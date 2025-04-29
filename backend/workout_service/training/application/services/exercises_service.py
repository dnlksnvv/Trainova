import logging
from typing import List, Optional, Dict, Any
from uuid import UUID
from training.domain.schemas import Exercise, ExerciseCreate, ExerciseUpdate
from training.infrastructure.database import Database
from training.domain.db_constants import *

logger = logging.getLogger(__name__)

class ExercisesService:
    """
    Сервис для работы с упражнениями
    """
    
    def __init__(self):
        self.db = Database()
    
    async def get_all_exercises(self) -> List[Exercise]:
        """
        Получает список всех упражнений
        
        Returns:
            Список упражнений
        """
        try:
            query = f"""
                SELECT * FROM {EXERCISES_TABLE}
                ORDER BY title
            """
            
            rows = await self.db.fetch(query)
            result = []
            for row in rows:
                exercise = self._map_to_model(row)
                if exercise:  # Проверяем, что упражнение не None
                    result.append(exercise)
            return result
        except Exception as e:
            logger.error(f"Ошибка при получении списка упражнений: {str(e)}")
            raise
    
    async def get_exercise_by_id(self, exercise_id: UUID) -> Optional[Exercise]:
        """
        Получает упражнение по ID
        
        Args:
            exercise_id: ID упражнения (UUID)
            
        Returns:
            Объект упражнения или None, если упражнение не найдено
        """
        try:
            query = f"""
                SELECT * FROM {EXERCISES_TABLE}
                WHERE exercise_id = $1
            """
            
            row = await self.db.fetchrow(query, exercise_id)
            return self._map_to_model(row) if row else None
        except Exception as e:
            logger.error(f"Ошибка при получении упражнения по ID {exercise_id}: {str(e)}")
            raise
    
    async def create_exercise(self, exercise_data: ExerciseCreate) -> Exercise:
        """
        Создает новое упражнение
        
        Args:
            exercise_data: Данные для создания упражнения
            
        Returns:
            Созданное упражнение
        """
        try:
            # Проверяем, существует ли уже такое упражнение
            check_query = f"""
                SELECT * FROM {EXERCISES_TABLE}
                WHERE title = $1 AND muscle_group_id = $2 AND description = $3
                LIMIT 1
            """
            
            existing_row = await self.db.fetchrow(
                check_query, 
                exercise_data.title,
                exercise_data.muscle_group_id,
                exercise_data.description
            )
            
            # Если упражнение с такими данными уже существует, возвращаем его
            if existing_row:
                logger.info(f"Найдено существующее упражнение с таким же названием и группой мышц: {exercise_data.title}")
                existing_exercise = self._map_to_model(existing_row)
                
                # Обработка случая, когда _map_to_model вернул None
                if not existing_exercise:
                    logger.error("Не удалось преобразовать существующую запись в модель Exercise")
                    raise ValueError("Ошибка при получении существующего упражнения")
                
                # Если есть изменения в gif_uuid, обновляем его
                if exercise_data.gif_uuid is not None and existing_exercise.gif_uuid != exercise_data.gif_uuid:
                    exercise_uuid = UUID(str(existing_exercise.exercise_id))
                    updated_exercise = await self.update_exercise(
                        exercise_uuid, 
                        ExerciseUpdate(gif_uuid=exercise_data.gif_uuid)
                    )
                    
                    if not updated_exercise:
                        logger.error(f"Не удалось обновить gif_uuid для упражнения {existing_exercise.exercise_id}")
                        raise ValueError("Ошибка при обновлении существующего упражнения")
                    
                    return updated_exercise
                
                return existing_exercise
            
            query = f"""
                INSERT INTO {EXERCISES_TABLE} (
                    title,
                    description,
                    muscle_group_id,
                    gif_uuid
                )
                VALUES ($1, $2, $3, $4)
                RETURNING *
            """
            
            row = await self.db.fetchrow(
                query, 
                exercise_data.title,
                exercise_data.description,
                exercise_data.muscle_group_id,
                exercise_data.gif_uuid
            )
            
            exercise = self._map_to_model(row)
            if not exercise:
                raise ValueError("Не удалось создать упражнение")
            return exercise
        except Exception as e:
            logger.error(f"Ошибка при создании упражнения: {str(e)}")
            raise
    
    async def update_exercise(self, exercise_id: UUID, exercise_data: ExerciseUpdate) -> Optional[Exercise]:
        """
        Обновляет упражнение
        
        Args:
            exercise_id: ID упражнения (UUID)
            exercise_data: Данные для обновления
            
        Returns:
            Обновленное упражнение или None, если упражнение не найдено
        """
        try:
            current_exercise = await self.get_exercise_by_id(exercise_id)
            if not current_exercise:
                return None
            
            update_fields = []
            params = []
            param_index = 1
            
            if exercise_data.title is not None:
                update_fields.append(f"title = ${param_index}")
                params.append(exercise_data.title)
                param_index += 1
                
            if exercise_data.description is not None:
                update_fields.append(f"description = ${param_index}")
                params.append(exercise_data.description)
                param_index += 1
                
            if exercise_data.muscle_group_id is not None:
                update_fields.append(f"muscle_group_id = ${param_index}")
                params.append(exercise_data.muscle_group_id)
                param_index += 1
                
            if hasattr(exercise_data, 'gif_uuid'):
                update_fields.append(f"gif_uuid = ${param_index}")
                params.append(exercise_data.gif_uuid)
                param_index += 1
            
            update_fields.append(f"updated_at = CURRENT_TIMESTAMP")
            
            # Если нет полей для обновления, возвращаем текущее упражнение
            if not update_fields:
                return current_exercise
            
            query = f"""
                UPDATE {EXERCISES_TABLE}
                SET {', '.join(update_fields)}
                WHERE exercise_id = ${param_index}
                RETURNING *
            """
            
            params.append(exercise_id)
            row = await self.db.fetchrow(query, *params)
            return self._map_to_model(row)
        except Exception as e:
            logger.error(f"Ошибка при обновлении упражнения {exercise_id}: {str(e)}")
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
            query = f"""
                DELETE FROM {EXERCISES_TABLE}
                WHERE exercise_id = $1
                RETURNING exercise_id
            """
            
            result = await self.db.fetchval(query, exercise_id)
            return result is not None
        except Exception as e:
            logger.error(f"Ошибка при удалении упражнения {exercise_id}: {str(e)}")
            raise
    
        """
        Получает список упражнений по группы мышц (устаревший метод)
        
        Args:
            muscle_group: Группа мышц как строка
            
        Returns:
            Список упражнений (всегда пустой, поскольку в таблице нет поля muscle_group)
        """
        return []
    
    async def get_exercises_by_muscle_group_id(self, muscle_group_id: int) -> List[Exercise]:
        """
        Получает список упражнений по ID группы мышц
        
        Args:
            muscle_group_id: ID группы мышц из таблицы muscle_groups
            
        Returns:
            Список упражнений
        """
        try:
            query = f"""
                SELECT * FROM {EXERCISES_TABLE}
                WHERE muscle_group_id = $1
                ORDER BY title
            """
            
            rows = await self.db.fetch(query, muscle_group_id)
            result = []
            for row in rows:
                exercise = self._map_to_model(row)
                if exercise:
                    result.append(exercise)
            return result
        except Exception as e:
            logger.error(f"Ошибка при получении упражнений по ID группы мышц {muscle_group_id}: {str(e)}")
            raise
            
    def _map_to_model(self, row: Optional[Dict[str, Any]]) -> Optional[Exercise]:
        """
        Преобразует результат запроса в модель упражнения
        
        Args:
            row: Результат запроса к БД
            
        Returns:
            Модель упражнения или None
        """
        if not row:
            return None
            
        # Преобразуем UUID в строку, если необходимо
        exercise_id = row.get("exercise_id")
        if exercise_id is not None:
            exercise_id = str(exercise_id)
            
        gif_uuid = row.get("gif_uuid")
        if gif_uuid is not None:
            gif_uuid = str(gif_uuid)
            
        return Exercise(
            exercise_id=exercise_id,
            title=row.get("title", ""),
            description=row.get("description", ""),
            muscle_group_id=row.get("muscle_group_id", 0),
            gif_uuid=gif_uuid,
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at")
        ) 