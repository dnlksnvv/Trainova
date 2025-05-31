import logging
import json
from typing import Dict, List, Optional, Any
from datetime import datetime, date, timezone
import uuid

from profile.infrastructure.database import Database
from profile.domain.db_constants import *

logger = logging.getLogger(__name__)

class ProfileRepository:

    def __init__(self):
        self.db = Database()
    
    async def get_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        try:
            # строка в число - защита от инъекций
            numeric_id = int(user_id)
            query = f"SELECT * FROM {USERS_TABLE} WHERE {USER_ID} = $1"
            return await self.db.fetchrow(query, numeric_id)
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return None
        except Exception as e:
            logger.error(f"Ошибка при получении пользователя по ID {user_id}: {str(e)}")
            return None
  
    
    async def update_profile(self, user_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        
        try:
            # строка в число - защита от инъекций
            numeric_id = int(user_id)
            
            # Формируем SET часть запроса динамически
            set_parts = []
            params = [numeric_id]
            
            for i, (key, value) in enumerate(data.items(), start=2):
                if key in [USER_FIRST_NAME, USER_LAST_NAME, USER_DESCRIPTION, USER_AVATAR_URL]:
                    set_parts.append(f"{key} = ${i}")
                    params.append(value)
            
            if not set_parts:
                return await self.get_profile(user_id)
            
            query = f"""
                UPDATE {USERS_TABLE}
                SET {', '.join(set_parts)}
                WHERE {USER_ID} = $1
                RETURNING {USER_ID}, {USER_EMAIL}, {USER_FIRST_NAME}, {USER_LAST_NAME},
                         {USER_DESCRIPTION}, {USER_AVATAR_URL}, {USER_CREATED_AT}, {USER_IS_VERIFIED}
            """
            
            return await self.db.fetchrow(query, *params)
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return None
        except Exception as e:
            logger.error(f"Ошибка при обновлении профиля пользователя {user_id}: {str(e)}")
            return None
    
    async def update_avatar(self, user_id: int, avatar_url: str) -> bool:
       
        try:
            query = f"""
                UPDATE {USERS_TABLE}
                SET {USER_AVATAR_URL} = $1
                WHERE {USER_ID} = $2
            """
            result = await self.db.execute(query, avatar_url, user_id)
            return result is not None
        except Exception as e:
            logger.error(f"Ошибка при обновлении аватара: {str(e)}")
            return False
    
    async def get_subscriptions(self, user_id: str) -> List[Dict]:
        try:
            numeric_id = int(user_id)
            
            query = f"""
                SELECT * FROM subscriptions
                WHERE {SUBSCRIPTION_USER_ID} = $1
                ORDER BY {SUBSCRIPTION_CREATED_AT} DESC
            """
            result = await self.db.fetch(query, numeric_id)
            
            if not result:
                logger.info(f"Подписки не найдены для пользователя {user_id}")
                return []
            
            subscriptions = []
            for row in result:
                subscription = dict(row)
                
                # Проверяем наличие поля subscription_id и преобразуем его в строку
                if SUBSCRIPTION_ID in subscription:
                    subscription[SUBSCRIPTION_ID] = str(subscription[SUBSCRIPTION_ID])
                
                # Преобразуем course_id в строку
                if SUBSCRIPTION_COURSE_ID in subscription:
                    subscription[SUBSCRIPTION_COURSE_ID] = str(subscription[SUBSCRIPTION_COURSE_ID])
                
                # Преобразуем даты в строки
                if SUBSCRIPTION_START_DATE in subscription and isinstance(subscription[SUBSCRIPTION_START_DATE], (date, datetime)):
                    if isinstance(subscription[SUBSCRIPTION_START_DATE], datetime):
                        subscription[SUBSCRIPTION_START_DATE] = subscription[SUBSCRIPTION_START_DATE].isoformat()
                    else:
                        subscription[SUBSCRIPTION_START_DATE] = subscription[SUBSCRIPTION_START_DATE].isoformat()
                
                if SUBSCRIPTION_END_DATE in subscription and subscription[SUBSCRIPTION_END_DATE] and isinstance(subscription[SUBSCRIPTION_END_DATE], (date, datetime)):
                    if isinstance(subscription[SUBSCRIPTION_END_DATE], datetime):
                        subscription[SUBSCRIPTION_END_DATE] = subscription[SUBSCRIPTION_END_DATE].isoformat()
                    else:
                        subscription[SUBSCRIPTION_END_DATE] = subscription[SUBSCRIPTION_END_DATE].isoformat()
                
                # Преобразуем временные метки в строки
                if SUBSCRIPTION_CREATED_AT in subscription and isinstance(subscription[SUBSCRIPTION_CREATED_AT], datetime):
                    subscription[SUBSCRIPTION_CREATED_AT] = subscription[SUBSCRIPTION_CREATED_AT].isoformat()
                if SUBSCRIPTION_UPDATED_AT in subscription and isinstance(subscription[SUBSCRIPTION_UPDATED_AT], datetime):
                    subscription[SUBSCRIPTION_UPDATED_AT] = subscription[SUBSCRIPTION_UPDATED_AT].isoformat()
                
                subscriptions.append(subscription)
            
            logger.info(f"Получено {len(subscriptions)} подписок для пользователя {user_id}")
            return subscriptions
            
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return []
        except Exception as e:
            logger.error(f"Ошибка при получении подписок пользователя {user_id}: {str(e)}")
            return []
    
    async def cancel_subscription(self, user_id: str, course_id: str) -> bool:
        try:
            numeric_user_id = int(user_id)
            
            # Обновляем статус подписки для активных и бесплатных подписок
            query = f"""
                UPDATE subscriptions
                SET {SUBSCRIPTION_STATUS} = 'cancelled', {SUBSCRIPTION_UPDATED_AT} = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
                WHERE {SUBSCRIPTION_USER_ID} = $1 AND {SUBSCRIPTION_COURSE_ID} = $2
                AND {SUBSCRIPTION_STATUS} IN ('active', 'free')
            """
            
            result = await self.db.execute(query, numeric_user_id, course_id)
            success = "UPDATE" in result and int(result.split()[1]) > 0
            
            if success:
                logger.info(f"Подписка успешно отменена для пользователя {user_id} на курс {course_id}")
            else:
                logger.info(f"Подписка не найдена для пользователя {user_id} и курса {course_id}")
            
            return success
            
        except ValueError:
            logger.error(f"Некорректный формат ID: user_id={user_id}, course_id={course_id}")
            return False
        except Exception as e:
            logger.error(f"Ошибка при отмене подписки пользователя {user_id} на курс {course_id}: {str(e)}")
            return False
    
    async def get_payments(self, user_id: str) -> List[Dict[str, Any]]:
        try:
            numeric_id = int(user_id)
            
            query = f"""
                SELECT * FROM payments WHERE {PAYMENT_USER_ID} = $1
                ORDER BY {PAYMENT_DATE} DESC
            """
            
            payments = await self.db.fetch(query, numeric_id)
            logger.info(f"Получены платежи для пользователя {user_id}: {payments}")
            
            for payment in payments:
                if isinstance(payment[PAYMENT_DATE], date):
                    payment[PAYMENT_DATE] = payment[PAYMENT_DATE].isoformat()
            
            return payments
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return []
        except Exception as e:
            logger.error(f"Ошибка при получении платежей пользователя {user_id}: {str(e)}")
            return []
    
    async def create_payment(self, payment_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Создает запись о платеже в базе данных.
        
        Args:
            payment_data: Данные платежа
            
        Returns:
            Dict: Созданный платеж с id или пустой словарь, если создание не удалось
        """
        try:
            # Проверяем обязательные поля
            required_fields = ["user_id", "course_id", "course_name", "amount", "status"]
            
            # Преобразуем числовые поля
            try:
                user_id = int(payment_data["user_id"])
                payment_data["user_id"] = user_id
            except (ValueError, KeyError):
                logger.error("Некорректный формат user_id в данных платежа")
                return {}
            
            # Удаляем payment_date если он есть, так как это поле будет заполнено позже
            if "payment_date" in payment_data:
                del payment_data["payment_date"]
            
            # Получаем текущее время для полей created_at и updated_at
            current_time = datetime.utcnow().replace(tzinfo=timezone.utc)
            
            # Добавляем поля created_at и updated_at если их нет
            if "created_at" not in payment_data:
                payment_data["created_at"] = current_time
                
            if "updated_at" not in payment_data:
                payment_data["updated_at"] = current_time
            
            # Формируем SQL запрос для вставки
            fields = []
            values = []
            placeholders = []
            
            idx = 1
            for key, value in payment_data.items():
                fields.append(key)
                values.append(value)
                placeholders.append(f"${idx}")
                idx += 1
            
            query = f"""
                INSERT INTO payments ({', '.join(fields)})
                VALUES ({', '.join(placeholders)})
                RETURNING *
            """
            
            logger.info(f"Выполнение запроса на создание платежа: {query}")
            logger.info(f"Параметры: {values}")
            
            result = await self.db.fetchrow(query, *values)
            
            if result:
                logger.info(f"Платеж успешно создан: {result}")
                return dict(result)
            
            logger.error("Не удалось создать платеж")
            return {}
            
        except Exception as e:
            logger.error(f"Ошибка при создании платежа: {str(e)}")
            return {}
            
    async def save_payment_method(self, payment_method_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Сохраняет метод оплаты пользователя.
        
        Args:
            payment_method_data: Данные метода оплаты
            
        Returns:
            Dict: Сохраненный метод оплаты или пустой словарь, если сохранение не удалось
        """
        try:
            # Проверяем обязательные поля
            required_fields = ["payment_method_id", "user_id", "method_type"]
            for field in required_fields:
                if field not in payment_method_data:
                    logger.error(f"Отсутствует обязательное поле {field} в данных метода оплаты")
                    return {}
            
            # Конвертируем user_id в int
            try:
                user_id = int(payment_method_data["user_id"])
                payment_method_data["user_id"] = user_id
            except (ValueError, KeyError):
                logger.error("Некорректный формат user_id в данных метода оплаты")
                return {}
                
            # Если payment_method_id уже существует, обновляем запись
            existing_method = await self.db.fetchrow(
                """
                SELECT * FROM payment_methods 
                WHERE payment_method_id = $1
                """, 
                payment_method_data["payment_method_id"]
            )
            
            if existing_method:
                # Формируем SET часть запроса динамически
                set_parts = []
                params = [payment_method_data["payment_method_id"]]
                
                update_fields = {
                    k: v for k, v in payment_method_data.items() 
                    if k != "payment_method_id" and k != "created_at"
                }
                
                idx = 2
                for key, value in update_fields.items():
                    set_parts.append(f"{key} = ${idx}")
                    
                    if key == "details" and isinstance(value, dict):
                        params.append(json.dumps(value))
                    else:
                        params.append(value)
                    
                    idx += 1
                
                # Добавляем обновление updated_at
                set_parts.append("updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'")
                
                query = f"""
                    UPDATE payment_methods
                    SET {', '.join(set_parts)}
                    WHERE payment_method_id = $1
                    RETURNING *
                """
                
                result = await self.db.fetchrow(query, *params)
                
                if result:
                    logger.info(f"Метод оплаты успешно обновлен: {result}")
                    return dict(result)
                
                logger.error("Не удалось обновить метод оплаты")
                return {}
            
            fields = []
            values = []
            placeholders = []
            
            idx = 1
            for key, value in payment_method_data.items():
                fields.append(key)
                
                # Если это JSONB поле и значение уже является словарем, преобразуем его в JSON
                if key == "details" and isinstance(value, dict):
                    values.append(json.dumps(value))
                else:
                    values.append(value)
                
                placeholders.append(f"${idx}")
                idx += 1
            
            # Получаем текущее время для полей created_at и updated_at
            current_time = datetime.utcnow().replace(tzinfo=timezone.utc)
            
            # Добавляем created_at и updated_at, если их нет
            if "created_at" not in payment_method_data:
                fields.append("created_at")
                values.append(current_time)
                placeholders.append(f"${idx}")
                idx += 1
                
            if "updated_at" not in payment_method_data:
                fields.append("updated_at")
                values.append(current_time)
                placeholders.append(f"${idx}")
                idx += 1
            
            query = f"""
                INSERT INTO payment_methods ({', '.join(fields)})
                VALUES ({', '.join(placeholders)})
                RETURNING *
            """
            
            logger.info(f"Выполнение запроса на создание метода оплаты: {query}")
            logger.info(f"Параметры: {values}")
            
            result = await self.db.fetchrow(query, *values)
            
            if result:
                logger.info(f"Метод оплаты успешно создан: {result}")
                return dict(result)
            
            logger.error("Не удалось создать метод оплаты")
            return {}
            
        except Exception as e:
            logger.error(f"Ошибка при сохранении метода оплаты: {str(e)}")
            return {}
    
    async def get_payment_method(self, user_id: str) -> Optional[Dict]:
        try:
            numeric_id = int(user_id)
            
            query = f"""
                SELECT * FROM payment_methods
                WHERE {PAYMENT_METHOD_USER_ID} = $1
                ORDER BY {PAYMENT_METHOD_IS_DEFAULT} DESC, {PAYMENT_METHOD_UPDATED_AT} DESC
                LIMIT 1
            """
            result = await self.db.fetchrow(query, numeric_id)
            
            if not result:
                logger.info(f"Метод оплаты не найден для пользователя {user_id}")
                return {
                    "method": "",
                    "payment_method_id": "",
                    "is_saved": False,
                    "is_default": False,
                    "is_verified": False,
                    "title": None,
                    "card_last4": None,
                    "card_type": None,
                    "card_expiry_month": None,
                    "card_expiry_year": None,
                    "issuer_country": None,
                    "details": {}
                }
            
            method = dict(result)
            logger.info(f"Получен метод оплаты для пользователя {user_id}: {method}")
            
            details = {}
            if method.get(PAYMENT_METHOD_DETAILS):
                try:
                    if isinstance(method[PAYMENT_METHOD_DETAILS], str):
                        details = json.loads(method[PAYMENT_METHOD_DETAILS])
                    else:
                        details = method[PAYMENT_METHOD_DETAILS]
                    logger.info(f"Детали метода оплаты после преобразования JSON: {details}")
                except json.JSONDecodeError:
                    logger.warning(f"Не удалось преобразовать детали метода оплаты в JSON: {method[PAYMENT_METHOD_DETAILS]}")
            
            response = {
                "method": method[PAYMENT_METHOD_TYPE] or "",
                "payment_method_id": method["payment_method_id"],
                "is_saved": method.get("is_saved", False),
                "is_default": method.get("is_default", False),
                "is_verified": method.get("is_verified", False),
                "title": method.get("title"),
                "card_last4": method.get("card_last4"),
                "card_type": method.get("card_type"),
                "card_expiry_month": method.get("card_expiry_month"),
                "card_expiry_year": method.get("card_expiry_year"),
                "issuer_country": method.get("issuer_country"),
                "details": details
            }
            logger.info(f"Подготовленный ответ: {response}")
            return response
            
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return {
                "method": "",
                "payment_method_id": "",
                "is_saved": False,
                "is_default": False,
                "is_verified": False,
                "title": None,
                "card_last4": None,
                "card_type": None,
                "card_expiry_month": None,
                "card_expiry_year": None,
                "issuer_country": None,
                "details": {}
            }
        except Exception as e:
            logger.error(f"Ошибка при получении метода оплаты: {str(e)}")
            return {
                "method": "",
                "payment_method_id": "",
                "is_saved": False,
                "is_default": False,
                "is_verified": False,
                "title": None,
                "card_last4": None,
                "card_type": None,
                "card_expiry_month": None,
                "card_expiry_year": None,
                "issuer_country": None,
                "details": {}
            }
    
    async def get_payment_method_by_id(self, payment_method_id: str) -> Optional[Dict]:
        try:
            query = """
                SELECT * FROM payment_methods
                WHERE payment_method_id = $1
            """
            result = await self.db.fetchrow(query, payment_method_id)
            
            if not result:
                logger.info(f"Метод оплаты с ID {payment_method_id} не найден")
                return None
            
            return dict(result)
            
        except Exception as e:
            logger.error(f"Ошибка при получении метода оплаты по ID {payment_method_id}: {str(e)}")
            return None
    
    async def get_course_info(self, course_uuid: str) -> Optional[Dict[str, Any]]:
        """
        Получает информацию о курсе из базы данных.
        
        Args:
            course_uuid: UUID курса
            
        Returns:
            Dict: Информация о курсе или None, если курс не найден
        """
        try:
            query = """
                SELECT course_uuid, name, description, price, user_id
                FROM courses
                WHERE course_uuid = $1
            """
            
            course = await self.db.fetchrow(query, course_uuid)
            
            if not course:
                logger.info(f"Курс с UUID {course_uuid} не найден")
                return None
            
            # Преобразуем course_uuid в строку
            result = dict(course)
            if result.get("course_uuid"):
                result["course_uuid"] = str(result["course_uuid"])
            result["course_id"] = result["course_uuid"]  # Для совместимости с интерфейсом payments
            
            logger.info(f"Получена информация о курсе: {result}")
            return result
        except Exception as e:
            logger.error(f"Ошибка при получении информации о курсе {course_uuid}: {str(e)}")
            return None
    
    async def get_payment_by_id(self, payment_id: str) -> Optional[Dict[str, Any]]:
        """
        Получает информацию о платеже по его ID.
        
        Args:
            payment_id: ID платежа
            
        Returns:
            Dict: Информация о платеже или None, если платеж не найден
        """
        try:
            query = """
                SELECT * FROM payments
                WHERE payment_id = $1
            """
            
            result = await self.db.fetchrow(query, payment_id)
            
            if not result:
                logger.info(f"Платеж с ID {payment_id} не найден")
                return None
            
            payment = dict(result)
            
            # Преобразуем даты в объекты date, если они строки
            if payment.get("payment_date") and isinstance(payment["payment_date"], str):
                try:
                    payment["payment_date"] = datetime.strptime(payment["payment_date"], "%Y-%m-%d").date()
                except ValueError:
                    logger.warning(f"Не удалось преобразовать дату платежа: {payment['payment_date']}")
            
            logger.info(f"Получен платеж {payment_id}: {payment}")
            return payment
            
        except Exception as e:
            logger.error(f"Ошибка при получении платежа по ID {payment_id}: {str(e)}")
            return None
    
    async def update_payment(self, payment_id: str, update_data: Dict[str, Any]) -> bool:
        """
        Обновляет информацию о платеже.
        
        Args:
            payment_id: ID платежа
            update_data: Данные для обновления
            
        Returns:
            bool: Успешность обновления платежа
        """
        try:
            # Формируем SET часть запроса динамически
            set_parts = []
            params = [payment_id]
            
            idx = 2
            for key, value in update_data.items():
                set_parts.append(f"{key} = ${idx}")
                params.append(value)
                idx += 1
            
            if not set_parts:
                logger.warning("Нет данных для обновления платежа")
                return False
            
            query = f"""
                UPDATE payments
                SET {', '.join(set_parts)}
                WHERE payment_id = $1
            """
            
            logger.info(f"Выполнение запроса на обновление платежа: {query}")
            logger.info(f"Параметры: {params}")
            
            result = await self.db.execute(query, *params)
            
            success = "UPDATE" in result and int(result.split()[1]) > 0
            logger.info(f"Результат обновления платежа {payment_id}: {result}, успех: {success}")
            
            return success
            
        except Exception as e:
            logger.error(f"Ошибка при обновлении платежа {payment_id}: {str(e)}")
            return False
    
    async def create_subscription(self, subscription_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Создание новой подписки.
        
        Args:
            subscription_data: Данные подписки
            
        Returns:
            Dict: Созданная подписка
        """
        try:
            user_id = subscription_data.get("user_id")
            course_id = subscription_data.get("course_id")
            subscription_uuid = str(uuid.uuid4())
            
            # Создаем новую подписку
            query = """
                    INSERT INTO subscriptions (
                        subscription_uuid, user_id, course_id, course_name, 
                        start_date, end_date, status, price, recurring, payment_id,
                        created_at, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    RETURNING *
                """
            
            # Получаем данные для вставки
            now = datetime.utcnow().replace(tzinfo=timezone.utc)
            params = [
                subscription_uuid,
                user_id,
                course_id,
                subscription_data.get("course_name"),
                subscription_data.get("start_date") or now,
                subscription_data.get("end_date"),
                subscription_data.get("status", "active"),
                subscription_data.get("price", 0),
                subscription_data.get("recurring", False),
                subscription_data.get("payment_id"),
                now,
                now
            ]
            
            # Выполняем запрос
            logger.info(f"Создание новой подписки для пользователя {user_id} на курс {course_id}")
            result = await self.db.fetchrow(query, *params)
            
            if result:
                return dict(result)
            
            return None
            
        except Exception as e:
            logger.error(f"Ошибка при создании подписки: {str(e)}")
            return None
    
    async def create_free_subscription(self, subscription_data: Dict[str, Any]) -> Optional[str]:
        """
        Создание новой бесплатной подписки.
        
        Args:
            subscription_data: Данные подписки
            
        Returns:
            str: UUID созданной подписки или None в случае ошибки
        """
        try:
            user_id = subscription_data.get("user_id")
            course_id = subscription_data.get("course_id")
            subscription_uuid = str(uuid.uuid4())
            
            # Преобразуем user_id в integer, если он передан как строка
            user_id_int = int(user_id) if isinstance(user_id, str) else user_id
            
            # Создаем новую бесплатную подписку
            query = """
                    INSERT INTO subscriptions (
                        subscription_uuid, user_id, course_id, course_name, 
                        start_date, end_date, status, price, recurring,
                        created_at, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    RETURNING subscription_uuid
                """
            
            current_time = datetime.utcnow().replace(tzinfo=timezone.utc)
            
            params = [
                subscription_uuid,
                user_id_int,  # Используем преобразованный user_id
                course_id,
                subscription_data.get("course_name", ""),
                current_time,  # start_date
                None,          # end_date (для бесплатной подписки)
                "free",        # status
                0,             # price
                False,         # recurring
                current_time,  # created_at
                current_time   # updated_at
            ]
            
            logger.info(f"Создание новой бесплатной подписки для пользователя {user_id_int} на курс {course_id}")
            result = await self.db.fetchrow(query, *params)
            
            if result:
                logger.info(f"Бесплатная подписка успешно создана с UUID: {result['subscription_uuid']}")
                return result['subscription_uuid']
            else:
                logger.error("Не удалось получить UUID созданной подписки")
                return None
            
        except Exception as e:
            logger.error(f"Ошибка при создании бесплатной подписки: {str(e)}")
            return None
    
    async def get_all_payment_methods(self, user_id: str) -> List[Dict]:
        """
        Получает все методы оплаты пользователя.
        
        Args:
            user_id: ID пользователя
            
        Returns:
            List[Dict]: Список методов оплаты пользователя
        """
        try:
            numeric_id = int(user_id)
            
            query = f"""
                SELECT * FROM payment_methods
                WHERE {PAYMENT_METHOD_USER_ID} = $1
                ORDER BY {PAYMENT_METHOD_IS_DEFAULT} DESC, {PAYMENT_METHOD_UPDATED_AT} DESC
            """
            results = await self.db.fetch(query, numeric_id)
            
            if not results:
                logger.info(f"Методы оплаты не найдены для пользователя {user_id}")
                return []
            
            payment_methods = []
            for result in results:
                method = dict(result)
                
                details = {}
                if method.get(PAYMENT_METHOD_DETAILS):
                    try:
                        if isinstance(method[PAYMENT_METHOD_DETAILS], str):
                            details = json.loads(method[PAYMENT_METHOD_DETAILS])
                        else:
                            details = method[PAYMENT_METHOD_DETAILS]
                    except json.JSONDecodeError:
                        logger.warning(f"Не удалось преобразовать детали метода оплаты в JSON: {method[PAYMENT_METHOD_DETAILS]}")
                
                response = {
                    "method": method[PAYMENT_METHOD_TYPE] or "",
                    "payment_method_id": method["payment_method_id"],
                    "is_saved": method.get("is_saved", False),
                    "is_default": method.get("is_default", False),
                    "is_verified": method.get("is_verified", False),
                    "title": method.get("title"),
                    "card_last4": method.get("card_last4"),
                    "card_type": method.get("card_type"),
                    "card_expiry_month": method.get("card_expiry_month"),
                    "card_expiry_year": method.get("card_expiry_year"),
                    "issuer_country": method.get("issuer_country"),
                    "details": details
                }
                
                payment_methods.append(response)
                logger.info(f"Метод оплаты: id={response['payment_method_id']}, is_verified={response['is_verified']}, is_default={response['is_default']}")
            
            logger.info(f"Получено {len(payment_methods)} методов оплаты для пользователя {user_id}")
            return payment_methods
            
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return []
        except Exception as e:
            logger.error(f"Ошибка при получении методов оплаты пользователя {user_id}: {str(e)}")
            return []
    
    async def set_default_payment_method(self, user_id: str, payment_method_id: str) -> bool:
        """
        Устанавливает метод оплаты как используемый по умолчанию и сбрасывает флаг у других методов.
        
        Args:
            user_id: ID пользователя
            payment_method_id: ID метода оплаты, который нужно сделать дефолтным
            
        Returns:
            bool: Успешность операции
        """
        try:
            numeric_id = int(user_id)
            
            # Сначала сбрасываем флаг is_default у всех методов оплаты пользователя
            reset_query = f"""
                UPDATE payment_methods
                SET {PAYMENT_METHOD_IS_DEFAULT} = FALSE
                WHERE {PAYMENT_METHOD_USER_ID} = $1
            """
            
            await self.db.execute(reset_query, numeric_id)
            
            # Затем устанавливаем флаг is_default у выбранного метода оплаты
            set_query = f"""
                UPDATE payment_methods
                SET {PAYMENT_METHOD_IS_DEFAULT} = TRUE, {PAYMENT_METHOD_UPDATED_AT} = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
                WHERE {PAYMENT_METHOD_USER_ID} = $1 AND payment_method_id = $2
                RETURNING *
            """
            
            result = await self.db.fetchrow(set_query, numeric_id, payment_method_id)
            
            if not result:
                logger.error(f"Метод оплаты с ID {payment_method_id} не найден для пользователя {user_id}")
                return False
            
            logger.info(f"Метод оплаты {payment_method_id} установлен как используемый по умолчанию для пользователя {user_id}")
            return True
            
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return False
        except Exception as e:
            logger.error(f"Ошибка при установке метода оплаты по умолчанию: {str(e)}")
            return False
            
    async def delete_payment_method(self, payment_method_id: str) -> bool:
        """
        Удаляет метод оплаты по его ID.
        
        Args:
            payment_method_id: ID метода оплаты для удаления
            
        Returns:
            bool: Успешность операции удаления
        """
        try:
            query = """
                DELETE FROM payment_methods
                WHERE payment_method_id = $1
                RETURNING payment_method_id
            """
            
            result = await self.db.fetchrow(query, payment_method_id)
            
            if result:
                logger.info(f"Метод оплаты с ID {payment_method_id} успешно удален")
                return True
            else:
                logger.warning(f"Метод оплаты с ID {payment_method_id} не найден при попытке удаления")
                return False
                
        except Exception as e:
            logger.error(f"Ошибка при удалении метода оплаты с ID {payment_method_id}: {str(e)}")
            return False
            
    async def get_active_subscription(self, user_id: str, course_id: str) -> Optional[Dict[str, Any]]:
        """
        Получает активную подписку пользователя на курс (включая бесплатные).
        
        Args:
            user_id: ID пользователя
            course_id: ID курса
            
        Returns:
            Dict: Информация о подписке или None, если подписка не найдена
        """
        try:
            numeric_id = int(user_id)
            
            query = """
                SELECT * FROM subscriptions
                WHERE user_id = $1 AND course_id = $2 AND status IN ('active', 'free')
                ORDER BY end_date DESC
                LIMIT 1
            """
            
            result = await self.db.fetchrow(query, numeric_id, course_id)
            
            if not result:
                logger.info(f"Активная или бесплатная подписка пользователя {user_id} на курс {course_id} не найдена")
                return None
                
            subscription = dict(result)
            
            # Преобразуем даты в понятный формат
            if isinstance(subscription.get("start_date"), datetime):
                subscription["start_date"] = subscription["start_date"]
                
            if isinstance(subscription.get("end_date"), datetime):
                subscription["end_date"] = subscription["end_date"]
                
            # Преобразуем временные метки в строки
            if isinstance(subscription.get("created_at"), datetime):
                subscription["created_at"] = subscription["created_at"].isoformat()
                
            if isinstance(subscription.get("updated_at"), datetime):
                subscription["updated_at"] = subscription["updated_at"].isoformat()
                
            logger.info(f"Найдена подписка пользователя {user_id} на курс {course_id}: {subscription}")
            return subscription
            
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return None
        except Exception as e:
            logger.error(f"Ошибка при получении подписки пользователя {user_id} на курс {course_id}: {str(e)}")
            return None
            
    async def update_subscription_status(self, subscription_uuid: str, status: str) -> bool:
        """
        Обновляет статус подписки.
        
        Args:
            subscription_uuid: UUID подписки
            status: Новый статус подписки
            
        Returns:
            bool: Успешность операции
        """
        try:
            query = """
                UPDATE subscriptions
                SET status = $1, updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
                WHERE subscription_uuid = $2
                RETURNING subscription_uuid
            """
            
            result = await self.db.fetchrow(query, status, subscription_uuid)
            
            if result:
                logger.info(f"Статус подписки {subscription_uuid} успешно обновлен на '{status}'")
                return True
            else:
                logger.warning(f"Подписка с UUID {subscription_uuid} не найдена при попытке обновления статуса")
                return False
                
        except Exception as e:
            logger.error(f"Ошибка при обновлении статуса подписки {subscription_uuid}: {str(e)}")
            return False
    
    async def toggle_subscription_recurring(self, user_id: str, course_id: str) -> bool:
        """
        Переключает статус автопродления подписки.
        
        Args:
            user_id: ID пользователя
            course_id: ID курса
            
        Returns:
            bool: Успешность операции
        """
        try:
            numeric_user_id = int(user_id)
            
            query = """
                UPDATE subscriptions
                SET recurring = NOT recurring, updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
                WHERE user_id = $1 AND course_id = $2 AND status = 'active'
                RETURNING recurring
            """
            
            result = await self.db.fetchrow(query, numeric_user_id, course_id)
            
            if result:
                new_recurring_status = result['recurring']
                logger.info(f"Статус автопродления подписки пользователя {user_id} на курс {course_id} изменен на {new_recurring_status}")
                return True
            else:
                logger.warning(f"Активная подписка пользователя {user_id} на курс {course_id} не найдена")
                return False
                
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return False
        except Exception as e:
            logger.error(f"Ошибка при переключении автопродления подписки пользователя {user_id} на курс {course_id}: {str(e)}")
            return False
    
    async def get_user_active_subscriptions(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Получает список активных подписок пользователя
        
        Args:
            user_id: ID пользователя
            
        Returns:
            List[Dict]: Список активных подписок
        """
        try:
            numeric_user_id = int(user_id)
            
            query = f"""
                SELECT * FROM subscriptions
                WHERE {SUBSCRIPTION_USER_ID} = $1 AND {SUBSCRIPTION_STATUS} = 'active'
                ORDER BY {SUBSCRIPTION_CREATED_AT} DESC
            """
            
            result = await self.db.fetch(query, numeric_user_id)
            
            if not result:
                return []
                
            subscriptions = []
            for row in result:
                subscription_data = dict(row)
                
                # Обработка UUID и datetime
                if SUBSCRIPTION_ID in subscription_data:
                    subscription_data[SUBSCRIPTION_ID] = str(subscription_data[SUBSCRIPTION_ID])
                    
                if SUBSCRIPTION_COURSE_ID in subscription_data:
                    subscription_data[SUBSCRIPTION_COURSE_ID] = str(subscription_data[SUBSCRIPTION_COURSE_ID])
                    
                if SUBSCRIPTION_START_DATE in subscription_data and isinstance(subscription_data[SUBSCRIPTION_START_DATE], (datetime, date)):
                    subscription_data[SUBSCRIPTION_START_DATE] = subscription_data[SUBSCRIPTION_START_DATE].isoformat()
                    
                if SUBSCRIPTION_END_DATE in subscription_data and subscription_data[SUBSCRIPTION_END_DATE] and isinstance(subscription_data[SUBSCRIPTION_END_DATE], (datetime, date)):
                    subscription_data[SUBSCRIPTION_END_DATE] = subscription_data[SUBSCRIPTION_END_DATE].isoformat()
                
                subscriptions.append(subscription_data)
                
            return subscriptions
            
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return []
        except Exception as e:
            logger.error(f"Ошибка при получении активных подписок пользователя {user_id}: {str(e)}")
            return []
    
    async def get_user_rating(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Получает рейтинг пользователя (тренера) из таблицы user_ratings
        
        Args:
            user_id: ID пользователя (тренера)
            
        Returns:
            Optional[Dict]: Информация о рейтинге или None, если рейтинг не найден
        """
        try:
            numeric_user_id = int(user_id)
            
            query = f"""
                SELECT user_id, rating, rating_count, updated_at
                FROM user_ratings
                WHERE user_id = $1
            """
            
            result = await self.db.fetchrow(query, numeric_user_id)
            
            if not result:
                # Если записи о рейтинге нет, возвращаем нулевой рейтинг
                return {
                    "user_id": numeric_user_id,
                    "rating": 0.0,
                    "rating_count": 0,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                
            # Преобразуем результат в словарь
            rating_data = dict(result)
            
            # Преобразуем timestamp в строку ISO
            if "updated_at" in rating_data and isinstance(rating_data["updated_at"], datetime):
                rating_data["updated_at"] = rating_data["updated_at"].isoformat()
                
            return rating_data
            
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return None
        except Exception as e:
            logger.error(f"Ошибка при получении рейтинга пользователя {user_id}: {str(e)}")
            return None

    async def get_user_subscribers_count(self, user_id: str) -> int:
        """
        Получает количество уникальных подписчиков пользователя по всем его курсам
        
        Args:
            user_id: ID пользователя (тренера)
            
        Returns:
            int: Количество уникальных подписчиков
        """
        try:
            numeric_user_id = int(user_id)
            
            # Подсчитываем уникальных подписчиков по всем курсам пользователя
            # с активными и бесплатными подписками
            query = """
                SELECT COUNT(DISTINCT s.user_id) as subscribers_count
                FROM subscriptions s
                JOIN courses c ON s.course_id = c.course_uuid::text
                WHERE c.user_id = $1 AND s.status IN ('active', 'free')
            """
            
            result = await self.db.fetchrow(query, numeric_user_id)
            
            if result:
                return result['subscribers_count'] or 0
            else:
                return 0
                
        except ValueError:
            logger.error(f"Некорректный формат ID пользователя: {user_id}")
            return 0
        except Exception as e:
            logger.error(f"Ошибка при получении количества подписчиков пользователя {user_id}: {str(e)}")
            return 0 