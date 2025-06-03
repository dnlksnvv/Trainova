import jwt
import logging
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any, Tuple
from config import settings

logger = logging.getLogger(__name__)

security = HTTPBearer()


class AuthService:
    """Сервис для аутентификации"""
    
    @staticmethod
    def decode_token(token: str) -> Dict[str, Any]:
        """Декодирование JWT токена"""
        try:
            payload = jwt.decode(
                token, 
                settings.JWT_SECRET, 
                algorithms=[settings.JWT_ALGORITHM]
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Токен истек")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Неверный токен")
    
    @staticmethod
    def get_user_id_from_token(token: str) -> int:
        """Извлечение ID пользователя из токена"""
        payload = AuthService.decode_token(token)
        user_id = payload.get("user_id")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Отсутствует ID пользователя в токене")
        
        try:
            return int(user_id)
        except (ValueError, TypeError):
            raise HTTPException(status_code=401, detail="Неверный формат ID пользователя")

    @staticmethod
    def get_user_role_from_token(token: str) -> int:
        """Извлечение роли пользователя из токена"""
        payload = AuthService.decode_token(token)
        role_id = payload.get("role_id")
        
        if role_id is None:
            # По умолчанию роль обычного пользователя
            return 2
        
        try:
            return int(role_id)
        except (ValueError, TypeError):
            return 2

    @staticmethod
    def get_user_data_from_token(token: str) -> Tuple[int, int]:
        """Извлечение ID и роли пользователя из токена"""
        payload = AuthService.decode_token(token)
        
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Отсутствует ID пользователя в токене")
        
        role_id = payload.get("role_id", 2)  # По умолчанию роль обычного пользователя
        
        try:
            return int(user_id), int(role_id)
        except (ValueError, TypeError):
            raise HTTPException(status_code=401, detail="Неверный формат данных пользователя")


async def get_current_user_id(credentials: HTTPAuthorizationCredentials = Security(security)) -> int:
    """
    Dependency для получения ID текущего пользователя из JWT токена
    """
    try:
        token = credentials.credentials
        user_id = AuthService.get_user_id_from_token(token)
        return user_id
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при аутентификации: {str(e)}")
        raise HTTPException(status_code=401, detail="Ошибка аутентификации")


async def get_current_user_data(credentials: HTTPAuthorizationCredentials = Security(security)) -> Tuple[int, int]:
    """
    Dependency для получения ID и роли текущего пользователя из JWT токена
    Возвращает кортеж (user_id, role_id)
    """
    try:
        token = credentials.credentials
        user_id, role_id = AuthService.get_user_data_from_token(token)
        return user_id, role_id
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при аутентификации: {str(e)}")
        raise HTTPException(status_code=401, detail="Ошибка аутентификации")


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(HTTPBearer(auto_error=False))
) -> Optional[Tuple[int, int]]:
    """
    Dependency для получения данных пользователя (опциональный)
    Возвращает None если токен отсутствует или неверный
    Возвращает кортеж (user_id, role_id) если токен валидный
    """
    if credentials is None:
        return None
    
    try:
        token = credentials.credentials
        user_id, role_id = AuthService.get_user_data_from_token(token)
        return user_id, role_id
    except HTTPException:
        # Возвращаем None вместо выброса исключения
        return None
    except Exception:
        return None 