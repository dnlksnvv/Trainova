import logging
import jwt
from typing import Dict, Any, Optional
from config import settings
from profile.domain.interfaces import IAuthService

logger = logging.getLogger(__name__)

class AuthServiceImpl(IAuthService):
    
    def __init__(self):
        """Инициализация сервиса."""
        self.jwt_secret = settings.JWT_SECRET
        self.jwt_algorithm = settings.JWT_ALGORITHM
    
    async def verify_token(self, token: str) -> Dict:
        """Проверка JWT токена локально"""
        decoded = self._decode_jwt(token)
        if not decoded:
            raise ValueError("Недействительный токен")
        
        # Проверяем, что это access токен
        if decoded.get("token_type") != "access":
            logger.warning(f"Неверный тип токена: {decoded.get('token_type')}")
            raise ValueError("Требуется access токен")
        
        return {
            "user_id": decoded.get("user_id"),
            "email": decoded.get("email"),
            "role_id": decoded.get("role_id")
        }
    
    def _decode_jwt(self, token: str) -> Optional[Dict[str, Any]]:
        """Локальное декодирование JWT токена"""
        try:
            # Декодируем токен с проверкой подписи и срока действия
            return jwt.decode(token, self.jwt_secret, algorithms=[self.jwt_algorithm])
        except jwt.ExpiredSignatureError:
            logger.error("Токен истек")
            return None
        except jwt.InvalidTokenError as e:
            logger.error(f"Недействительный токен: {str(e)}")
            return None
        except Exception as e:
            logger.exception(f"Ошибка при декодировании токена: {str(e)}")
            return None
    
    async def check_token_blacklist(self, token: str) -> bool:
        """Проверка токена в черном списке (заглушка)"""
        # В простой реализации считаем, что blacklist не используется
        # При необходимости можно добавить Redis или базу данных для blacklist
        return False 