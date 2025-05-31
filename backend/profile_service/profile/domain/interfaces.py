from abc import ABC, abstractmethod
from typing import Dict, List, Tuple, Any, Optional

class IProfileService(ABC):
    """Интерфейс сервиса для работы с профилями пользователей."""
    
    @abstractmethod
    async def get_profile(self, user_id: str) -> Dict:
        """
        Получение профиля пользователя.
        
        Args:
            user_id: Идентификатор пользователя
            
        Returns:
            Dict: Данные профиля пользователя
        """
        pass
    
    @abstractmethod
    async def update_profile(self, user_id: str, data: Dict) -> Dict:
        """
        Обновление профиля пользователя.
        
        Args:
            user_id: Идентификатор пользователя
            data: Данные для обновления профиля
            
        Returns:
            Dict: Обновленный профиль пользователя
        """
        pass
    
    @abstractmethod
    async def update_avatar(self, user_id: str, avatar_url: str, verification_code: str) -> bool:
        """
        Обновление аватара пользователя.
        
        Args:
            user_id: Идентификатор пользователя
            avatar_url: URL аватара
            verification_code: Код верификации
            
        Returns:
            bool: True, если аватар успешно обновлен, иначе False
        """
        pass
    
    @abstractmethod
    async def subscribe_to_course(self, user_id: str, course_uuid: str, payment_method_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Подписка пользователя на курс с оплатой.
        
        Args:
            user_id: ID пользователя
            course_uuid: UUID курса для подписки
            payment_method_id: ID метода оплаты (опционально)
            
        Returns:
            Dict: Результат операции подписки
        """
        pass
    
    @abstractmethod
    async def subscribe_to_course_free(self, user_id: str, course_uuid: str) -> Dict[str, Any]:
        """
        Бесплатная подписка пользователя на курс.
        
        Args:
            user_id: ID пользователя
            course_uuid: UUID курса для бесплатной подписки
            
        Returns:
            Dict: Результат операции подписки
        """
        pass
    
    @abstractmethod
    async def get_subscriptions(self, user_id: str) -> List[Dict]:
        """
        Получение списка подписок пользователя.
        
        Args:
            user_id: Идентификатор пользователя
            
        Returns:
            List[Dict]: Список подписок пользователя
        """
        pass
    
    @abstractmethod
    async def get_payments(self, user_id: str) -> List[Dict]:
        """
        Получение истории платежей пользователя.
        
        Args:
            user_id: Идентификатор пользователя
            
        Returns:
            List[Dict]: История платежей пользователя
        """
        pass
    
    @abstractmethod
    async def cancel_subscription(self, user_id: str, course_id: str) -> bool:
        """
        Отмена подписки пользователя на курс.
        
        Args:
            user_id: Идентификатор пользователя
            course_id: Идентификатор курса
            
        Returns:
            bool: True, если подписка успешно отменена, иначе False
        """
        pass
    
    @abstractmethod
    async def toggle_subscription_recurring(self, user_id: str, course_id: str) -> bool:
        """
        Переключение статуса автопродления подписки.
        
        Args:
            user_id: Идентификатор пользователя
            course_id: Идентификатор курса
            
        Returns:
            bool: True, если статус автопродления успешно изменен, иначе False
        """
        pass
    
    @abstractmethod
    async def get_payment_method(self, user_id: str) -> Dict:
        """
        Получение текущего метода оплаты пользователя.
        
        Args:
            user_id: Идентификатор пользователя
            
        Returns:
            Dict: Текущий метод оплаты
        """
        pass
    
    @abstractmethod
    async def update_payment_method(self, user_id: str, data: Dict) -> bool:
        """
        Обновление метода оплаты пользователя.
        
        Args:
            user_id: Идентификатор пользователя
            data: Данные метода оплаты
            
        Returns:
            bool: True, если метод оплаты успешно обновлен, иначе False
        """
        pass
    
    @abstractmethod
    async def process_payment_webhook(self, payment_data: Dict[str, Any]) -> bool:
        """
        Обрабатывает данные вебхука о платеже от платежной системы.
        
        Args:
            payment_data: Данные платежа из вебхука
            
        Returns:
            bool: Успешность обработки вебхука
        """
        pass
    
    @abstractmethod
    async def get_payment_methods(self, user_id: str) -> List[Dict]:
        """
        Получение списка всех методов оплаты пользователя.
        
        Args:
            user_id: Идентификатор пользователя
            
        Returns:
            List[Dict]: Список методов оплаты пользователя
        """
        pass
    
    @abstractmethod
    async def set_default_payment_method(self, user_id: str, payment_method_id: str) -> bool:
        """
        Установка метода оплаты как используемого по умолчанию.
        
        Args:
            user_id: Идентификатор пользователя
            payment_method_id: ID метода оплаты
            
        Returns:
            bool: Успешность операции
        """
        pass
    
    @abstractmethod
    async def pay_with_saved_method(self, user_id: str, course_uuid: str, payment_method_id: str) -> Dict[str, Any]:
        """
        Производит оплату с использованием сохраненного метода оплаты.
        
        Args:
            user_id: ID пользователя
            course_uuid: UUID курса
            payment_method_id: ID метода оплаты
            
        Returns:
            Dict: Результат операции
        """
        pass
    
    @abstractmethod
    async def get_user_rating(self, user_id: str) -> Dict[str, Any]:
        """
        Получение рейтинга пользователя (тренера).
        
        Args:
            user_id: Идентификатор пользователя
            
        Returns:
            Dict: Рейтинг пользователя
        """
        pass

    @abstractmethod
    async def get_user_subscribers_count(self, user_id: str) -> int:
        """
        Получение количества уникальных подписчиков пользователя.
        
        Args:
            user_id: Идентификатор пользователя
            
        Returns:
            int: Количество уникальных подписчиков
        """
        pass

class IAuthService(ABC):
    """Интерфейс сервиса для аутентификации пользователей."""
    
    @abstractmethod
    async def verify_token(self, token: str) -> Dict:
        """
        Проверка токена аутентификации.
        
        Args:
            token: Токен аутентификации
            
        Returns:
            Dict: Информация о пользователе из токена
            
        Raises:
            ValueError: Если токен недействителен
        """
        pass
    
    @abstractmethod
    def _decode_jwt(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Локальное декодирование JWT токена.
        
        Args:
            token: JWT токен для декодирования
            
        Returns:
            Optional[Dict]: Декодированные данные токена или None, если произошла ошибка
        """
        pass
    
    @abstractmethod
    async def _verify_with_auth_service(self, token: str) -> Dict:
        """
        Проверка токена через сервис авторизации.
        
        Args:
            token: Токен аутентификации
            
        Returns:
            Dict: Информация о пользователе из токена
            
        Raises:
            ValueError: Если токен недействителен или произошла ошибка связи
        """
        pass
    
    @abstractmethod
    async def check_token_blacklist(self, token: str) -> bool:
        """
        Проверка токена на наличие в черном списке через сервис авторизации.
        
        Args:
            token: Токен для проверки
            
        Returns:
            bool: True, если токен в черном списке, иначе False
        """
        pass

class ITokenService(ABC):
    @abstractmethod
    def decode_jwt(self, token: str) -> Optional[Dict[str, Any]]:
        pass
    
    @abstractmethod
    def is_token_valid(self, token: str, expected_type: Optional[str] = None) -> bool:
        pass 