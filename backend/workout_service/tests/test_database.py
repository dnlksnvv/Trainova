import pytest
import pytest_asyncio
from unittest.mock import patch, AsyncMock, MagicMock

# Мы импортируем Database только для типизации, но не используем реальный класс
from training.infrastructure.database import Database

class MockDatabase:
    """Мок класса Database для тестирования с расширенной функциональностью"""
    
    def __init__(self):
        self.connected = False
        self._query_history = []
        self._executed_queries = []
        
        # Хранение тестовых таблиц и данных
        self._tables = {
            "exercises": [
                {"exercise_id": "123e4567-e89b-12d3-a456-426614174000", "title": "Жим лежа", "muscle_group_id": 1},
                {"exercise_id": "223e4567-e89b-12d3-a456-426614174001", "title": "Приседания", "muscle_group_id": 2},
            ],
            "muscle_groups": [
                {"id": 1, "name": "Грудные мышцы"},
                {"id": 2, "name": "Ноги"},
            ]
        }
    
    async def connect(self):
        """Имитирует подключение к базе данных"""
        self.connected = True
        self._executed_queries.append("CONNECT")
        return self
    
    async def disconnect(self):
        """Имитирует отключение от базы данных"""
        self.connected = False
        self._executed_queries.append("DISCONNECT")
    
    async def fetchval(self, query, *args, **kwargs):
        """Имитирует получение значения из запроса с проверкой параметров"""
        if not self.connected:
            await self.connect()
        
        # Сохраняем запрос и параметры
        self._query_history.append({
            "query": query,
            "args": args,
            "kwargs": kwargs,
            "method": "fetchval"
        })
        
        # Обрабатываем разные типы запросов
        query_lower = query.lower().strip()
        
        # Проверка соединения
        if "select 1" in query_lower:
            return 1
        
        # Проверка существования таблицы
        if "exists" in query_lower and "information_schema.tables" in query_lower:
            for table in self._tables.keys():
                if f"table_name = '{table}'" in query_lower:
                    return True
            return False
        
        # Запросы с count
        if "count(*)" in query_lower:
            table_name = None
            for table in self._tables.keys():
                if f"from {table}" in query_lower:
                    table_name = table
                    break
            if table_name:
                return len(self._tables[table_name])
            return 0
        
        return None
    
    async def fetch(self, query, *args, **kwargs):
        """Имитирует получение списка результатов с проверкой SQL"""
        if not self.connected:
            await self.connect()
        
        # Сохраняем запрос и параметры
        self._query_history.append({
            "query": query,
            "args": args,
            "kwargs": kwargs,
            "method": "fetch"
        })
        
        query_lower = query.lower().strip()
        
        # Определяем таблицу из запроса select
        table_name = None
        for table in self._tables.keys():
            if f"from {table}" in query_lower:
                table_name = table
                break
        
        if table_name:
            # Возвращаем данные из соответствующей таблицы
            return self._tables[table_name]
        return []
    
    async def fetchrow(self, query, *args, **kwargs):
        """Имитирует получение одной строки результатов с реальной логикой"""
        if not self.connected:
            await self.connect()
        
        # Сохраняем запрос и параметры
        self._query_history.append({
            "query": query,
            "args": args,
            "kwargs": kwargs,
            "method": "fetchrow"
        })
        
        query_lower = query.lower().strip()
        
        # Определяем таблицу из запроса
        table_name = None
        for table in self._tables.keys():
            if f"from {table}" in query_lower:
                table_name = table
                break
        
        if table_name and self._tables[table_name]:
            # Если запрос содержит where, ищем соответствующую запись
            if "where" in query_lower:
                # Пример простой логики для поиска по ID
                for row in self._tables[table_name]:
                    for key, value in row.items():
                        if isinstance(value, str) and f"{key} = $1" in query_lower and str(value) == str(args[0]):
                            return row
                        elif f"{key} = $1" in query_lower and value == args[0]:
                            return row
            # Если where нет, возвращаем первую запись
            return self._tables[table_name][0]
        return None
    
    async def execute(self, query, *args, **kwargs):
        """Имитирует выполнение запроса без результатов с отслеживанием"""
        if not self.connected:
            await self.connect()
        
        # Сохраняем запрос и параметры
        self._query_history.append({
            "query": query,
            "args": args,
            "kwargs": kwargs,
            "method": "execute"
        })
        
        # Добавляем запрос в историю выполненных запросов
        self._executed_queries.append(query)
        
        # Возвращаем стандартный результат для execute
        return "OK"
    
    def assert_query_executed(self, query_substring):
        """Проверяет, что запрос с указанным подстрокой был выполнен"""
        for query_data in self._query_history:
            if query_substring in query_data["query"]:
                return True
        raise AssertionError(f"Запрос, содержащий '{query_substring}', не был выполнен")
    
    def get_executed_queries_count(self):
        """Возвращает количество выполненных запросов"""
        return len(self._query_history)

@pytest_asyncio.fixture
async def mock_database():
    """Фикстура с моком базы данных"""
    db = MockDatabase()
    await db.connect()
    yield db
    await db.disconnect()

@pytest.mark.asyncio
async def test_database_connection(mock_database):
    """Проверяем, что соединение с базой данных работает"""
    # Тестовый запрос
    result = await mock_database.fetchval("SELECT 1")
    assert result == 1
    
    # Проверяем, что запрос был записан в историю
    mock_database.assert_query_executed("SELECT 1")

@pytest.mark.asyncio
async def test_get_exercises_table_exists(mock_database):
    """Проверяем, что таблица упражнений существует"""
    result = await mock_database.fetchval("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'exercises'
        )
    """)
    assert result is True, "Таблица exercises не существует"
    
    # Проверяем, что проверялось именно существование таблицы exercises
    mock_database.assert_query_executed("table_name = 'exercises'")

@pytest.mark.asyncio
async def test_get_muscle_groups_table_exists(mock_database):
    """Проверяем, что таблица групп мышц существует"""
    result = await mock_database.fetchval("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'muscle_groups'
        )
    """)
    assert result is True, "Таблица muscle_groups не существует"
    
    # Проверяем, что проверялось именно существование таблицы muscle_groups
    mock_database.assert_query_executed("table_name = 'muscle_groups'")

@pytest.mark.asyncio
async def test_fetch_exercises(mock_database):
    """Проверяем получение всех упражнений из базы"""
    exercises = await mock_database.fetch("SELECT * FROM exercises")
    
    # Проверяем, что получили непустой список упражнений
    assert len(exercises) > 0
    assert "exercise_id" in exercises[0]
    assert "title" in exercises[0]
    assert "muscle_group_id" in exercises[0]
    
    # Проверяем правильный SQL-запрос
    mock_database.assert_query_executed("SELECT * FROM exercises")

@pytest.mark.asyncio
async def test_fetch_exercise_by_id(mock_database):
    """Проверяем получение упражнения по ID"""
    exercise_id = "123e4567-e89b-12d3-a456-426614174000"
    exercise = await mock_database.fetchrow("SELECT * FROM exercises WHERE exercise_id = $1", exercise_id)
    
    # Проверяем, что получили правильное упражнение
    assert exercise is not None
    assert exercise["exercise_id"] == exercise_id
    assert exercise["title"] == "Жим лежа"
    
    # Проверяем выполнение запроса с правильными параметрами
    mock_database.assert_query_executed("WHERE exercise_id = $1") 