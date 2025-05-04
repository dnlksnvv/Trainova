import logging
from typing import List, Optional
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
        self.db = Database()
    
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
            
            activity_rows = await self.db.fetch(activities_query, user_id, start_date, end_date)
            weight_rows = await self.db.fetch(weights_query, user_id, start_date, end_date)
            
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
                        user_id=str(user_id),
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
            existing_activity = await self.db.fetchrow(check_activity_query, user_id, record_date)
            
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
                        activity_result = await self.db.fetchrow(update_activity_query, user_id, record_date, workout_count, last_workout_uuid)
                    else:
                        update_activity_query = """
                            UPDATE user_activities
                            SET workout_count = workout_count + $3
                            WHERE user_id = $1 AND record_date = $2
                            RETURNING *
                        """
                        activity_result = await self.db.fetchrow(update_activity_query, user_id, record_date, workout_count)
                else:
                    # Если есть UUID последней тренировки, обновляем его
                    if last_workout_uuid:
                        update_activity_query = """
                            UPDATE user_activities
                            SET workout_count = $3, last_workout_uuid = $4
                            WHERE user_id = $1 AND record_date = $2
                            RETURNING *
                        """
                        activity_result = await self.db.fetchrow(update_activity_query, user_id, record_date, workout_count, last_workout_uuid)
                    else:
                        update_activity_query = """
                            UPDATE user_activities
                            SET workout_count = $3
                            WHERE user_id = $1 AND record_date = $2
                            RETURNING *
                        """
                        activity_result = await self.db.fetchrow(update_activity_query, user_id, record_date, workout_count)
            else:
                # Создаем новую запись
                if last_workout_uuid:
                    insert_activity_query = """
                        INSERT INTO user_activities (user_id, record_date, workout_count, last_workout_uuid)
                        VALUES ($1, $2, $3, $4)
                        RETURNING *
                    """
                    activity_result = await self.db.fetchrow(insert_activity_query, user_id, record_date, workout_count, last_workout_uuid)
                else:
                    insert_activity_query = """
                        INSERT INTO user_activities (user_id, record_date, workout_count)
                        VALUES ($1, $2, $3)
                        RETURNING *
                    """
                    activity_result = await self.db.fetchrow(insert_activity_query, user_id, record_date, workout_count)
            
            # Если указан вес, обновляем его
            weight_result = None
            if weight is not None:
                # Проверяем, существует ли запись веса
                check_weight_query = """
                    SELECT * FROM user_weights
                    WHERE user_id = $1 AND record_date = $2
                """
                existing_weight = await self.db.fetchrow(check_weight_query, user_id, record_date)
                
                if existing_weight:
                    # Обновляем существующую запись
                    update_weight_query = """
                        UPDATE user_weights
                        SET weight = $3
                        WHERE user_id = $1 AND record_date = $2
                        RETURNING *
                    """
                    weight_result = await self.db.fetchrow(update_weight_query, user_id, record_date, weight)
                else:
                    insert_weight_query = """
                        INSERT INTO user_weights (user_id, record_date, weight)
                        VALUES ($1, $2, $3)
                        RETURNING *
                    """
                    weight_result = await self.db.fetchrow(insert_weight_query, user_id, record_date, weight)
            
            # Получаем текущий вес после обновления
            current_weight = None
            if weight_result:
                current_weight = float(weight_result['weight'])
            elif weight is not None:
                current_weight = weight
            
            if activity_result:
                return UserActivity(
                    user_id=str(activity_result['user_id']),
                    record_date=activity_result['record_date'],
                    workout_count=activity_result['workout_count'],
                    weight=current_weight,
                    last_workout_uuid=activity_result.get('last_workout_uuid')
                )
            else:
                # На случай, если возникла ошибка и запись не была создана/ обновлена
                return UserActivity(
                    user_id=str(user_id),
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