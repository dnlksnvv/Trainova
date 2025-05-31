from pydantic_settings import BaseSettings
from typing import List, Optional, Set
import os


class Settings(BaseSettings):
    APP_NAME: str = "Trainova Profile Service"
    DEBUG: bool = False
    FRONTEND_URL: str = "http://localhost:3000"
    PROFILE_API_PREFIX: str
    
    # JWT Configuration для локальной проверки токенов
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_SECONDS: int = 3600
    REFRESH_TOKEN_EXPIRE_SECONDS: int = 604800
    RESET_PASSWORD_TOKEN_EXPIRE_MINUTES: int = 30
    
    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: str
    MAIL_PORT: int
    MAIL_SERVER: str
    MAIL_FROM_NAME: str
    MAIL_STARTTLS: bool
    MAIL_SSL_TLS: bool
    USE_CREDENTIALS: bool
    VALIDATE_CERTS: bool
    
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_PORT: int
    
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000"]
    
    UPLOAD_FOLDER: str = os.path.join(os.path.dirname(__file__), "uploads")
    MAX_CONTENT_LENGTH: int = 16 * 1024 * 1024
    ALLOWED_EXTENSIONS: Set[str] = {"png", "jpg", "jpeg", "gif"}
    
    AUTH_SERVICE_URL: str = "http://localhost:8000/api/auth"
    
    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8005
    
    # Пути для файлов
    UPLOADS_PATH: str = "/uploads"
    AVATARS_PATH: str = "/uploads/avatars"
    
    # YooKassa configuration
    YOOKASSA_ACCOUNT_ID: str
    YOOKASSA_SECRET_KEY: str
    
    class Config:
        env_file = "../../docker/.env"
        case_sensitive = False
        extra = "ignore"


settings = Settings() 