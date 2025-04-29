import jwt
import logging
from fastapi import Request, HTTPException, status
from training.domain.schemas import TokenPayload
from config import settings
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

async def verify_token(request: Request) -> Dict[str, Any]:
    """
    Проверяет JWT токен из заголовка Authorization
    
    Args:
        request: Запрос FastAPI
        
    Returns:
        Расшифрованный токен с данными пользователя
        
    Raises:
        HTTPException: если токен недействителен или отсутствует
    """
    try:
        authorization = request.headers.get("Authorization")
        if not authorization:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization header is missing"
            )
        
        parts = authorization.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header format. Use 'Bearer <token>'"
            )
        
        token = parts[1]
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        
        # Добавляем данные пользователя в состояние запроса
        request.state.user = payload
        return payload
    except jwt.PyJWTError as e:
        logger.error(f"JWT token verification error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    except Exception as e:
        logger.error(f"Token verification error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

async def get_current_user_id(request: Request) -> int:
    """
    Получает ID текущего пользователя из JWT токена
    
    Args:
        request: Запрос FastAPI
        
    Returns:
        ID пользователя
        
    Raises:
        HTTPException: если токен недействителен или отсутствует
    """
    # Если данные пользователя еще не проверены, проверяем токен
    if not hasattr(request.state, 'user'):
        await verify_token(request)
    
    user_id = request.state.user.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User ID not found in token"
        )
    
    return user_id

def is_admin(request: Request) -> bool:
    """
    Проверяет, является ли текущий пользователь администратором
    
    Args:
        request: Запрос FastAPI
        
    Returns:
        True, если пользователь администратор, иначе False
    """
    if not hasattr(request.state, 'user'):
        logger.warning("Проверка прав администратора: объект user отсутствует в request.state")
        return False
    
    role_id = request.state.user.get("role_id")
    logger.info(f"Проверка прав администратора: role_id = {role_id}")
    return role_id == 1  # Проверка по числовому значению роли (1 = Администратор, а 2 = Пользователь)



def is_admin_or_trainer(request: Request) -> bool:
    """
    Проверяет, является ли текущий пользователь администратором или тренером
    
    Args:
        request: Запрос FastAPI
        
    Returns:
        True, если пользователь администратор или тренер, иначе False
    """
    if not hasattr(request.state, 'user'):
        logger.warning("Проверка прав администратора/тренера: объект user отсутствует в request.state")
        return False
    
    user_info = request.state.user
    role_id = user_info.get("role_id")
    
    logger.info(f"ОТЛАДКА - Проверка прав: пользователь ID {user_info.get('user_id')}, email: {user_info.get('email_or_phone')}")
    logger.info(f"ОТЛАДКА - role_id: {role_id}, Тип: {type(role_id)}")
    logger.info(f"ОТЛАДКА - Полная информация пользователя: {user_info}")
    
    is_admin_result = role_id == 1
    is_trainer_result = role_id == 3
    
    logger.info(f"ОТЛАДКА - Результат проверки: is_admin={is_admin_result}, is_trainer={is_trainer_result}")
    
    return is_admin_result or is_trainer_result
