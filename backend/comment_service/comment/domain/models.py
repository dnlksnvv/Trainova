from typing import Optional
from datetime import datetime
from pydantic import BaseModel
import uuid

class CommentBase(BaseModel):
    course_workout_uuid: str
    text: str
    parent_comment_uuid: Optional[str] = None

class CommentCreate(CommentBase):
    pass

class CommentUpdate(BaseModel):
    text: str

class Comment(CommentBase):
    comment_uuid: str
    user_id: int
    user_first_name: Optional[str] = None
    user_last_name: Optional[str] = None
    user_avatar_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False
    
    class Config:
        from_attributes = True 