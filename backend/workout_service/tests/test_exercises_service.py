import pytest
import uuid
from unittest.mock import AsyncMock, patch
from typing import List, Dict, Any

from training.application.services.exercises_service import ExercisesService
from training.domain.schemas import Exercise, ExerciseCreate, ExerciseUpdate

# Тестовые данные
TEST_EXERCISE_ID = uuid.uuid4()
TEST_EXERCISE = {
    "exercise_id": str(TEST_EXERCISE_ID),
    "title": "Жим штанги лежа",
    "description": "Базовое упражнение для грудных мышц",
    "muscle_group_id": 1,
    "gif_uuid": None,
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
def exercises_service(mock_database):
    with patch('training.application.services.exercises_service.Database', return_value=mock_database):
        service = ExercisesService()
        service.db = mock_database
        yield service

@pytest.mark.asyncio
async def test_get_all_exercises(exercises_service):
    """Тест получения всех упражнений"""
    # Настройка мока
    exercises_service.db.fetch.return_value = [TEST_EXERCISE]
    
    # Вызов тестируемого метода
    result = await exercises_service.get_all_exercises()
    
    # Проверки
    assert exercises_service.db.fetch.called
    assert len(result) == 1
    assert str(result[0].exercise_id) == str(TEST_EXERCISE_ID)
    assert result[0].title == TEST_EXERCISE["title"]
    assert result[0].description == TEST_EXERCISE["description"]
    assert result[0].muscle_group_id == TEST_EXERCISE["muscle_group_id"]

@pytest.mark.asyncio
async def test_get_exercise_by_id(exercises_service):
    """Тест получения упражнения по ID"""
    # Настройка мока
    exercises_service.db.fetchrow.return_value = TEST_EXERCISE
    
    # Вызов тестируемого метода
    result = await exercises_service.get_exercise_by_id(TEST_EXERCISE_ID)
    
    # Проверки
    exercises_service.db.fetchrow.assert_called_once()
    assert result is not None
    assert str(result.exercise_id) == str(TEST_EXERCISE_ID)
    assert result.title == TEST_EXERCISE["title"]

@pytest.mark.asyncio
async def test_create_exercise(exercises_service):
    """Тест создания упражнения"""
    # Создаем данные для теста
    exercise_data = ExerciseCreate(
        title="Приседания со штангой",
        description="Базовое упражнение для ног",
        muscle_group_id=2,
        gif_uuid=None
    )
    
    # Настройка мока
    new_exercise = {
        "exercise_id": str(uuid.uuid4()),
        "title": exercise_data.title,
        "description": exercise_data.description,
        "muscle_group_id": exercise_data.muscle_group_id,
        "gif_uuid": exercise_data.gif_uuid,
        "created_at": "2023-01-02T12:00:00",
        "updated_at": "2023-01-02T12:00:00"
    }
    exercises_service.db.fetchrow.side_effect = [None, new_exercise]
    
    # Вызов тестируемого метода
    result = await exercises_service.create_exercise(exercise_data)
    
    # Проверки
    assert exercises_service.db.fetchrow.call_count == 2
    assert result is not None
    assert result.title == exercise_data.title
    assert result.description == exercise_data.description
    assert result.muscle_group_id == exercise_data.muscle_group_id

@pytest.mark.asyncio
async def test_update_exercise(exercises_service):
    """Тест обновления упражнения"""
    # Создаем данные для теста
    exercise_id = TEST_EXERCISE_ID
    update_data = ExerciseUpdate(
        title="Обновленное упражнение",
        description="Обновленное описание",
        muscle_group_id=3
    )
    
    # Настройка моков
    current_exercise = TEST_EXERCISE.copy()
    updated_exercise = current_exercise.copy()
    updated_exercise["title"] = update_data.title
    updated_exercise["description"] = update_data.description
    updated_exercise["muscle_group_id"] = update_data.muscle_group_id
    
    exercises_service.db.fetchrow.side_effect = [current_exercise, updated_exercise]
    
    # Вызов тестируемого метода
    result = await exercises_service.update_exercise(exercise_id, update_data)
    
    # Проверки
    assert exercises_service.db.fetchrow.call_count == 2
    assert result is not None
    assert result.title == update_data.title
    assert result.description == update_data.description
    assert result.muscle_group_id == update_data.muscle_group_id

@pytest.mark.asyncio
async def test_delete_exercise(exercises_service):
    """Тест удаления упражнения"""
    # Настройка мока
    exercises_service.db.fetchval.return_value = str(TEST_EXERCISE_ID) # Возвращаем ID удаленного упражнения
    
    # Вызов тестируемого метода
    result = await exercises_service.delete_exercise(TEST_EXERCISE_ID)
    
    # Проверки
    exercises_service.db.fetchval.assert_called_once()
    assert result is True  # Проверяем, что удаление прошло успешно 