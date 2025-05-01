from fastapi import APIRouter, HTTPException, status, Depends, Header, Request, Form, Cookie, Response
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from pathlib import Path
import uuid
import random
import logging
from typing import Dict, Optional
from pydantic import BaseModel, Field
from datetime import datetime


from auth.domain.schemas import (
    UserRegisterRequest,
    UserVerifyRequest,
    UserLoginRequest,
    TokenResponse,
    RefreshRequest,
    LogoutRequest,
    ErrorResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ChangePasswordRequest,
    VerifyPasswordChangeRequest,
    ChangeEmailRequest,
    VerifyEmailChangeRequest
)
from auth.domain.interfaces import IAuthService, ITokenService
from auth.infrastructure.email import EmailService
from auth.infrastructure.token_blacklist_service import TokenBlacklistService
from auth.domain.db_constants import *
from config import settings

logger = logging.getLogger(__name__)

parent_directory = Path(__file__).parent.parent.parent
templates_path = parent_directory / "templates"
templates = Jinja2Templates(directory=templates_path)

class AuthRouter:
    def __init__(self, auth_service: IAuthService, token_service: ITokenService):
        self.auth_service = auth_service
        self.token_service = token_service
        self.email_service = EmailService()
        
        self.oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.AUTH_API_PREFIX}/login")
        self.router = APIRouter(prefix=settings.AUTH_API_PREFIX, tags=["Auth"])
        
        self.register_routes()
    
    def register_routes(self):
        # Регистрация нового аккаунта
        self.router.add_api_route("/register", 
                                 self.register_user, 
                                 methods=["POST"], 
                                 responses={400: {"model": ErrorResponse}})
        
        # Верификация нового аккаунта
        self.router.add_api_route("/verify", 
                                 self.verify_code, 
                                 methods=["POST"], 
                                 responses={400: {"model": ErrorResponse}})
        
        # Аутентификация пользователя
        self.router.add_api_route("/login", 
                                 self.login_user, 
                                 methods=["POST"], 
                                 response_model=TokenResponse, 
                                 responses={400: {"model": ErrorResponse}})
        
        # Обновление токена
        self.router.add_api_route("/refresh", 
                                 self.refresh_token, 
                                 methods=["POST"], 
                                 response_model=TokenResponse, 
                                 responses={400: {"model": ErrorResponse}})
        
        # Выход из системы
        self.router.add_api_route("/logout", 
                                 self.logout, 
                                 methods=["POST"], 
                                 responses={400: {"model": ErrorResponse}})
        
        # Получение информации о аккаунте
        self.router.add_api_route("/me", 
                                 self.get_current_user_info, 
                                 methods=["GET"])
        
        # Восстановление забытого пароля(на почту приходит ссылка для сброса пароля)
        self.router.add_api_route("/forgot-password", 
                                 self.forgot_password, 
                                 methods=["POST"], 
                                 responses={400: {"model": ErrorResponse}})
   
        self.router.add_api_route("/reset-password", 
                                 self.reset_password, 
                                 methods=["POST"], 
                                 responses={400: {"model": ErrorResponse}})
        
        # Смена пароля авторизованным пользователем
        self.router.add_api_route("/change-password", 
                                 self.change_password, 
                                 methods=["POST"], 
                                 responses={400: {"model": ErrorResponse}})
    
        # Подтверждение смены пароля
        self.router.add_api_route("/verify-password-change", 
                                 self.verify_password_change, 
                                 methods=["POST"], 
                                 responses={400: {"model": ErrorResponse}})
        
        # Запрос на смену email
        self.router.add_api_route("/change-email", 
                                 self.change_email, 
                                 methods=["POST"], 
                                 responses={400: {"model": ErrorResponse}})
        
        # Подтверждение смены email
        self.router.add_api_route("/verify-email-change", 
                                 self.verify_email_change, 
                                 methods=["POST"], 
                                 responses={400: {"model": ErrorResponse}})
    
    async def register_user(self, data: UserRegisterRequest):
        success, user, error_message = await self.auth_service.register_user(
            email=data.email,
            password=data.password,
            first_name=data.first_name,
            last_name=data.last_name
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_message
            )
        
        return {"message": "Verification code sent"}
    
    async def verify_code(self, data: UserVerifyRequest):
        success, user_id, error_message = await self.auth_service.verify_user(data.code)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_message
            )
        
        return {"message": "Аккаунт успешно верифицирован. Теперь вы можете войти в систему."}
    
    async def login_user(self, data: UserLoginRequest):
        success, user_data, error_message = await self.auth_service.login_user(
            email=data.email,
            password=data.password
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=error_message
            )
        
        # токены с версией пароля
        password_version = user_data.get("password_version", 0)
            
        access_token = self.token_service.create_access_token(
            str(user_data[USER_ID]), 
            user_data[USER_ROLE_ID],
            user_data[USER_EMAIL],
            password_version=password_version
        )
        
        refresh_token = self.token_service.create_refresh_token(
            str(user_data[USER_ID]), 
            user_data[USER_ROLE_ID],
            user_data[USER_EMAIL],
            password_version=password_version
        )
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }
    
    async def refresh_token(self, data: RefreshRequest):
        """
        Обновляет access и refresh токены с помощью refresh токена
        """
        try:
            refresh_token = data.refresh_token
            
            if await TokenBlacklistService.is_token_blacklisted(refresh_token):
                logger.warning(f"Попытка обновить токен из черного списка: {refresh_token[:20]}...")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Токен отозван. Требуется повторная авторизация."
                )
            
            decoded = self.token_service.decode_jwt(refresh_token)
            if not decoded:
                logger.error(f"Недействительный refresh токен: {refresh_token[:20]}...")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Недействительный или истекший refresh токен"
                )
            
            # Проверяем, что это действительно refresh токен
            token_type = decoded.get("token_type")
            if token_type != "refresh":
                logger.error(f"Неверный тип токена для обновления, ожидался 'refresh', получен '{token_type}'")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Требуется refresh токен, передан '{token_type}'"
                )
            
            user_id = decoded.get("user_id")
            if not user_id:
                logger.error("В токене отсутствует идентификатор пользователя")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Недействительный токен"
                )
            
            # Сразу добавляем использованный токен в черный список
            # Это защищает от повторного использования refresh токена
            expires_at = datetime.fromtimestamp(decoded.get("exp", 0))
            await TokenBlacklistService.add_token_to_blacklist(refresh_token, expires_at)
            
            role_id = decoded.get("role_id")
            email = decoded.get("email")
            password_version = decoded.get("password_version", 0)
            
            access_token = self.token_service.create_access_token(
                user_id=user_id,
                role_id=role_id,
                email=email,
                password_version=password_version
            )
            
            new_refresh_token = self.token_service.create_refresh_token(
                user_id=user_id,
                role_id=role_id,
                email=email,
                password_version=password_version
            )
            
            return TokenResponse(
                access_token=access_token,
                refresh_token=new_refresh_token,
                token_type="bearer"
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Ошибка при обновлении токена: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при обновлении токена: {str(e)}"
            )
    
    async def logout(self, data: LogoutRequest, authorization: str = Header(None)):
        """
        Выход из системы. Отзывает токены.
        """
        try:
            if authorization:
                scheme, _, token = authorization.partition(" ")
                if scheme.lower() == "bearer" and token:
                    decoded = self.token_service.decode_jwt(token)
                    if decoded:
                        expires_at = datetime.fromtimestamp(decoded.get("exp", 0))
                        await TokenBlacklistService.add_token_to_blacklist(token, expires_at)
            
            if data.refresh_token:
                decoded = self.token_service.decode_jwt(data.refresh_token)
                if decoded:
                    expires_at = datetime.fromtimestamp(decoded.get("exp", 0))
                    await TokenBlacklistService.add_token_to_blacklist(data.refresh_token, expires_at)
            
            return {"detail": "Вы успешно вышли из системы"}
        except Exception as e:
            logger.error(f"Ошибка при выходе из системы: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при выходе из системы: {str(e)}"
            )
    
    async def get_current_user_info(self, authorization: str = Header(None)):
        token = await self.get_current_token(authorization)
        
        logger.info(f"Запрос /me с токеном: {token[:10]}...")
        
        decoded = self.token_service.decode_jwt(token)
        if not decoded:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Недействительный или истекший токен",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        user_id = decoded.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Недействительный токен: отсутствует ID пользователя",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        logger.info(f"Пользователь ID: {user_id}")
        
        user = await self.auth_service.get_user_by_id(int(user_id))
        if not user:
            logger.error(f"Пользователь с ID {user_id} не найден")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Пользователь не найден",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        logger.info(f"Пользователь найден: {user[USER_EMAIL]}")
        return {
            "user_id": user_id,
            "email": user[USER_EMAIL],
            "role_id": user[USER_ROLE_ID],
            "is_verified": user[USER_IS_VERIFIED],
            "first_name": user[USER_FIRST_NAME],
            "last_name": user[USER_LAST_NAME],
            "avatar_url": user[USER_AVATAR_URL]
        }
    
    async def forgot_password(self, data: ForgotPasswordRequest, request: Request = None):
        """
        Восстановление забытого пароля
        
        """
        if " " in data.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email не должен содержать пробелы"
            )
        
        success, reset_code, error_message = await self.auth_service.initiate_forgot_password(data.email)
        
        normalized_contact = self.auth_service.normalize_contact(data.email)
        
        reset_url = f"{settings.FRONTEND_URL}/auth/reset-password-form?code={reset_code or 'invalid'}&email={normalized_contact}"
        
        if success and reset_code:
            try:
                await self.email_service.send_reset_password_email(
                    normalized_contact, 
                    reset_url
                )
                
                #! В разработке выводим ссылку в консоль, в проде убрать!
                print(f"\n\nСсылка для сброса пароля: {reset_url}")
                print(f"Код для сброса пароля: {reset_code}\n\n")
                
                logger.info(f"Ссылка для сброса пароля отправлена на {normalized_contact}")
            except Exception as e:
                logger.error(f"Ошибка при отправке email для сброса пароля: {str(e)}")
        
        # Намеренно скрываем, существует ли пользователь с таким email
        return {"message": "Если указанный адрес зарегистрирован, на него будет отправлена ссылка для сброса пароля"}

    async def change_password(self, data: ChangePasswordRequest, authorization: str = Header(None)):
        """
        Смена пароля авторизованным пользователем
        
        """
        token = await self.get_current_token(authorization)
        
        logger.info(f"Запрос на смену пароля с токеном: {token[:20]}...")
        
        decoded = self.token_service.decode_jwt(token)
        if not decoded:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Недействительный или истекший токен",
                headers={"WWW-Authenticate": "Bearer"}
            )
            
        user_id = decoded.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Недействительный токен: отсутствует ID пользователя"
            )
        
        user = await self.auth_service.get_user_by_id(int(user_id))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь не найден"
            )
        
        is_password_valid = self.auth_service.verify_password(
            data.current_password, 
            user[USER_PASSWORD_HASH]
        )
        
        if not is_password_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный текущий пароль"
            )
            
        success, verification_code, error_message = await self.auth_service.initiate_password_change(user_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_message
            )
            
        #! Для тестирования, потом убрать
        print(f"\n\nКод верификации для смены пароля: {verification_code}\n\n")
        
        return {
            "message": "Код верификации отправлен на ваш email. Пожалуйста, подтвердите смену пароля, введя полученный код."
        }
    
    async def verify_email_change(self, data: VerifyEmailChangeRequest, authorization: str = Header(None)):
        """
        Верифицирует смену email по коду подтверждения
        """
        try:
            token = await self.get_current_token(authorization)
            
            decoded = self.token_service.decode_jwt(token)
            user_id = decoded.get("user_id")
            
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Недействительный токен"
                )
            
            success, error_message = await self.auth_service.verify_and_change_email(
                user_id, 
                data.new_email, 
                data.verification_code
            )
            
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=error_message or "Недействительный код или email"
                )
            
            # После смены email инвалидируем текущий токен
            # Пользователь должен заново войти с новым email
            expires_at = datetime.fromtimestamp(decoded.get("exp", 0))
            await TokenBlacklistService.add_token_to_blacklist(token, expires_at)
            
            return {"detail": "Email успешно изменен, требуется повторная авторизация"}
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Ошибка при верификации смены email: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при верификации смены email: {str(e)}"
            )

    async def change_email(self, data: ChangeEmailRequest, authorization: str = Header(None)):
        """
        Смена email авторизованного пользователя. Отправляет код верификации на новый email.
        """
        token = await self.get_current_token(authorization)
        
        if " " in data.new_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email не должен содержать пробелы"
            )
        
        decoded = self.token_service.decode_jwt(token)
        if not decoded:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Недействительный или истекший токен",
                headers={"WWW-Authenticate": "Bearer"}
            )
            
        user_id = decoded.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Недействительный токен: отсутствует ID пользователя"
            )
        
        success, verification_code, error_message = await self.auth_service.initiate_email_change(
            user_id,
            data.new_email
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_message
            )
        
        #! Для тестирования, потом убрать
        print(f"\n\nКод верификации для смены email: {verification_code}\n\n")
        
        normalized_contact = self.auth_service.normalize_contact(data.new_email)
        
        return {
            "message": "Код верификации отправлен на новый email. Пожалуйста, подтвердите смену email, введя полученный код.",
            "new_email": normalized_contact
        }

    async def verify_password_change(self, data: VerifyPasswordChangeRequest, authorization: str = Header(None)):
        """
        Верифицирует смену пароля по коду
        """
        try:
            token = await self.get_current_token(authorization)
            
            decoded = self.token_service.decode_jwt(token)
            user_id = decoded.get("user_id")
            
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Недействительный токен"
                )
            
            success, error_message = await self.auth_service.verify_and_change_password(
                user_id, 
                data.verification_code, 
                data.new_password
            )
            
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=error_message or "Недействительный код"
                )
            
            # После смены пароля нужно инвалидировать все токены
            expires_at = datetime.fromtimestamp(decoded.get("exp", 0))
            await TokenBlacklistService.add_token_to_blacklist(token, expires_at)
            
            return {"detail": "Пароль успешно изменен, требуется повторная авторизация"}
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Ошибка при верификации смены пароля: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при верификации смены пароля: {str(e)}"
            )

        
    async def reset_password(self, data: ResetPasswordRequest):
        """
        Обрабатывает запрос на сброс пароля с фронта. Принимает JSON: email, code, new_password, confirm_password.
        """
        try:
            await self._reset_password(data)
            
            return {
                "success": True,
                "message": "Пароль успешно изменен. Теперь вы можете войти с новым паролем."
            }
        except HTTPException as e:
            return {
                "success": False,
                "message": e.detail
            }

    async def _reset_password(self, data: ResetPasswordRequest):
        """
        Метод для обработки сброса пароля.
        """

        if " " in data.new_password or " " in data.confirm_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пароль не должен содержать пробелы"
            )
        
        if data.new_password != data.confirm_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пароли не совпадают"
            )
        
        normalized_contact = self.auth_service.normalize_contact(data.email)
        
        success, error_message = await self.auth_service.reset_password_with_code(
            data.email,
            data.code,
            data.new_password
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_message or "Неверный email или код подтверждения"
            )
        
        logger.info(f"Пароль успешно изменен для пользователя с email {data.email}")
        
        return {"message": "Пароль успешно изменен. Пожалуйста, войдите с новым паролем."}
    
    async def get_current_token(self, authorization: str = Header(None)):
        """
        Извлекает токен и проверяет его
        """
        if not authorization:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Требуется аутентификация",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверная схема аутентификации",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        if await TokenBlacklistService.is_token_blacklisted(token):
            logger.error(f"Токен в черном списке: {token[:20]}...")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Токен отозван. Требуется повторная авторизация.",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        try:
            decoded = self.token_service.decode_jwt(token)
            logger.info(f"Получен токен: {token[:20]}...")
            logger.info(f"Декодированный токен: {decoded}")
            
            if not decoded:
                logger.error(f"Токен не валиден: {token[:20]}...")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Недействительный или истекший токен",
                    headers={"WWW-Authenticate": "Bearer"}
                )
            
            token_type = decoded.get("token_type")
            logger.info(f"Тип токена: {token_type}")
            
            if token_type != "access":
                logger.error(f"Неверный тип токена, ожидался 'access', получен '{token_type}'")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Необходим access токен. Вы передали '{token_type}' токен.",
                    headers={"WWW-Authenticate": "Bearer"}
                )
            
            user_id = decoded.get("user_id")
            token_password_version = decoded.get("password_version", 0)
            
            user = await self.auth_service.get_user_by_id(int(user_id))
            
            if user:
                current_password_version = user.get("password_version", 0)
                
                logger.info(f"Версия пароля в токене: {token_password_version}, текущая версия: {current_password_version}")
                
                if token_password_version < current_password_version:
                    logger.error(f"Версия пароля в токене устарела. Токен: {token_password_version}, текущая: {current_password_version}")
            
                    # Добавляем устаревший токен в черный список
                    expires_at = datetime.fromtimestamp(decoded.get("exp", 0))
                    await TokenBlacklistService.add_token_to_blacklist(token, expires_at)
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Пароль был изменен. Требуется повторная авторизация.",
                        headers={"WWW-Authenticate": "Bearer"}
                    )
            
            logger.info(f"Токен валиден, пользователь: {decoded.get('user_id')}")
            return token
        except Exception as e:
            logger.exception(f"Ошибка при проверке токена: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Ошибка при проверке токена: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"}
            )