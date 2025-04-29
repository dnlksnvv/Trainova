import pytest
import uuid
from unittest.mock import AsyncMock, patch, MagicMock
from typing import List, Dict, Any
from datetime import datetime

from training.application.services.training_service import TrainingService
from training.domain.schemas import Training, TrainingCreate, DifficultyLevel, TrainingExercise

# Тестовые данные
TEST_TRAINING_ID = 1
TEST_USER_ID = 12345

TEST_TRAINING = {
    "id": TEST_TRAINING_ID,
    "name": "Тренировка для начинающих",
    "description": "Базовая тренировка для новичков",
    "duration": 45,
    "difficulty": "beginner",
    "created_by": TEST_USER_ID,
    "is_public": True,
    "exercises": [],
    "created_at": "2023-01-01T12:00:00",
    "updated_at": "2023-01-01T12:00:00"
}

# Фикстура для мока базы данных
@pytest.fixture
def mock_database():
    with patch('training.infrastructure.database.Database') as mock:
        db_instance = mock.return_value
        db_instance.fetch = AsyncMock()
        db_instance.fetchrow = AsyncMock()
        db_instance.execute = AsyncMock()
        db_instance.fetchval = AsyncMock()
        yield db_instance

# Фикстура для создания сервиса с моком базы данных
@pytest.fixture
def training_service(mock_database):
    with patch('training.application.services.training_service.Database', return_value=mock_database):
        service = TrainingService()
        service.db = mock_database
        yield service

@pytest.mark.asyncio
async def test_get_trainings(training_service):
    """Тест получения списка тренировок"""
    # Настройка мока для вызова базы данных
    training_service.db.fetch.return_value = [TEST_TRAINING]
    
    # Патчим метод _get_training_exercises, который вызывается внутри get_all_trainings
    with patch.object(training_service, '_get_training_exercises', return_value=[]):
        # Вызов тестируемого метода - передаем user_id для избежания фильтрации по public
        result = await training_service.get_all_trainings(user_id=TEST_USER_ID)
        
        # Проверки
        assert training_service.db.fetch.called
        assert len(result) == 1
        assert result[0].id == TEST_TRAINING["id"]
        assert result[0].name == TEST_TRAINING["name"]
        assert result[0].description == TEST_TRAINING["description"]

@pytest.mark.asyncio
async def test_get_training_by_id(training_service):
    """Тест получения тренировки по ID"""
    # Настройка мока
    training_service.db.fetchrow.return_value = TEST_TRAINING
    
    # Патчим метод _get_training_exercises, который вызывается внутри get_training_by_id
    with patch.object(training_service, '_get_training_exercises', return_value=[]):
        # Вызов тестируемого метода - передаем user_id для избежания фильтрации по public
        result = await training_service.get_training_by_id(TEST_TRAINING_ID, user_id=TEST_USER_ID)
        
        # Проверки
        training_service.db.fetchrow.assert_called_once()
        assert result is not None
        assert result.id == TEST_TRAINING["id"]
        assert result.name == TEST_TRAINING["name"]

# Тест get_user_trainings требует больше настройки, т.к. в нем происходит обработка строк из БД
# Его лучше оставить для интеграционного тестирования 