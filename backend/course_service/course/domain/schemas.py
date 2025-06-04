from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from decimal import Decimal
import uuid


class CourseBase(BaseModel):
    """Базовая модель курса"""
    name: str = Field(..., min_length=1, max_length=125, description="Название курса")
    description: Optional[str] = Field(None, max_length=500, description="Описание курса")
    price: Optional[Decimal] = Field(None, ge=0, description="Цена курса")
    is_published: bool = Field(default=False, description="Опубликован ли курс")


class CourseCreate(CourseBase):
    """Модель для создания курса"""
    pass  # user_id будет извлекаться из токена авторизации


class CourseUpdate(BaseModel):
    """Модель для обновления курса"""
    name: Optional[str] = Field(None, min_length=1, max_length=125)
    description: Optional[str] = Field(None, max_length=500)
    price: Optional[Decimal] = Field(None, ge=0)
    is_published: Optional[bool] = None


class CourseFilters(BaseModel):
    """Модель фильтров для поиска курсов"""
    user_ids: Optional[List[int]] = Field(None, description="Список ID пользователей для фильтрации")
    current_subscribe: Optional[bool] = Field(None, description="Флаг для фильтрации курсов с активной подпиской")
    include_unpublished: Optional[bool] = Field(True, description="Включать ли неопубликованные курсы (по умолчанию true - текущее поведение)")


class CourseFilterRequest(BaseModel):
    """Модель запроса для фильтрации курсов"""
    filters: Optional[CourseFilters] = Field(None, description="Фильтры для поиска курсов")


class MuscleGroupWithPercentage(BaseModel):
    """Модель группы мышц с процентом задействованности для курса"""
    id: int
    name: str
    description: Optional[str] = None
    percentage: int = Field(..., ge=0, le=100, description="Процент задействованности группы мышц (0-100)")


class AuthorResponse(BaseModel):
    """Модель данных автора курса"""
    user_id: int = Field(..., description="ID автора")
    first_name: Optional[str] = Field(None, description="Имя автора")
    last_name: Optional[str] = Field(None, description="Фамилия автора")
    email: str = Field("", description="Email автора")
    description: Optional[str] = Field(None, description="Описание автора")
    avatar_url: Optional[str] = Field(None, description="URL аватара автора")
    rating: float = Field(0.0, description="Средний рейтинг автора")
    rating_count: int = Field(0, description="Количество оценок автора")


class CourseResponse(BaseModel):
    """Модель ответа с данными курса"""
    course_uuid: uuid.UUID
    user_id: int
    name: str  # Убираем ограничения для ответа
    description: Optional[str] = None  # Убираем ограничения для ответа
    price: Optional[Decimal] = Field(None, ge=0, description="Цена курса")
    is_published: bool = Field(default=False, description="Опубликован ли курс")
    rating: Decimal
    subscribers_count: int
    duration: Optional[int] = Field(None, ge=0, description="Длительность курса в секундах (сумма длительностей тренировок)")
    exercise_count: int = Field(default=0, ge=0, description="Количество тренировок в курсе")
    created_at: datetime
    updated_at: datetime
    has_subscription: bool = Field(False, description="Признак наличия подписки у текущего пользователя")
    subscription_end_date: Optional[datetime] = Field(None, description="Дата окончания подписки")
    muscle_groups: Optional[List[MuscleGroupWithPercentage]] = Field(None, description="Группы мышц, задействованные в курсе")
    author: Optional[AuthorResponse] = Field(None, description="Информация об авторе курса")

    class Config:
        from_attributes = True


class CoursesListResponse(BaseModel):
    """Модель ответа со списком курсов"""
    courses: List[CourseResponse]
    total: int
    page: int = 1
    per_page: int = 10


class HealthResponse(BaseModel):
    """Модель ответа проверки здоровья сервиса"""
    service: str
    status: str
    message: str


class SuccessResponse(BaseModel):
    """Модель успешного ответа API"""
    message: str


class ErrorResponse(BaseModel):
    """Модель ошибки API"""
    error: str
    detail: Optional[str] = None


# =================== COURSE WORKOUTS SCHEMAS ===================

class MuscleGroupPercentage(BaseModel):
    """Модель для хранения группы мышц с процентом задействованности"""
    id: int = Field(..., description="ID группы мышц")
    percentage: int = Field(..., ge=0, le=100, description="Процент задействованности группы мышц (0-100)")


