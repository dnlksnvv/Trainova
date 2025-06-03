import datetime as dt
import uuid
from typing import Optional
from pydantic import BaseModel, Field

class DailyMotivation(BaseModel):
    daily_motivation_uuid: uuid.UUID
    user_id: int
    date_start: dt.date
    date_ended: dt.date
    status: str = 'new'  # new, in_progress, completed, failed, regenerating, deepfit-error
    motivation_message: Optional[str] = None
    fact: Optional[str] = None
    advice: Optional[str] = None
    created_at: Optional[dt.datetime] = Field(None, description="UTC timestamp")
    updated_at: Optional[dt.datetime] = Field(None, description="UTC timestamp")

class DailyMotivationCreate(BaseModel):
    user_id: int
    date_start: dt.date
    date_ended: dt.date
    status: str = 'new'

class DailyMotivationResponse(BaseModel):
    generation_date: str  # Форматированная date_start
    date_period: str      # Форматированный период date_ended -> date_start
    status: str
    motivation_message: Optional[str] = None
    fact: Optional[str] = None
    advice: Optional[str] = None

class NeuroGenerationQueue(BaseModel):
    neuro_generation_queue_id: int
    daily_motivation_uuid: str
    status: str
    datetime_created: dt.datetime = Field(description="UTC timestamp")
    datetime_started: Optional[dt.datetime] = Field(None, description="UTC timestamp")
    datetime_completed: Optional[dt.datetime] = Field(None, description="UTC timestamp")

class NeuroGenerationQueueCreate(BaseModel):
    daily_motivation_uuid: str
    status: str = 'new'

# Модели для работы с уровнем жёсткости ответов
class UserResponseLevel(BaseModel):
    user_id: int
    response_level_id: int
    created_at: Optional[dt.datetime] = Field(None, description="UTC timestamp")
    updated_at: Optional[dt.datetime] = Field(None, description="UTC timestamp")

class UserResponseLevelCreate(BaseModel):
    user_id: int
    response_level_id: int = 1  # По умолчанию лояльный режим

class UserResponseLevelResponse(BaseModel):
    response_level_id: int

class UserResponseLevelUpdate(BaseModel):
    response_level_id: int 