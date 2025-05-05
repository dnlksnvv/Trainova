import logging
from typing import List, Optional, Dict, Any, Union
from uuid import UUID
from training.domain.schemas import (
    Training, TrainingCreate, TrainingUpdate,
    UserTraining, UserTrainingCreate, UserTrainingUpdate,
    TrainingExercise, TrainingExerciseCreate,
    AppWorkout, AppWorkoutCreate, AppWorkoutExercise,
    TrainingStatus
)
from training.infrastructure.database import Database
from training.domain.db_constants import *
from datetime import datetime

logger = logging.getLogger(__name__)

class TrainingService:
    """
    Сервис для работы с тренировками
    """
    
    def __init__(self):
        self.db = Database()
    
    async def get_all_trainings(self, user_id: Optional[int] = None) -> List[Training]:
        """
        Получает список всех публичных тренировок и личных тренировок пользователя
        
        Args:
            user_id: ID пользователя (опционально)
            
        Returns:
            Список тренировок
        """
        try:
            if user_id:
                query = f"""
                    SELECT * FROM {TRAININGS_TABLE}
                    WHERE {TRAINING_IS_PUBLIC} = true OR {TRAINING_CREATED_BY} = $1
                    ORDER BY {TRAINING_CREATED_AT} DESC
                """
                rows = await self.db.fetch(query, user_id)
            else:
                query = f"""
                    SELECT * FROM {TRAININGS_TABLE}
                    WHERE {TRAINING_IS_PUBLIC} = true
                    ORDER BY {TRAINING_CREATED_AT} DESC
                """
                rows = await self.db.fetch(query)
            
            trainings = []
            for row in rows:
                training = Training(**row)
                training.exercises = await self._get_training_exercises(training.id)
                trainings.append(training)
            
            return trainings
        except Exception as e:
            logger.error(f"Ошибка при получении списка тренировок: {str(e)}")
            raise
    
    async def get_training_by_id(self, training_id: int, user_id: Optional[int] = None) -> Optional[Training]:
        """
        Получает тренировку по ID
        
        Args:
            training_id: ID тренировки
            user_id: ID пользователя (для проверки доступа к приватной тренировке)
            
        Returns:
            Объект тренировки или None, если тренировка не найдена или недоступна
        """
        try:
            if user_id:
                query = f"""
                    SELECT * FROM {TRAININGS_TABLE}
                    WHERE {TRAINING_ID} = $1 
                    AND ({TRAINING_IS_PUBLIC} = true OR {TRAINING_CREATED_BY} = $2)
                """
                row = await self.db.fetchrow(query, training_id, user_id)
            else:
                query = f"""
                    SELECT * FROM {TRAININGS_TABLE}
                    WHERE {TRAINING_ID} = $1 AND {TRAINING_IS_PUBLIC} = true
                """
                row = await self.db.fetchrow(query, training_id)
            
            if not row:
                return None
                
            training = Training(**row)
            training.exercises = await self._get_training_exercises(training.id)
            
            return training
        except Exception as e:
            logger.error(f"Ошибка при получении тренировки по ID {training_id}: {str(e)}")
            raise
    
    async def create_training(self, training_data: TrainingCreate, user_id: int) -> Training:
        """
        Создает новую тренировку
        
        Args:
            training_data: Данные для создания тренировки
            user_id: ID пользователя, создающего тренировку
            
        Returns:
            Созданная тренировка
        """
        try:
            # Убедимся, что подключение к БД установлено
            if not self.db._pool:
                await self.db.connect()
                
            async with self.db._pool.acquire() as conn:
                async with conn.transaction():
                    query = f"""
                        INSERT INTO {TRAININGS_TABLE} (
                            {TRAINING_NAME}, 
                            {TRAINING_DESCRIPTION}, 
                            {TRAINING_DIFFICULTY}, 
                            {TRAINING_DURATION}, 
                            {TRAINING_CREATED_BY}, 
                            {TRAINING_IS_PUBLIC}
                        )
                        VALUES ($1, $2, $3, $4, $5, $6)
                        RETURNING *
                    """
                    
                    training_row = await conn.fetchrow(
                        query, 
                        training_data.name, 
                        training_data.description, 
                        training_data.difficulty.value, 
                        training_data.duration, 
                        user_id, 
                        training_data.is_public
                    )
                    
                    training_id = training_row[TRAINING_ID]
                    
                    exercises = []
                    for exercise_data in training_data.exercises:
                        exercise_query = f"""
                            INSERT INTO {TRAINING_EXERCISES_TABLE} (
                                {TRAINING_EXERCISE_TRAINING_ID}, 
                                {TRAINING_EXERCISE_EXERCISE_ID}, 
                                {TRAINING_EXERCISE_SETS}, 
                                {TRAINING_EXERCISE_REPS}, 
                                {TRAINING_EXERCISE_WEIGHT}, 
                                {TRAINING_EXERCISE_REST_TIME}, 
                                {TRAINING_EXERCISE_ORDER}
                            )
                            VALUES ($1, $2, $3, $4, $5, $6, $7)
                            RETURNING *
                        """
                        
                        exercise_row = await conn.fetchrow(
                            exercise_query,
                            training_id,
                            exercise_data.exercise_id,
                            exercise_data.sets,
                            exercise_data.reps,
                            exercise_data.weight,
                            exercise_data.rest_time,
                            exercise_data.exercise_order
                        )
                        
                        exercises.append(TrainingExercise(**exercise_row))
                    
                    training = Training(**training_row)
                    training.exercises = exercises
                    
                    return training
        except Exception as e:
            logger.error(f"Ошибка при создании тренировки: {str(e)}")
            raise
    
    async def update_training(self, training_id: int, training_data: TrainingUpdate, user_id: int) -> Optional[Training]:
        """
        Обновляет тренировку
        
        Args:
            training_id: ID тренировки
            training_data: Данные для обновления
            user_id: ID пользователя (для проверки прав)
            
        Returns:
            Обновленная тренировка или None, если тренировка не найдена или нет прав
        """
        try:
            current_training = await self.get_training_by_id(training_id, user_id)
            if not current_training or current_training.created_by != user_id:
                return None
            
            # Убедимся, что подключение к БД установлено
            if not self.db._pool:
                await self.db.connect()
                
            async with self.db._pool.acquire() as conn:
                async with conn.transaction():
                    update_fields = []
                    params = []
                    param_index = 1
                    
                    if training_data.name is not None:
                        update_fields.append(f"{TRAINING_NAME} = ${param_index}")
                        params.append(training_data.name)
                        param_index += 1
                        
                    if training_data.description is not None:
                        update_fields.append(f"{TRAINING_DESCRIPTION} = ${param_index}")
                        params.append(training_data.description)
                        param_index += 1
                        
                    if training_data.difficulty is not None:
                        update_fields.append(f"{TRAINING_DIFFICULTY} = ${param_index}")
                        params.append(training_data.difficulty.value)
                        param_index += 1
                        
                    if training_data.duration is not None:
                        update_fields.append(f"{TRAINING_DURATION} = ${param_index}")
                        params.append(training_data.duration)
                        param_index += 1
                        
                    if training_data.is_public is not None:
                        update_fields.append(f"{TRAINING_IS_PUBLIC} = ${param_index}")
                        params.append(training_data.is_public)
                        param_index += 1
                    
                    update_fields.append(f"{TRAINING_UPDATED_AT} = CURRENT_TIMESTAMP")
                    
                    if not update_fields and not training_data.exercises:
                        return current_training
                    
                    if update_fields:
                        query = f"""
                            UPDATE {TRAININGS_TABLE}
                            SET {', '.join(update_fields)}
                            WHERE {TRAINING_ID} = ${param_index}
                            RETURNING *
                        """
                        
                        params.append(training_id)
                        training_row = await conn.fetchrow(query, *params)
                    else:
                        query = f"SELECT * FROM {TRAININGS_TABLE} WHERE {TRAINING_ID} = $1"
                        training_row = await conn.fetchrow(query, training_id)
                    
                    if training_data.exercises:
                        delete_query = f"""
                            DELETE FROM {TRAINING_EXERCISES_TABLE}
                            WHERE {TRAINING_EXERCISE_TRAINING_ID} = $1
                        """
                        await conn.execute(delete_query, training_id)
                        
                        exercises = []
                        for exercise_data in training_data.exercises:
                            exercise_query = f"""
                                INSERT INTO {TRAINING_EXERCISES_TABLE} (
                                    {TRAINING_EXERCISE_TRAINING_ID}, 
                                    {TRAINING_EXERCISE_EXERCISE_ID}, 
                                    {TRAINING_EXERCISE_SETS}, 
                                    {TRAINING_EXERCISE_REPS}, 
                                    {TRAINING_EXERCISE_WEIGHT}, 
                                    {TRAINING_EXERCISE_REST_TIME}, 
                                    {TRAINING_EXERCISE_ORDER}
                                )
                                VALUES ($1, $2, $3, $4, $5, $6, $7)
                                RETURNING *
                            """
                            
                            exercise_row = await conn.fetchrow(
                                exercise_query,
                                training_id,
                                exercise_data.exercise_id,
                                exercise_data.sets,
                                exercise_data.reps,
                                exercise_data.weight,
                                exercise_data.rest_time,
                                exercise_data.exercise_order
                            )
                            
                            exercises.append(TrainingExercise(**exercise_row))
                        
                        training = Training(**training_row)
                        training.exercises = exercises
                    else:
                        training = Training(**training_row)
                        training.exercises = await self._get_training_exercises(training_id)
                    
                    return training
        except Exception as e:
            logger.error(f"Ошибка при обновлении тренировки {training_id}: {str(e)}")
            raise
    
    async def delete_training(self, training_id: int, user_id: int) -> bool:
        """
        Удаляет тренировку
        
        Args:
            training_id: ID тренировки
            user_id: ID пользователя (для проверки прав)
            
        Returns:
            True, если тренировка успешно удалена, иначе False
        """
        try:
            current_training = await self.get_training_by_id(training_id, user_id)
            if not current_training or current_training.created_by != user_id:
                return False
            
            # Убедимся, что подключение к БД установлено
            if not self.db._pool:
                await self.db.connect()
                
            async with self.db._pool.acquire() as conn:
                async with conn.transaction():
                    await conn.execute(
                        f"DELETE FROM {TRAINING_EXERCISES_TABLE} WHERE {TRAINING_EXERCISE_TRAINING_ID} = $1",
                        training_id
                    )
                    
                    await conn.execute(
                        f"DELETE FROM {USER_TRAININGS_TABLE} WHERE {USER_TRAINING_TRAINING_ID} = $1",
                        training_id
                    )
                    
                    await conn.execute(
                        f"DELETE FROM {USER_PROGRESS_TABLE} WHERE {USER_PROGRESS_TRAINING_ID} = $1",
                        training_id
                    )
                    
                    result = await conn.fetchval(
                        f"DELETE FROM {TRAININGS_TABLE} WHERE {TRAINING_ID} = $1 RETURNING {TRAINING_ID}",
                        training_id
                    )
                    
                    return result is not None
        except Exception as e:
            logger.error(f"Ошибка при удалении тренировки {training_id}: {str(e)}")
            raise
    
    async def _get_training_exercises(self, training_id: Optional[int]) -> List[TrainingExercise]:
        """
        Получает список упражнений для тренировки
        
        Args:
            training_id: ID тренировки
            
        Returns:
            Список упражнений
        """
        try:
            if training_id is None:
                return []
                
            query = f"""
                SELECT * FROM {TRAINING_EXERCISES_TABLE}
                WHERE {TRAINING_EXERCISE_TRAINING_ID} = $1
                ORDER BY {TRAINING_EXERCISE_ORDER}
            """
            
            rows = await self.db.fetch(query, training_id)
            return [TrainingExercise(**row) for row in rows]
        except Exception as e:
            logger.error(f"Ошибка при получении упражнений для тренировки {training_id}: {str(e)}")
            raise
    
    async def get_user_trainings(self, user_id: int) -> List[UserTraining]:
        """
        Получает список тренировок пользователя
        
        Args:
            user_id: ID пользователя
            
        Returns:
            Список тренировок пользователя
        """
        try:
            query = f"""
                SELECT ut.*, t.*
                FROM {USER_TRAININGS_TABLE} ut
                JOIN {TRAININGS_TABLE} t ON ut.{USER_TRAINING_TRAINING_ID} = t.{TRAINING_ID}
                WHERE ut.{USER_TRAINING_USER_ID} = $1
                ORDER BY ut.{USER_TRAINING_FAVORITE} DESC, ut.{USER_TRAINING_STARTED_AT} DESC
            """
            
            rows = await self.db.fetch(query, user_id)
            
            user_trainings = []
            for row in rows:
                training_data = {k: v for k, v in row.items() if k.startswith(TRAINING_ID.split('_')[0])}
                user_training_data = {k: v for k, v in row.items() if k.startswith(USER_TRAINING_ID.split('_')[0])}
                
                training = Training(**training_data)
                training.exercises = await self._get_training_exercises(training.id)
                
                user_training = UserTraining(
                    id=user_training_data.get("user_training_id"),
                    user_id=user_id,
                    training_id=int(training_data.get(TRAINING_ID, 0)),
                    status=row.get("user_training_status", TrainingStatus.NOT_STARTED),
                    is_favorite=row.get("user_training_favorite", False),
                    started_at=row.get("user_training_started_at"),
                    completed_at=row.get("user_training_completed_at")
                )
                user_training.training = training
                
                user_trainings.append(user_training)
            
            return user_trainings
        except Exception as e:
            logger.error(f"Ошибка при получении тренировок пользователя {user_id}: {str(e)}")
            raise
    
    async def add_training_to_user(self, user_id: int, training_data: UserTrainingCreate) -> UserTraining:
        """
        Добавляет тренировку пользователю
        
        Args:
            user_id: ID пользователя
            training_data: Данные для добавления тренировки
            
        Returns:
            Объект связи пользователь-тренировка
        """
        try:
            training = await self.get_training_by_id(training_data.training_id, user_id)
            if not training:
                raise ValueError(f"Тренировка с ID {training_data.training_id} не найдена или недоступна")
            
            # Проверяем, есть ли уже эта тренировка у пользователя
            query = f"""
                SELECT * FROM {USER_TRAININGS_TABLE}
                WHERE {USER_TRAINING_USER_ID} = $1 AND {USER_TRAINING_TRAINING_ID} = $2
            """
            
            existing = await self.db.fetchrow(query, user_id, training_data.training_id)
            if existing:
                user_training = UserTraining(
                    id=existing.get("user_training_id"),
                    user_id=user_id,
                    training_id=training_data.training_id,
                    status=existing.get("user_training_status", TrainingStatus.NOT_STARTED),
                    is_favorite=existing.get("user_training_favorite", False),
                    started_at=existing.get("user_training_started_at"),
                    completed_at=existing.get("user_training_completed_at")
                )
                user_training.training = training
                return user_training
            
            insert_query = f"""
                INSERT INTO {USER_TRAININGS_TABLE} (
                    {USER_TRAINING_USER_ID}, 
                    {USER_TRAINING_TRAINING_ID}, 
                    {USER_TRAINING_FAVORITE}
                )
                VALUES ($1, $2, $3)
                RETURNING *
            """
            
            row = await self.db.fetchrow(
                insert_query,
                user_id,
                training_data.training_id,
                training_data.is_favorite
            )
            
            row_dict = dict(row) if row else {}
            user_training = UserTraining(
                id=row_dict.get("user_training_id"),
                user_id=user_id,
                training_id=training_data.training_id,
                status=row_dict.get("user_training_status", TrainingStatus.NOT_STARTED),
                is_favorite=row_dict.get("user_training_favorite", False),
                started_at=row_dict.get("user_training_started_at"),
                completed_at=row_dict.get("user_training_completed_at")
            )
            user_training.training = training
            
            return user_training
        except Exception as e:
            logger.error(f"Ошибка при добавлении тренировки {training_data.training_id} пользователю {user_id}: {str(e)}")
            raise
    
    async def update_user_training(
        self, user_id: int, training_id: int, data: UserTrainingUpdate
    ) -> Optional[UserTraining]:
        """
        Обновляет связь пользователь-тренировка
        
        Args:
            user_id: ID пользователя
            training_id: ID тренировки
            data: Данные для обновления
            
        Returns:
            Обновленный объект связи или None, если связь не найдена
        """
        try:
            query = f"""
                SELECT * FROM {USER_TRAININGS_TABLE}
                WHERE {USER_TRAINING_USER_ID} = $1 AND {USER_TRAINING_TRAINING_ID} = $2
            """
            
            existing = await self.db.fetchrow(query, user_id, training_id)
            if not existing:
                return None
            
            update_fields = []
            params = []
            param_index = 1
            
            if data.status is not None:
                update_fields.append(f"{USER_TRAINING_STATUS} = ${param_index}")
                params.append(data.status.value)
                param_index += 1
                
                if data.status == "in_progress" and existing[USER_TRAINING_STARTED_AT] is None:
                    update_fields.append(f"{USER_TRAINING_STARTED_AT} = ${param_index}")
                    params.append(datetime.now())
                    param_index += 1
                
                if data.status == "completed" and existing[USER_TRAINING_COMPLETED_AT] is None:
                    update_fields.append(f"{USER_TRAINING_COMPLETED_AT} = ${param_index}")
                    params.append(datetime.now())
                    param_index += 1
            
            if data.is_favorite is not None:
                update_fields.append(f"{USER_TRAINING_FAVORITE} = ${param_index}")
                params.append(data.is_favorite)
                param_index += 1
                
            if data.started_at is not None:
                update_fields.append(f"{USER_TRAINING_STARTED_AT} = ${param_index}")
                params.append(data.started_at)
                param_index += 1
                
            if data.completed_at is not None:
                update_fields.append(f"{USER_TRAINING_COMPLETED_AT} = ${param_index}")
                params.append(data.completed_at)
                param_index += 1
            
            if not update_fields:
                training = await self.get_training_by_id(training_id, user_id)
                existing_dict = dict(existing) if existing else {}
                user_training = UserTraining(
                    id=existing_dict.get("user_training_id"),
                    user_id=user_id,
                    training_id=training_id,
                    status=existing_dict.get("user_training_status", TrainingStatus.NOT_STARTED),
                    is_favorite=existing_dict.get("user_training_favorite", False),
                    started_at=existing_dict.get("user_training_started_at"),
                    completed_at=existing_dict.get("user_training_completed_at")
                )
                user_training.training = training
                return user_training
            
            update_query = f"""
                UPDATE {USER_TRAININGS_TABLE}
                SET {', '.join(update_fields)}
                WHERE {USER_TRAINING_USER_ID} = ${param_index} AND {USER_TRAINING_TRAINING_ID} = ${param_index + 1}
                RETURNING *
            """
            
            params.extend([user_id, training_id])
            row = await self.db.fetchrow(update_query, *params)
            
            # Получаем данные тренировки
            training = await self.get_training_by_id(training_id, user_id)
            
            row_dict = dict(row) if row else {}
            user_training = UserTraining(
                id=row_dict.get("user_training_id"),
                user_id=user_id,
                training_id=training_id,
                status=row_dict.get("user_training_status", TrainingStatus.NOT_STARTED),
                is_favorite=row_dict.get("user_training_favorite", False),
                started_at=row_dict.get("user_training_started_at"),
                completed_at=row_dict.get("user_training_completed_at")
            )
            user_training.training = training
            
            return user_training
        except Exception as e:
            logger.error(f"Ошибка при обновлении связи пользователь-тренировка {user_id}-{training_id}: {str(e)}")
            raise
    
    async def remove_training_from_user(self, user_id: int, training_id: int) -> bool:
        """
        Удаляет тренировку у пользователя
        
        Args:
            user_id: ID пользователя
            training_id: ID тренировки
            
        Returns:
            True, если тренировка успешно удалена, иначе False
        """
        try:
            query = f"""
                DELETE FROM {USER_TRAININGS_TABLE}
                WHERE {USER_TRAINING_USER_ID} = $1 AND {USER_TRAINING_TRAINING_ID} = $2
                RETURNING {USER_TRAINING_ID}
            """
            
            result = await self.db.fetchval(query, user_id, training_id)
            return result is not None
        except Exception as e:
            logger.error(f"Ошибка при удалении тренировки {training_id} у пользователя {user_id}: {str(e)}")
            raise

    
    async def get_app_workouts(self, user_id: int) -> List[AppWorkout]:
        """
        Получает список всех пользовательских тренировок с информацией о последней сессии пользователя,
        последнем упражнении и суммарном времени тренировки
        
        Args:
            user_id: ID пользователя
            
        Returns:
            Список пользовательских тренировок с расширенной информацией
        """
        try:
            # Запрос на получение всех тренировок
            query = """
                SELECT * FROM app_workouts
                ORDER BY created_at DESC
            """
            rows = await self.db.fetch(query)
            
            workouts = []
            for row in rows:
                workout = AppWorkout(**row)
                workout.exercises = await self._get_app_workout_exercises(workout.app_workout_uuid)
                
                # Получаем информацию о последней сессии для этой тренировки для этого пользователя
                last_session_query = """
                    SELECT 
                        workout_session_uuid,
                        datetime_start,
                        datetime_stop,
                        status
                    FROM user_workout_sessions
                    WHERE user_id = $1 AND workout_uuid = $2
                    ORDER BY datetime_start DESC
                    LIMIT 1
                """
                
                try:
                    last_session = await self.db.fetchrow(last_session_query, user_id, str(workout.app_workout_uuid))
                    
                    # Добавляем информацию о последней сессии к объекту тренировки
                    if last_session:
                        session_dict = dict(last_session)
                        workout_session_uuid = session_dict.get('workout_session_uuid')
                        workout.last_session_uuid = workout_session_uuid
                        workout.last_session_start = session_dict.get('datetime_start')
                        workout.last_session_stop = session_dict.get('datetime_stop')
                        workout.last_session_status = session_dict.get('status')
                        
                        # Если нашли сессию тренировки, ищем информацию о последнем упражнении
                        if workout_session_uuid:
                            # Запрос на получение последнего упражнения в тренировке
                            last_exercise_query = """
                                SELECT 
                                    exercise_session_uuid,
                                    datetime_start,
                                    datetime_end,
                                    status
                                FROM user_exercise_sessions
                                WHERE workout_session_uuid = $1
                                ORDER BY datetime_start DESC
                                LIMIT 1
                            """
                            
                            last_exercise = await self.db.fetchrow(last_exercise_query, str(workout_session_uuid))
                            if last_exercise:
                                exercise_dict = dict(last_exercise)
                                workout.last_exercise_session_uuid = exercise_dict.get('exercise_session_uuid')
                                workout.last_exercise_start = exercise_dict.get('datetime_start')
                                workout.last_exercise_stop = exercise_dict.get('datetime_end')
                                workout.last_exercise_status = exercise_dict.get('status')
                            
                            # Подсчитываем суммарное время всех упражнений в тренировке
                            total_time_query = """
                                SELECT 
                                    datetime_start,
                                    datetime_end
                                FROM user_exercise_sessions
                                WHERE workout_session_uuid = $1 AND datetime_end IS NOT NULL
                            """
                            
                            exercise_times = await self.db.fetch(total_time_query, str(workout_session_uuid))
                            total_seconds = 0
                            
                            if exercise_times:
                                for exercise_time in exercise_times:
                                    time_dict = dict(exercise_time)
                                    start_time = time_dict.get('datetime_start')
                                    end_time = time_dict.get('datetime_end')
                                    
                                    # Вычисляем разницу только если оба значения не None
                                    if start_time and end_time:
                                        time_diff = end_time - start_time
                                        total_seconds += time_diff.total_seconds()
                                
                                workout.total_workout_time = int(total_seconds)
                    else:
                        workout.last_session_uuid = None
                        workout.last_session_start = None
                        workout.last_session_stop = None
                        workout.last_session_status = None
                        workout.last_exercise_session_uuid = None
                        workout.last_exercise_start = None
                        workout.last_exercise_stop = None
                        workout.last_exercise_status = None
                        workout.total_workout_time = None
                except Exception as e:
                    logger.error(f"Ошибка при получении информации о последней сессии: {str(e)}")
                    workout.last_session_uuid = None
                    workout.last_session_start = None
                    workout.last_session_stop = None
                    workout.last_session_status = None
                    workout.last_exercise_session_uuid = None
                    workout.last_exercise_start = None
                    workout.last_exercise_stop = None
                    workout.last_exercise_status = None
                    workout.total_workout_time = None
                
                workouts.append(workout)
            
            return workouts
        except Exception as e:
            logger.error(f"Ошибка при получении списка пользовательских тренировок: {str(e)}")
            raise
    
    async def get_app_workout_by_id(self, workout_uuid: UUID, user_id: int) -> Optional[AppWorkout]:
        """
        Получает пользовательскую тренировку по ID с информацией о последней сессии пользователя,
        последнем упражнении и суммарном времени тренировки
        
        Args:
            workout_uuid: UUID тренировки
            user_id: ID пользователя
            
        Returns:
            Объект тренировки или None, если тренировка не найдена
        """
        try:
            query = """
                SELECT * FROM app_workouts
                WHERE app_workout_uuid = $1
            """
            row = await self.db.fetchrow(query, str(workout_uuid))
            
            if not row:
                return None
                
            workout = AppWorkout(**row)
            workout.exercises = await self._get_app_workout_exercises(workout.app_workout_uuid)
            
            # Получаем информацию о последней сессии для этой тренировки для этого пользователя
            last_session_query = """
                SELECT 
                    workout_session_uuid,
                    datetime_start,
                    datetime_stop,
                    status
                FROM user_workout_sessions
                WHERE user_id = $1 AND workout_uuid = $2
                ORDER BY datetime_start DESC
                LIMIT 1
            """
            
            try:
                last_session = await self.db.fetchrow(last_session_query, user_id, str(workout.app_workout_uuid))
                
                # Добавляем информацию о последней сессии к объекту тренировки
                if last_session:
                    session_dict = dict(last_session)
                    workout_session_uuid = session_dict.get('workout_session_uuid')
                    workout.last_session_uuid = workout_session_uuid
                    workout.last_session_start = session_dict.get('datetime_start')
                    workout.last_session_stop = session_dict.get('datetime_stop')
                    workout.last_session_status = session_dict.get('status')
                    
                    # Если нашли сессию тренировки, ищем информацию о последнем упражнении
                    if workout_session_uuid:
                        # Запрос на получение последнего упражнения в тренировке
                        last_exercise_query = """
                            SELECT 
                                exercise_session_uuid,
                                datetime_start,
                                datetime_end,
                                status
                            FROM user_exercise_sessions
                            WHERE workout_session_uuid = $1
                            ORDER BY datetime_start DESC
                            LIMIT 1
                        """
                        
                        last_exercise = await self.db.fetchrow(last_exercise_query, str(workout_session_uuid))
                        if last_exercise:
                            exercise_dict = dict(last_exercise)
                            workout.last_exercise_session_uuid = exercise_dict.get('exercise_session_uuid')
                            workout.last_exercise_start = exercise_dict.get('datetime_start')
                            workout.last_exercise_stop = exercise_dict.get('datetime_end')
                            workout.last_exercise_status = exercise_dict.get('status')
                        
                        # Подсчитываем суммарное время всех упражнений в тренировке
                        total_time_query = """
                            SELECT 
                                datetime_start,
                                datetime_end
                            FROM user_exercise_sessions
                            WHERE workout_session_uuid = $1 AND datetime_end IS NOT NULL
                        """
                        
                        exercise_times = await self.db.fetch(total_time_query, str(workout_session_uuid))
                        total_seconds = 0
                        
                        if exercise_times:
                            for exercise_time in exercise_times:
                                time_dict = dict(exercise_time)
                                start_time = time_dict.get('datetime_start')
                                end_time = time_dict.get('datetime_end')
                                
                                # Вычисляем разницу только если оба значения не None
                                if start_time and end_time:
                                    time_diff = end_time - start_time
                                    total_seconds += time_diff.total_seconds()
                            
                            workout.total_workout_time = int(total_seconds)
                else:
                    workout.last_session_uuid = None
                    workout.last_session_start = None
                    workout.last_session_stop = None
                    workout.last_session_status = None
                    workout.last_exercise_session_uuid = None
                    workout.last_exercise_start = None
                    workout.last_exercise_stop = None
                    workout.last_exercise_status = None
                    workout.total_workout_time = None
            except Exception as e:
                logger.error(f"Ошибка при получении информации о последней сессии: {str(e)}")
                workout.last_session_uuid = None
                workout.last_session_start = None
                workout.last_session_stop = None
                workout.last_session_status = None
                workout.last_exercise_session_uuid = None
                workout.last_exercise_start = None
                workout.last_exercise_stop = None
                workout.last_exercise_status = None
                workout.total_workout_time = None
            
            return workout
        except Exception as e:
            logger.error(f"Ошибка при получении тренировки по ID {workout_uuid}: {str(e)}")
            raise
    
    async def create_app_workout(self, data: AppWorkoutCreate, user_id: int) -> AppWorkout:
        """
        Создает новую пользовательскую тренировку
        
        Args:
            data: Данные для создания тренировки
            user_id: ID пользователя
            
        Returns:
            Созданная тренировка
        """
        try:
            # Убедимся, что подключение к БД установлено
            if not self.db._pool:
                await self.db.connect()
                
            async with self.db._pool.acquire() as conn:
                async with conn.transaction():
                    query = """
                        INSERT INTO app_workouts (
                            name, 
                            description
                        )
                        VALUES ($1, $2)
                        RETURNING *
                    """
                    
                    workout_row = await conn.fetchrow(
                        query, 
                        data.name, 
                        data.description
                    )
                    
                    workout_uuid = workout_row['app_workout_uuid']
                    
                    exercises = []
                    for exercise_data in data.exercises:
                        exercise_query = """
                            INSERT INTO app_workout_exercises (
                                app_workout_uuid, 
                                exercise_id, 
                                duration, 
                                count
                            )
                            VALUES ($1, $2, $3, $4)
                            RETURNING *
                        """
                        
                        exercise_row = await conn.fetchrow(
                            exercise_query,
                            str(workout_uuid),
                            str(exercise_data.exercise_id),
                            exercise_data.duration,
                            exercise_data.count
                        )
                        
                        exercises.append(AppWorkoutExercise(**exercise_row))
                    
                    workout = AppWorkout(**workout_row)
                    workout.exercises = exercises
                    
                    return workout
        except Exception as e:
            logger.error(f"Ошибка при создании пользовательской тренировки: {str(e)}")
            raise
    
    async def update_app_workout(self, workout_uuid: UUID, data: AppWorkoutCreate, user_id: int) -> Optional[AppWorkout]:
        """
        Обновляет пользовательскую тренировку
        
        Args:
            workout_uuid: UUID тренировки
            data: Данные для обновления
            user_id: ID пользователя
            
        Returns:
            Обновленная тренировка или None, если тренировка не найдена
        """
        try:
            current_workout = await self.get_app_workout_by_id(workout_uuid, user_id)
            if not current_workout:
                return None
            
            # Убедимся, что подключение к БД установлено
            if not self.db._pool:
                await self.db.connect()
            
            async with self.db._pool.acquire() as conn:
                async with conn.transaction():
                    update_query = """
                        UPDATE app_workouts
                        SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
                        WHERE app_workout_uuid = $3
                        RETURNING *
                    """
                    
                    updated_row = await conn.fetchrow(
                        update_query,
                        data.name,
                        data.description,
                        str(workout_uuid)
                    )
                    
                    if not updated_row:
                        return None
                    
                    delete_exercises_query = """
                        DELETE FROM app_workout_exercises
                        WHERE app_workout_uuid = $1
                    """
                    await conn.execute(delete_exercises_query, str(workout_uuid))
                    
                    # Добавляем новые упражнения
                    exercises = []
                    for exercise_data in data.exercises:
                        exercise_query = """
                            INSERT INTO app_workout_exercises (
                                app_workout_uuid, 
                                exercise_id, 
                                duration, 
                                count
                            )
                            VALUES ($1, $2, $3, $4)
                            RETURNING *
                        """
                        
                        exercise_row = await conn.fetchrow(
                            exercise_query,
                            str(workout_uuid),
                            str(exercise_data.exercise_id),
                            exercise_data.duration,
                            exercise_data.count
                        )
                        
                        exercises.append(AppWorkoutExercise(**exercise_row))
                    
                    workout = AppWorkout(**updated_row)
                    workout.exercises = exercises
                    
                    return workout
        except Exception as e:
            logger.error(f"Ошибка при обновлении пользовательской тренировки {workout_uuid}: {str(e)}")
            raise
    
    async def delete_app_workout(self, workout_uuid: UUID, user_id: int) -> bool:
        """
        Удаляет пользовательскую тренировку
        
        Args:
            workout_uuid: UUID тренировки
            user_id: ID пользователя (не используется)
            
        Returns:
            True, если тренировка была успешно удалена, иначе False
        """
        try:
            current_workout = await self.get_app_workout_by_id(workout_uuid, user_id)
            if not current_workout:
                return False
            
            query = """
                DELETE FROM app_workouts
                WHERE app_workout_uuid = $1
            """
            
            result = await self.db.execute(query, str(workout_uuid))
            return result == "DELETE 1"
        except Exception as e:
            logger.error(f"Ошибка при удалении пользовательской тренировки {workout_uuid}: {str(e)}")
            raise
    
    async def _get_app_workout_exercises(self, workout_uuid: Optional[Union[str, UUID]]) -> List[AppWorkoutExercise]:
        """
        Получает упражнения для пользовательской тренировки
        
        Args:
            workout_uuid: UUID тренировки (строка или UUID объект)
            
        Returns:
            Список упражнений для тренировки с добавленным порядковым номером (order)
        """
        try:
            if workout_uuid is None:
                return []
                
            workout_uuid_str = str(workout_uuid)
            
            query = """
                SELECT awe.*, e.title as exercise_name, e.description as exercise_description, e.gif_uuid, 
                       mg.name as muscle_group_name, mg.id as muscle_group_id
                FROM app_workout_exercises awe
                JOIN exercises e ON awe.exercise_id = e.exercise_id
                LEFT JOIN muscle_groups mg ON e.muscle_group_id = mg.id
                WHERE awe.app_workout_uuid = $1
                ORDER BY awe.created_at
            """
            
            rows = await self.db.fetch(query, workout_uuid_str)
            
            exercises = []
            # Добавляем порядковый номер к каждому упражнению
            for index, row in enumerate(rows):
                exercise = AppWorkoutExercise(**row)
                exercise.order = index + 1
                exercises.append(exercise)
            
            return exercises
        except Exception as e:
            logger.error(f"Ошибка при получении упражнений для тренировки {workout_uuid}: {str(e)}")
            return []
