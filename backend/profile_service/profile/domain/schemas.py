from pydantic import BaseModel, Field, EmailStr
from typing import List, Dict, Optional, Any

class ErrorResponse(BaseModel):
    """Модель ответа с ошибкой."""
    detail: str = Field(..., description="Детали ошибки")

class MessageResponse(BaseModel):
    """Модель ответа с сообщением."""
    message: str = Field(..., description="Сообщение об успешном выполнении операции")

class ProfileResponse(BaseModel):
    """Модель ответа с данными профиля пользователя."""
    user_id: str = Field(..., description="Идентификатор пользователя")
    first_name: Optional[str] = Field(None, description="Имя пользователя")
    last_name: Optional[str] = Field(None, description="Фамилия пользователя")
    email: str = Field("", description="Email пользователя")
    description: Optional[str] = Field(None, description="Описание пользователя")
    avatar_url: Optional[str] = Field(None, description="URL аватара пользователя")

class ProfileUpdateRequest(BaseModel):
    """Модель запроса на обновление профиля пользователя."""
    first_name: Optional[str] = Field(None, description="Имя пользователя")
    last_name: Optional[str] = Field(None, description="Фамилия пользователя")
    description: Optional[str] = Field(None, description="Описание пользователя")

class ChangeNameRequest(BaseModel):
    """Модель запроса на изменение имени пользователя."""
    first_name: Optional[str] = Field(None, description="Имя пользователя")
    last_name: Optional[str] = Field(None, description="Фамилия пользователя")

class ChangeAvatarRequest(BaseModel):
    """Схема запроса на изменение аватара пользователя."""
    avatar_url: str = Field(..., description="URL нового аватара")

class ChangeDescriptionRequest(BaseModel):
    """Модель запроса на изменение описания пользователя."""
    description: Optional[str] = Field(None, description="Описание пользователя")

class SubscriptionRequest(BaseModel):
    """Модель запроса на подписку на курс."""
    course_uuid: str = Field(..., description="UUID курса для подписки")
    payment_method_id: Optional[str] = Field(None, description="ID метода оплаты для использования (если есть)")

class SubscriptionInfo(BaseModel):
    """Модель информации о подписке."""
    subscription_uuid: str = Field(..., description="UUID подписки", alias="subscription_id")
    course_id: str = Field(..., description="Идентификатор курса")
    course_name: str = Field(..., description="Название курса")
    start_date: str = Field(..., description="Дата начала подписки")
    end_date: Optional[str] = Field(None, description="Дата окончания подписки")
    status: str = Field(..., description="Статус подписки")
    price: float = Field(..., description="Стоимость подписки")
    recurring: bool = Field(..., description="Флаг автоматического продления")
    days_left: Optional[int] = Field(None, description="Количество дней до окончания подписки")

    class Config:
        populate_by_name = True  # Позволяет использовать как subscription_uuid, так и subscription_id

class SubscriptionsResponse(BaseModel):
    """Модель ответа со списком подписок пользователя."""
    subscriptions: List[SubscriptionInfo] = Field(default_factory=list, description="Список подписок пользователя")

class PaymentInfo(BaseModel):
    """Модель информации о платеже."""
    payment_id: str = Field(..., description="Идентификатор платежа")
    course_id: str = Field(..., description="Идентификатор курса")
    course_name: str = Field(..., description="Название курса")
    payment_date: Optional[str] = Field(None, description="Дата платежа")
    amount: float = Field(..., description="Сумма платежа")
    status: str = Field(..., description="Статус платежа")
    payment_method: str = Field("", description="Метод оплаты")

class PaymentsResponse(BaseModel):
    """Модель ответа с историей платежей пользователя."""
    payments: List[PaymentInfo] = Field(default_factory=list, description="История платежей пользователя")

class PaymentMethodResponse(BaseModel):
    """Модель ответа с информацией о методе оплаты."""
    method: str = Field(..., description="Тип метода оплаты")
    payment_method_id: str = Field("", description="ID метода оплаты")
    is_saved: bool = Field(False, description="Флаг, указывающий, сохранён ли способ оплаты")
    is_default: bool = Field(False, description="Флаг, указывающий, является ли способ оплаты используемым по умолчанию")
    is_verified: bool = Field(False, description="Флаг, указывающий, подтверждён ли способ оплаты")
    title: Optional[str] = Field(None, description="Название метода оплаты")
    card_last4: Optional[str] = Field(None, description="Последние 4 цифры карты")
    card_type: Optional[str] = Field(None, description="Тип карты")
    card_expiry_month: Optional[str] = Field(None, description="Месяц окончания срока действия карты")
    card_expiry_year: Optional[str] = Field(None, description="Год окончания срока действия карты")
    issuer_country: Optional[str] = Field(None, description="Страна эмитента карты")
    details: Dict[str, Any] = Field({}, description="Детали метода оплаты")

class PaymentMethodsResponse(BaseModel):
    """Модель ответа со списком методов оплаты пользователя."""
    payment_methods: List[PaymentMethodResponse] = Field(default_factory=list, description="Список методов оплаты пользователя")

class ChangePaymentMethodRequest(BaseModel):
    """Модель запроса на изменение метода оплаты."""
    method: str = Field(..., description="Тип метода оплаты")
    details: Dict[str, Any] = Field(..., description="Детали метода оплаты")

class SubscriptionResponse(BaseModel):
    """Модель ответа при подписке на курс с платежными данными."""
    message: str = Field(..., description="Сообщение об успешном выполнении операции")
    payment_id: str = Field(..., description="UUID платежа")
    confirmation_url: str = Field(..., description="Ссылка для оплаты")

class PayWithSavedMethodRequest(BaseModel):
    """Модель запроса на оплату с использованием сохраненного метода оплаты."""
    course_uuid: str = Field(..., description="UUID курса для оплаты")
    payment_method_id: str = Field(..., description="ID метода оплаты")

class UserRatingResponse(BaseModel):
    """Модель ответа с рейтингом пользователя (тренера)."""
    user_id: int = Field(..., description="ID пользователя (тренера)")
    rating: float = Field(0.0, description="Средний рейтинг пользователя")
    rating_count: int = Field(0, description="Количество оценок")
    subscribers_count: int = Field(0, description="Количество подписчиков пользователя")

class FreeSubscriptionRequest(BaseModel):
    """Модель запроса на бесплатную подписку на курс."""
    course_uuid: str = Field(..., description="UUID курса для бесплатной подписки")

class FreeSubscriptionResponse(BaseModel):
    """Модель ответа при успешной бесплатной подписке на курс."""
    message: str = Field(..., description="Сообщение об успешном получении доступа")
    subscription_uuid: str = Field(..., description="UUID созданной подписки") 