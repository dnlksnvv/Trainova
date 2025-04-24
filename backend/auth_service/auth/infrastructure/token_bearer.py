from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging

from auth.domain.interfaces import ITokenService

logger = logging.getLogger(__name__)

class BearerTokenAuth(HTTPBearer):
    def __init__(self, token_service: ITokenService, auto_error: bool = True):
        super().__init__(auto_error=auto_error)
        self.token_service = token_service
    
    async def __call__(self, request: Request) -> str:
        credentials = await super().__call__(request)
        
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Необходима аутентификация"
            )
            
        # должен быть именно Bearer
        if not credentials.scheme == "Bearer":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Неверная схема аутентификации. Ожидается Bearer"
            )
            
        token = credentials.credentials
        logger.debug(f"Полученный токен: {token[:10]}...")
            
        # Проверккка валидности JWT
        if not self.verify_jwt(token):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Недействительный или истекший токен"
            )
            
        return token
    
    def verify_jwt(self, token: str) -> bool:
        decoded_token = self.token_service.decode_jwt(token)
        logger.debug(f"Декодированный токен: {decoded_token}")
        return decoded_token is not None 