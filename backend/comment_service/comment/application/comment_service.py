import uuid
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

from ..domain.schemas import CommentResponse, CommentWithReplies, CommentList
from ..infrastructure.database import Database
from ..infrastructure.repositories.comment_repository import CommentRepository

logger = logging.getLogger(__name__)

class CommentService:
    def __init__(self):
        self.comment_repository = CommentRepository()
    
    async def create_comment(self, comment_data: Dict[str, Any]) -> CommentResponse:
        """Создание нового комментария"""
        try:
            # Генерируем UUID для комментария
            comment_uuid = str(uuid.uuid4())
            
            # Подготавливаем данные для вставки
            insert_data = {
                "comment_uuid": comment_uuid,
                "user_id": comment_data["user_id"],
                "course_workout_uuid": comment_data["course_workout_uuid"],
                "content": comment_data["content"],
                "parent_comment_uuid": comment_data.get("parent_comment_uuid"),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            # Проверяем существование родительского комментария, если он указан
            if insert_data["parent_comment_uuid"]:
                parent_comment = await self.comment_repository.get_by_id(insert_data["parent_comment_uuid"])
                if not parent_comment:
                    raise ValueError("Родительский комментарий не найден")
                
                # Проверяем, что родительский комментарий принадлежит той же тренировке
                if parent_comment.course_workout_uuid != insert_data["course_workout_uuid"]:
                    raise ValueError("Родительский комментарий принадлежит другой тренировке")
            
            # Создаем комментарий
            created_comment = await self.comment_repository.create(insert_data)
            
            logger.info(f"Комментарий создан: {comment_uuid}")
            return created_comment
        except Exception as e:
            logger.error(f"Ошибка при создании комментария: {str(e)}")
            raise
    
    async def get_comment_by_id(self, comment_uuid: str) -> Optional[CommentResponse]:
        """Получение комментария по ID"""
        try:
            return await self.comment_repository.get_by_id(comment_uuid)
        except Exception as e:
            logger.error(f"Ошибка при получении комментария {comment_uuid}: {str(e)}")
            raise
    
    async def update_comment(self, comment_uuid: str, update_data: Dict[str, Any]) -> CommentResponse:
        """Обновление комментария"""
        try:
            # Добавляем время обновления
            update_data["updated_at"] = datetime.utcnow()
            
            updated_comment = await self.comment_repository.update(comment_uuid, update_data)
            if not updated_comment:
                raise ValueError("Комментарий не найден")
            
            logger.info(f"Комментарий обновлен: {comment_uuid}")
            return updated_comment
        except Exception as e:
            logger.error(f"Ошибка при обновлении комментария {comment_uuid}: {str(e)}")
            raise
    
    async def delete_comment(self, comment_uuid: str) -> CommentResponse:
        """Удаление комментария (мягкое удаление)"""
        try:
            delete_data = {
                "is_deleted": True,
                "updated_at": datetime.utcnow()
            }
            
            deleted_comment = await self.comment_repository.update(comment_uuid, delete_data)
            if not deleted_comment:
                raise ValueError("Комментарий не найден")
            
            logger.info(f"Комментарий удален: {comment_uuid}")
            return deleted_comment
        except Exception as e:
            logger.error(f"Ошибка при удалении комментария {comment_uuid}: {str(e)}")
            raise
    
    async def can_delete_comment(self, comment_uuid: str, user_id: int, user_role: int) -> bool:
        """Проверка прав на удаление комментария"""
        try:
            comment = await self.comment_repository.get_by_id(comment_uuid)
            if not comment:
                return False
            
            # Админ может удалить любой комментарий
            if user_role == 1:
                return True
            
            # Автор комментария может удалить свой комментарий
            if comment.user_id == user_id:
                return True
            
            # Автор курса может удалить любой комментарий в своем курсе
            is_course_owner = await self.comment_repository.is_course_owner(comment.course_workout_uuid, user_id)
            if is_course_owner:
                return True
            
            return False
        except Exception as e:
            logger.error(f"Ошибка при проверке прав на удаление комментария {comment_uuid}: {str(e)}")
            return False
    
    async def get_workout_comments(
        self, 
        workout_uuid: str, 
        show_deleted: bool = False, 
        limit: int = 20, 
        offset: int = 0,
        user_id: Optional[int] = None
    ) -> CommentList:
        """Получение комментариев для тренировки с пагинацией и поддержкой ответов"""
        try:
            # Получаем основные комментарии (без родительского комментария)
            main_comments = await self.comment_repository.get_workout_comments(
                workout_uuid, show_deleted, limit, offset, parent_comment_uuid=None
            )
            
            # Получаем общее количество основных комментариев
            total_count = await self.comment_repository.count_workout_comments(
                workout_uuid, show_deleted, parent_comment_uuid=None
            )
            
            # Формируем список комментариев с ответами
            comments_with_replies = []
            for comment in main_comments:
                # Получаем ответы для каждого основного комментария
                replies = await self.comment_repository.get_workout_comments(
                    workout_uuid, show_deleted, limit=50, offset=0, 
                    parent_comment_uuid=comment.comment_uuid
                )
                
                # Подсчитываем количество ответов
                replies_count = len(replies)
                
                # Создаем объект CommentResponse с количеством ответов
                comment_dict = comment.dict()
                comment_dict["replies_count"] = replies_count
                comment_response = CommentResponse(**comment_dict)
                
                # Создаем объект CommentWithReplies
                comment_with_replies = CommentWithReplies(
                    **comment_response.dict(),
                    replies=replies
                )
                
                comments_with_replies.append(comment_with_replies)
            
            return CommentList(
                comments=comments_with_replies,
                total_count=total_count
            )
        except Exception as e:
            logger.error(f"Ошибка при получении комментариев для тренировки {workout_uuid}: {str(e)}")
            raise 