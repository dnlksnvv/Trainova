import logging
from typing import List, Optional, Dict, Any
from uuid import UUID
from training.domain.schemas import (
    Training, Exercise, UserTraining, UserProgress
)
from training.infrastructure.database import Database
from training.domain.db_constants import *

logger = logging.getLogger(__name__)

class AdminService:
    """
    Сервис для администратора
    """
    
    def __init__(self):
        self.db = Database()
    
    async def get_all_trainings_admin(self) -> List[Training]:
        """
        Получает список всех тренировок (для администраторов)
        
        Returns:
            Список тренировок
        """
        try:
            query = f"""
                SELECT * FROM {TRAININGS_TABLE}
                ORDER BY {TRAINING_CREATED_AT} DESC
            """
            
            rows = await self.db.fetch(query)
            return [Training(**row) for row in rows]
        except Exception as e:
            logger.error(f"Ошибка при получении списка всех тренировок: {str(e)}")
            raise
    
        """
        Получает статистику пользователей
        
        Returns:
            Статистика пользователей
        """
        try:
            # Общее количество тренировок
            total_trainings_query = f"SELECT COUNT(*) FROM {TRAININGS_TABLE}"
            total_trainings = await self.db.fetchval(total_trainings_query)
            

            
            # Общее количество упражнений
            total_exercises_query = f"SELECT COUNT(*) FROM {EXERCISES_TABLE}"
            total_exercises = await self.db.fetchval(total_exercises_query)
            
            # Количество пользователей, добавивших тренировки
            users_with_trainings_query = f"""
                SELECT COUNT(DISTINCT {USER_TRAINING_USER_ID}) 
                FROM {USER_TRAININGS_TABLE}
            """
            users_with_trainings = await self.db.fetchval(users_with_trainings_query)
            
            # Количество завершенных тренировок
            completed_trainings_query = f"""
                SELECT COUNT(*) FROM {USER_TRAININGS_TABLE}
                WHERE {USER_TRAINING_STATUS} = 'completed'
            """
            completed_trainings = await self.db.fetchval(completed_trainings_query)
            
            # Наиболее популярные тренировки
            popular_trainings_query = f"""
                SELECT t.{TRAINING_ID}, t.{TRAINING_NAME}, COUNT(ut.{USER_TRAINING_ID}) as user_count
                FROM {TRAININGS_TABLE} t
                JOIN {USER_TRAININGS_TABLE} ut ON t.{TRAINING_ID} = ut.{USER_TRAINING_TRAINING_ID}
                GROUP BY t.{TRAINING_ID}, t.{TRAINING_NAME}
                ORDER BY user_count DESC
                LIMIT 5
            """
            popular_trainings_rows = await self.db.fetch(popular_trainings_query)
            popular_trainings = [
                {
                    "id": row[TRAINING_ID], 
                    "name": row[TRAINING_NAME], 
                    "user_count": row["user_count"]
                } 
                for row in popular_trainings_rows
            ]
            
            # Наиболее популярные группы мышц
            popular_muscle_groups_query = f"""
                SELECT {EXERCISE_MUSCLE_GROUP}, COUNT(*) as exercise_count
                FROM {EXERCISES_TABLE}
                GROUP BY {EXERCISE_MUSCLE_GROUP}
                ORDER BY exercise_count DESC
            """
            popular_muscle_groups_rows = await self.db.fetch(popular_muscle_groups_query)
            popular_muscle_groups = [
                {
                    "muscle_group": row[EXERCISE_MUSCLE_GROUP], 
                    "exercise_count": row["exercise_count"]
                } 
                for row in popular_muscle_groups_rows
            ]
            
            return {
                "total_trainings": total_trainings,
                "total_exercises": total_exercises,
                "users_with_trainings": users_with_trainings,
                "completed_trainings": completed_trainings,
                "popular_trainings": popular_trainings,
                "popular_muscle_groups": popular_muscle_groups
            }
        except Exception as e:
            logger.error(f"Ошибка при получении статистики пользователей: {str(e)}")
            raise

    async def delete_training_admin(self, training_id: int) -> bool:
        """
        Удаляет тренировку (для администраторов)
        
        Args:
            training_id: ID тренировки
            
        Returns:
            True, если тренировка успешно удалена, иначе False
        """
        try:
            # Начинаем транзакцию
            async with self.db._pool.acquire() as conn:
                async with conn.transaction():
                    # Удаляем связи упражнений
                    await conn.execute(
                        f"DELETE FROM {TRAINING_EXERCISES_TABLE} WHERE {TRAINING_EXERCISE_TRAINING_ID} = $1",
                        training_id
                    )
                    
                    # Удаляем записи о тренировках пользователей
                    await conn.execute(
                        f"DELETE FROM {USER_TRAININGS_TABLE} WHERE {USER_TRAINING_TRAINING_ID} = $1",
                        training_id
                    )
                    
                    # Удаляем записи о прогрессе пользователей
                    await conn.execute(
                        f"DELETE FROM {USER_PROGRESS_TABLE} WHERE {USER_PROGRESS_TRAINING_ID} = $1",
                        training_id
                    )
                    
                    # Удаляем тренировку
                    result = await conn.fetchval(
                        f"DELETE FROM {TRAININGS_TABLE} WHERE {TRAINING_ID} = $1 RETURNING {TRAINING_ID}",
                        training_id
                    )
                    
                    return result is not None
        except Exception as e:
            logger.error(f"Ошибка при удалении тренировки {training_id}: {str(e)}")
            raise
    
    async def delete_exercise(self, exercise_id: UUID) -> bool:
        """
        Удаляет упражнение
        
        Args:
            exercise_id: ID упражнения (UUID)
            
        Returns:
            True, если упражнение успешно удалено, иначе False
        """
        try:
            async with self.db._pool.acquire() as conn:
                async with conn.transaction():
                    await conn.execute(
                        f"DELETE FROM {TRAINING_EXERCISES_TABLE} WHERE {TRAINING_EXERCISE_EXERCISE_ID} = $1",
                        exercise_id
                    )
                    
                    await conn.execute(
                        f"DELETE FROM {USER_PROGRESS_TABLE} WHERE {USER_PROGRESS_EXERCISE_ID} = $1",
                        exercise_id
                    )
                    
                    result = await conn.fetchval(
                        f"DELETE FROM {EXERCISES_TABLE} WHERE exercise_id = $1 RETURNING exercise_id",
                        exercise_id
                    )
                    
                    return result is not None
        except Exception as e:
            logger.error(f"Ошибка при удалении упражнения {exercise_id}: {str(e)}")
            raise
