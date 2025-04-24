import asyncio
import logging
import random
import string
from passlib.context import CryptContext
from typing import Dict, Any, Tuple, Optional
import time

from auth.domain.interfaces import IAuthService, IEmailService
from auth.infrastructure.user_repository import UserRepository
from auth.domain.db_constants import *
from config import settings

logger = logging.getLogger(__name__)

class AuthService(IAuthService):
    def __init__(self, email_service: IEmailService):
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        self.email_service = email_service
        self.user_repository = UserRepository()
        self.reset_codes = {}
    
    def hash_password(self, password: str) -> str:
        return self.pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return self.pwd_context.verify(plain_password, hashed_password)
    
    def normalize_contact(self, email: str) -> str:
        """Нормализует контактные данные пользователя"""
        contact = email.strip().replace(" ", "")
        return contact.lower()
    
    def generate_verification_code(self, length: int = 6) -> str:
        """Генерирует случайный код для верификации"""
        return ''.join(random.choices(string.digits, k=length))
    
    async def register_user(self, email: str, password: str, first_name: Optional[str] = None, last_name: Optional[str] = None) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """Регистрирует нового пользователя и отправляет код верификации"""
        normalized_contact = self.normalize_contact(email)
        
        # Проверка на пробелы, ничего критичного, но лучше сразу отклонить
        if " " in normalized_contact:
            return False, None, "Email не должны содержать пробелы"
        
        if " " in password:
            return False, None, "Пароль не должен содержать пробелы"
        
        password_hash = self.hash_password(password)
        
        user = await self.user_repository.create_user(
            email=normalized_contact,
            password_hash=password_hash,
            first_name=first_name,
            last_name=last_name,
            is_verified=False
        )
        
        if not user:
            return False, None, "Пользователь с таким email уже существует"
        
        verification_code = self.generate_verification_code()
        
        code_saved = await self.user_repository.save_verification_code(user[USER_ID], verification_code)
        
        if not code_saved:
            logger.error(f"Не удалось сохранить код верификации для пользователя {user[USER_ID]}")
            return False, None, "Не удалось сохранить код верификации"
        
        try:
            await self.email_service.send_verification_email(
                normalized_contact,
                verification_code,
                context="registration"
            )
            
            logger.info(f"Код верификации для пользователя {user[USER_ID]}: {verification_code}")
            print(f"\n\nКод верификации для регистрации: {verification_code}\n\n")
            
            return True, user, None
        except Exception as e:
            logger.error(f"Ошибка при отправке кода верификации: {str(e)}")
            return False, None, "Не удалось отправить код верификации"
    
    async def verify_user(self, code: str) -> Tuple[bool, Optional[int], Optional[str]]:
        """Подтверждает аккаунт пользователя через код верификации"""
        user_id = await self.user_repository.get_user_id_by_verification_code(code)
        
        if not user_id:
            return False, None, "Неверный код верификации"
        
        user = await self.user_repository.get_user_by_id(user_id)
        
        if not user:
            return False, None, "Пользователь не найден"
        
        verified = await self.user_repository.set_user_verified(user_id)
        
        if not verified:
            return False, None, "Не удалось подтвердить аккаунт"
        
        await self.user_repository.delete_verification_code(user_id)
        
        return True, user_id, None
   
    async def login_user(self, email: str, password: str) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """Выполняет вход пользователя в систему"""
        normalized_contact = self.normalize_contact(email)
        
        user = await self.user_repository.get_user_by_email(normalized_contact)
        
        if not user:
            logger.warning(f"Попытка входа с несуществующим email: {normalized_contact}")
            return False, None, "Неверные данные для входа"
        
        if not self.verify_password(password, user[USER_PASSWORD_HASH]):
            logger.warning(f"Неверный пароль для пользователя: {normalized_contact}")
            return False, None, "Неверные данные для входа"
        
        if not user[USER_IS_VERIFIED]:
            # Если учетка не верифицирована - отправляем код повторно
            logger.warning(f"Попытка входа в неверифицированный аккаунт: {normalized_contact}")
            
            verification_code = self.generate_verification_code()
            
            code_saved = await self.user_repository.save_verification_code(user[USER_ID], verification_code)
            
            if not code_saved:
                logger.error(f"Не удалось сохранить код верификации для пользователя {user[USER_ID]}")
                return False, None, "Не удалось создать код верификации"
            
            try:
                await self.email_service.send_verification_email(
                    normalized_contact,
                    verification_code,
                    context="login"
                )
                
                logger.info(f"Код верификации отправлен для входа пользователю: {normalized_contact}")
                return False, None, "Аккаунт не верифицирован. Код верификации отправлен на вашу почту."
            except Exception as e:
                logger.error(f"Ошибка при отправке кода верификации: {str(e)}")
                return False, None, "Ошибка при отправке кода верификации"
        
        # Получаем версию пароля для включения в токен
        password_version = await self.user_repository.get_password_version(user[USER_ID])
        if password_version is None:
            await self.user_repository.set_password_version(user[USER_ID], 0)
            password_version = 0
        
        logger.info(f"Успешный вход пользователя: {normalized_contact}, версия пароля: {password_version}")
        
        user_data = dict(user)
        user_data["password_version"] = password_version
        
        return True, user_data, None
    
    async def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Получает информацию о пользователе по ID"""
        try:
            user = await self.user_repository.get_user_by_id(user_id)
            if user:
                password_version = await self.user_repository.get_password_version(user_id)
                
                user_data = dict(user)
                user_data["password_version"] = password_version
                
                return user_data
            return None
        except Exception as e:
            logger.error(f"Ошибка при получении пользователя по ID {user_id}: {str(e)}")
            return None 

    async def initiate_password_change(self, user_id: str) -> Tuple[bool, str, Optional[str]]:
        """Инициирует процесс смены пароля авторизованным пользователем"""
        try:
            user = await self.user_repository.get_user_by_id(user_id)
            
            if not user:
                logger.error(f"Пользователь с ID {user_id} не найден")
                return False, "", "Пользователь не найден"
            
            verification_code = self.generate_verification_code()
            
            code_saved = await self.user_repository.save_verification_code(user_id, verification_code)
            
            if not code_saved:
                logger.error(f"Не удалось сохранить код верификации для пользователя {user_id}")
                return False, "", "Не удалось сохранить код верификации"
            
            try:
                await self.email_service.send_verification_email(
                    user[USER_EMAIL],
                    verification_code,
                    context="password_change"
                )
                
                logger.info(f"Код верификации для смены пароля отправлен пользователю {user_id}: {verification_code}")
                return True, verification_code, None
            except Exception as e:
                logger.error(f"Ошибка при отправке кода верификации: {str(e)}")
                return False, "", "Не удалось отправить код верификации"
        except Exception as e:
            logger.error(f"Ошибка при инициации смены пароля: {str(e)}")
            return False, "", f"Ошибка при инициации смены пароля: {str(e)}"
    
    async def verify_and_change_password(self, user_id: str, verification_code: str, new_password: str) -> Tuple[bool, Optional[str]]:
        """Проверяет код верификации и меняет пароль пользователя"""
        try:
            user = await self.user_repository.get_user_by_id(user_id)
            
            if not user:
                logger.error(f"Пользователь с ID {user_id} не найден")
                return False, "Пользователь не найден"
            
            stored_code = await self.user_repository.get_verification_code(user_id)
            
            if not stored_code:
                logger.error(f"Код верификации для пользователя {user_id} не найден")
                return False, "Код верификации не найден. Сначала запросите смену пароля."
            
            if verification_code != stored_code:
                logger.error(f"Неверный код верификации для пользователя {user_id}")
                return False, "Неверный код верификации"
            
            hashed_password = self.hash_password(new_password)
            
            password_updated = await self.user_repository.update_password(user_id, hashed_password)
            
            if not password_updated:
                logger.error(f"Не удалось обновить пароль пользователя {user_id}")
                return False, "Не удалось обновить пароль"
            
            await self.user_repository.delete_verification_code(user_id)
            
            logger.info(f"Пароль пользователя {user_id} успешно изменен")
            return True, None
        except Exception as e:
            logger.error(f"Ошибка при смене пароля: {str(e)}")
            return False, f"Ошибка при смене пароля: {str(e)}"
    
    async def initiate_forgot_password(self, email: str) -> Tuple[bool, Optional[str], Optional[str]]:
        """Инициирует процесс восстановления забытого пароля"""
        try:
            normalized_contact = self.normalize_contact(email)
            
            user = await self.user_repository.get_user_by_email(normalized_contact)
            
            if not user:
                return False, None, "Если указанный адрес зарегистрирован, на него будет отправлена ссылка для сброса пароля"
            
            if not user[USER_IS_VERIFIED]:
                verification_code = self.generate_verification_code()
                
                code_saved = await self.user_repository.save_verification_code(user[USER_ID], verification_code)
                
                if not code_saved:
                    logger.error(f"Не удалось сохранить код верификации для пользователя {user[USER_ID]}")
                    return False, None, "Если указанный адрес зарегистрирован, на него будет отправлена ссылка для сброса пароля"
                
                try:
                    await self.email_service.send_verification_email(
                        normalized_contact,
                        verification_code,
                        context="registration"
                    )
                    
                    return False, verification_code, "Ваш аккаунт не верифицирован. Мы отправили код верификации на ваш email."
                except Exception as e:
                    logger.error(f"Ошибка при отправке кода верификации: {str(e)}")
                    return False, None, "Если указанный адрес зарегистрирован, на него будет отправлена ссылка для сброса пароля"
            
            reset_code = self.generate_verification_code()
            
            code_saved = await self.user_repository.save_reset_code(user[USER_ID], reset_code)
            
            if not code_saved:
                logger.error(f"Не удалось сохранить код сброса пароля для пользователя {user[USER_ID]}")
                return False, None, "Если указанный адрес зарегистрирован, на него будет отправлена ссылка для сброса пароля"
            
            return True, reset_code, None
        except Exception as e:
            logger.error(f"Ошибка при инициации сброса пароля: {str(e)}")
            return False, None, "Если указанный адрес зарегистрирован, на него будет отправлена ссылка для сброса пароля"
    
    async def reset_password_with_code(self, email: str, reset_code: str, new_password: str) -> Tuple[bool, Optional[str]]:
        """Сбрасывает пароль пользователя по коду сброса"""
        try:
            normalized_contact = self.normalize_contact(email)
            
            user = await self.user_repository.get_user_by_email(normalized_contact)
            
            if not user:
                return False, "Неверный email или код подтверждения"
            
            stored_code = await self.user_repository.get_reset_code(user[USER_ID])
            
            if not stored_code or stored_code != reset_code:
                return False, "Неверный email или код подтверждения"
            
            hashed_password = self.hash_password(new_password)
            
            password_updated = await self.user_repository.update_password(user[USER_ID], hashed_password)
            
            if not password_updated:
                return False, "Не удалось обновить пароль. Пожалуйста, попробуйте позже."
            
            await self.user_repository.delete_reset_code(user[USER_ID])
            
            return True, None
        except Exception as e:
            logger.error(f"Ошибка при сбросе пароля: {str(e)}")
            return False, f"Ошибка при сбросе пароля: {str(e)}"
    
    async def initiate_email_change(self, user_id: str, new_email: str) -> Tuple[bool, Optional[str], Optional[str]]:
        """Инициирует процесс смены email"""
        try:
            normalized_contact = self.normalize_contact(new_email)
            
            user = await self.user_repository.get_user_by_id(user_id)
            
            if not user:
                return False, None, "Пользователь не найден"
            
            if normalized_contact == user[USER_EMAIL]:
                return False, None, "Новый email совпадает с текущим"
            
            existing_user = await self.user_repository.get_user_by_email(normalized_contact)
            if existing_user:
                return False, None, "Этот email уже используется другим пользователем"
            
            verification_code = self.generate_verification_code()
            
            code_saved = await self.user_repository.save_email_change_code(user_id, normalized_contact, verification_code)
            
            if not code_saved:
                logger.error(f"Не удалось сохранить код смены email для пользователя {user_id}")
                return False, None, "Не удалось сохранить код смены email"
            
            try:
                await self.email_service.send_verification_email(
                    normalized_contact,
                    verification_code,
                    context="email_change"
                )
                
                logger.info(f"Код верификации для смены email отправлен пользователю {user_id}: {verification_code}")
                return True, verification_code, None
            except Exception as e:
                logger.error(f"Ошибка при отправке кода верификации: {str(e)}")
                return False, None, "Не удалось отправить код верификации"
        except Exception as e:
            logger.error(f"Ошибка при инициации смены email: {str(e)}")
            return False, None, f"Ошибка при инициации смены email: {str(e)}"
    
    async def verify_and_change_email(self, user_id: str, new_email: str, verification_code: str) -> Tuple[bool, Optional[str]]:
        """Проверяет код верификации и меняет email пользователя"""
        try:
            normalized_contact = self.normalize_contact(new_email)
            
            user = await self.user_repository.get_user_by_id(user_id)
            
            if not user:
                return False, "Пользователь не найден"
            
            email_change_request = await self.user_repository.get_email_change_request(user_id)
            
            if not email_change_request:
                return False, "Запрос на смену email не найден. Сначала запросите смену email."
            
            if normalized_contact != email_change_request["new_email"]:
                return False, "Указанный email не соответствует запрошенному для смены"
            
            if verification_code != email_change_request["code"]:
                return False, "Неверный код верификации"
            
            email_updated = await self.user_repository.update_email(user_id, normalized_contact)
            
            if not email_updated:
                return False, "Не удалось обновить email. Пожалуйста, попробуйте позже."
            
            await self.user_repository.delete_email_change_code(user_id)
            
            await self.user_repository.update_password(user_id, user[USER_PASSWORD_HASH])
            
            return True, None
        except Exception as e:
            logger.error(f"Ошибка при смене email: {str(e)}")
            return False, f"Ошибка при смене email: {str(e)}" 