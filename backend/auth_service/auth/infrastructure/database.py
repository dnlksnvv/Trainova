import logging
from typing import Dict, List, Any, Optional
import asyncpg
from asyncpg.pool import Pool
from auth.domain.db_constants import *
from config import settings

logger = logging.getLogger(__name__)

class Database:
    _instance = None
    _pool: Optional[Pool] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Database, cls).__new__(cls)
        return cls._instance

    async def connect(self) -> None:
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
        if self._pool:
            await self._pool.close()
            self._pool = None
            logger.info("Соединение с базой данных закрыто.")

    async def execute(self, query: str, *args, **kwargs) -> str:
        """
        Выполняет SQL запрос без возврата данных
        для INSERT, UPDATE, DELETE операций
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
        Возвращает список строк результата запроса
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
        Возвращает первую строку результата как словарь
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
        Возвращает значение из первой строки результата
        """
        if not self._pool:
            await self.connect()
        
        async with self._pool.acquire() as connection:
            try:
                return await connection.fetchval(query, *args, **kwargs)
            except Exception as e:
                logger.error(f"Ошибка при выполнении запроса {query}: {str(e)}")
                raise 