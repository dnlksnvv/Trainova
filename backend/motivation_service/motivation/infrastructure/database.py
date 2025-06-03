import asyncpg
import logging
from typing import Optional
from datetime import datetime, timezone
from config import settings

logger = logging.getLogger(__name__)


class Database:
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None

    async def connect(self):
        """Создание пула соединений с базой данных"""
        try:
            connect_start_utc = datetime.now(timezone.utc)
            logger.info(f"Создание пула соединений с базой данных (UTC: {connect_start_utc})")
            
            self.pool = await asyncpg.create_pool(
                host=settings.DB_HOST,
                port=settings.DB_PORT,
                user=settings.DB_USER,
                password=settings.DB_PASSWORD,
                database=settings.DB_NAME,
                min_size=1,
                max_size=10
            )
            
            connect_end_utc = datetime.now(timezone.utc)
            connect_duration = (connect_end_utc - connect_start_utc).total_seconds()
            logger.info(f"Пул соединений с базой данных создан за {connect_duration:.2f} сек (UTC: {connect_end_utc})")
            
        except Exception as e:
            error_time_utc = datetime.now(timezone.utc)
            logger.error(f"Ошибка при создании пула соединений в UTC {error_time_utc}: {str(e)}")
            raise

    async def disconnect(self):
        """Закрытие пула соединений"""
        if self.pool:
            disconnect_start_utc = datetime.now(timezone.utc)
            logger.info(f"Закрытие пула соединений с базой данных (UTC: {disconnect_start_utc})")
            
            await self.pool.close()
            
            disconnect_end_utc = datetime.now(timezone.utc)
            logger.info(f"Пул соединений с базой данных закрыт (UTC: {disconnect_end_utc})")

    async def get_connection(self):
        """Получение соединения из пула"""
        if not self.pool:
            await self.connect()
        if self.pool:
            return await self.pool.acquire()
        else:
            error_time_utc = datetime.now(timezone.utc)
            logger.error(f"Не удалось создать соединение с базой данных (UTC: {error_time_utc})")
            raise Exception("Не удалось создать соединение с базой данных")

    async def release_connection(self, connection):
        """Возвращение соединения в пул"""
        if self.pool:
            await self.pool.release(connection) 