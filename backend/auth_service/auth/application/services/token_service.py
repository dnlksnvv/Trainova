import jwt
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from auth.domain.interfaces import ITokenService
from config import settings

logger = logging.getLogger(__name__)

class TokenService(ITokenService):
    def __init__(self):
        self.jwt_secret = settings.JWT_SECRET
        self.jwt_algorithm = settings.JWT_ALGORITHM
        self.access_token_expire_seconds = settings.ACCESS_TOKEN_EXPIRE_SECONDS
        self.refresh_token_expire_seconds = settings.REFRESH_TOKEN_EXPIRE_SECONDS
    
    def create_token_payload(self, user_id: str, role_id: int, email: str, expires_delta: int, password_version: int = 0) -> Dict[str, Any]:
        expire = datetime.utcnow() + timedelta(seconds=expires_delta)
        return {
            "user_id": user_id,
            "role_id": role_id,
            "email": email,
            "exp": expire.timestamp(),
            "iat": datetime.utcnow().timestamp(),
            "password_version": password_version  # Добавляем версию, чтобы инвалидировать все токены при смене пароля
        }
    
    def create_access_token(self, user_id: str, role_id: int, email: str, token_type: str = "access", expire_minutes: Optional[int] = None, password_version: int = 0) -> str:
        """
        Создает JWT токен.

        """
        if expire_minutes is not None:
            expires_delta = expire_minutes * 60
        else:
            # Если не указано особое время жизни - берем из конфига
            expires_delta = self.access_token_expire_seconds
            
        payload = self.create_token_payload(user_id, role_id, email, expires_delta, password_version)
        payload["token_type"] = token_type
        return jwt.encode(payload, self.jwt_secret, algorithm=self.jwt_algorithm)
    
    def create_refresh_token(self, user_id: str, role_id: int, email: str, password_version: int = 0) -> str:
        payload = self.create_token_payload(user_id, role_id, email, self.refresh_token_expire_seconds, password_version)
        payload["token_type"] = "refresh"
        return jwt.encode(payload, self.jwt_secret, algorithm=self.jwt_algorithm)
    
    def create_reset_password_token(self, user_id: str, role_id: int, email: str, expire_minutes: int = 30, password_version: int = 0) -> str:
        """
        Создает токен для сброса пароля с временем жизни
        """
        return self.create_access_token(
            user_id=user_id, 
            role_id=role_id, 
            email=email, 
            token_type="reset_password", 
            expire_minutes=expire_minutes,
            password_version=password_version
        )
    
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
                # Сначала проверяем без проверки срока действия - нужно для токенов сброса пароля
                payload = jwt.decode(token, self.jwt_secret, algorithms=[self.jwt_algorithm], options={"verify_exp": False})
                
                if payload.get("token_type") == "reset_password":
                    logger.info("Обнаружен токен сброса пароля, проверка срока действия отключена")
                    return payload
                
                # Для обычных токенов - строгая проверка времени жизни
                return jwt.decode(token, self.jwt_secret, algorithms=[self.jwt_algorithm])
            except jwt.ExpiredSignatureError:
                try:
                    # Если токен истек, проверяем не токен ли это сброса пароля
                    payload = jwt.decode(token, self.jwt_secret, algorithms=[self.jwt_algorithm], options={"verify_exp": False})
                    if payload.get("token_type") == "reset_password":
                        logger.info("Обнаружен истекший токен сброса пароля, но допускаем его использование")
                        return payload
                    else:
                        logger.error("Токен истек и не является токеном сброса пароля")
                        return None
                except:
                    logger.error("Токен истек и не может быть декодирован")
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