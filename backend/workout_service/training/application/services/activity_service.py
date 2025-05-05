import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from uuid import UUID
from training.domain.schemas import UserActivity
from training.infrastructure.database import Database
from training.domain.db_constants import *

logger = logging.getLogger(__name__)

class ActivityService:
    """
    Сервис для работы с данными активности пользователей
    """
    
    def __init__(self):
        self.db_pool = Database()
    
    async def get_user_activity(self, user_id: int, start_date: date, end_date: date) -> List[UserActivity]:
        """
        Получает данные активности пользователя за указанный период
        
        
        user_id: ID пользователя
        start_date: Начальная дата периода
        end_date: Конечная дата периода
            
        Returns:
            Список данных активности
        """
        try:
            # Запрос для получения активности (тренировок)
            activities_query = """
                SELECT * FROM user_activities
                WHERE user_id = $1 AND record_date BETWEEN $2 AND $3
                ORDER BY record_date
            """
            
            # Запрос для получения веса
            weights_query = """
                SELECT * FROM user_weights
                WHERE user_id = $1 AND record_date BETWEEN $2 AND $3
                ORDER BY record_date
            """
            
            activity_rows = await self.db_pool.fetch(activities_query, user_id, start_date, end_date)
            weight_rows = await self.db_pool.fetch(weights_query, user_id, start_date, end_date)
            
            # Создаём список дат в запрошенном интервале
            all_dates = [(start_date + timedelta(days=i)) for i in range((end_date - start_date).days + 1)]
            
            activity_dict = {row['record_date']: row for row in activity_rows}
            weight_dict = {row['record_date']: row for row in weight_rows}
            
            result = []
            for current_date in all_dates:
                activity_data = activity_dict.get(current_date)
                weight_data = weight_dict.get(current_date)
                
                # Определяем, есть ли у нас данные для этой даты
                has_activity = activity_data and activity_data['workout_count'] > 0
                has_last_workout = activity_data and activity_data.get('last_workout_uuid')
                has_weight = weight_data is not None
                
                # Добавляем в результат только если есть какие-то данные
                if has_activity or has_weight or has_last_workout:
                    workout_count = activity_data['workout_count'] if activity_data else 0
                    weight = float(weight_data['weight']) if weight_data else None
                    last_workout_uuid = activity_data.get('last_workout_uuid') if activity_data else None
                    
                    result.append(UserActivity(
                        record_date=current_date,
                        workout_count=workout_count,
                        weight=weight,
                        last_workout_uuid=last_workout_uuid
                    ))
            
            return result
            
        except Exception as e:
            logger.error(f"Ошибка при получении данных активности пользователя: {str(e)}")
            raise
    
    async def update_user_activity(self, user_id: int, record_date: date, workout_count: int, weight: Optional[float] = None, increment: bool = False, last_workout_uuid: Optional[UUID] = None) -> UserActivity:
        """
        Обновляет или создаёт запись активности пользователя за конкретную дату
        
        Args:
            user_id: ID пользователя
            record_date: Дата записи
            workout_count: Количество тренировок
            weight: Вес пользователя (опционально)
            increment: Увеличить счетчик тренировок вместо перезаписи (по умолчанию False)
            last_workout_uuid: UUID последней тренировки (опционально)
            
        Returns:
            Обновленная запись активности
        """
        try:
            check_activity_query = """
                SELECT * FROM user_activities
                WHERE user_id = $1 AND record_date = $2
            """
            existing_activity = await self.db_pool.fetchrow(check_activity_query, user_id, record_date)
            
            # Обновляем или вставляем данные активности
            activity_result = None
            if existing_activity:
                # Обновляем существующую запись
                if increment:
                    # Если есть UUID последней тренировки, обновляем его
                    if last_workout_uuid:
                        update_activity_query = """
                            UPDATE user_activities
                            SET workout_count = workout_count + $3, last_workout_uuid = $4
                            WHERE user_id = $1 AND record_date = $2
                            RETURNING *
                        """
                        activity_result = await self.db_pool.fetchrow(update_activity_query, user_id, record_date, workout_count, last_workout_uuid)
                    else:
                        update_activity_query = """
                            UPDATE user_activities
                            SET workout_count = workout_count + $3
                            WHERE user_id = $1 AND record_date = $2
                            RETURNING *
                        """
                        activity_result = await self.db_pool.fetchrow(update_activity_query, user_id, record_date, workout_count)
                else:
                    # Если есть UUID последней тренировки, обновляем его
                    if last_workout_uuid:
                        update_activity_query = """
                            UPDATE user_activities
                            SET workout_count = $3, last_workout_uuid = $4
                            WHERE user_id = $1 AND record_date = $2
                            RETURNING *
                        """
                        activity_result = await self.db_pool.fetchrow(update_activity_query, user_id, record_date, workout_count, last_workout_uuid)
                    else:
                        update_activity_query = """
                            UPDATE user_activities
                            SET workout_count = $3
                            WHERE user_id = $1 AND record_date = $2
                            RETURNING *
                        """
                        activity_result = await self.db_pool.fetchrow(update_activity_query, user_id, record_date, workout_count)
            else:
                # Создаем новую запись
                if last_workout_uuid:
                    insert_activity_query = """
                        INSERT INTO user_activities (user_id, record_date, workout_count, last_workout_uuid)
                        VALUES ($1, $2, $3, $4)
                        RETURNING *
                    """
                    activity_result = await self.db_pool.fetchrow(insert_activity_query, user_id, record_date, workout_count, last_workout_uuid)
                else:
                    insert_activity_query = """
                        INSERT INTO user_activities (user_id, record_date, workout_count)
                        VALUES ($1, $2, $3)
                        RETURNING *
                    """
                    activity_result = await self.db_pool.fetchrow(insert_activity_query, user_id, record_date, workout_count)
            
            # Если указан вес, обновляем его
            weight_result = None
            if weight is not None:
                # Проверяем, существует ли запись веса
                check_weight_query = """
                    SELECT * FROM user_weights
                    WHERE user_id = $1 AND record_date = $2
                """
                existing_weight = await self.db_pool.fetchrow(check_weight_query, user_id, record_date)
                
                if existing_weight:
                    # Обновляем существующую запись
                    update_weight_query = """
                        UPDATE user_weights
                        SET weight = $3
                        WHERE user_id = $1 AND record_date = $2
                        RETURNING *
                    """
                    weight_result = await self.db_pool.fetchrow(update_weight_query, user_id, record_date, weight)
                else:
                    insert_weight_query = """
                        INSERT INTO user_weights (user_id, record_date, weight)
                        VALUES ($1, $2, $3)
                        RETURNING *
                    """
                    weight_result = await self.db_pool.fetchrow(insert_weight_query, user_id, record_date, weight)
            
            # Получаем текущий вес после обновления
            current_weight = None
            if weight_result:
                current_weight = float(weight_result['weight'])
            elif weight is not None:
                current_weight = weight
            
            if activity_result:
                return UserActivity(
                    record_date=activity_result['record_date'],
                    workout_count=activity_result['workout_count'],
                    weight=current_weight,
                    last_workout_uuid=activity_result.get('last_workout_uuid')
                )
            else:
                # На случай, если возникла ошибка и запись не была создана/ обновлена
                return UserActivity(
                    record_date=record_date,
                    workout_count=workout_count,
                    weight=current_weight,
                    last_workout_uuid=last_workout_uuid
                )
                
        except Exception as e:
            logger.error(f"Ошибка при обновлении активности пользователя: {str(e)}")
            raise
    
    async def save_workout_progress(self, user_id: int, workout_uuid: UUID, completed_at: datetime) -> dict:
        """
        Сохраняет прогресс тренировки и обновляет активность пользователя
        
        Args:
            user_id: ID пользователя
            workout_uuid: UUID завершенной тренировки
            completed_at: Время завершения тренировки
            
        Returns:
            Словарь с информацией о результате операции
        """
        try:
            # Убедимся, что workout_uuid это объект UUID
            if isinstance(workout_uuid, str):
                workout_uuid = UUID(workout_uuid)
                
            # Получаем текущую дату для записи активности
            today = date.today()
            
            # Обновляем счетчик тренировок и UUID последней тренировки
            activity = await self.update_user_activity(
                user_id=user_id, 
                record_date=today, 
                workout_count=1, 
                increment=True,
                last_workout_uuid=workout_uuid
            )
            
            logger.info(f"Сохранен прогресс тренировки {workout_uuid} для пользователя {user_id}")
            
            return {
                "success": True,
                "message": "Прогресс тренировки сохранен",
                "workout_uuid": str(workout_uuid),
                "completed_at": completed_at.isoformat(),
                "user_id": str(user_id),
                "activity": {
                    "workout_count": activity.workout_count,
                    "record_date": activity.record_date.isoformat(),
                    "last_workout_uuid": str(activity.last_workout_uuid) if activity.last_workout_uuid else None
                }
            }
                
        except Exception as e:
            logger.error(f"Ошибка при сохранении прогресса тренировки: {str(e)}")
            raise
    
    async def save_workout_session(self, user_id: int, workout_session_uuid: UUID, workout_uuid: Optional[UUID] = None, 
                                status: str = 'in_process', datetime_start: Optional[datetime] = None,
                                datetime_stop: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Сохраняет или обновляет сессию тренировки в таблице user_workout_sessions
        
        Args:
            user_id: ID пользователя
            workout_session_uuid: UUID сессии тренировки
            workout_uuid: UUID тренировки (опционально)
            status: Статус тренировки ('in_process', 'completed', etc.)
            datetime_start: Время начала тренировки
            datetime_stop: Время окончания тренировки (опционально)
            
        Returns:
            Словарь с информацией о результате операции
        """
        try:
            # Проверяем существует ли запись с таким workout_session_uuid
            check_query = """
                SELECT * FROM user_workout_sessions
                WHERE workout_session_uuid = $1
            """
            existing_session = await self.db_pool.fetchrow(check_query, workout_session_uuid)
            
            if existing_session:
                # Обновляем существующую запись
                update_parts = []
                params = []
                
                # Начинаем с добавления UUID для WHERE условия
                params.append(workout_session_uuid)
                
                # Формируем части запроса и массив параметров
                if status:
                    update_parts.append(f"status = ${len(params) + 1}")
                    params.append(status)
                
                if datetime_stop:
                    update_parts.append(f"datetime_stop = ${len(params) + 1}")
                    params.append(datetime_stop)
                
                # Добавляем обновление поля updated_at
                update_parts.append(f"updated_at = ${len(params) + 1}")
                params.append(datetime.now())
                
                # Проверяем, есть ли что обновлять
                if update_parts:
                    update_query = f"""
                        UPDATE user_workout_sessions
                        SET {', '.join(update_parts)}
                        WHERE workout_session_uuid = $1
                        RETURNING *
                    """
                    result = await self.db_pool.fetchrow(update_query, *params)
                    logger.info(f"Обновлена сессия тренировки {workout_session_uuid}")
                    
                    # Конвертируем результат в словарь
                    session_data = {}
                    if result:
                        for key in result.keys():
                            session_data[key] = result[key]
                    
                    return {
                        "success": True,
                        "message": "Сессия тренировки обновлена",
                        "session_data": session_data
                    }
                else:
                    return {
                        "success": False,
                        "message": "Нет данных для обновления"
                    }
            else:
                # Создаем новую запись
                insert_query = """
                    INSERT INTO user_workout_sessions (
                        workout_session_uuid, user_id, workout_uuid, 
                        datetime_start, datetime_stop, status, created_at, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
                    RETURNING *
                """
                
                # Используем текущее время для created_at и updated_at
                current_time = datetime.now()
                
                result = await self.db_pool.fetchrow(
                    insert_query, 
                    workout_session_uuid, 
                    user_id, 
                    workout_uuid, 
                    datetime_start, 
                    datetime_stop, 
                    status,
                    current_time
                )
                
                logger.info(f"Создана новая сессия тренировки {workout_session_uuid}")
                
                # Конвертируем результат в словарь
                session_data = {}
                if result:
                    for key in result.keys():
                        session_data[key] = result[key]
                
                return {
                    "success": True,
                    "message": "Новая сессия тренировки создана",
                    "session_data": session_data
                }
        
        except Exception as e:
            logger.error(f"Ошибка при сохранении сессии тренировки: {str(e)}")
            raise
    
    async def save_exercise_session(
        self,
        user_id: int,
        workout_session_uuid: UUID,
        exercise_uuid: UUID,
        status: str,
        datetime_start: Optional[datetime] = None,
        datetime_end: Optional[datetime] = None,
        exercise_session_uuid: Optional[UUID] = None,
        duration: Optional[int] = None,
        user_duration: Optional[int] = None,
        count: Optional[int] = None,
        user_count: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Сохраняет или обновляет информацию о сессии упражнения в таблице user_exercise_sessions.
        
        Args:
            user_id: ID пользователя
            workout_session_uuid: UUID сессии тренировки
            exercise_uuid: UUID упражнения
            status: Статус сессии упражнения ('start' или 'ended')
            datetime_start: Время начала упражнения (только при status='start')
            datetime_end: Время окончания упражнения (только при status='ended')
            exercise_session_uuid: UUID сессии упражнения (передается с фронтенда)
            duration: Заданная длительность упражнения в секундах
            user_duration: Фактически выполненная длительность упражнения в секундах
            count: Заданное количество повторений
            user_count: Фактически выполненное количество повторений
            
        Returns:
            Словарь с результатом операции
        """
        try:
            logger.info(
                f"Сохранение/обновление сессии упражнения: user_id={user_id}, "
                f"workout_session_uuid={workout_session_uuid}, exercise_uuid={exercise_uuid}, "
                f"status={status}, datetime_start={datetime_start}, datetime_end={datetime_end}, "
                f"exercise_session_uuid={exercise_session_uuid}, duration={duration}, "
                f"user_duration={user_duration}, count={count}, user_count={user_count}"
            )
            
            # Если передан exercise_session_uuid, проверяем его существование
            if exercise_session_uuid:
                # Ищем сессию упражнения по переданному UUID
                check_by_uuid_query = """
                    SELECT exercise_session_uuid, status, datetime_start, datetime_end 
                    FROM user_exercise_sessions 
                    WHERE exercise_session_uuid = $1
                    LIMIT 1
                """
                
                logger.debug(f"Проверка существования сессии упражнения по UUID: {check_by_uuid_query}")
                
                existing_session = await self.db_pool.fetchrow(check_by_uuid_query, exercise_session_uuid)
                
                # Если сессия найдена по UUID, обновляем её
                if existing_session:
                    logger.info(f"Найдена существующая сессия упражнения по UUID: {existing_session}")
                    
                    # Обновляем существующую запись
                    update_fields = []
                    update_params = []
                    param_index = 1
                    
                    # Формируем список полей для обновления
                    if status != existing_session['status']:
                        update_fields.append(f"status = ${param_index}")
                        update_params.append(status)
                        param_index += 1
                    
                    if status == 'start' and datetime_start:
                        update_fields.append(f"datetime_start = ${param_index}")
                        update_params.append(datetime_start)
                        param_index += 1
                    
                    if status == 'ended' and datetime_end:
                        update_fields.append(f"datetime_end = ${param_index}")
                        update_params.append(datetime_end)
                        param_index += 1
                    
                    # Добавляем поля статистики при завершении упражнения
                    if status == 'ended':
                        if duration is not None:
                            update_fields.append(f"duration = ${param_index}")
                            update_params.append(duration)
                            param_index += 1
                        
                        if user_duration is not None:
                            update_fields.append(f"user_duration = ${param_index}")
                            update_params.append(user_duration)
                            param_index += 1
                        
                        if count is not None:
                            update_fields.append(f"count = ${param_index}")
                            update_params.append(count)
                            param_index += 1
                        
                        if user_count is not None:
                            update_fields.append(f"user_count = ${param_index}")
                            update_params.append(user_count)
                            param_index += 1
                    
                    update_fields.append(f"updated_at = NOW()")
                    
                    if update_fields:
                        update_query = f"""
                            UPDATE user_exercise_sessions 
                            SET {', '.join(update_fields)} 
                            WHERE exercise_session_uuid = ${param_index}
                            RETURNING exercise_session_uuid
                        """
                        
                        update_params.append(exercise_session_uuid)
                        
                        logger.debug(f"Обновление сессии упражнения по UUID: {update_query}")
                        updated_session = await self.db_pool.fetchrow(update_query, *update_params)
                        
                        result = {
                            "operation": "updated",
                            "session_id": exercise_session_uuid,
                            "status": status,
                            "message": "Обновлена существующая сессия упражнения"
                        }
                    else:
                        result = {
                            "operation": "no_change",
                            "session_id": exercise_session_uuid,
                            "status": existing_session['status'],
                            "message": "Нет изменений для сессии упражнения"
                        }
                    
                    # Добавляем дополнительную информацию в результат
                    result.update({
                        "user_id": user_id,
                        "workout_session_uuid": str(workout_session_uuid),
                        "exercise_uuid": str(exercise_uuid),
                        "exercise_session_uuid": str(exercise_session_uuid),
                        "datetime_start": datetime_start.isoformat() if datetime_start else None,
                        "datetime_end": datetime_end.isoformat() if datetime_end else None,
                        "duration": duration,
                        "user_duration": user_duration,
                        "count": count,
                        "user_count": user_count
                    })
                    
                    logger.info(f"Успешно обновлена сессия упражнения по UUID: {result}")
                    return result
            
            # Если UUID не передан или сессия не найдена по UUID,
            # проверяем, существует ли уже сессия по другим параметрам
            check_query = """
                SELECT exercise_session_uuid, status, datetime_start, datetime_end 
                FROM user_exercise_sessions 
                WHERE user_id = $1 AND workout_session_uuid = $2 AND exercise_uuid = $3
                ORDER BY created_at DESC
                LIMIT 1
            """
            
            logger.debug(f"Проверка существования сессии упражнения: {check_query}")
            
            existing_session = await self.db_pool.fetchrow(check_query, user_id, workout_session_uuid, exercise_uuid)
            
            result = {}
            
            # Если сессия существует и не передан UUID с фронтенда
            if existing_session and not exercise_session_uuid:
                # Сессия существует, обновляем её
                logger.info(f"Найдена существующая сессия упражнения: {existing_session}")
                
                session_id = existing_session['exercise_session_uuid']
                existing_status = existing_session['status']
                
                # Для случаев, когда приходит:
                # 1. 'start' после 'start' - обновляем время начала
                # 2. 'ended' после 'start' - обновляем статус и добавляем время окончания
                # 3. 'start' после 'ended' - создаем новую запись (это будет новая сессия упражнения)
                # 4. 'ended' после 'ended' - обновляем время окончания
                
                if status == 'start' and existing_status == 'ended':
                    # Создаем новую запись с переданным UUID или генерируем новый
                    insert_query = """
                        INSERT INTO user_exercise_sessions 
                        (exercise_session_uuid, user_id, workout_session_uuid, exercise_uuid, status, datetime_start, datetime_end, created_at, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                        RETURNING exercise_session_uuid
                    """
                    
                    # Если не передан UUID, используем сгенерированный системой
                    session_uuid_to_use = exercise_session_uuid if exercise_session_uuid else None
                    
                    logger.debug(f"Создание новой сессии упражнения: {insert_query}")
                    new_session = await self.db_pool.fetchrow(
                        insert_query, 
                        session_uuid_to_use,
                        user_id, 
                        workout_session_uuid, 
                        exercise_uuid,
                        status,
                        datetime_start,
                        None
                    )
                    
                    result = {
                        "operation": "created",
                        "session_id": new_session['exercise_session_uuid'] if new_session else None,
                        "status": status,
                        "message": "Создана новая сессия упражнения"
                    }
                else:
                    # Обновляем существующую запись
                    update_fields = []
                    update_params = []
                    param_index = 1
                    
                    # Формируем список полей для обновления
                    if status != existing_status:
                        update_fields.append(f"status = ${param_index}")
                        update_params.append(status)
                        param_index += 1
                    
                    if status == 'start' and datetime_start:
                        update_fields.append(f"datetime_start = ${param_index}")
                        update_params.append(datetime_start)
                        param_index += 1
                    
                    if status == 'ended' and datetime_end:
                        update_fields.append(f"datetime_end = ${param_index}")
                        update_params.append(datetime_end)
                        param_index += 1
                    
                    # Добавляем поля статистики при завершении упражнения
                    if status == 'ended':
                        if duration is not None:
                            update_fields.append(f"duration = ${param_index}")
                            update_params.append(duration)
                            param_index += 1
                        
                        if user_duration is not None:
                            update_fields.append(f"user_duration = ${param_index}")
                            update_params.append(user_duration)
                            param_index += 1
                        
                        if count is not None:
                            update_fields.append(f"count = ${param_index}")
                            update_params.append(count)
                            param_index += 1
                        
                        if user_count is not None:
                            update_fields.append(f"user_count = ${param_index}")
                            update_params.append(user_count)
                            param_index += 1
                    
                    update_fields.append(f"updated_at = NOW()")
                    
                    if update_fields:
                        update_query = f"""
                            UPDATE user_exercise_sessions 
                            SET {', '.join(update_fields)} 
                            WHERE exercise_session_uuid = ${param_index}
                            RETURNING exercise_session_uuid
                        """
                        
                        update_params.append(session_id)
                        
                        logger.debug(f"Обновление сессии упражнения: {update_query}")
                        updated_session = await self.db_pool.fetchrow(update_query, *update_params)
                        
                        result = {
                            "operation": "updated",
                            "session_id": session_id,
                            "status": status,
                            "message": "Обновлена существующая сессия упражнения"
                        }
                    else:
                        result = {
                            "operation": "no_change",
                            "session_id": session_id,
                            "status": existing_status,
                            "message": "Нет изменений для сессии упражнения"
                        }
            else:
                # Сессия не существует или нужно создать новую с указанным UUID, создаем новую запись
                insert_query = """
                    INSERT INTO user_exercise_sessions 
                    (exercise_session_uuid, user_id, workout_session_uuid, exercise_uuid, status, datetime_start, datetime_end, 
                    duration, user_duration, count, user_count, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
                    RETURNING exercise_session_uuid
                """
                
                # Если не передан UUID, используем сгенерированный системой
                session_uuid_to_use = exercise_session_uuid if exercise_session_uuid else None
                
                # Устанавливаем значения в зависимости от статуса
                start_time = datetime_start if status == 'start' else None
                end_time = datetime_end if status == 'ended' else None
                
                # Добавляем значения для статистики только при завершении
                dur = duration if status == 'ended' else None
                user_dur = user_duration if status == 'ended' else None
                cnt = count if status == 'ended' else None
                user_cnt = user_count if status == 'ended' else None
                
                logger.debug(f"Создание новой сессии упражнения: {insert_query}")
                new_session = await self.db_pool.fetchrow(
                    insert_query, 
                    session_uuid_to_use,
                    user_id, 
                    workout_session_uuid, 
                    exercise_uuid,
                    status,
                    start_time,
                    end_time,
                    dur,
                    user_dur,
                    cnt,
                    user_cnt
                )
                
                result = {
                    "operation": "created",
                    "session_id": new_session['exercise_session_uuid'] if new_session else None,
                    "status": status,
                    "message": "Создана новая сессия упражнения"
                }
            
            # Добавляем дополнительную информацию в результат
            result.update({
                "user_id": user_id,
                "workout_session_uuid": str(workout_session_uuid),
                "exercise_uuid": str(exercise_uuid),
                "exercise_session_uuid": str(result["session_id"]) if result.get("session_id") else None,
                "datetime_start": datetime_start.isoformat() if datetime_start else None,
                "datetime_end": datetime_end.isoformat() if datetime_end else None
            })
            
            logger.info(f"Успешно сохранена/обновлена сессия упражнения: {result}")
            return result
        
        except Exception as e:
            logger.error(f"Ошибка при сохранении сессии упражнения: {str(e)}")
            raise 