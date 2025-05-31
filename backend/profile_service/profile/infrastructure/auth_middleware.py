from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging
import aiohttp
from typing import Dict, Any, Optional, Callable
from config import settings
from fastapi.responses import JSONResponse

from profile.domain.interfaces import ITokenService

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
            
        # Проверка валидности JWT
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

def get_current_user(request: Request) -> dict:
    logger.info("Попытка получить данные текущего пользователя")
    if not hasattr(request.state, "user"):
        logger.warning("В request.state отсутствуют данные пользователя")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Не авторизован"
        )
    logger.info(f"Получены данные пользователя: {request.state.user}")
    return request.state.user

class TokenValidationMiddleware:
    
    def __init__(self, app, token_service: ITokenService, excluded_paths: list = None):
      
        self.app = app
        self.token_service = token_service
        self.excluded_paths = excluded_paths or ["/docs", "/redoc", "/openapi.json", "/"]
        logger.info(f"TokenValidationMiddleware инициализирован с excluded_paths: {self.excluded_paths}")
    
    async def __call__(self, scope, receive, send):
       
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
            
        # Создаем объект Request из scope
        request = Request(scope)
        path = request.url.path
        method = request.method
        logger.info(f"Получен запрос {method} к {path}")
        
        # Пропускаем OPTIONS запросы (preflight requests)
        if method == "OPTIONS":
            logger.info(f"Пропуск OPTIONS запроса к {path}")
            return await self.app(scope, receive, send)
        
        # Проверяем, нужно ли пропустить этот путь
        if path in self.excluded_paths:
            logger.info(f"Путь {path} исключен из проверки авторизации")
            return await self.app(scope, receive, send)
        
        # Получаем заголовок авторизации
        authorization = request.headers.get("Authorization")
        logger.info(f"Заголовок Authorization: {authorization[:20] if authorization else 'отсутствует'}...")
        
        if not authorization:
            logger.warning("Отсутствует заголовок Authorization")
            response = JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Требуется аутентификация"},
                headers={"WWW-Authenticate": "Bearer"}
            )
            return await response(scope, receive, send)
        
        # Проверяем формат заголовка
        parts = authorization.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            logger.warning(f"Неверный формат заголовка Authorization: {authorization[:20]}...")
            response = JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Неверный формат авторизации. Ожидается: Bearer <токен>"},
                headers={"WWW-Authenticate": "Bearer"}
            )
            return await response(scope, receive, send)
        
        token = parts[1]
        logger.info(f"Получен токен: {token[:20]}...")
        
        # Проверяем токен 
        payload = self.token_service.decode_jwt(token)
        logger.info(f"Результат декодирования токена: {payload}")
        
        if not payload:
            logger.warning("Токен недействителен или истек")
            response = JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Недействительный или истекший токен"},
                headers={"WWW-Authenticate": "Bearer"}
            )
            return await response(scope, receive, send)
        
        # Добавляем данные пользователя в request.state
        user_data = {
            "user_id": payload.get("user_id"),
            "email": payload.get("email"),
            "role_id": payload.get("role_id")
        }
        logger.info(f"Добавлены данные пользователя в request.state: {user_data}")
        request.state.user = user_data
        
        # Продолжаем обработку запроса
        return await self.app(scope, receive, send) 