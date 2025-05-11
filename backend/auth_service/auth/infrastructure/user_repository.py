import logging
from typing import Dict, List, Any, Optional, Tuple
import uuid

from auth.infrastructure.database import Database
from auth.domain.db_constants import *

logger = logging.getLogger(__name__)

class UserRepository:
    def __init__(self):
        self.db = Database()

    async def create_user(self, 
                        email: str, 
                        password_hash: str, 
                        first_name: Optional[str] = None, 
                        last_name: Optional[str] = None, 
                        role_id: int = 2,
                        is_verified: bool = False) -> Optional[Dict[str, Any]]:
  
        try:
            # Проверка на дубликатыы
            existing_user = await self.get_user_by_email(email)
            if existing_user:
                logger.warning(f"Пользователь с email {email} уже существует")
                return None
            
            query = f"""
            INSERT INTO {USERS_TABLE} (
                {USER_EMAIL}, 
                {USER_PASSWORD_HASH}, 
                {USER_FIRST_NAME}, 
                {USER_LAST_NAME}, 
                {USER_ROLE_ID}, 
                {USER_IS_VERIFIED}
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            """
            
            user = await self.db.fetchrow(
                query, 
                email, 
                password_hash, 
                first_name, 
                last_name, 
                role_id, 
                is_verified
            )
            
            if user:
                logger.info(f"Создан новый пользователь с ID {user[USER_ID]}")
                
                await self.set_password_version(user[USER_ID], 0)
                
                return user
            else:
                logger.error("Не удалось создать пользователя")
                return None
        except Exception as e:
            logger.error(f"Ошибка при создании пользователя: {str(e)}")
            return None

    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:

        try:
            # строка в число - защита от инъекций
            numeric_id = int(user_id)
            query = f"SELECT * FROM {USERS_TABLE} WHERE {USER_ID} = $1"
            return await self.db.fetchrow(query, numeric_id)
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return None
        except Exception as e:
            logger.error(f"Ошибка при получении пользователя по ID {user_id}: {str(e)}")
            return None

    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:

        try:
            query = f"SELECT * FROM {USERS_TABLE} WHERE {USER_EMAIL} = $1"
            return await self.db.fetchrow(query, email)
        except Exception as e:
            logger.error(f"Ошибка при получении пользователя по email {email}: {str(e)}")
            return None

    async def update_user(self, user_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:

        try:
            set_parts = []
            values = []
            for i, (key, value) in enumerate(data.items(), start=1):
                set_parts.append(f"{key} = ${i}")
                values.append(value)
            
            values.append(user_id)
            param_index = len(values)
            
            query = f"""
            UPDATE {USERS_TABLE}
            SET {', '.join(set_parts)}
            WHERE {USER_ID} = ${param_index}
            RETURNING *
            """
            
            return await self.db.fetchrow(query, *values)
        except Exception as e:
            logger.error(f"Ошибка при обновлении пользователя с ID {user_id}: {str(e)}")
            return None

    async def set_user_verified(self, user_id: int, is_verified: bool = True) -> bool:

        try:
            query = f"""
            UPDATE {USERS_TABLE}
            SET {USER_IS_VERIFIED} = $1
            WHERE {USER_ID} = $2
            """
            
            await self.db.execute(query, is_verified, user_id)
            return True
        except Exception as e:
            logger.error(f"Ошибка при обновлении статуса верификации пользователя {user_id}: {str(e)}")
            return False

    async def update_password(self, user_id: str, password_hash: str) -> bool:

        try:
            numeric_id = int(user_id)
            
            query = f"""
            UPDATE {USERS_TABLE}
            SET {USER_PASSWORD_HASH} = $1
            WHERE {USER_ID} = $2
            """
            
            await self.db.execute(query, password_hash, numeric_id)
            
            # Увеличиваем версиию пароля, чтобы инвалидировать старые токены
            current_version = await self.get_password_version(user_id)
            new_version = (current_version or 0) + 1
            await self.set_password_version(user_id, new_version)
            
            logger.info(f"Пароль пользователя {user_id} обновлен, новая версия: {new_version}")
            return True
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return False
        except Exception as e:
            logger.error(f"Ошибка при обновлении пароля пользователя {user_id}: {str(e)}")
            return False

    async def get_password_version(self, user_id: str) -> Optional[int]:

        try:
            numeric_id = int(user_id)
            
            query = f"""
            SELECT {PASSWORD_VERSION_VERSION}
            FROM {PASSWORD_VERSIONS_TABLE}
            WHERE {PASSWORD_VERSION_USER_ID} = $1
            ORDER BY {PASSWORD_VERSION_CREATED_AT} DESC
            LIMIT 1
            """
            
            version = await self.db.fetchval(query, numeric_id)
            return version
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return None
        except Exception as e:
            logger.error(f"Ошибка при получении версии пароля пользователя {user_id}: {str(e)}")
            return None

    async def set_password_version(self, user_id: str, version: int) -> bool:

        try:
            numeric_id = int(user_id)
            
            query = f"""
            INSERT INTO {PASSWORD_VERSIONS_TABLE} (
                {PASSWORD_VERSION_USER_ID}, 
                {PASSWORD_VERSION_VERSION}
            ) VALUES ($1, $2)
            ON CONFLICT ({PASSWORD_VERSION_USER_ID}) 
            DO UPDATE SET 
                {PASSWORD_VERSION_VERSION} = $2,
                {PASSWORD_VERSION_CREATED_AT} = CURRENT_TIMESTAMP
            """
            
            await self.db.execute(query, numeric_id, version)
            logger.info(f"Установлена версия пароля {version} для пользователя {user_id}")
            return True
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return False
        except Exception as e:
            logger.error(f"Ошибка при установке версии пароля пользователя {user_id}: {str(e)}")
            return False

    async def save_verification_code(self, user_id: str, code: str) -> bool:

        try:
            numeric_id = int(user_id)
            
            await self.delete_verification_code(user_id)
            
            query = f"""
            INSERT INTO {VERIFICATION_CODES_TABLE} (
                {VERIFICATION_CODE_USER_ID}, 
                {VERIFICATION_CODE}
            ) VALUES ($1, $2)
            """
            
            await self.db.execute(query, numeric_id, code)
            logger.info(f"Сохранен код верификации для пользователя {user_id}")
            return True
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return False
        except Exception as e:
            logger.error(f"Ошибка при сохранении кода верификации для пользователя {user_id}: {str(e)}")
            return False

    async def get_verification_code(self, user_id: str) -> Optional[str]:

        try:
            numeric_id = int(user_id)
            
            query = f"""
            SELECT {VERIFICATION_CODE}
            FROM {VERIFICATION_CODES_TABLE}
            WHERE {VERIFICATION_CODE_USER_ID} = $1
            ORDER BY {VERIFICATION_CODE_CREATED_AT} DESC
            LIMIT 1
            """
            
            return await self.db.fetchval(query, numeric_id)
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return None
        except Exception as e:
            logger.error(f"Ошибка при получении кода верификации для пользователя {user_id}: {str(e)}")
            return None

    async def get_user_id_by_verification_code(self, code: str) -> Optional[int]:

        try:
            query = f"""
            SELECT {VERIFICATION_CODE_USER_ID}
            FROM {VERIFICATION_CODES_TABLE}
            WHERE {VERIFICATION_CODE} = $1
            ORDER BY {VERIFICATION_CODE_CREATED_AT} DESC
            LIMIT 1
            """
            
            return await self.db.fetchval(query, code)
        except Exception as e:
            logger.error(f"Ошибка при получении ID пользователя по коду верификации {code}: {str(e)}")
            return None

    async def delete_verification_code(self, user_id: str) -> bool:

        try:
            numeric_id = int(user_id)
            
            query = f"""
            DELETE FROM {VERIFICATION_CODES_TABLE}
            WHERE {VERIFICATION_CODE_USER_ID} = $1
            """
            
            await self.db.execute(query, numeric_id)
            return True
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return False
        except Exception as e:
            logger.error(f"Ошибка при удалении кода верификации для пользователя {user_id}: {str(e)}")
            return False

    async def save_reset_code(self, user_id: str, reset_code: str) -> bool:

        try:
            numeric_id = int(user_id)
            
            await self.delete_reset_code(user_id)
            
            query = f"""
            INSERT INTO {RESET_CODES_TABLE} (
                {RESET_CODE_USER_ID}, 
                {RESET_CODE}
            ) VALUES ($1, $2)
            """
            
            await self.db.execute(query, numeric_id, reset_code)
            logger.info(f"Сохранен код сброса пароля для пользователя {user_id}")
            return True
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return False
        except Exception as e:
            logger.error(f"Ошибка при сохранении кода сброса пароля для пользователя {user_id}: {str(e)}")
            return False

    async def get_reset_code(self, user_id: str) -> Optional[str]:

        try:
            numeric_id = int(user_id)
            
            query = f"""
            SELECT {RESET_CODE}
            FROM {RESET_CODES_TABLE}
            WHERE {RESET_CODE_USER_ID} = $1
            ORDER BY {RESET_CODE_CREATED_AT} DESC
            LIMIT 1
            """
            
            return await self.db.fetchval(query, numeric_id)
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return None
        except Exception as e:
            logger.error(f"Ошибка при получении кода сброса пароля для пользователя {user_id}: {str(e)}")
            return None

    async def get_user_id_by_reset_code(self, reset_code: str) -> Optional[int]:

        try:
            query = f"""
            SELECT {RESET_CODE_USER_ID}
            FROM {RESET_CODES_TABLE}
            WHERE {RESET_CODE} = $1
            ORDER BY {RESET_CODE_CREATED_AT} DESC
            LIMIT 1
            """
            
            return await self.db.fetchval(query, reset_code)
        except Exception as e:
            logger.error(f"Ошибка при получении ID пользователя по коду сброса пароля {reset_code}: {str(e)}")
            return None

    async def delete_reset_code(self, user_id: str) -> bool:

        try:
            numeric_id = int(user_id)
            
            query = f"""
            DELETE FROM {RESET_CODES_TABLE}
            WHERE {RESET_CODE_USER_ID} = $1
            """
            
            await self.db.execute(query, numeric_id)
            return True
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return False
        except Exception as e:
            logger.error(f"Ошибка при удалении кода сброса пароля для пользователя {user_id}: {str(e)}")
            return False

    async def save_email_change_code(self, user_id: str, new_email: str, code: str) -> bool:

        try:
            numeric_id = int(user_id)
            
            await self.delete_email_change_code(user_id)
            
            query = f"""
            INSERT INTO {EMAIL_CHANGE_CODES_TABLE} (
                {EMAIL_CHANGE_CODE_USER_ID}, 
                {EMAIL_CHANGE_CODE_NEW_EMAIL},
                {EMAIL_CHANGE_CODE}
            ) VALUES ($1, $2, $3)
            """
            
            await self.db.execute(query, numeric_id, new_email, code)
            logger.info(f"Сохранен код смены email для пользователя {user_id}")
            return True
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return False
        except Exception as e:
            logger.error(f"Ошибка при сохранении кода смены email для пользователя {user_id}: {str(e)}")
            return False

    async def get_email_change_code(self, user_id: str, new_email: str) -> Optional[str]:

        try:
            numeric_id = int(user_id)
            
            query = f"""
            SELECT {EMAIL_CHANGE_CODE}
            FROM {EMAIL_CHANGE_CODES_TABLE}
            WHERE {EMAIL_CHANGE_CODE_USER_ID} = $1 AND {EMAIL_CHANGE_CODE_NEW_EMAIL} = $2
            ORDER BY {EMAIL_CHANGE_CODE_CREATED_AT} DESC
            LIMIT 1
            """
            
            return await self.db.fetchval(query, numeric_id, new_email)
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return None
        except Exception as e:
            logger.error(f"Ошибка при получении кода смены email для пользователя {user_id}: {str(e)}")
            return None

    async def get_email_change_request(self, user_id: str) -> Optional[Dict[str, Any]]:

        try:
            numeric_id = int(user_id)
            
            query = f"""
            SELECT {EMAIL_CHANGE_CODE_NEW_EMAIL} as new_email, {EMAIL_CHANGE_CODE} as code
            FROM {EMAIL_CHANGE_CODES_TABLE}
            WHERE {EMAIL_CHANGE_CODE_USER_ID} = $1
            ORDER BY {EMAIL_CHANGE_CODE_CREATED_AT} DESC
            LIMIT 1
            """
            
            return await self.db.fetchrow(query, numeric_id)
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return None
        except Exception as e:
            logger.error(f"Ошибка при получении запроса на смену email для пользователя {user_id}: {str(e)}")
            return None

    async def delete_email_change_code(self, user_id: str) -> bool:

        try:
            numeric_id = int(user_id)
            
            query = f"""
            DELETE FROM {EMAIL_CHANGE_CODES_TABLE}
            WHERE {EMAIL_CHANGE_CODE_USER_ID} = $1
            """
            
            await self.db.execute(query, numeric_id)
            return True
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return False
        except Exception as e:
            logger.error(f"Ошибка при удалении кода смены email для пользователя {user_id}: {str(e)}")
            return False

    async def update_email(self, user_id: str, new_email: str) -> bool:

        try:
            numeric_id = int(user_id)
            
            query = f"""
            UPDATE {USERS_TABLE}
            SET {USER_EMAIL} = $1
            WHERE {USER_ID} = $2
            """
            
            await self.db.execute(query, new_email, numeric_id)
            logger.info(f"Email пользователя {user_id} обновлен на {new_email}")
            return True
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return False
        except Exception as e:
            logger.error(f"Ошибка при обновлении email пользователя {user_id}: {str(e)}")
            return False 