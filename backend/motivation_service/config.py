from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    MOTIVATION_API_PREFIX: str
    APP_NAME: str = "Trainova Motivation Service"
    DEBUG: bool = True

    JWT_SECRET: str
    JWT_ALGORITHM: str
    
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_PORT: int
    
    API_KEY: str 
    API_URL: str
    MODEL: str
    
    
    class Config:
        env_file = "../../docker/.env"
        case_sensitive = False
        extra = "ignore"


settings = Settings() 