import asyncpg
import logging
from typing import Dict, List, Any, Optional
from config import settings

logger = logging.getLogger(__name__)

class Database:
    _instance = None
    _pool = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Database, cls).__new__(cls)
        return cls._instance
    
    async def connect(self) -> None:
        if self._pool is None:
            try:
                logger.info(f"Подключение к базе данных {settings.DB_NAME} на {settings.DB_HOST}:{settings.DB_PORT}")
                
                self._pool = await asyncpg.create_pool(
                    user=settings.DB_USER,
                    password=settings.DB_PASSWORD,
                    database=settings.DB_NAME,
                    host=settings.DB_HOST,
                    port=settings.DB_PORT,
                    min_size=5,
                    max_size=20
                )
                
                logger.info("Соединение с базой данных установлено успешно")
            except Exception as e:
                logger.error(f"Ошибка при подключении к базе данных: {str(e)}")
                raise
    
    async def disconnect(self) -> None:
        if self._pool:
            await self._pool.close()
            self._pool = None
            logger.info("Соединение с базой данных закрыто")
    
    async def execute(self, query: str, *args, **kwargs) -> str:
        if not self._pool:
            await self.connect()
            
        async with self._pool.acquire() as connection:
            try:
                return await connection.execute(query, *args, **kwargs)
            except Exception as e:
                logger.error(f"Ошибка при выполнении запроса: {str(e)}")
                logger.error(f"Запрос: {query}")
                logger.error(f"Параметры: {args}")
                raise
    
    async def fetch(self, query: str, *args, **kwargs) -> List[Dict[str, Any]]:
        if not self._pool:
            await self.connect()
            
        async with self._pool.acquire() as connection:
            try:
                rows = await connection.fetch(query, *args, **kwargs)
                return [dict(row) for row in rows]
            except Exception as e:
                logger.error(f"Ошибка при выполнении запроса: {str(e)}")
                logger.error(f"Запрос: {query}")
                logger.error(f"Параметры: {args}")
                raise
    
    async def fetchrow(self, query: str, *args, **kwargs) -> Optional[Dict[str, Any]]:
        if not self._pool:
            await self.connect()
            
        async with self._pool.acquire() as connection:
            try:
                row = await connection.fetchrow(query, *args, **kwargs)
                return dict(row) if row else None
            except Exception as e:
                logger.error(f"Ошибка при выполнении запроса: {str(e)}")
                logger.error(f"Запрос: {query}")
                logger.error(f"Параметры: {args}")
                raise
    
    
    async def fetchval(self, query: str, *args, **kwargs) -> Any:
        if not self._pool:
            await self.connect()
            
        async with self._pool.acquire() as connection:
            try:
                return await connection.fetchval(query, *args, **kwargs)
            except Exception as e:
                logger.error(f"Ошибка при выполнении запроса: {str(e)}")
                logger.error(f"Запрос: {query}")
                logger.error(f"Параметры: {args}")
                raise
    
    async def transaction(self):
        if not self._pool:
            await self.connect()
            
        return self._pool.transaction() 