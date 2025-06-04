from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
import uuid

class HealthResponse(BaseModel):
    service: str
    status: str
    message: str

class CommentBase(BaseModel):
    """Базовая схема комментария"""
    content: str = Field(..., description="Текст комментария")

class CommentCreate(BaseModel):
    course_workout_uuid: str = Field(..., description="UUID тренировки курса")
    content: str = Field(..., min_length=1, max_length=2000, description="Содержимое комментария")
    parent_comment_uuid: Optional[str] = Field(None, description="UUID родительского комментария для ответа")
    
    @validator('course_workout_uuid', 'parent_comment_uuid')
    def validate_uuid(cls, v):
        if v is not None:
            try:
                uuid.UUID(v)
            except ValueError:
                raise ValueError('Некорректный формат UUID')
        return v

class CommentUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000, description="Новое содержимое комментария")

class CommentResponse(BaseModel):
    comment_uuid: str
    user_id: int
    course_workout_uuid: str
    content: str
    parent_comment_uuid: Optional[str] = None
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime
    user_name: Optional[str] = None
    user_avatar_url: Optional[str] = None
    replies_count: int = 0
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class CommentWithReplies(CommentResponse):
    replies: List[CommentResponse] = []

class CommentList(BaseModel):
    comments: List[CommentWithReplies]
    total_count: int 