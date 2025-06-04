from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    APP_NAME: str = "Trainova Comment Service"
    
    DEBUG: bool = True
    FRONTEND_URL: str
    
    JWT_SECRET: str
    JWT_ALGORITHM: str
    
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_PORT: int
    
    # Настройки для формирования URL аватарок
    PROFILE_API_PREFIX: str
    AVATARS_PATH: str = "/uploads/avatars"
    
    class Config:
        env_file = "../../docker/.env"
        case_sensitive = False
        extra = "ignore"


settings = Settings() 