from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str
    DEBUG: bool

    JWT_SECRET: str
    JWT_ALGORITHM: str
    
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str 
    DB_PORT: int
    
    SERVER_HOST: str
    SERVER_PORT: int
    
    API_PREFIX: str
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
