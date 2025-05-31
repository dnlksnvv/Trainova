from datetime import datetime, date, timedelta, timezone
from typing import Dict, List, Optional, Any
import os
import uuid
import logging
from fastapi import UploadFile
import json
from yookassa import Configuration, Payment

from profile.domain.interfaces import IProfileService
from profile.infrastructure.profile_repository import ProfileRepository
from config import settings

logger = logging.getLogger(__name__)

class ProfileServiceImpl(IProfileService):
    
    def __init__(self, repository: Optional[ProfileRepository] = None):
        self.repository = repository or ProfileRepository()
        self.upload_folder = settings.UPLOAD_FOLDER
        os.makedirs(self.upload_folder, exist_ok=True)
        
        # Инициализация YooKassa с тестовыми ключами
        Configuration.account_id = settings.YOOKASSA_ACCOUNT_ID or '380955'
        Configuration.secret_key = settings.YOOKASSA_SECRET_KEY or 'test_BfCpnEuulpV84mNzYhVTSFOsdrHFHxPYnN_I_8ZCaGE'
    
    async def get_profile(self, user_id: str) -> Dict[str, Any]:
        profile = await self.repository.get_profile(user_id)
        
        if not profile:
            # Если профиль не найден, возвращаем пустой профиль
            return {
                "user_id": user_id,
                "first_name": "",
                "last_name": "",
                "email": "",
                "phone": "",
                "avatar_url": ""
            }
        
        return profile
    
    async def update_profile(self, user_id: str, data: Dict) -> Dict[str, Any]:
        # Фильтрация данных для обновления - только разрешенные поля
        allowed_fields = ["first_name", "last_name", "avatar_url", "description"]
        filtered_data = {k: v for k, v in data.items() if k in allowed_fields and v is not None}
        
        # Обновление профиля в репозитории
        profile = await self.repository.update_profile(user_id, filtered_data)
        if not profile:
            return {}
        return profile
    
    async def update_avatar(self, user_id: str, avatar_url: str, verification_code: str = "") -> bool:
        try:
            # Конвертируем user_id в int для БД
            numeric_id = int(user_id)
            return await self.repository.update_avatar(numeric_id, avatar_url)
        except ValueError as e:
            logger.error(f"Некорректный формат user_id: {user_id}")
            return False
        except Exception as e:
            logger.error(f"Ошибка при обновлении аватара пользователя {user_id}: {str(e)}")
            return False
    
    async def subscribe_to_course(self, user_id: str, course_uuid: str, payment_method_id: Optional[str] = None) -> Dict[str, Any]:
        """Реализация подписки на курс с оплатой через YooKassa"""
        try:
            logger.info(f"Попытка оформления подписки на курс {course_uuid} пользователем {user_id}")
            if payment_method_id:
                logger.info(f"Используется сохраненный метод оплаты: {payment_method_id}")
            
            # Получение информации о курсе из базы данных
            course_info = await self.repository.get_course_info(course_uuid)
            
            if not course_info:
                logger.error(f"Информация о курсе {course_uuid} не найдена")
                return {
                    "message": "Информация о курсе не найдена. Невозможно оформить подписку.",
                    "status": "error"
                }
            
            # Проверка: является ли пользователь владельцем курса
            if str(course_info.get("user_id")) == str(user_id):
                logger.info(f"Пользователь {user_id} является владельцем курса {course_uuid}. Подписка невозможна.")
                return {
                    "message": "Вы не можете оформить подписку на собственный курс.",
                    "status": "error"
                }
            
            # Проверяем, есть ли у пользователя активная подписка на этот курс
            active_subscription = await self.repository.get_active_subscription(user_id, course_uuid)
            
            if active_subscription:
                subscription_status = active_subscription.get("status")
                
                # Если это бесплатная подписка
                if subscription_status == "free":
                    logger.info(f"У пользователя {user_id} уже есть бесплатная подписка на курс {course_uuid}")
                    return {
                        "message": "У вас уже есть бесплатная подписка на этот курс. Отмените её перед оформлением платной.",
                        "status": "error"
                    }
                
                # Если это платная подписка, проверяем срок действия
                elif subscription_status == "active":
                    now = datetime.utcnow().replace(tzinfo=timezone.utc)
                    end_date = active_subscription.get("end_date")
                    
                    if end_date and end_date > now:
                        logger.info(f"У пользователя {user_id} уже есть активная подписка на курс {course_uuid}, действующая до {end_date}")
                        return {
                            "message": f"У вас уже есть активная подписка на этот курс, действующая до {end_date.strftime('%d.%m.%Y')}.",
                            "status": "error",
                            "subscription": active_subscription
                        }
                    else:
                        # Если срок действия подписки истек, обновляем ее статус
                        logger.info(f"Подписка пользователя {user_id} на курс {course_uuid} истекла, обновляем статус")
                        subscription_uuid = active_subscription.get("subscription_uuid")
                        if subscription_uuid:
                            await self.repository.update_subscription_status(subscription_uuid, "expired")
            
            # Если указан ID метода оплаты, проверяем его наличие и доступность
            if payment_method_id:
                payment_method = await self.repository.get_payment_method_by_id(payment_method_id)
                
                if not payment_method:
                    logger.error(f"Метод оплаты {payment_method_id} не найден")
                    return {
                        "message": "Указанный метод оплаты не найден.",
                        "status": "error"
                    }
                
                # Проверяем, принадлежит ли метод оплаты пользователю
                if str(payment_method.get("user_id")) != str(user_id):
                    logger.error(f"Метод оплаты {payment_method_id} не принадлежит пользователю {user_id}")
                    return {
                        "message": "У вас нет доступа к указанному методу оплаты.",
                        "status": "error"
                    }
                    
                # Проверяем, что метод оплаты верифицирован и сохранен
                if not payment_method.get("is_verified") or not payment_method.get("is_saved"):
                    logger.error(f"Метод оплаты {payment_method_id} не верифицирован или не сохранен")
                    return {
                        "message": "Указанный метод оплаты недоступен для использования.",
                        "status": "error"
                    }
            
            # Создание платежа в YooKassa
            try:
                amount = course_info.get("price") or 0
                # Преобразуем Decimal в строку для YooKassa
                amount_str = str(amount)
                
                logger.info(f"Создание платежа в YooKassa на сумму {amount_str} RUB за курс {course_info.get('name')}")
                
                # Базовые данные для создания платежа
                payment_data = {
                    "amount": {"value": amount_str, "currency": "RUB"},
                    "confirmation": {
                        "type": "redirect",
                        "return_url": f"{settings.FRONTEND_URL}/courses/{course_uuid}/"
                    },
                    "capture": True,
                    "description": f"Оплата курса: {course_info.get('name')}"
                }
                
                # Если указан существующий метод оплаты, используем его
                if payment_method_id:
                    payment_data["payment_method_id"] = payment_method_id
                else:
                    # Иначе, создаем новый метод оплаты
                    payment_data["payment_method_data"] = {"type": "bank_card"}
                
                # Создаем платеж через YooKassa
                payment = Payment.create(payment_data)
                
                # Вывод полной информации о платеже для отладки
                print("\n=== ДЕТАЛЬНАЯ ИНФОРМАЦИЯ О ПЛАТЕЖЕ ===")
                print(f"🔍 Используем метод оплаты ID: {payment_method_id if payment_method_id else 'Новый метод'}")
                
                # Безопасный доступ к атрибутам с проверкой на None
                confirmation_url = ""
                if hasattr(payment, 'confirmation') and payment.confirmation is not None:
                    confirmation_url = getattr(payment.confirmation, 'confirmation_url', "")
                    print(f"🔗 Полная ссылка для подтверждения оплаты: {confirmation_url}")
                else:
                    print("🔗 Ссылка для подтверждения не найдена")
                
                print(f"🆔 UUID платежа: {payment.id}")
                print(f"📌 Статус: {payment.status}")
                
                # Безопасный доступ к атрибутам amount
                amount_value = ""
                amount_currency = "RUB"
                if hasattr(payment, 'amount') and payment.amount is not None:
                    amount_value = getattr(payment.amount, 'value', "")
                    amount_currency = getattr(payment.amount, 'currency', "RUB")
                    print(f"💰 Сумма: {amount_value} {amount_currency}")
                else:
                    print("💰 Информация о сумме не найдена")
                
                print(f"📅 Дата создания: {payment.created_at}")
                print(f"💳 Тип метода оплаты: {getattr(payment.payment_method, 'type', 'N/A')}")
                
                # Информация о карте, если доступна
                card = getattr(payment.payment_method, 'card', None)
                if card:
                    print(f"💳 Последние 4 цифры карты: {getattr(card, 'last4', 'N/A')}")
                    print(f"💳 Тип карты: {getattr(card, 'card_type', 'N/A')}")
                
                print(f"💾 ID способа оплаты: {getattr(payment.payment_method, 'id', 'N/A')}")
                print(f"✅ Сохранен: {getattr(payment.payment_method, 'saved', 'N/A')}")
                
                # Вывод полного JSON ответа
                print("\n📦 Полный JSON-ответ платежа:")
                if hasattr(payment, 'json'):
                    try:
                        print(json.dumps(payment.json(), indent=2, ensure_ascii=False))
                    except:
                        print("Не удалось вывести JSON ответ")
                
                print("=== КОНЕЦ ИНФОРМАЦИИ О ПЛАТЕЖЕ ===\n")
                
                # Получаем информацию о методе оплаты, если она доступна
                payment_method = getattr(payment, 'payment_method', None)
                payment_method_type = "bank_card"
                payment_method_id = None
                
                # Инициализируем переменные для данных о карте
                card_last4 = None
                card_type = None
                card_expiry_month = None
                card_expiry_year = None
                issuer_country = None
                is_saved = False
                title = None
                
                if payment_method is not None:
                    payment_method_type = getattr(payment_method, 'type', "bank_card")
                    payment_method_id = getattr(payment_method, 'id', None)
                    is_saved = getattr(payment_method, 'saved', False)
                    title = getattr(payment_method, 'title', None)
                    
                    # Если у платежа есть информация о карте, сохраняем ее
                    card = getattr(payment_method, 'card', None)
                    if card is not None:
                        card_last4 = getattr(card, 'last4', None)
                        card_type = getattr(card, 'card_type', None)
                        card_expiry_month = getattr(card, 'expiry_month', None)
                        card_expiry_year = getattr(card, 'expiry_year', None)
                        issuer_country = getattr(card, 'issuer_country', None)
                        
                        # Если нет заголовка метода оплаты, создаем его на основе данных карты
                        if title is None and card_last4 is not None:
                            card_type_display = card_type or "Card"
                            title = f"{card_type_display} *{card_last4}"
                
                # Создаем запись о платеже в базе данных
                payment_data = {
                    "payment_id": payment.id,
                    "user_id": user_id,
                    "course_id": course_uuid,
                    "course_name": course_info.get("name") or "Название курса",
                    "amount": amount,
                    "status": payment.status,
                    "payment_method_id": payment_method_id,
                    "confirmation_url": confirmation_url
                }
                
                # Сохраняем платеж в базе данных
                db_payment = await self.repository.create_payment(payment_data)
                
                if not db_payment:
                    logger.error(f"Не удалось создать запись о платеже в БД для подписки пользователя {user_id} на курс {course_uuid}")
                    return {
                        "message": "Не удалось обработать платеж. Попробуйте позже.",
                        "status": "error"
                    }
                
                # Если у платежа есть ID метода оплаты, сохраняем его в базе данных
                if payment_method_id is not None and payment_method is not None and not await self.repository.get_payment_method_by_id(payment_method_id):
                    payment_method_details = {}
                    if hasattr(payment_method, 'json'):
                        try:
                            payment_method_details = payment_method.json()
                        except:
                            # Если метод json не сработал, пытаемся преобразовать объект в словарь
                            payment_method_details = {}
                    
                    payment_method_data = {
                        "payment_method_id": payment_method_id,
                        "user_id": user_id,
                        "method_type": payment_method_type,
                        "is_saved": False,  # Метод не сохраняется до подтверждения оплаты
                        "title": title,
                        "card_last4": card_last4,
                        "card_type": card_type,
                        "card_expiry_month": card_expiry_month,
                        "card_expiry_year": card_expiry_year,
                        "issuer_country": issuer_country,
                        "is_default": False,  # Новые методы оплаты не будут дефолтными до подтверждения оплаты
                        "is_verified": False,  # Новые методы оплаты не будут верифицированными до подтверждения оплаты
                        "details": payment_method_details
                    }
                    
                    await self.repository.save_payment_method(payment_method_data)
                
                # Возвращаем только необходимые данные для фронтенда
                return {
                    "message": "Платеж создан. Перейдите по ссылке для оплаты.",
                    "status": "success",
                    "payment_id": payment.id,
                    "confirmation_url": confirmation_url
                }
                
            except Exception as e:
                logger.error(f"Ошибка при создании платежа в YooKassa: {str(e)}")
                return {
                    "message": f"Ошибка при создании платежа: {str(e)}",
                    "status": "error"
                }
            
        except Exception as e:
            logger.error(f"Ошибка при оформлении подписки на курс {course_uuid} пользователем {user_id}: {str(e)}")
            return {
                "message": f"Ошибка при оформлении подписки: {str(e)}",
                "status": "error"
            }
    
    async def subscribe_to_course_free(self, user_id: str, course_uuid: str) -> Dict[str, Any]:
        """Реализация бесплатной подписки на курс"""
        try:
            logger.info(f"Попытка оформления бесплатной подписки на курс {course_uuid} пользователем {user_id}")
            
            # Получение информации о курсе из базы данных
            course_info = await self.repository.get_course_info(course_uuid)
            
            if not course_info:
                logger.error(f"Информация о курсе {course_uuid} не найдена")
                return {
                    "message": "Информация о курсе не найдена",
                    "status": "error"
                }
            
            # Проверяем, что курс действительно бесплатный
            course_price = course_info.get("price", 0)
            if course_price and course_price > 0:
                logger.error(f"Курс {course_uuid} не является бесплатным (цена: {course_price})")
                return {
                    "message": "Данный курс не является бесплатным",
                    "status": "error"
                }
            
            # Проверка: является ли пользователь владельцем курса
            if str(course_info.get("user_id")) == str(user_id):
                logger.info(f"Пользователь {user_id} является владельцем курса {course_uuid}. Подписка невозможна.")
                return {
                    "message": "Вы не можете оформить подписку на собственный курс",
                    "status": "error"
                }
            
            # Проверяем, есть ли у пользователя активная подписка на этот курс
            active_subscription = await self.repository.get_active_subscription(user_id, course_uuid)
            
            if active_subscription:
                subscription_status = active_subscription.get("status")
                if subscription_status == "free":
                    logger.info(f"У пользователя {user_id} уже есть бесплатная подписка на курс {course_uuid}")
                    return {
                        "message": "У вас уже есть бесплатная подписка на этот курс",
                        "status": "error"
                    }
                elif subscription_status == "active":
                    logger.info(f"У пользователя {user_id} уже есть платная подписка на курс {course_uuid}")
                    return {
                        "message": "У вас уже есть платная подписка на этот курс",
                        "status": "error"
                    }
                else:
                    logger.info(f"У пользователя {user_id} уже есть подписка на курс {course_uuid} со статусом {subscription_status}")
                    return {
                        "message": "У вас уже есть доступ к этому курсу",
                        "status": "error"
                    }
            
            # Создаем бесплатную подписку
            subscription_data = {
                "user_id": user_id,
                "course_id": course_uuid,
                "course_name": course_info.get("name", "Бесплатный курс"),
                "status": "free",
                "price": 0
            }
            
            subscription_uuid = await self.repository.create_free_subscription(subscription_data)
            
            if not subscription_uuid:
                logger.error(f"Не удалось создать бесплатную подписку для пользователя {user_id} на курс {course_uuid}")
                return {
                    "message": "Не удалось оформить подписку. Попробуйте позже",
                    "status": "error"
                }
            
            logger.info(f"Бесплатная подписка успешно создана для пользователя {user_id} на курс {course_uuid}")
            
            return {
                "message": "Доступ к бесплатному курсу успешно получен",
                "status": "success",
                "subscription_uuid": subscription_uuid
            }
            
        except Exception as e:
            logger.error(f"Ошибка при оформлении бесплатной подписки на курс {course_uuid} пользователем {user_id}: {str(e)}")
            return {
                "message": f"Ошибка при оформлении подписки: {str(e)}",
                "status": "error"
            }
    
    async def get_subscriptions(self, user_id: str) -> List[Dict]:
        # Получаем все подписки пользователя
        subscriptions = await self.repository.get_subscriptions(user_id)
        
        # Проверяем статусы подписок и обновляем их при необходимости
        now = datetime.utcnow().replace(tzinfo=timezone.utc)
        valid_subscriptions = []
        
        for subscription in subscriptions:
            # Проверяем, истекла ли подписка
            end_date = subscription.get("end_date")
            status = subscription.get("status")
            subscription_uuid = subscription.get("subscription_uuid")
            course_id = subscription.get("course_id")
            
            # Преобразуем строковое представление в datetime если нужно для проверки
            end_date_dt = None
            if end_date:
                if isinstance(end_date, str):
                    try:
                        end_date_dt = datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc)
                    except ValueError:
                        logger.error(f"Некорректный формат даты окончания подписки: {end_date}")
                        end_date_dt = None
                elif isinstance(end_date, datetime):
                    end_date_dt = end_date
                    # Преобразуем datetime обратно в строку для ответа
                    subscription["end_date"] = end_date.isoformat()
            
            # Если подписка активна, но дата окончания в прошлом, обновляем статус
            if status == "active" and end_date_dt and end_date_dt < now:
                active_subscription_uuid = subscription.get("subscription_uuid")
                if active_subscription_uuid is not None and isinstance(active_subscription_uuid, (str, int)):
                    logger.info(f"Подписка пользователя {user_id} на курс {subscription_uuid} истекла, обновляем статус")
                    await self.repository.update_subscription_status(str(active_subscription_uuid), "expired")
                    subscription["status"] = "expired"
                    status = "expired"  # Обновляем локальную переменную
            
            # Специальная обработка для бесплатных подписок
            if status == "free" and course_id:
                course_info = await self.repository.get_course_info(str(course_id))
                if course_info:
                    current_price = course_info.get("price")
                    # Если курс стал платным (цена больше 0), то завершаем бесплатную подписку
                    if current_price and current_price > 0:
                        logger.info(f"Курс {course_id} стал платным (цена: {current_price}), завершаем бесплатную подписку {subscription_uuid}")
                        await self.repository.update_subscription_status(str(subscription_uuid), "expired")
                        subscription["status"] = "expired"
                        status = "expired"  # Обновляем локальную переменную
                    else:
                        # Курс остается бесплатным, оставляем подписку активной
                        logger.info(f"Курс {course_id} остается бесплатным, подписка {subscription_uuid} остается активной")
                        subscription["course_name"] = course_info.get("name", "Неизвестный курс")
                        subscription["price"] = 0  # Бесплатный курс
            
            # Добавляем активные и бесплатные подписки
            if status in ["active", "free"]:
                # Получаем информацию о курсе для активных подписок (если еще не получена)
                if course_id and "course_name" not in subscription:
                    course_info = await self.repository.get_course_info(str(course_id))
                    if course_info:
                        subscription["course_name"] = course_info.get("name", "Неизвестный курс")
                        subscription["price"] = course_info.get("price", 0)
                
                # Вычисляем оставшиеся дни до окончания подписки (только для активных платных подписок)
                if status == "active" and end_date_dt:
                    days_left = (end_date_dt - now).days
                    subscription["days_left"] = max(0, days_left)
                elif status == "free":
                    # Для бесплатных подписок дни не ограничены
                    subscription["days_left"] = None
                
                # Убеждаемся, что все даты в подписке являются строками
                for date_field in ["start_date", "end_date", "created_at", "updated_at"]:
                    if date_field in subscription and isinstance(subscription[date_field], datetime):
                        subscription[date_field] = subscription[date_field].isoformat()
                
                valid_subscriptions.append(subscription)
        
        return valid_subscriptions
    
    async def get_payments(self, user_id: str) -> List[Dict]:
        """
        Получает историю платежей пользователя с дополнительной информацией о методах оплаты.
        
        Args:
            user_id: ID пользователя
            
        Returns:
            List[Dict]: Список платежей с информацией о методах оплаты
        """
        try:
            # Получаем платежи из репозитория
            payments = await self.repository.get_payments(user_id)
            
            # Обрабатываем каждый платеж
            processed_payments = []
            for payment in payments:
                # Создаем копию платежа для обработки
                processed_payment = dict(payment)
                
                # Обрабатываем payment_date
                if processed_payment.get('payment_date') is None:
                    processed_payment['payment_date'] = None
                elif isinstance(processed_payment.get('payment_date'), str):
                    # Если уже строка, оставляем как есть
                    pass
                else:
                    # Если это объект datetime или date, преобразуем в строку
                    try:
                        processed_payment['payment_date'] = processed_payment['payment_date'].isoformat()
                    except:
                        processed_payment['payment_date'] = None
                
                # Получаем информацию о методе оплаты
                payment_method_id = processed_payment.get('payment_method_id')
                payment_method_name = ""
                
                if payment_method_id:
                    try:
                        payment_method_info = await self.repository.get_payment_method_by_id(payment_method_id)
                        if payment_method_info:
                            method_type = payment_method_info.get('method_type', '')
                            title = payment_method_info.get('title', '')
                            
                            # Используем title, если есть, иначе method_type
                            if title:
                                payment_method_name = title
                            elif method_type:
                                payment_method_name = method_type
                            else:
                                payment_method_name = "Неизвестный метод"
                        else:
                            payment_method_name = "Метод не найден"
                    except Exception as e:
                        logger.warning(f"Ошибка при получении информации о методе оплаты {payment_method_id}: {str(e)}")
                        payment_method_name = "Ошибка получения метода"
                
                # Добавляем информацию о методе оплаты
                processed_payment['payment_method'] = payment_method_name
                
                processed_payments.append(processed_payment)
            
            logger.info(f"Обработано {len(processed_payments)} платежей для пользователя {user_id}")
            return processed_payments
            
        except Exception as e:
            logger.error(f"Ошибка при получении платежей пользователя {user_id}: {str(e)}")
            return []
    
    async def cancel_subscription(self, user_id: str, course_id: str) -> bool:
        return await self.repository.cancel_subscription(user_id, course_id)
    
    async def toggle_subscription_recurring(self, user_id: str, course_id: str) -> bool:
        """
        Переключает статус автопродления подписки.
        
        Args:
            user_id: ID пользователя
            course_id: ID курса
            
        Returns:
            bool: Успешность операции
        """
        return await self.repository.toggle_subscription_recurring(user_id, course_id)
    
    async def get_payment_method(self, user_id: str) -> Dict:
        method = await self.repository.get_payment_method(user_id)
        logger.info(f"Получен метод оплаты из репозитория: {method}")
        
        if not method:
            return {"method": "", "details": {}}
        
        # Данные уже преобразованы в нужный формат в репозитории
        return method
    
    async def update_payment_method(self, user_id: str, data: Dict) -> bool:
        method_type = data.get("method", "")
        details = data.get("details", {})
        
        # Извлекаем данные о карте из details, если они есть
        card_data = details.get("card", {})
        
        # Создаем данные для сохранения метода оплаты
        payment_method_data = {
            "payment_method_id": str(uuid.uuid4()),  # Генерируем новый ID
            "user_id": user_id,
            "method_type": method_type,
            "is_saved": False,  # Метод не сохраняется до подтверждения оплаты
            "is_default": False,  # Метод оплаты не будет дефолтным до подтверждения оплаты
            "is_verified": False,  # Метод оплаты не будет верифицированным до подтверждения оплаты
            "details": details
        }
        
        # Добавляем данные о карте, если они есть
        if card_data:
            payment_method_data.update({
                "card_last4": card_data.get("last4"),
                "card_type": card_data.get("card_type"),
                "card_expiry_month": card_data.get("expiry_month"),
                "card_expiry_year": card_data.get("expiry_year"),
                "issuer_country": card_data.get("issuer_country")
            })
            
            # Создаем заголовок метода оплаты на основе данных карты
            if card_data.get("last4"):
                card_type_display = card_data.get("card_type", "Card")
                payment_method_data["title"] = f"{card_type_display} *{card_data.get('last4')}"
        
        # Сохраняем метод оплаты
        result = await self.repository.save_payment_method(payment_method_data)
        return bool(result)
    
    async def process_payment_webhook(self, payment_data: Dict[str, Any]) -> bool:
        """
        Обрабатывает данные вебхука о платеже от YooKassa.
        
        Args:
            payment_data: Данные платежа из вебхука
            
        Returns:
            bool: Успешность обработки вебхука
        """
        try:
            logger.info(f"Обработка вебхука платежа: {json.dumps(payment_data, ensure_ascii=False)}")
            
            # ЮKassa присылает данные в object
            payment_object = payment_data.get("object", {})
            logger.info(f"Извлеченный payment_object: {payment_object}")
            
            payment_id = payment_object.get("id")
            status = payment_object.get("status")
            paid = payment_object.get("paid", False)
            
            logger.info(f"Извлеченные данные: payment_id={payment_id}, status={status}, paid={paid}")
            
            # Извлекаем данные о методе оплаты
            payment_method_data = payment_object.get("payment_method", {})
            payment_method_id = payment_method_data.get("id")
            
            # Если у платежа есть информация о методе оплаты, обрабатываем её
            if payment_method_id and payment_method_data:
                # Проверяем, есть ли уже этот метод оплаты в базе данных
                existing_payment_method = await self.repository.get_payment_method_by_id(payment_method_id)
                
                # Если статус платежа "canceled" и метод оплаты существует
                if status == "canceled" and existing_payment_method:
                    # Проверяем верифицирован ли метод оплаты
                    is_verified = existing_payment_method.get("is_verified", False)
                    
                    if not is_verified:
                        # Если метод не верифицирован, удаляем его
                        logger.info(f"Удаление неверифицированного метода оплаты {payment_method_id} из-за отмены платежа {payment_id}")
                        await self.repository.delete_payment_method(payment_method_id)
                    else:
                        logger.info(f"Метод оплаты {payment_method_id} верифицирован, не удаляем его при отмене платежа {payment_id}")
                else:
                    # Извлекаем данные о карте
                    card_data = payment_method_data.get("card", {})
                    method_type = payment_method_data.get("type", "")
                    is_saved = payment_method_data.get("saved", False)
                    title = payment_method_data.get("title", "")
                    
                    # Подготавливаем данные метода оплаты для сохранения/обновления
                    payment_method_data_to_save = {
                        "payment_method_id": payment_method_id,
                        "user_id": 0,  # Значение по умолчанию, будет заменено ниже, если платеж найден
                        "method_type": method_type,
                        "is_saved": is_saved,
                        "title": title,
                        "is_default": False,  # По умолчанию не установлен как основной
                        "is_verified": False,  # По умолчанию не верифицирован
                        "details": payment_method_data
                    }
                    
                    # Если платеж успешный, отмечаем метод как верифицированный и делаем его дефолтным
                    if status == "succeeded" and paid:
                        payment_method_data_to_save["is_verified"] = True
                        payment_method_data_to_save["is_default"] = True
                        payment_method_data_to_save["is_saved"] = True
                        logger.info(f"Платеж {payment_id} успешен. Метод оплаты {payment_method_id} помечен как верифицированный, сохраненный и установлен по умолчанию.")
                    else:
                        logger.info(f"Платеж {payment_id} не успешен (статус: {status}, оплачен: {paid}). Метод оплаты {payment_method_id} остается неверифицированным.")
                    
                    # Добавляем данные о карте, если они есть
                    if card_data:
                        payment_method_data_to_save.update({
                            "card_last4": card_data.get("last4"),
                            "card_type": card_data.get("card_type"),
                            "card_expiry_month": card_data.get("expiry_month"),
                            "card_expiry_year": card_data.get("expiry_year"),
                            "issuer_country": card_data.get("issuer_country")
                        })
                    
                    # Если не указан заголовок, а есть последние 4 цифры, создаем заголовок
                    if not title and card_data and card_data.get("last4"):
                        card_type_display = card_data.get("card_type", "Card")
                        payment_method_data_to_save["title"] = f"{card_type_display} *{card_data.get('last4')}"
                    
                    # Получаем информацию о платеже из базы данных
                    payment_db = None
                    if payment_id:
                        payment_db = await self.repository.get_payment_by_id(payment_id)
                        
                    if payment_db and payment_db.get("user_id"):
                        payment_method_data_to_save["user_id"] = payment_db.get("user_id")
                        
                    # Сохраняем или обновляем метод оплаты
                    await self.repository.save_payment_method(payment_method_data_to_save)
            
            if not payment_id:
                logger.error("Отсутствует ID платежа в данных вебхука")
                return False
            
            # Получаем информацию о платеже из базы данных
            db_payment = await self.repository.get_payment_by_id(payment_id)
            
            if not db_payment:
                logger.error(f"Платеж с ID {payment_id} не найден в базе данных")
                
                # Для платежей с отмененным статусом, мы просто логируем и возвращаем успех
                if status == "canceled":
                    logger.info(f"Получен вебхук о платеже {payment_id} со статусом 'canceled', но платеж не найден в БД. Пропускаем обработку.")
                    return True
                
                # Для успешных платежей, которых нет в БД, можно создать запись
                if status == "succeeded" and paid:
                    try:
                        # Извлекаем данные из вебхука
                        description = payment_object.get("description", "")
                        amount_data = payment_object.get("amount", {})
                        amount_value = amount_data.get("value", "0")
                        
                        # Пытаемся извлечь ID курса из описания
                        course_id = None
                        course_name = "Неизвестный курс"
                        
                        # Обычно описание имеет формат "Оплата курса: Название курса"
                        if description and ":" in description:
                            course_name = description.split(":", 1)[1].strip()
                        
                        # Создаем запись о платеже
                        new_payment_data = {
                            "payment_id": payment_id,
                            "user_id": 0,  # Неизвестный пользователь
                            "course_id": course_id or "unknown",
                            "course_name": course_name,
                            "amount": amount_value,
                            "status": status,
                            "payment_date": datetime.utcnow().replace(tzinfo=timezone.utc).date(),
                            "payment_method_id": payment_method_id if payment_method_id else "",
                            "confirmation_url": ""
                        }
                        
                        # Сохраняем информацию о платеже
                        created_payment = await self.repository.create_payment(new_payment_data)
                        
                        if created_payment:
                            logger.info(f"Создана запись о платеже {payment_id}, которого не было в БД: {created_payment}")
                            return True
                        else:
                            logger.error(f"Не удалось создать запись о платеже {payment_id}")
                            return False
                    except Exception as e:
                        logger.exception(f"Ошибка при создании записи о платеже {payment_id}, которого не было в БД: {str(e)}")
                        return False
                
                # Для других статусов просто возвращаем успех
                return True
            
            logger.info(f"Найден платеж в БД: {db_payment}")
            
            # Обновляем статус платежа в базе данных
            payment_update = {
                "status": status,
                "updated_at": datetime.utcnow().replace(tzinfo=timezone.utc)
            }
            
            # Если платеж успешно оплачен, добавляем дату оплаты
            if status == "succeeded" and paid:
                payment_update["payment_date"] = datetime.utcnow().replace(tzinfo=timezone.utc).date()
                
                # Создаем подписку пользователя на курс
                await self._create_subscription_after_payment(db_payment)
            
            # Обновляем платеж в базе данных
            updated = await self.repository.update_payment(payment_id, payment_update)
            
            logger.info(f"Обновление платежа {payment_id}: {updated}")
            return updated
            
        except Exception as e:
            logger.exception(f"Ошибка при обработке вебхука платежа: {str(e)}")
            return False
    
    async def _create_subscription_after_payment(self, payment_data: Dict[str, Any]) -> bool:
        """
        Создает подписку пользователя на курс после успешной оплаты.
        
        Args:
            payment_data: Данные платежа из базы данных
            
        Returns:
            bool: Успешность создания подписки
        """
        try:
            user_id = payment_data.get("user_id")
            course_id = payment_data.get("course_id")
            course_name = payment_data.get("course_name")
            amount = payment_data.get("amount")
            payment_id = payment_data.get("payment_id")
            
            if not all([user_id, course_id, course_name, amount, payment_id]):
                logger.error(f"Неполные данные платежа для создания подписки: {payment_data}")
                return False
            
            # Проверка статусов всех подписок пользователя и обновление истекших
            await self._check_and_update_expired_subscriptions(str(user_id))
            
            # Получаем информацию о курсе (явно преобразуем course_id к строке)
            course_id_str = str(course_id)
            course_info = await self.repository.get_course_info(course_id_str)
            
            if not course_info:
                logger.error(f"Информация о курсе {course_id} не найдена")
                return False
            
            # Создаем данные подписки
            now = datetime.utcnow().replace(tzinfo=timezone.utc)
            
            end_date = now + timedelta(days=30)
            
            subscription_data = {
                "user_id": user_id,
                "course_id": course_id,
                "course_name": course_name,
                "start_date": now,
                "end_date": end_date,
                "status": "active",
                "price": amount,
                "recurring": False,  # По умолчанию без автопродления
                "payment_id": payment_id
            }
            
            # Создаем подписку
            subscription = await self.repository.create_subscription(subscription_data)
            
            logger.info(f"Создана подписка на курс {course_id} для пользователя {user_id}: {subscription}")
            return bool(subscription)
            
        except Exception as e:
            logger.exception(f"Ошибка при создании подписки после оплаты: {str(e)}")
            return False
    
    async def _check_and_update_expired_subscriptions(self, user_id: str) -> None:
        """
        Проверяет и обновляет статусы истекших подписок пользователя.
        
        Args:
            user_id: ID пользователя
        """
        try:
            # Получаем все активные подписки пользователя
            subscriptions = await self.repository.get_user_active_subscriptions(user_id)
            
            if not subscriptions:
                logger.info(f"У пользователя {user_id} нет активных подписок для проверки")
                return
                
            now = datetime.utcnow().replace(tzinfo=timezone.utc)
            
            for subscription in subscriptions:
                end_date = subscription.get("end_date")
                subscription_uuid = subscription.get("subscription_uuid")
                
                # Если подписка истекла, обновляем статус
                if end_date and end_date < now and subscription_uuid:
                    logger.info(f"Подписка {subscription_uuid} пользователя {user_id} истекла, обновляем статус")
                    await self.repository.update_subscription_status(str(subscription_uuid), "expired")
                    
        except Exception as e:
            logger.error(f"Ошибка при проверке и обновлении истекших подписок пользователя {user_id}: {str(e)}")
    
    async def get_payment_methods(self, user_id: str) -> List[Dict]:
        """
        Получает все методы оплаты пользователя.
        
        Args:
            user_id: ID пользователя
            
        Returns:
            List[Dict]: Список верифицированных и сохраненных методов оплаты пользователя
        """
        payment_methods = await self.repository.get_all_payment_methods(user_id)
        # Фильтруем только верифицированные и сохраненные методы оплаты
        available_methods = [method for method in payment_methods 
                         if method.get("is_verified", False) and method.get("is_saved", False)]
        logger.info(f"Получено {len(available_methods)} доступных методов оплаты из {len(payment_methods)} для пользователя {user_id}")
        return available_methods
    
    async def set_default_payment_method(self, user_id: str, payment_method_id: str) -> bool:
        """Устанавливает указанный метод оплаты как метод по умолчанию"""
        try:
            result = await self.repository.set_default_payment_method(user_id, payment_method_id)
            return result
        except Exception as e:
            logger.error(f"Ошибка при установке метода оплаты по умолчанию: {str(e)}")
            return False
    
    async def get_user_rating(self, user_id: str) -> Dict[str, Any]:
        """
        Получает рейтинг пользователя (тренера)
        
        Args:
            user_id: ID пользователя (тренера)
            
        Returns:
            Dict: Информация о рейтинге тренера
        """
        try:
            # Получаем рейтинг из репозитория
            rating_data = await self.repository.get_user_rating(user_id)
            
            if not rating_data:
                # Если рейтинг не найден, возвращаем нулевой рейтинг
                return {
                    "user_id": int(user_id),
                    "rating": 0.0,
                    "rating_count": 0
                }
            
            return rating_data
            
        except Exception as e:
            logger.error(f"Ошибка при получении рейтинга тренера {user_id}: {str(e)}")
            return {
                "user_id": int(user_id),
                "rating": 0.0,
                "rating_count": 0
            }
    
    async def pay_with_saved_method(self, user_id: str, course_uuid: str, payment_method_id: str) -> Dict[str, Any]:
        """Оплата курса с использованием сохраненного метода оплаты"""
        try:
            logger.info(f"Попытка оплаты курса {course_uuid} пользователем {user_id} с использованием метода оплаты {payment_method_id}")
            
            # Получаем информацию о курсе
            course_info = await self.repository.get_course_info(course_uuid)
            
            if not course_info:
                logger.error(f"Информация о курсе {course_uuid} не найдена")
                return {
                    "message": "Информация о курсе не найдена. Невозможно оформить подписку.",
                    "status": "error"
                }
            
            # Проверяем, является ли пользователь владельцем курса
            if str(course_info.get("user_id")) == str(user_id):
                logger.info(f"Пользователь {user_id} является владельцем курса {course_uuid}. Подписка невозможна.")
                return {
                    "message": "Вы не можете оформить подписку на собственный курс.",
                    "status": "error"
                }
            
            # Получаем метод оплаты
            payment_method = await self.repository.get_payment_method_by_id(payment_method_id)
            
            if not payment_method:
                logger.error(f"Метод оплаты {payment_method_id} не найден")
                return {
                    "message": "Выбранный метод оплаты не найден.",
                    "status": "error"
                }
            
            # Проверяем, принадлежит ли метод оплаты пользователю
            if str(payment_method.get("user_id")) != str(user_id):
                logger.error(f"Метод оплаты {payment_method_id} не принадлежит пользователю {user_id}")
                return {
                    "message": "У вас нет доступа к выбранному методу оплаты.",
                    "status": "error"
                }
            
            # Делаем этот метод оплаты дефолтным
            await self.repository.set_default_payment_method(user_id, payment_method_id)
            
            # Заглушка для демонстрации функциональности
            # В реальном приложении здесь будет код для проведения оплаты через YooKassa с использованием сохраненного метода оплаты
            
            # Возвращаем информацию о методе оплаты
            card_info = ""
            if payment_method.get("card_type") and payment_method.get("card_last4"):
                card_info = f"{payment_method.get('card_type')} *{payment_method.get('card_last4')}"
            
            return {
                "message": f"Вы выбрали оплату с использованием сохраненной карты: {card_info}. В демонстрационной версии оплата не проводится.",
                "status": "success",
                "payment_method": {
                    "id": payment_method_id,
                    "type": payment_method.get("method_type"),
                    "title": payment_method.get("title"),
                    "card_last4": payment_method.get("card_last4"),
                    "card_type": payment_method.get("card_type")
                }
            }
            
        except Exception as e:
            logger.exception(f"Ошибка при оплате с использованием сохраненного метода: {str(e)}")
            return {
                "message": f"Ошибка при оплате: {str(e)}",
                "status": "error"
            }
    
    async def get_user_subscribers_count(self, user_id: str) -> int:
        """Получение количества уникальных подписчиков пользователя"""
        return await self.repository.get_user_subscribers_count(user_id) 