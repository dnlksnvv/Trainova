from fastapi import APIRouter, HTTPException, status, Request, UploadFile, File, Depends, Query
from fastapi.responses import JSONResponse
import logging
from typing import Dict, Optional, List
import os
import aiofiles
import imghdr
import uuid
import json

from profile.domain.schemas import (
    ProfileUpdateRequest,
    ProfileResponse,
    SubscriptionsResponse,
    PaymentsResponse,
    MessageResponse,
    ChangeNameRequest,
    ChangeAvatarRequest,
    PaymentMethodResponse,
    PaymentMethodsResponse,
    ChangePaymentMethodRequest,
    ErrorResponse,
    SubscriptionRequest,
    SubscriptionResponse,
    PayWithSavedMethodRequest,
    UserRatingResponse,
    FreeSubscriptionRequest,
    FreeSubscriptionResponse
)
from profile.domain.interfaces import IProfileService
from profile.infrastructure.auth_middleware import get_current_user
from config import settings

logger = logging.getLogger(__name__)

def get_current_user_id(request: Request) -> str:
    """Получает ID текущего пользователя из запроса."""
    user = get_current_user(request)
    return user["user_id"]

def _format_avatar_url(avatar_filename: str | None) -> str | None:
    """Формирует полный URL для аватара из имени файла"""
    if not avatar_filename:
        return None
    
    # Если уже содержит полный путь API (старый формат), возвращаем как есть
    if avatar_filename.startswith(f'{settings.PROFILE_API_PREFIX}{settings.AVATARS_PATH}/'):
        return avatar_filename
    
    # Если содержит полный путь файловой системы (/app/uploads/...), извлекаем только имя файла
    if avatar_filename.startswith('/app/uploads/avatars/'):
        filename = avatar_filename.split('/')[-1]  # Извлекаем только имя файла
        return f"{settings.PROFILE_API_PREFIX}{settings.AVATARS_PATH}/{filename}"
    
    # Если уже содержит путь /uploads/, извлекаем только имя файла
    if avatar_filename.startswith('/uploads/'):
        filename = avatar_filename.split('/')[-1]
        return f"{settings.PROFILE_API_PREFIX}{settings.AVATARS_PATH}/{filename}"
    
    # Если только имя файла, формируем полный путь
    return f"{settings.PROFILE_API_PREFIX}{settings.AVATARS_PATH}/{avatar_filename}"

