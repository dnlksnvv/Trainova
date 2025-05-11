import logging
from datetime import datetime
from typing import Optional
from auth.infrastructure.database import Database
from auth.domain.db_constants import *

logger = logging.getLogger(__name__)

class TokenBlacklistService:
    
    @staticmethod
    async def add_token_to_blacklist(token: str, expires_at: datetime) -> bool:
        """
        Добавляет токен в черный список до его истечения
        Используется при логауте пользователя
        """
        try:
            db = Database()
            query = f"""
            INSERT INTO {BLACKLISTED_TOKENS_TABLE} ({BLACKLISTED_TOKEN_TOKEN}, {BLACKLISTED_TOKEN_EXPIRES_AT}) 
            VALUES ($1, $2) 
            ON CONFLICT ({BLACKLISTED_TOKEN_TOKEN}) DO NOTHING
            """
            await db.execute(query, token, expires_at)
            logger.info(f"Токен добавлен в черный список: {token[:20]}...")
            return True
        except Exception as e:
            logger.error(f"Ошибка при добавлении токена в черный список: {str(e)}")
            return False
    
    @staticmethod
    async def is_token_blacklisted(token: str) -> bool:
        """
        Проверяет, находится ли токен в черном списке
        Для предотвращения использования отозванных токенов
        """
        try:
            db = Database()
            query = f"SELECT 1 FROM {BLACKLISTED_TOKENS_TABLE} WHERE {BLACKLISTED_TOKEN_TOKEN} = $1"
            result = await db.fetchval(query, token)
            return result is not None
        except Exception as e:
            logger.error(f"Ошибка при проверке токена в черном списке: {str(e)}")
            return False
    
    @staticmethod
    async def clean_expired_tokens() -> int:
        """
        Очищает истекшие токены из черного списка
        """
        try:
            db = Database()
            query = f"DELETE FROM {BLACKLISTED_TOKENS_TABLE} WHERE {BLACKLISTED_TOKEN_EXPIRES_AT} < CURRENT_TIMESTAMP RETURNING {BLACKLISTED_TOKEN_ID}"
            result = await db.fetch(query)
            count = len(result) if result else 0
            logger.info(f"Удалено {count} истекших токенов из черного списка")
            return count
        except Exception as e:
            logger.error(f"Ошибка при очистке истекших токенов: {str(e)}")
            return 0 