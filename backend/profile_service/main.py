from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
import logging
import uvicorn
import os
import json
from decimal import Decimal

from profile.api.router import ProfileRouter
from profile.application.services.token_service import TokenService
from profile.application.profile_service import ProfileServiceImpl
from profile.infrastructure.auth_middleware import TokenValidationMiddleware
from profile.infrastructure.database import Database
from profile.infrastructure.profile_repository import ProfileRepository
from config import settings

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Кастомный JSON encoder для правильной сериализации Decimal
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)

# Кастомная функция для обработки ответов
def custom_jsonable_encoder(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    return jsonable_encoder(obj)

# Создание директорий для загрузки файлов
os.makedirs(settings.UPLOAD_FOLDER, exist_ok=True)
avatar_dir = os.path.join(settings.UPLOAD_FOLDER, "avatars")
os.makedirs(avatar_dir, exist_ok=True)
logger.info(f"Директории для загрузки файлов созданы: {settings.UPLOAD_FOLDER}")

app = FastAPI(
    title="Profile Service",
    description="Сервис для управления профилями пользователей",
    version="1.0.0"
)

# Переопределяем стандартный JSONResponse для использования кастомного encoder
original_json_response = JSONResponse

class CustomJSONResponse(JSONResponse):
    def render(self, content) -> bytes:
        return json.dumps(
            content,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
            cls=CustomJSONEncoder,
        ).encode("utf-8")

# Заменяем стандартный JSONResponse на кастомный
JSONResponse = CustomJSONResponse

# Настройка статических файлов
app.mount(f"{settings.PROFILE_API_PREFIX}{settings.UPLOADS_PATH}", StaticFiles(directory=settings.UPLOAD_FOLDER), name="uploads")

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Инициализация зависимостей
db = Database()
profile_repository = ProfileRepository()
token_service = TokenService()
profile_service = ProfileServiceImpl(profile_repository)

excluded_paths = ["/docs", "/redoc", "/openapi.json", "/", "/health", f"{settings.PROFILE_API_PREFIX}/webhook/yookassa"]
app.add_middleware(
    TokenValidationMiddleware,
    token_service=token_service,
    excluded_paths=excluded_paths
)

# Создание и подключение роутера
profile_router = ProfileRouter(profile_service)
app.include_router(profile_router.router)

@app.get("/")
async def root():
    return {"message": "Profile Service API"}

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "profile"}

@app.on_event("startup")
async def startup_event():
    """Действия при запуске приложения"""
    try:
        # Подключение к базе данных
        await db.connect()
        logger.info("Соединение с базой данных установлено")
    except Exception as e:
        logger.error(f"Ошибка при подключении к базе данных: {str(e)}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Действия при остановке приложения"""
    try:
        # Закрытие соединения с базой данных
        await db.disconnect()
        logger.info("Соединение с базой данных закрыто")
    except Exception as e:
        logger.error(f"Ошибка при закрытии соединения с базой данных: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    ) 