class ProfileRouter:
    def __init__(self, profile_service: IProfileService):
        self.profile_service = profile_service
        self.router = APIRouter(prefix=settings.PROFILE_API_PREFIX, tags=["Profile"])
        
        # Регистрация маршрутов
        self.register_routes()
    
    def register_routes(self):
        
        # Получение профиля текущего пользователя
        self.router.add_api_route(
            "/me",
            self.get_my_profile,
            methods=["GET"],
            response_model=ProfileResponse,
            responses={404: {"model": ErrorResponse}}
        )
        
        # Получение публичных данных профиля пользователя по ID
        self.router.add_api_route(
            "/user/{user_id}",
            self.get_user_profile,
            methods=["GET"],
            responses={404: {"model": ErrorResponse}}
        )
        
        # Обновление профиля
        self.router.add_api_route(
            "/update",
            self.update_profile,
            methods=["PUT"],
            responses={400: {"model": ErrorResponse}}
        )
        
        # Получение списка подписок пользователя
        self.router.add_api_route(
            "/subscriptions",
            self.list_subscriptions,
            methods=["GET"],
            response_model=SubscriptionsResponse
        )
        
        # Получение истории платежей
        self.router.add_api_route(
            "/payments",
            self.list_payments,
            methods=["GET"],
            response_model=PaymentsResponse
        )
        
        # Обновление имени профиля
        self.router.add_api_route(
            "/name-change",
            self.change_name,
            methods=["PUT"],
            response_model=MessageResponse,
            responses={400: {"model": ErrorResponse}}
        )
        
        # Обновление аватара профиля
        self.router.add_api_route(
            "/avatar-change",
            self.change_avatar,
            methods=["PUT"],
            response_model=MessageResponse,
            responses={400: {"model": ErrorResponse}}
        )
        
        # Подписка на курс
        self.router.add_api_route(
            "/subscribe",
            self.subscribe,
            methods=["POST"],
            response_model=SubscriptionResponse,
            responses={400: {"model": ErrorResponse}}
        )
        
        # Бесплатная подписка на курс
        self.router.add_api_route(
            "/subscribe-free",
            self.subscribe_free,
            methods=["POST"],
            response_model=FreeSubscriptionResponse,
            responses={400: {"model": ErrorResponse}}
        )
        
        # Получение текущего метода оплаты
        self.router.add_api_route(
            "/payment-method",
            self.get_current_payment_method,
            methods=["GET"],
            response_model=PaymentMethodResponse,
            responses={404: {"model": ErrorResponse}}
        )
        
        # Изменение метода оплаты
        self.router.add_api_route(
            "/payment-method-change",
            self.change_payment_method,
            methods=["PUT"],
            response_model=MessageResponse,
            responses={400: {"model": ErrorResponse}}
        )
        
        # Получение списка методов оплаты пользователя
        self.router.add_api_route(
            "/payment-methods",
            self.get_payment_methods,
            methods=["GET"],
            response_model=PaymentMethodsResponse,
            responses={404: {"model": ErrorResponse}}
        )
        
        # Установка метода оплаты по умолчанию
        self.router.add_api_route(
            "/set-default-payment-method/{payment_method_id}",
            self.set_default_payment_method,
            methods=["PUT"],
            response_model=MessageResponse,
            responses={400: {"model": ErrorResponse}}
        )
        
        # Оплата с использованием сохраненного метода оплаты
        self.router.add_api_route(
            "/pay-with-saved-method",
            self.pay_with_saved_method,
            methods=["POST"],
            responses={400: {"model": ErrorResponse}}
        )
        
        # Отмена подписки
        self.router.add_api_route(
            "/subscriptions-cancel",
            self.cancel_user_subscription,
            methods=["DELETE"],
            response_model=MessageResponse,
            responses={400: {"model": ErrorResponse}}
        )
        
        # Переключение автопродления подписки
        self.router.add_api_route(
            "/subscriptions-toggle-recurring",
            self.toggle_subscription_recurring,
            methods=["PUT"],
            response_model=MessageResponse,
            responses={400: {"model": ErrorResponse}}
        )
        
        # Загрузка аватара
        self.router.add_api_route(
            "/upload-avatar",
            self.upload_avatar,
            methods=["POST"],
            response_model=Dict[str, str],
            responses={400: {"model": ErrorResponse}}
        )
        
        # Получение рейтинга пользователя (тренера)
        self.router.add_api_route(
            "/user/{user_id}/rating",
            self.get_user_rating,
            methods=["GET"],
            response_model=UserRatingResponse,
            responses={404: {"model": ErrorResponse}}
        )
        
        # Вебхук для YooKassa
        self.router.add_api_route(
            "/webhook/yookassa",
            self.yookassa_webhook,
            methods=["POST"]
        )
    
    async def get_my_profile(self, request: Request):
        try:
            user = get_current_user(request)
            user_id = user["user_id"]
            
            # Получение профиля из сервиса
            profile = await self.profile_service.get_profile(user_id)
            
            if not profile:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Профиль не найден"
                )
            
            return {
                "user_id": str(profile["id"]),
                "email": profile["email"],
                "role_id": profile["role_id"],
                "is_verified": profile["is_verified"],
                "first_name": profile.get("first_name") or "",
                "last_name": profile.get("last_name") or "",
                "description": profile.get("description"),
                "avatar_url": _format_avatar_url(profile.get("avatar_url"))
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Ошибка при получении профиля: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при получении профиля: {str(e)}"
            )
    
    async def get_user_profile(self, user_id: str, request: Request):
        try:
            # Проверяем, что пользователь авторизован
            current_user = get_current_user(request)
            
            # Получение профиля из сервиса
            profile = await self.profile_service.get_profile(user_id)
            
            if not profile:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Профиль не найден"
                )
            
            # Возвращаем только публичные данные
            return {
                "user_id": str(profile["id"]),
                "first_name": profile.get("first_name") or "",
                "last_name": profile.get("last_name") or "",
                "description": profile.get("description"),
                "avatar_url": _format_avatar_url(profile.get("avatar_url"))
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Ошибка при получении профиля пользователя {user_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при получении профиля: {str(e)}"
            )
    
    async def update_profile(self, data: ProfileUpdateRequest, request: Request):
        try:
            user = get_current_user(request)
            user_id = user["user_id"]
            
            # Обновление профиля через сервис
            profile_data = data.dict(exclude_unset=True)
            updated_profile = await self.profile_service.update_profile(user_id, profile_data)
            
            return updated_profile
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Ошибка при обновлении профиля: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при обновлении профиля: {str(e)}"
            )
    
    async def list_subscriptions(self, request: Request):
        try:
            user = get_current_user(request)
            user_id = user["user_id"]
            subscriptions = await self.profile_service.get_subscriptions(user_id)
            return {"subscriptions": subscriptions}
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Ошибка при получении списка подписок: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при получении списка подписок: {str(e)}"
            )
    
    async def list_payments(self, request: Request):
        try:
            user = get_current_user(request)
            user_id = user["user_id"]
            payments = await self.profile_service.get_payments(user_id)
            return {"payments": payments}
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Ошибка при получении истории платежей: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при получении истории платежей: {str(e)}"
            )
    
    async def change_name(self, data: ChangeNameRequest, request: Request):
        try:
            user = get_current_user(request)
            user_id = user["user_id"]
            
            # Создаем словарь только с необходимыми полями
            profile_data = {}
            if data.first_name is not None:
                profile_data["first_name"] = data.first_name
            if data.last_name is not None:
                profile_data["last_name"] = data.last_name
                
            # Обновляем профиль через сервис
            result = await self.profile_service.update_profile(user_id, profile_data)
            
            if result:
                return {"message": "Имя успешно изменено"}
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Не удалось изменить имя"
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Ошибка при изменении имени: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при изменении имени: {str(e)}"
            )
    
    async def change_avatar(self, data: ChangeAvatarRequest, request: Request):
        try:
            user = get_current_user(request)
            user_id = user["user_id"]
            
            # Обновление аватара через сервис
            profile_data = {"avatar_url": data.avatar_url}
            result = await self.profile_service.update_profile(user_id, profile_data)
            
            if result:
                return {"message": "Аватар успешно изменен"}
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Не удалось изменить аватар"
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Ошибка при изменении аватара: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при изменении аватара: {str(e)}"
            )
    
    async def get_current_payment_method(self, request: Request) -> PaymentMethodResponse:
        try:
            user = get_current_user(request)
            user_id = user["user_id"]
            method = await self.profile_service.get_payment_method(user_id)
            
            if not method:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Метод оплаты не найден"
                )
            
            logger.info(f"Преобразование данных в PaymentMethodResponse: {method}")
            return PaymentMethodResponse(**method)
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Ошибка при получении метода оплаты: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при получении метода оплаты: {str(e)}"
            )
    
    async def change_payment_method(self, data: ChangePaymentMethodRequest, request: Request):
        try:
            user = get_current_user(request)
            user_id = user["user_id"]
            
            result = await self.profile_service.update_payment_method(user_id, data.dict())
            
            if result:
                return {"message": "Метод оплаты успешно изменен"}
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Не удалось изменить метод оплаты"
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Ошибка при изменении метода оплаты: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при изменении метода оплаты: {str(e)}"
            )
    
    async def subscribe(self, request: SubscriptionRequest, user_id: str = Depends(get_current_user_id)) -> SubscriptionResponse:
        """Подписка на курс."""
        try:
            result = await self.profile_service.subscribe_to_course(user_id, request.course_uuid, request.payment_method_id)
            
            # Формируем ответ согласно схеме SubscriptionResponse
            if result["status"] == "error":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=result["message"]
                )
                
            # Возвращаем ответ с данными платежа
            return SubscriptionResponse(
                message=result.get("message", "Подписка оформлена"),
                payment_id=result.get("payment_id", ""),
                confirmation_url=result.get("confirmation_url", "")
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Ошибка при подписке на курс: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при подписке на курс: {str(e)}"
            )
    
    async def subscribe_free(self, request_data: FreeSubscriptionRequest, user_id: str = Depends(get_current_user_id)) -> FreeSubscriptionResponse:
        """Бесплатная подписка на курс."""
        try:
            result = await self.profile_service.subscribe_to_course_free(user_id, request_data.course_uuid)
            
            # Формируем ответ согласно схеме FreeSubscriptionResponse
            if result["status"] == "error":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=result["message"]
                )
                
            # Возвращаем ответ с данными подписки
            return FreeSubscriptionResponse(
                message=result.get("message", "Доступ к бесплатному курсу получен"),
                subscription_uuid=result.get("subscription_uuid", "")
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Ошибка при бесплатной подписке на курс: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при подписке на курс: {str(e)}"
            )
    
    async def yookassa_webhook(self, request: Request):
        """
        Обработка вебхука от YooKassa
        """
        try:
            # Получаем данные из тела запроса
            webhook_data = await request.json()
            
            # Обрабатываем вебхук через сервис
            result = await self.profile_service.process_payment_webhook(webhook_data)
            
            if result:
                return JSONResponse(content={"status": "success"})
            else:
                return JSONResponse(content={"status": "error"}, status_code=400)
                 
        except Exception as e:
            logger.exception(f"Ошибка при обработке вебхука YooKassa: {str(e)}")
            return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)

    async def get_payment_methods(self, request: Request):
        """
        Получение списка всех методов оплаты пользователя
        """
        try:
            user = get_current_user(request)
            user_id = user["user_id"]
            
            # Получение методов оплаты из сервиса
            payment_methods = await self.profile_service.get_payment_methods(user_id)
            
            return {"payment_methods": payment_methods}
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Ошибка при получении методов оплаты: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при получении методов оплаты: {str(e)}"
            )
    
    async def set_default_payment_method(self, payment_method_id: str, request: Request):
        """
        Установка метода оплаты по умолчанию
        """
        try:
            user = get_current_user(request)
            user_id = user["user_id"]
            
            # Установка метода оплаты по умолчанию
            success = await self.profile_service.set_default_payment_method(user_id, payment_method_id)
            
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Не удалось установить метод оплаты по умолчанию"
                )
            
            return {"message": "Метод оплаты успешно установлен по умолчанию"}
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Ошибка при установке метода оплаты по умолчанию: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при установке метода оплаты по умолчанию: {str(e)}"
            )
    
    async def pay_with_saved_method(self, data: PayWithSavedMethodRequest, request: Request):
        """
        Оплата с использованием сохраненного метода оплаты
        """
        try:
            user = get_current_user(request)
            user_id = user["user_id"]
            
            # Оплата с использованием сохраненного метода
            result = await self.profile_service.pay_with_saved_method(
                user_id, 
                data.course_uuid, 
                data.payment_method_id
            )
            
            return result
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Ошибка при оплате с использованием сохраненного метода: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при оплате: {str(e)}"
            )

    async def cancel_user_subscription(self, request: Request, course_id: str = Query(..., description="UUID курса для отмены подписки")):
        """
        Отмена подписки на курс
        """
        try:
            user = get_current_user(request)
            user_id = user["user_id"]
            
            # Отмена подписки через сервис (передаем course_id)
            result = await self.profile_service.cancel_subscription(user_id, course_id)
            
            if result:
                return {"message": "Подписка успешно отменена"}
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Не удалось отменить подписку"
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Ошибка при отмене подписки: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при отмене подписки: {str(e)}"
            )

    async def toggle_subscription_recurring(self, subscription_id: str, request: Request):
        """
        Переключение автопродления подписки
        """
        try:
            user = get_current_user(request)
            user_id = user["user_id"]
            
            # Переключение автопродления подписки через сервис
            result = await self.profile_service.toggle_subscription_recurring(user_id, subscription_id)
            
            if result:
                return {"message": "Автопродление подписки успешно переключено"}
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Не удалось переключить автопродление подписки"
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Ошибка при переключении автопродления подписки: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при переключении автопродления подписки: {str(e)}"
            )

    async def upload_avatar(self, file: UploadFile, request: Request):
        """
        Загрузка аватара
        """
        try:
            user = get_current_user(request)
            user_id = user["user_id"]
            
            # Проверка типа файла
            if file.content_type not in ["image/jpeg", "image/png"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Недопустимый тип файла. Допустимые типы: image/jpeg, image/png"
                )
            
            # Сохранение файла
            filename = f"{uuid.uuid4()}.{imghdr.what(file.file)}"
            file_path = f"{settings.UPLOAD_FOLDER}/avatars/{filename}"
            async with aiofiles.open(file_path, 'wb') as f:
                while chunk := await file.read(1024):
                    await f.write(chunk)
            
            # Обновление аватара через сервис - сохраняем только filename в БД
            result = await self.profile_service.update_avatar(user_id, filename, "")
            
            if result:
                return {"message": "Аватар успешно загружен"}
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Не удалось загрузить аватар"
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Ошибка при загрузке аватара: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при загрузке аватара: {str(e)}"
            )

    async def get_user_rating(self, user_id: str, request: Request):
        """
        Получает рейтинг пользователя (тренера)
        
        Args:
            user_id: ID пользователя (тренера)
            request: HTTP запрос
            
        Returns:
            UserRatingResponse: Информация о рейтинге пользователя
        """
        try:
            # Получаем рейтинг тренера
            rating_data = await self.profile_service.get_user_rating(user_id)
            
            # Получаем количество подписчиков
            subscribers_count = await self.profile_service.get_user_subscribers_count(user_id)
            
            if not rating_data:
                return UserRatingResponse(
                    user_id=int(user_id),
                    rating=0.0,
                    rating_count=0,
                    subscribers_count=subscribers_count
                )
            
            return UserRatingResponse(
                user_id=rating_data["user_id"],
                rating=rating_data["rating"],
                rating_count=rating_data["rating_count"],
                subscribers_count=subscribers_count
            )
            
        except Exception as e:
            logger.error(f"Ошибка при получении рейтинга пользователя {user_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при получении рейтинга пользователя: {str(e)}"
            )

# Этот роутер будет инициализирован в main.py с настоящим сервисом# Здесь создаем только класс роутера# profile_router будет создан в main.py