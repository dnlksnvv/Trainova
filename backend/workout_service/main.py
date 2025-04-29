from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
import logging
import sys
import jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from training import router as training_router
from training.infrastructure.database import Database
from training.domain.utils import verify_token
from config import settings

# Настройка логгирования
logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("main")

# Middleware для аутентификации
class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Исключения для путей, не требующих аутентификации
        no_auth_paths = [
            "/",
            "/docs",
            "/openapi.json",
            "/redoc"
        ]
        
        if request.url.path in no_auth_paths:
            return await call_next(request)
        
        try:
            auth_header = request.headers.get("Authorization")
            if auth_header:
                token_type, token = auth_header.split()
                if token_type.lower() == "bearer":
                    try:
                        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
                        request.state.user = payload
                    except jwt.PyJWTError as e:
                        logger.warning(f"Invalid token: {str(e)}")
        except Exception as e:
            logger.warning(f"Auth middleware error: {str(e)}")
        

        return await call_next(request)

app = FastAPI(
    title="Trainova Training Service API",
    description="API для управления тренировками и упражнениями в приложении Trainova",
    version="1.0.0"
)


app.add_middleware(AuthMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В рабочем окружении указать конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Обработка исключений
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

# Подключаем роутеры
app.include_router(training_router)

# Корневой маршрут - информация об API
@app.get("/")
def read_root():
    return {
        "name": "Trainova Training Service API",
        "version": "1.0.0",
        "description": "API для управления тренировками и упражнениями в приложении Trainova",
        "docs_url": "/docs"
    }

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT"
        }
    }
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

@app.on_event("startup")
async def startup_event():
    logger.info("Приложение запущено")
    db = Database()
    try:
        await db.connect()
        logger.info("Соединение с базой данных установлено")
    except Exception as e:
        logger.error(f"Ошибка при подключении к базе данных: {str(e)}")

@app.on_event("shutdown")
async def shutdown_event():
    db = Database()
    try:
        await db.disconnect()
        logger.info("Соединение с базой данных закрыто")
    except Exception as e:
        logger.error(f"Ошибка при закрытии соединения с базой данных: {str(e)}")
    
    logger.info("Приложение остановлено")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app", 
        host=settings.SERVER_HOST, 
        port=settings.SERVER_PORT, 
        reload=settings.DEBUG
    )
