import logging
from typing import Optional, List, Dict, Any, Union
from datetime import datetime

from ...domain.schemas import CommentResponse
from ..database import Database

logger = logging.getLogger(__name__)

class CommentRepository:
    def __init__(self):
        self.db = Database()
    
    async def create(self, comment_data: Dict[str, Any]) -> CommentResponse:
        """Создание нового комментария в базе данных"""
        query = """
        INSERT INTO comments (
            comment_uuid, user_id, course_workout_uuid, content, 
            parent_comment_uuid, is_deleted, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING comment_uuid, user_id, course_workout_uuid, content, 
                  parent_comment_uuid, is_deleted, created_at, updated_at
        """
        
        row = await self.db.fetchrow(
            query,
            comment_data["comment_uuid"],
            comment_data["user_id"],
            comment_data["course_workout_uuid"],
            comment_data["content"],
            comment_data.get("parent_comment_uuid"),
            False,  # is_deleted
            comment_data["created_at"],
            comment_data["updated_at"]
        )
        
        if not row:
            raise Exception("Не удалось создать комментарий")
        
        # Получаем данные пользователя для отображения
        user_data = await self._get_user_data(row["user_id"])
        
        return CommentResponse(
            comment_uuid=str(row["comment_uuid"]),
            user_id=row["user_id"],
            course_workout_uuid=str(row["course_workout_uuid"]),
            content=row["content"],
            parent_comment_uuid=str(row["parent_comment_uuid"]) if row["parent_comment_uuid"] else None,
            is_deleted=row["is_deleted"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            user_name=user_data.get("user_name"),
            user_avatar_url=user_data.get("user_avatar_url"),
            replies_count=0
        )
    
    async def get_by_id(self, comment_uuid: str) -> Optional[CommentResponse]:
        """Получение комментария по UUID"""
        query = """
        SELECT c.comment_uuid, c.user_id, c.course_workout_uuid, c.content, 
               c.parent_comment_uuid, c.is_deleted, c.created_at, c.updated_at,
               COALESCE(u.first_name || ' ' || u.last_name, u.email) as user_name,
               u.avatar_url as user_avatar_url
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.comment_uuid = $1
        """
        
        row = await self.db.fetchrow(query, comment_uuid)
        if not row:
            return None
        
        # Создаем правильный URL для аватарки
        avatar_url = None
        if row["user_avatar_url"]:
            avatar_url = self._build_avatar_url(row["user_avatar_url"])
        
        return CommentResponse(
            comment_uuid=str(row["comment_uuid"]),
            user_id=row["user_id"],
            course_workout_uuid=str(row["course_workout_uuid"]),
            content=row["content"],
            parent_comment_uuid=str(row["parent_comment_uuid"]) if row["parent_comment_uuid"] else None,
            is_deleted=row["is_deleted"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            user_name=row["user_name"],
            user_avatar_url=avatar_url,
            replies_count=0
        )
    
    async def update(self, comment_uuid: str, update_data: Dict[str, Any]) -> Optional[CommentResponse]:
        """Обновление комментария"""
        # Формируем SQL запрос динамически
        set_clauses = []
        values = []
        param_index = 1
        
        for key, value in update_data.items():
            set_clauses.append(f"{key} = ${param_index}")
            values.append(value)
            param_index += 1
        
        values.append(comment_uuid)  # для WHERE условия
        
        query = f"""
        UPDATE comments 
        SET {', '.join(set_clauses)}
        WHERE comment_uuid = ${param_index}
        RETURNING comment_uuid, user_id, course_workout_uuid, content, 
                  parent_comment_uuid, is_deleted, created_at, updated_at
        """
        
        row = await self.db.fetchrow(query, *values)
        if not row:
            return None
        
        # Получаем данные пользователя для отображения
        user_data = await self._get_user_data(row["user_id"])
        
        return CommentResponse(
            comment_uuid=str(row["comment_uuid"]),
            user_id=row["user_id"],
            course_workout_uuid=str(row["course_workout_uuid"]),
            content=row["content"],
            parent_comment_uuid=str(row["parent_comment_uuid"]) if row["parent_comment_uuid"] else None,
            is_deleted=row["is_deleted"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            user_name=user_data.get("user_name"),
            user_avatar_url=user_data.get("user_avatar_url"),
            replies_count=0
        )
    
    async def get_workout_comments(
        self, 
        workout_uuid: str, 
        show_deleted: bool = False, 
        limit: int = 20, 
        offset: int = 0,
        parent_comment_uuid: Optional[str] = None
    ) -> List[CommentResponse]:
        """Получение комментариев для тренировки"""
        # Строим запрос динамически с правильной типизацией параметров
        where_conditions = ["c.course_workout_uuid = $1"]
        query_params: List[Union[str, int, bool]] = [workout_uuid]
        param_index = 2
        
        # Фильтр по родительскому комментарию
        if parent_comment_uuid is None:
            where_conditions.append("c.parent_comment_uuid IS NULL")
        else:
            where_conditions.append(f"c.parent_comment_uuid = ${param_index}")
            query_params.append(parent_comment_uuid)
            param_index += 1
        
        # Фильтр по удаленным комментариям
        if not show_deleted:
            where_conditions.append("c.is_deleted = FALSE")
        
        # Добавляем параметры пагинации
        limit_placeholder = f"${param_index}"
        offset_placeholder = f"${param_index + 1}"
        query_params.append(limit)
        query_params.append(offset)
        
        query = f"""
        SELECT c.comment_uuid, c.user_id, c.course_workout_uuid, c.content, 
               c.parent_comment_uuid, c.is_deleted, c.created_at, c.updated_at,
               COALESCE(u.first_name || ' ' || u.last_name, u.email) as user_name,
               u.avatar_url as user_avatar_url
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE {' AND '.join(where_conditions)}
        ORDER BY c.created_at ASC
        LIMIT {limit_placeholder} OFFSET {offset_placeholder}
        """
        
        rows = await self.db.fetch(query, *query_params)
        
        comments = []
        for row in rows:
            # Создаем правильный URL для аватарки
            avatar_url = None
            if row["user_avatar_url"]:
                avatar_url = self._build_avatar_url(row["user_avatar_url"])
            
            comment = CommentResponse(
                comment_uuid=str(row["comment_uuid"]),
                user_id=row["user_id"],
                course_workout_uuid=str(row["course_workout_uuid"]),
                content=row["content"],
                parent_comment_uuid=str(row["parent_comment_uuid"]) if row["parent_comment_uuid"] else None,
                is_deleted=row["is_deleted"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                user_name=row["user_name"],
                user_avatar_url=avatar_url,
                replies_count=0
            )
            comments.append(comment)
        
        return comments
    
    async def count_workout_comments(
        self, 
        workout_uuid: str, 
        show_deleted: bool = False,
        parent_comment_uuid: Optional[str] = None
    ) -> int:
        """Подсчет количества комментариев для тренировки"""
        where_conditions = ["course_workout_uuid = $1"]
        query_params: List[Union[str, bool]] = [workout_uuid]
        param_index = 2
        
        # Фильтр по родительскому комментарию
        if parent_comment_uuid is None:
            where_conditions.append("parent_comment_uuid IS NULL")
        else:
            where_conditions.append(f"parent_comment_uuid = ${param_index}")
            query_params.append(parent_comment_uuid)
            param_index += 1
        
        # Фильтр по удаленным комментариям
        if not show_deleted:
            where_conditions.append("is_deleted = FALSE")
        
        query = f"""
        SELECT COUNT(*) as count
        FROM comments
        WHERE {' AND '.join(where_conditions)}
        """
        
        row = await self.db.fetchrow(query, *query_params)
        return row["count"] if row else 0
    
    async def is_course_owner(self, course_workout_uuid: str, user_id: int) -> bool:
        """Проверка, является ли пользователь владельцем курса"""
        query = """
        SELECT EXISTS(
            SELECT 1 
            FROM course_workouts cw 
            JOIN courses c ON cw.course_uuid = c.course_uuid 
            WHERE cw.course_workout_uuid = $1 AND c.user_id = $2
        ) as is_owner
        """
        
        row = await self.db.fetchrow(query, course_workout_uuid, user_id)
        return row["is_owner"] if row else False
    
    async def _get_user_data(self, user_id: int) -> Dict[str, Optional[str]]:
        """Получение данных пользователя для отображения"""
        query = """
        SELECT COALESCE(first_name || ' ' || last_name, email) as user_name,
               avatar_url
        FROM users 
        WHERE id = $1
        """
        
        row = await self.db.fetchrow(query, user_id)
        if not row:
            return {"user_name": None, "user_avatar_url": None}
        
        # Создаем правильный URL для аватарки
        avatar_url = None
        if row["avatar_url"]:
            avatar_url = self._build_avatar_url(row["avatar_url"])
        
        return {
            "user_name": row["user_name"],
            "user_avatar_url": avatar_url
        }
    
    def _build_avatar_url(self, avatar_filename: str) -> str:
        """Построение полного URL для аватарки"""
        # Получаем базовый URL из переменной окружения или используем значение по умолчанию
        import os
        base_url = os.getenv('API_URL', 'http://localhost:8001')
        return f"{base_url}/api/profile/avatars/{avatar_filename}" 