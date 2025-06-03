import logging
import asyncpg
from typing import Optional, Any
from contextlib import asynccontextmanager
from config import settings
from ..domain.db_constants import (
    CREATE_COURSES_TABLE,
    CREATE_COURSE_ENROLLMENTS_TABLE,
    CREATE_COURSE_REVIEWS_TABLE
)

logger = logging.getLogger(__name__)


class Database:
    """Класс для управления подключением к базе данных"""
    
    _instance: Optional['Database'] = None
    _pool: Optional[asyncpg.Pool] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Database, cls).__new__(cls)
        return cls._instance
    
    async def connect(self):
        """Создание пула соединений с базой данных"""
        if self._pool is None:
            try:
                # Создаем пул соединений
                self._pool = await asyncpg.create_pool(
                    host=settings.DB_HOST,
                    port=settings.DB_PORT,
                    user=settings.DB_USER,
                    password=settings.DB_PASSWORD,
                    database=settings.DB_NAME,
                    min_size=5,
                    max_size=20
                )
                
                logger.info("Пул соединений с базой данных создан")
                
                # Создаем таблицы если их нет
                await self._create_tables()
                
            except Exception as e:
                logger.error(f"Ошибка при создании пула соединений: {str(e)}")
                raise
    
    async def disconnect(self):
        """Закрытие пула соединений с базой данных"""
        if self._pool:
            await self._pool.close()
            self._pool = None
            logger.info("Пул соединений с базой данных закрыт")
    
    async def execute(self, query: str, *args):
        """Выполнение запроса на изменение данных"""
        if not self._pool:
            raise RuntimeError("Пул соединений не создан. Вызовите connect() сначала.")
        
        async with self._pool.acquire() as connection:
            return await connection.execute(query, *args)
    
    async def fetch_one(self, query: str, *args):
        """Выполнение запроса и получение одной записи"""
        if not self._pool:
            raise RuntimeError("Пул соединений не создан. Вызовите connect() сначала.")
        
        async with self._pool.acquire() as connection:
            return await connection.fetchrow(query, *args)
    
    async def fetch_all(self, query: str, *args):
        """Выполнение запроса и получение всех записей"""
        if not self._pool:
            raise RuntimeError("Пул соединений не создан. Вызовите connect() сначала.")
        
        async with self._pool.acquire() as connection:
            return await connection.fetch(query, *args)
    
    async def fetch_val(self, query: str, *args) -> Any:
        """Выполнение запроса и получение одного значения"""
        if not self._pool:
            raise RuntimeError("Пул соединений не создан. Вызовите connect() сначала.")
        
        async with self._pool.acquire() as connection:
            result = await connection.fetchval(query, *args)
            return result
    
    @asynccontextmanager
    async def transaction(self):
        """Создание контекстного менеджера для транзакции"""
        if not self._pool:
            raise RuntimeError("Пул соединений не создан. Вызовите connect() сначала.")
        
        connection = await self._pool.acquire()
        transaction = connection.transaction()
        await transaction.start()
        
        try:
            yield connection
            await transaction.commit()
        except Exception:
            await transaction.rollback()
            raise
        finally:
            await self._pool.release(connection)
    
    @property
    def pool(self) -> asyncpg.Pool:
        """Получение пула соединений"""
        if self._pool is None:
            raise RuntimeError("Пул соединений не создан. Вызовите connect() сначала.")
        return self._pool
    
    async def _create_tables(self):
        """Создание таблиц если их нет"""
        if not self._pool:
            return
            
        try:
            async with self._pool.acquire() as connection:
                # Создаем дополнительные таблицы (courses уже создается в init-db.sql)
                await connection.execute(CREATE_COURSES_TABLE)
                await connection.execute(CREATE_COURSE_ENROLLMENTS_TABLE) 
                await connection.execute(CREATE_COURSE_REVIEWS_TABLE)
                
                # Создаем дополнительные индексы для enrollments и reviews
                await connection.execute("""
                    CREATE INDEX IF NOT EXISTS idx_enrollments_course_uuid 
                    ON course_enrollments(course_uuid);
                """)
                await connection.execute("""
                    CREATE INDEX IF NOT EXISTS idx_enrollments_user_id 
                    ON course_enrollments(user_id);
                """)
                await connection.execute("""
                    CREATE INDEX IF NOT EXISTS idx_reviews_course_uuid 
                    ON course_reviews(course_uuid);
                """)
                await connection.execute("""
                    CREATE INDEX IF NOT EXISTS idx_reviews_user_id 
                    ON course_reviews(user_id);
                """)
                
                logger.info("Дополнительные таблицы и индексы созданы успешно")
            
        except Exception as e:
            logger.error(f"Ошибка при создании таблиц: {str(e)}")
            raise 