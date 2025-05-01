from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    WORKOUT_API_PREFIX: str
    APP_NAME: str = "Trainova Workout Service"
    DEBUG: bool

    JWT_SECRET: str
    JWT_ALGORITHM: str
    
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_PORT: int

    
    
    class Config:
        env_file = os.environ.get("CONFIG_FILE", ".env")
        case_sensitive = False
        extra = "ignore"


settings = Settings()
