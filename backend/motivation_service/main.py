from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
import logging
import sys
import jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import asyncio
from datetime import datetime, timezone

from motivation.infrastructure.database import Database
from motivation.infrastructure.repository import MotivationRepository
from motivation.application.services.motivation_service import MotivationService
from motivation.api.router import MotivationRouter
from background_worker import MotivationWorker
from config import settings

logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Глобальные переменные для сервисов
database = None
motivation_service = None
background_worker = None
worker_task = None

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time_utc = datetime.now(timezone.utc)
        
        # Пропускаем health check и docs
        if request.url.path in ["/health", "/docs", "/openapi.json"]:
            response = await call_next(request)
            return response
        
        # Извлекаем токен из заголовка Authorization
        auth_header = request.headers.get("Authorization")
        
        if not auth_header or not auth_header.startswith("Bearer "):
            logger.warning(f"🔒 Отсутствует токен авторизации для {request.url.path} (UTC: {start_time_utc})")
            return JSONResponse(
                status_code=401,
                content={"detail": "Отсутствует токен авторизации"}
            )
        
        token = auth_header.replace("Bearer ", "")
        
        try:
            # Декодируем JWT токен (без проверки подписи для простоты)
            payload = jwt.decode(token, options={"verify_signature": False})
            
            # Добавляем данные пользователя в состояние запроса
            request.state.user = {
                "user_id": payload.get("user_id"),
                "email": payload.get("email")
            }
            
            auth_time_utc = datetime.now(timezone.utc)
            logger.debug(f"🔓 Аутентификация успешна для user_id={payload.get('user_id')} (UTC: {auth_time_utc})")
            
        except jwt.InvalidTokenError as e:
            error_time_utc = datetime.now(timezone.utc)
            logger.warning(f"🔒 Недействительный токен для {request.url.path} (UTC: {error_time_utc}): {str(e)}")
            return JSONResponse(
                status_code=401,
                content={"detail": "Недействительный токен"}
            )
        
        response = await call_next(request)
        return response

def create_application() -> FastAPI:
    application = FastAPI(
        title="Motivation Service",
        description="Сервис мотивации для фитнес приложения",
        version="1.0.0"
    )
    
    # Настройка CORS
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # В продакшене указать конкретные домены
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Добавляем middleware для аутентификации
    application.add_middleware(AuthMiddleware)
    
    return application

app = create_application()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    current_time_utc = datetime.now(timezone.utc)
    return {
        "status": "healthy", 
        "service": "motivation_service",
        "timestamp_utc": current_time_utc.isoformat()
    }

@app.on_event("startup")
async def startup_event():
    global database, motivation_service, background_worker, worker_task
    
    start_time_utc = datetime.now(timezone.utc)
    
    try:
        logger.info(f"Motivation Service запущен в UTC: {start_time_utc}")
        
        # Инициализация базы данных
        database = Database()
        await database.connect()
        
        db_connected_utc = datetime.now(timezone.utc)
        logger.info(f"Соединение с базой данных установлено (UTC: {db_connected_utc})")
        
        # Проверяем что pool успешно создан
        if database.pool is None:
            raise Exception("Не удалось создать пул соединений с базой данных")
        
        # Инициализация сервиса мотивации
        motivation_repository = MotivationRepository(database.pool)
        motivation_service = MotivationService()
        motivation_service.set_repository(motivation_repository)
        
        # Создание роутера с сервисом
        motivation_router = MotivationRouter(motivation_service)
        app.include_router(motivation_router.router)
        
        service_init_utc = datetime.now(timezone.utc)
        logger.info(f"Сервис мотивации инициализирован (UTC: {service_init_utc})")
        
        # Запуск background worker (только если pool создан)
        if database.pool:
            background_worker = MotivationWorker(database.pool)
            worker_task = asyncio.create_task(background_worker.start())
            
            worker_start_utc = datetime.now(timezone.utc)
            logger.info(f"Background Worker запущен (UTC: {worker_start_utc})")
            
        complete_time_utc = datetime.now(timezone.utc)
        startup_duration = (complete_time_utc - start_time_utc).total_seconds()
        logger.info(f"✅ Запуск завершен за {startup_duration:.2f} сек (UTC: {complete_time_utc})")
        
    except Exception as e:
        error_time_utc = datetime.now(timezone.utc)
        logger.error(f"Ошибка при запуске сервиса в UTC {error_time_utc}: {str(e)}")
        raise e

@app.on_event("shutdown")
async def shutdown_event():
    global database, background_worker, worker_task
    
    shutdown_start_utc = datetime.now(timezone.utc)
    
    try:
        logger.info(f"Начинаем остановку сервиса (UTC: {shutdown_start_utc})")
        
        # Остановка background worker
        if background_worker:
            await background_worker.stop()
        
        if worker_task:
            worker_task.cancel()
            try:
                await worker_task
            except asyncio.CancelledError:
                pass
        
        worker_stop_utc = datetime.now(timezone.utc)
        logger.info(f"Background Worker остановлен (UTC: {worker_stop_utc})")
        
        # Закрытие соединения с базой данных
        if database:
            await database.disconnect()
            
            db_disconnect_utc = datetime.now(timezone.utc)
            logger.info(f"Соединение с базой данных закрыто (UTC: {db_disconnect_utc})")
        
        shutdown_complete_utc = datetime.now(timezone.utc)
        shutdown_duration = (shutdown_complete_utc - shutdown_start_utc).total_seconds()
        logger.info(f"✅ Остановка завершена за {shutdown_duration:.2f} сек (UTC: {shutdown_complete_utc})")
        
    except Exception as e:
        error_time_utc = datetime.now(timezone.utc)
        logger.error(f"Ошибка при остановке сервиса в UTC {error_time_utc}: {str(e)}")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_time_utc = datetime.now(timezone.utc)
    logger.error(f"Необработанная ошибка в UTC {error_time_utc}: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Внутренняя ошибка сервера",
            "timestamp_utc": error_time_utc.isoformat()
        }
    )

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="Motivation Service API",
        version="1.0.0",
        description="API для сервиса мотивации",
        routes=app.routes,
    )
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

if __name__ == "__main__":
    import uvicorn
    startup_utc = datetime.now(timezone.utc)
    logger.info(f"🚀 Запуск Motivation Service в UTC: {startup_utc}")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8008,
        reload=settings.DEBUG,
        log_level="info" if settings.DEBUG else "warning"
    ) 