class CourseWorkoutBase(BaseModel):
    """Базовая модель тренировки курса"""
    name: str = Field(..., min_length=1, max_length=125, description="Название тренировки")
    description: Optional[str] = Field(None, max_length=500, description="Описание тренировки")
    video_url: Optional[str] = Field(None, max_length=500, description="URL видео тренировки")
    duration: Optional[int] = Field(None, ge=0, description="Длительность тренировки в секундах")
    is_paid: bool = Field(default=False, description="Платная ли тренировка")
    is_published: bool = Field(default=False, description="Опубликована ли тренировка")
    order_index: int = Field(default=0, ge=0, description="Порядковый номер тренировки в курсе")


class CourseWorkoutCreate(BaseModel):
    """Модель для создания тренировки курса"""
    course_uuid: uuid.UUID
    name: str = Field(..., min_length=1, max_length=125, description="Название тренировки")
    description: Optional[str] = Field(None, max_length=500, description="Описание тренировки")
    video_url: Optional[str] = None
    duration: Optional[int] = None
    is_paid: Optional[bool] = False
    is_published: Optional[bool] = False
    muscle_groups: Optional[List[MuscleGroupPercentage]] = Field(None, description="Список групп мышц с процентом задействованности")


class CourseWorkoutUpdate(BaseModel):
    """Модель для обновления тренировки курса"""
    name: Optional[str] = Field(None, min_length=1, max_length=125, description="Название тренировки")
    description: Optional[str] = Field(None, max_length=500, description="Описание тренировки")
    video_url: Optional[str] = None
    duration: Optional[int] = None
    is_paid: Optional[bool] = None
    is_published: Optional[bool] = None
    order_index: Optional[int] = None
    muscle_groups: Optional[List[MuscleGroupPercentage]] = Field(None, description="Список групп мышц с процентом задействованности")


class MuscleGroupResponse(BaseModel):
    """Модель ответа с данными группы мышц в тренировке"""
    id: int
    name: str = Field(None, description="Название группы мышц")
    description: Optional[str] = Field(None, description="Описание группы мышц")
    percentage: int = Field(..., ge=0, le=100, description="Процент задействованности группы мышц (0-100)")


class CourseWorkoutResponse(BaseModel):
    """Модель ответа с данными тренировки курса"""
    course_workout_uuid: uuid.UUID
    course_uuid: uuid.UUID
    name: str  # Убираем ограничения для ответа
    description: Optional[str] = None  # Убираем ограничения для ответа
    video_url: Optional[str] = None
    duration: Optional[int] = None
    rating: Optional[Decimal] = None
    is_paid: bool
    is_published: bool
    order_index: int
    created_at: datetime
    updated_at: datetime
    muscle_groups: Optional[List[MuscleGroupResponse]] = Field(None, description="Список групп мышц с процентом задействованности")
    is_free: bool = Field(False, description="Признак бесплатного урока")
    is_visible: bool = Field(True, description="Признак видимости всего контента тренировки")
    comments_count: int = Field(0, description="Количество комментариев под тренировкой")
    
    class Config:
        from_attributes = True


class CourseWorkoutsListResponse(BaseModel):
    """Модель ответа со списком тренировок курса"""
    workouts: List[CourseWorkoutResponse]
    total: int
    page: int = 1
    per_page: int = 10


class CourseWorkoutFilters(BaseModel):
    """Модель фильтров для поиска тренировок"""
    course_uuids: Optional[List[uuid.UUID]] = Field(None, description="Список UUID курсов для фильтрации")
    is_published: Optional[bool] = Field(None, description="Фильтр по статусу публикации")
    is_paid: Optional[bool] = Field(None, description="Фильтр по платности")


class CourseWorkoutFilterRequest(BaseModel):
    """Модель запроса для фильтрации тренировок"""
    filters: Optional[CourseWorkoutFilters] = Field(None, description="Фильтры для поиска тренировок")


# =================== WORKOUT RATINGS SCHEMAS ===================

class WorkoutRatingBase(BaseModel):
    """Базовая модель оценки тренировки"""
    rating: Decimal = Field(..., ge=0, le=5, description="Оценка тренировки (0-5)")


class WorkoutRatingCreate(WorkoutRatingBase):
    """Модель для создания оценки тренировки"""
    course_workout_uuid: uuid.UUID = Field(..., description="UUID тренировки")


class WorkoutRatingUpdate(WorkoutRatingBase):
    """Модель для обновления оценки тренировки"""
    pass


class WorkoutRatingResponse(WorkoutRatingBase):
    """Модель ответа с данными оценки тренировки"""
    rating_uuid: uuid.UUID
    course_workout_uuid: uuid.UUID
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkoutRatingStatsResponse(BaseModel):
    """Модель ответа со статистикой оценок тренировки"""
    average_rating: Decimal
    total_ratings: int
    
    class Config:
        from_attributes = True 