import pytest
from unittest.mock import patch, AsyncMock, MagicMock
import uuid
import json

from training.api.router import TrainingRouter
from training.domain.schemas import Exercise, MuscleGroupModel

# Тестовые данные
TEST_EXERCISE_ID = uuid.uuid4()
TEST_MUSCLE_GROUP_ID = 1

# Тестовые данные для упражнений
TEST_EXERCISE = {
    "exercise_id": str(TEST_EXERCISE_ID),
    "title": "Жим штанги лежа",
    "description": "Базовое упражнение для грудных мышц",
    "muscle_group_id": TEST_MUSCLE_GROUP_ID,
    "gif_uuid": None,
    "created_at": "2023-01-01T12:00:00",
    "updated_at": "2023-01-01T12:00:00"
}

# Тестовые данные для групп мышц
TEST_MUSCLE_GROUP = {
    "id": TEST_MUSCLE_GROUP_ID,
    "name": "Грудные мышцы",
    "created_at": "2023-01-01T12:00:00",
    "updated_at": "2023-01-01T12:00:00"
}

# Тесты методов роутера напрямую
@pytest.mark.asyncio
async def test_get_exercises():
    """Тест получения списка упражнений"""
    # Создаем моки для сервисов
    exercises_service = MagicMock()
    exercises_service.get_all_exercises = AsyncMock(return_value=[Exercise(**TEST_EXERCISE)])
    
    # Остальные сервисы тоже нужно создать, т.к. они требуются для TrainingRouter
    training_service = MagicMock()
    admin_service = MagicMock()
    muscle_groups_service = MagicMock()
    activity_service = MagicMock()
    
    # Создаем роутер с моками
    router = TrainingRouter(
        exercises_service, 
        training_service, 
        admin_service,
        muscle_groups_service,
        activity_service
    )
    
    # Тестируем метод напрямую
    result = await router.get_exercises()
    
    # Проверки
    assert isinstance(result, list)
    assert len(result) == 1
    assert str(result[0].exercise_id) == str(TEST_EXERCISE_ID)
    assert result[0].title == TEST_EXERCISE["title"]
    assert result[0].description == TEST_EXERCISE["description"]

@pytest.mark.asyncio
async def test_get_exercise_by_id():
    """Тест получения упражнения по ID"""
    # Создаем моки для сервисов
    exercises_service = MagicMock()
    exercises_service.get_exercise_by_id = AsyncMock(return_value=Exercise(**TEST_EXERCISE))
    
    # Остальные сервисы
    training_service = MagicMock()
    admin_service = MagicMock()
    muscle_groups_service = MagicMock()
    activity_service = MagicMock()
    
    # Создаем роутер с моками
    router = TrainingRouter(
        exercises_service, 
        training_service, 
        admin_service,
        muscle_groups_service,
        activity_service
    )
    
    # Тестируем метод напрямую
    result = await router.get_exercise(TEST_EXERCISE_ID)
    
    # Проверки
    assert result is not None
    assert str(result.exercise_id) == str(TEST_EXERCISE_ID)
    assert result.title == TEST_EXERCISE["title"]
    assert result.description == TEST_EXERCISE["description"]

@pytest.mark.asyncio
async def test_get_muscle_groups():
    """Тест получения групп мышц"""
    # Создаем моки для сервисов
    muscle_groups_service = MagicMock()
    muscle_groups_service.get_all_muscle_groups = AsyncMock(
        return_value=[MuscleGroupModel(**TEST_MUSCLE_GROUP)]
    )
    
    # Остальные сервисы
    exercises_service = MagicMock()
    training_service = MagicMock()
    admin_service = MagicMock()
    activity_service = MagicMock()
    
    # Создаем роутер с моками
    router = TrainingRouter(
        exercises_service, 
        training_service, 
        admin_service,
        muscle_groups_service,
        activity_service
    )
    
    # Тестируем метод напрямую
    result = await router.get_muscle_groups()
    
    # Проверки
    assert isinstance(result, list)
    assert len(result) == 1
    assert result[0].id == TEST_MUSCLE_GROUP["id"]
    assert result[0].name == TEST_MUSCLE_GROUP["name"] 