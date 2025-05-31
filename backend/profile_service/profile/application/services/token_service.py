import jwt
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from profile.domain.interfaces import ITokenService
from config import settings

logger = logging.getLogger(__name__)

class TokenService(ITokenService):
    def __init__(self):
        self.jwt_secret = settings.JWT_SECRET
        self.jwt_algorithm = settings.JWT_ALGORITHM
        logger.info(f"TokenService инициализирован с алгоритмом: {self.jwt_algorithm}")
        logger.debug(f"JWT_SECRET: {self.jwt_secret[:5]}...")
    
    def decode_jwt(self, token: str) -> Optional[Dict[str, Any]]:
        try:
            logger.debug(f"Декодирование токена: {token[:20]}...")
            
            if token is None:
                logger.error("Получен пустой токен для декодирования")
                return None
            
            if not token.strip():
                logger.error("Получен пустой токен (пустая строка) для декодирования")
                return None
            
            if len(token) < 10:
                logger.error(f"Получен слишком короткий токен: {token}")
                return None
            
            logger.info(f"Попытка декодирования токена: {token[:50]}...")
            try:
                # Проверяем токен с учетом срока действия
                decoded = jwt.decode(token, self.jwt_secret, algorithms=[self.jwt_algorithm])
                logger.info(f"Токен успешно декодирован: {decoded}")
                return decoded
            except jwt.ExpiredSignatureError:
                logger.error("Токен истек")
                return None
            
        except jwt.ExpiredSignatureError:
            logger.error("Токен истек")
            return None
        except jwt.InvalidTokenError as e:
            logger.error(f"Недействительный токен: {str(e)}")
            return None
        except Exception as e:
            logger.exception(f"Ошибка при декодировании токена: {str(e)}")
            return None
    
    def is_token_valid(self, token: str, expected_type: str = None) -> bool:
        payload = self.decode_jwt(token)
        if not payload:
            return False
        
        if expected_type and payload.get("token_type") != expected_type:
            return False
            
        return True 