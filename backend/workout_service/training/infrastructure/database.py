import logging
from typing import Dict, List, Any, Optional
import asyncpg
from asyncpg.pool import Pool
from training.domain.db_constants import *
from config import settings

# Настройка логгера
logger = logging.getLogger(__name__)

class Database:
    """
    Класс для асинхронной работы с базой данных PostgreSQL
    """
    _instance = None
    _pool: Optional[Pool] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Database, cls).__new__(cls)
        return cls._instance

    async def connect(self) -> None:
        """
        Создает пул соединений с базой данных.
        """
        if self._pool is None:
            try:
                logger.info("Подключение к базе данных...")
                self._pool = await asyncpg.create_pool(
                    user=settings.DB_USER,
                    password=settings.DB_PASSWORD,
                    host=settings.DB_HOST,
                    port=settings.DB_PORT,
                    database=settings.DB_NAME
                )
                logger.info("Подключение к базе данных успешно установлено.")
            except Exception as e:
                logger.error(f"Ошибка при подключении к базе данных: {str(e)}")
                raise

    async def disconnect(self) -> None:
        """
        Закрывает пул соединений с базой данных.
        """
        if self._pool:
            await self._pool.close()
            self._pool = None
            logger.info("Соединение с базой данных закрыто.")

    async def execute(self, query: str, *args, **kwargs) -> str:
        """
        Выполняет SQL-запрос, который не возвращает результатов.
        
        Args:
            query: SQL-запрос
            args: Позиционные аргументы для запроса
            
        Returns:
            Статус выполнения запроса
        """
        if not self._pool:
            await self.connect()
        
        async with self._pool.acquire() as connection:
            try:
                return await connection.execute(query, *args, **kwargs)
            except Exception as e:
                logger.error(f"Ошибка при выполнении запроса {query}: {str(e)}")
                raise

    async def fetch(self, query: str, *args, **kwargs) -> List[Dict[str, Any]]:
        """
        Выполняет SQL-запрос и возвращает список результатов.
        
        Args:
            query: SQL-запрос
            args: Позиционные аргументы для запроса
            
        Returns:
            Список результатов запроса
        """
        if not self._pool:
            await self.connect()
        
        async with self._pool.acquire() as connection:
            try:
                rows = await connection.fetch(query, *args, **kwargs)
                return [dict(row) for row in rows]
            except Exception as e:
                logger.error(f"Ошибка при выполнении запроса {query}: {str(e)}")
                raise

    async def fetchrow(self, query: str, *args, **kwargs) -> Optional[Dict[str, Any]]:
        """
        Выполняет SQL-запрос и возвращает первую строку результата.
        
        Args:
            query: SQL-запрос
            args: Позиционные аргументы для запроса
            
        Returns:
            Первая строка результата или None, если результат пустой
        """
        if not self._pool:
            await self.connect()
        
        async with self._pool.acquire() as connection:
            try:
                row = await connection.fetchrow(query, *args, **kwargs)
                return dict(row) if row else None
            except Exception as e:
                logger.error(f"Ошибка при выполнении запроса {query}: {str(e)}")
                raise

    async def fetchval(self, query: str, *args, **kwargs) -> Any:
        """
        Выполняет SQL-запрос и возвращает одно значение.
        
        Args:
            query: SQL-запрос
            args: Позиционные аргументы для запроса
            
        Returns:
            Одно значение или None, если результат пустой
        """
        if not self._pool:
            await self.connect()
        
        async with self._pool.acquire() as connection:
            try:
                return await connection.fetchval(query, *args, **kwargs)
            except Exception as e:
                logger.error(f"Ошибка при выполнении запроса {query}: {str(e)}")
                raise
