import jwt
from fastapi import HTTPException, Depends, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timedelta
from typing import Dict, Optional, Any
from config import settings
import logging

logger = logging.getLogger(__name__)

security = HTTPBearer()

async def get_token_from_header(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Получение токена из заголовка Authorization"""
    return credentials.credentials

async def get_token_from_header_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))) -> Optional[str]:
    """Получение токена из заголовка Authorization (опционально)"""
    return credentials.credentials if credentials else None

async def decode_token(token: str) -> Dict[str, Any]:
    """Декодирование JWT токена"""
    try:
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET, 
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Срок действия токена истек")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Срок действия токена истек"
        )
    except jwt.InvalidTokenError as e:
        logger.warning(f"Недействительный токен: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен"
        )

async def get_current_user(token: str = Depends(get_token_from_header)) -> Dict[str, Any]:
    """Получение данных текущего пользователя из JWT токена и БД"""
    from comment.infrastructure.database import Database
    
    payload = await decode_token(token)
    
    # Проверяем, что токен содержит необходимые данные
    # auth_service использует поле user_id, а не sub
    user_id = payload.get("user_id")
    if not user_id:
        logger.error(f"Токен не содержит user_id. Payload: {payload}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен"
        )
    
    # Проверяем тип токена - должен быть access
    token_type = payload.get("token_type")
    if token_type != "access":
        logger.error(f"Неверный тип токена. Ожидается 'access', получен '{token_type}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен"
        )
    
    # Получаем актуальные данные пользователя из БД
    db = Database()
    user_from_db = await db.fetchrow(
        "SELECT id, email, first_name, last_name, role_id FROM users WHERE id = $1",
        int(user_id)
    )
    
    if not user_from_db:
        logger.error(f"Пользователь с ID {user_id} не найден в БД")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден"
        )
    
    # Формируем словарь с данными пользователя из БД
    user_data = {
        "user_id": user_from_db["id"],
        "email": user_from_db["email"] or "",
        "first_name": user_from_db["first_name"] or "",
        "last_name": user_from_db["last_name"] or "",
        "role_id": user_from_db["role_id"]
    }
    
    logger.info(f"Пользователь авторизован: user_id={user_data['user_id']}, role_id={user_data['role_id']}")
    return user_data

async def get_current_user_optional(token: Optional[str] = Depends(get_token_from_header_optional)) -> Optional[Dict[str, Any]]:
    """Получение данных текущего пользователя (опционально)"""
    if not token:
        return None
    
    try:
        return await get_current_user_by_token(token)
    except HTTPException:
        # Если токен некорректный, возвращаем None вместо ошибки
        return None

async def get_current_user_by_token(token: str) -> Dict[str, Any]:
    """Получение пользователя по токену без dependency injection"""
    from comment.infrastructure.database import Database
    
    payload = await decode_token(token)
    
    # Проверяем, что токен содержит необходимые данные
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен"
        )
    
    # Проверяем тип токена - должен быть access
    token_type = payload.get("token_type")
    if token_type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен"
        )
    
    # Получаем актуальные данные пользователя из БД
    db = Database()
    user_from_db = await db.fetchrow(
        "SELECT id, email, first_name, last_name, role_id FROM users WHERE id = $1",
        int(user_id)
    )
    
    if not user_from_db:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден"
        )
    
    # Формируем словарь с данными пользователя из БД
    user_data = {
        "user_id": user_from_db["id"],
        "email": user_from_db["email"] or "",
        "first_name": user_from_db["first_name"] or "",
        "last_name": user_from_db["last_name"] or "",
        "role_id": user_from_db["role_id"]
    }
    
    return user_data

async def get_current_user_id(user: Dict[str, Any] = Depends(get_current_user)) -> int:
    """Получение ID текущего пользователя"""
    return user["user_id"]

async def is_admin(user: Dict[str, Any] = Depends(get_current_user)) -> bool:
    """Проверка, является ли пользователь администратором"""
    return user.get("role_id") == 1

async def admin_required(is_admin_user: bool = Depends(is_admin)) -> None:
    """Проверка, что пользователь является администратором"""
    if not is_admin_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещен. Требуются права администратора"
        ) 