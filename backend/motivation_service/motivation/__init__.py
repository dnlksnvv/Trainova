import logging
from fastapi import FastAPI

from motivation.application.services.motivation_service import MotivationService
from motivation.api.router import MotivationRouter

logger = logging.getLogger(__name__)

def create_motivation_router(motivation_service: MotivationService):
    """Создает роутер мотивации с переданным сервисом"""
    return MotivationRouter(motivation_service).router

# Создаем заглушечный роутер для инициализации
motivation_service = MotivationService()
router = MotivationRouter(motivation_service).router 