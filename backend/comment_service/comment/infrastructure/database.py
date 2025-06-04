import logging
from typing import Dict, List, Any, Optional
import asyncpg
from asyncpg.pool import Pool
from config import settings
import uuid
from datetime import datetime
from comment.domain.models import Comment

logger = logging.getLogger(__name__)

class Database:
    _instance = None
    _pool: Optional[Pool] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Database, cls).__new__(cls)
        return cls._instance

    async def connect(self) -> None:
        if self._pool is None:
            try:
                logger.info("Подключение к базе данных...")
                self._pool = await asyncpg.create_pool(
                    user=settings.DB_USER,
                    password=settings.DB_PASSWORD,
                    host=settings.DB_HOST,
                    port=settings.DB_PORT,
                    database=settings.DB_NAME
                )
                logger.info("Подключение к базе данных успешно установлено.")
            except Exception as e:
                logger.error(f"Ошибка при подключении к базе данных: {str(e)}")
                raise

    async def disconnect(self) -> None:
        if self._pool:
            await self._pool.close()
            self._pool = None
            logger.info("Соединение с базой данных закрыто.")

    async def execute(self, query: str, *args, **kwargs) -> str:
        """
        Выполняет SQL запрос без возврата данных
        для INSERT, UPDATE, DELETE операций
        """
        if not self._pool:
            await self.connect()
        
        async with self._pool.acquire() as connection:
            try:
                return await connection.execute(query, *args, **kwargs)
            except Exception as e:
                logger.error(f"Ошибка при выполнении запроса {query}: {str(e)}")
                raise

    async def fetch(self, query: str, *args, **kwargs) -> List[Dict[str, Any]]:
        """
        Возвращает список строк результата запроса
        """
        if not self._pool:
            await self.connect()
        
        async with self._pool.acquire() as connection:
            try:
                rows = await connection.fetch(query, *args, **kwargs)
                return [dict(row) for row in rows]
            except Exception as e:
                logger.error(f"Ошибка при выполнении запроса {query}: {str(e)}")
                raise

    async def fetchrow(self, query: str, *args, **kwargs) -> Optional[Dict[str, Any]]:
        """
        Возвращает первую строку результата как словарь
        """
        if not self._pool:
            await self.connect()
        
        async with self._pool.acquire() as connection:
            try:
                row = await connection.fetchrow(query, *args, **kwargs)
                return dict(row) if row else None
            except Exception as e:
                logger.error(f"Ошибка при выполнении запроса {query}: {str(e)}")
                raise

    async def fetchval(self, query: str, *args, **kwargs) -> Any:
        """
        Возвращает значение из первой строки результата
        """
        if not self._pool:
            await self.connect()
        
        async with self._pool.acquire() as connection:
            try:
                return await connection.fetchval(query, *args, **kwargs)
            except Exception as e:
                logger.error(f"Ошибка при выполнении запроса {query}: {str(e)}")
                raise 

class CommentRepository:
    def __init__(self):
        self.database_url = settings.DATABASE_URL
    
    async def get_connection(self):
        return await asyncpg.connect(self.database_url)
    
    async def create(self, comment: Comment) -> Comment:
        """Создание нового комментария"""
        conn = await self.get_connection()
        try:
            comment_uuid = str(uuid.uuid4())
            now = datetime.utcnow()
            
            query = """
                INSERT INTO comments (
                    comment_uuid, course_workout_uuid, user_id, text, 
                    parent_comment_uuid, created_at, updated_at, is_deleted
                ) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING comment_uuid
            """
            
            await conn.execute(
                query,
                comment_uuid,
                comment.course_workout_uuid,
                comment.user_id,
                comment.text,
                comment.parent_comment_uuid,
                now,
                now,
                False
            )
            
            # Получаем созданный комментарий
            return await self.get_by_uuid(comment_uuid)
            
        finally:
            await conn.close()
    
    async def get_by_uuid(self, comment_uuid: str) -> Optional[Comment]:
        """Получение комментария по UUID"""
        conn = await self.get_connection()
        try:
            query = """
                SELECT c.*, u.first_name, u.last_name, u.avatar_url
                FROM comments c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE c.comment_uuid = $1
            """
            
            row = await conn.fetchrow(query, comment_uuid)
            if row:
                return Comment(
                    comment_uuid=row['comment_uuid'],
                    course_workout_uuid=row['course_workout_uuid'],
                    user_id=row['user_id'],
                    text=row['text'],
                    parent_comment_uuid=row['parent_comment_uuid'],
                    user_first_name=row['first_name'],
                    user_last_name=row['last_name'],
                    user_avatar_url=row['avatar_url'],
                    created_at=row['created_at'],
                    updated_at=row['updated_at'],
                    is_deleted=row['is_deleted']
                )
            return None
            
        finally:
            await conn.close()
    
    async def get_by_workout(self, workout_uuid: str) -> List[Comment]:
        """Получение всех комментариев для тренировки"""
        conn = await self.get_connection()
        try:
            query = """
                SELECT c.*, u.first_name, u.last_name, u.avatar_url
                FROM comments c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE c.course_workout_uuid = $1 AND c.is_deleted = FALSE
                ORDER BY c.created_at ASC
            """
            
            rows = await conn.fetch(query, workout_uuid)
            comments = []
            
            for row in rows:
                comments.append(Comment(
                    comment_uuid=row['comment_uuid'],
                    course_workout_uuid=row['course_workout_uuid'],
                    user_id=row['user_id'],
                    text=row['text'],
                    parent_comment_uuid=row['parent_comment_uuid'],
                    user_first_name=row['first_name'],
                    user_last_name=row['last_name'],
                    user_avatar_url=row['avatar_url'],
                    created_at=row['created_at'],
                    updated_at=row['updated_at'],
                    is_deleted=row['is_deleted']
                ))
            
            return comments
            
        finally:
            await conn.close()
    
    async def update(self, comment: Comment) -> Comment:
        """Обновление комментария"""
        conn = await self.get_connection()
        try:
            query = """
                UPDATE comments 
                SET text = $1, updated_at = $2, is_deleted = $3
                WHERE comment_uuid = $4
            """
            
            await conn.execute(
                query,
                comment.text,
                comment.updated_at,
                comment.is_deleted,
                comment.comment_uuid
            )
            
            return comment
            
        finally:
            await conn.close()
    
    async def count_by_workout(self, workout_uuid: str) -> int:
        """Подсчет количества комментариев для тренировки (без удаленных)"""
        conn = await self.get_connection()
        try:
            query = """
                SELECT COUNT(*) 
                FROM comments 
                WHERE course_workout_uuid = $1 AND is_deleted = FALSE
            """
            
            count = await conn.fetchval(query, workout_uuid)
            return count or 0
            
        finally:
            await conn.close() 