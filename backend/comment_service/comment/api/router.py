from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional, Dict, Any
import uuid
import logging

from ..domain.schemas import (
    CommentCreate, CommentUpdate, CommentResponse, 
    CommentWithReplies, CommentList, HealthResponse
)
from ..application.comment_service import CommentService
from ..infrastructure.token_bearer import get_current_user, get_current_user_optional

logger = logging.getLogger(__name__)

class CommentRouter:
    def __init__(self):
        self.router = APIRouter(
            prefix="",
            tags=["comments"],
            responses={404: {"description": "Not found"}},
        )
        self.comment_service = CommentService()
        self._register_routes()
    
    def _register_routes(self):
        """Регистрация маршрутов"""
        
        @self.router.get("/health", response_model=HealthResponse)
        async def health_check():
            """Проверка здоровья сервиса комментариев"""
            return HealthResponse(
                service="comment_service",
                status="healthy",
                message="Comment Service работает нормально"
            )
        
        @self.router.post("/", response_model=CommentResponse)
        async def create_comment(
            comment_data: CommentCreate,
            current_user: Dict[str, Any] = Depends(get_current_user)
        ):
            """Создание нового комментария"""
            try:
                logger.info(f"Создание комментария пользователем {current_user['user_id']}")
                
                # Добавляем user_id из токена
                comment_with_user = {
                    **comment_data.dict(),
                    "user_id": current_user["user_id"]
                }
                
                created_comment = await self.comment_service.create_comment(comment_with_user)
                
                logger.info(f"Комментарий успешно создан: {created_comment.comment_uuid}")
                return created_comment
            except Exception as e:
                logger.error(f"Ошибка при создании комментария: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Ошибка при создании комментария: {str(e)}"
                )
        
        @self.router.get("/{comment_uuid}", response_model=CommentResponse)
        async def get_comment(comment_uuid: str):
            """Получение комментария по UUID"""
            try:
                # Валидация UUID
                try:
                    uuid.UUID(comment_uuid)
                except ValueError:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Некорректный формат UUID комментария"
                    )
                
                comment = await self.comment_service.get_comment_by_id(comment_uuid)
                
                if not comment:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Комментарий не найден"
                    )
                
                return comment
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Ошибка при получении комментария {comment_uuid}: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Ошибка при получении комментария: {str(e)}"
                )
        
        @self.router.put("/{comment_uuid}", response_model=CommentResponse)
        async def update_comment(
            comment_uuid: str,
            comment_data: CommentUpdate,
            current_user: Dict[str, Any] = Depends(get_current_user)
        ):
            """Обновление комментария"""
            try:
                # Валидация UUID
                try:
                    uuid.UUID(comment_uuid)
                except ValueError:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Некорректный формат UUID комментария"
                    )
                
                # Проверяем права доступа
                existing_comment = await self.comment_service.get_comment_by_id(comment_uuid)
                if not existing_comment:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Комментарий не найден"
                    )
                
                # Только автор может редактировать свой комментарий
                if existing_comment.user_id != current_user["user_id"]:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Доступ запрещен. Вы можете редактировать только свои комментарии"
                    )
                
                updated_comment = await self.comment_service.update_comment(
                    comment_uuid, 
                    comment_data.dict(exclude_unset=True)
                )
                
                logger.info(f"Комментарий {comment_uuid} обновлен пользователем {current_user['user_id']}")
                return updated_comment
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Ошибка при обновлении комментария {comment_uuid}: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Ошибка при обновлении комментария: {str(e)}"
                )
        
        @self.router.delete("/{comment_uuid}", response_model=CommentResponse)
        async def delete_comment(
            comment_uuid: str,
            current_user: Dict[str, Any] = Depends(get_current_user)
        ):
            """Удаление комментария с проверкой прав"""
            try:
                # Валидация UUID
                try:
                    uuid.UUID(comment_uuid)
                except ValueError:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Некорректный формат UUID комментария"
                    )
                
                # Проверяем права доступа на удаление
                can_delete = await self.comment_service.can_delete_comment(
                    comment_uuid, 
                    current_user["user_id"], 
                    current_user["role_id"]
                )
                
                if not can_delete:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Доступ запрещен. Недостаточно прав для удаления комментария"
                    )
                
                deleted_comment = await self.comment_service.delete_comment(comment_uuid)
                
                logger.info(f"Комментарий {comment_uuid} удален пользователем {current_user['user_id']}")
                return deleted_comment
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Ошибка при удалении комментария {comment_uuid}: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Ошибка при удалении комментария: {str(e)}"
                )
        
        @self.router.get("/workout/{workout_uuid}", response_model=CommentList)
        async def get_workout_comments(
            workout_uuid: str,
            current_user: Dict[str, Any] = Depends(get_current_user),
            show_deleted: bool = Query(False, description="Показать удаленные комментарии"),
            limit: int = Query(20, ge=1, le=100, description="Количество комментариев на странице"),
            offset: int = Query(0, ge=0, description="Смещение для пагинации")
        ):
            """Получение комментариев для тренировки с пагинацией"""
            try:
                # Валидация UUID
                try:
                    uuid.UUID(workout_uuid)
                except ValueError:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Некорректный формат UUID тренировки"
                    )
                
                # Проверяем права на просмотр удаленных комментариев
                user_id = current_user["user_id"]
                user_role = current_user["role_id"]
                
                # Удаленные комментарии могут видеть только админы
                if show_deleted and user_role != 1:
                    show_deleted = False
                    logger.warning(f"Пользователь {user_id} пытался получить удаленные комментарии без прав")
                
                comments_data = await self.comment_service.get_workout_comments(
                    workout_uuid, show_deleted, limit, offset, user_id
                )
                
                logger.info(f"Получено {len(comments_data.comments)} комментариев для тренировки {workout_uuid}")
                return comments_data
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Ошибка при получении комментариев для тренировки {workout_uuid}: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Ошибка при получении комментариев: {str(e)}"
                ) 