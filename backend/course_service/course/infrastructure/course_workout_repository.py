"""
Репозиторий для работы с тренировками курсов
"""
from typing import List, Optional, Dict, Any, Tuple
from fastapi import HTTPException, status
import uuid
import logging
from datetime import datetime, timezone
from decimal import Decimal

from course.domain.schemas import (
    CourseWorkoutCreate, 
    CourseWorkoutUpdate, 
    CourseWorkoutResponse,
    CourseWorkoutFilters,
    CourseWorkoutFilterRequest,
    WorkoutRatingCreate,
    WorkoutRatingUpdate,
    WorkoutRatingResponse,
    WorkoutRatingStatsResponse
)
from course.infrastructure.database import Database

logger = logging.getLogger(__name__)


class CourseWorkoutRepository:
    """Репозиторий для работы с тренировками курсов"""
    
    def __init__(self):
        self.db = Database()
    
    async def create_workout(self, workout_data: CourseWorkoutCreate, user_id: int) -> CourseWorkoutResponse:
        """Создание новой тренировки курса"""
        try:
            # Проверяем, существует ли курс
            course_exists_query = """
                SELECT EXISTS(
                    SELECT 1 FROM courses 
                    WHERE course_uuid = $1 AND user_id = $2
                )
            """
            
            course_exists = await self.db.fetch_val(
                course_exists_query,
                workout_data.course_uuid,
                user_id
            )
            
            if not course_exists:
                raise ValueError(f"Курс с UUID {workout_data.course_uuid} не найден или вы не являетесь его владельцем")
            
            # Создаем тренировку в рамках транзакции
            async with self.db.transaction():
                # Получаем максимальный порядковый номер тренировок в курсе
                max_order_query = """
                    SELECT COALESCE(MAX(order_index), 0) + 1
                    FROM course_workouts
                    WHERE course_uuid = $1
                """
                
                next_order = await self.db.fetch_val(max_order_query, workout_data.course_uuid)
                
                # Создаем новую тренировку
                insert_query = """
                    INSERT INTO course_workouts (
                        course_uuid, name, description, video_url, 
                        duration, is_paid, is_published, order_index
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING course_workout_uuid, course_uuid, name, description, video_url, 
                             duration, rating, is_paid, is_published, order_index, created_at, updated_at
                """
                
                values = (
                    workout_data.course_uuid,
                    workout_data.name,
                    workout_data.description,
                    workout_data.video_url,
                    workout_data.duration,
                    workout_data.is_paid,
                    workout_data.is_published,
                    next_order
                )
                
                workout = await self.db.fetch_one(insert_query, *values)
                
                # Если переданы группы мышц, добавляем их связи
                if workout_data.muscle_groups and len(workout_data.muscle_groups) > 0:
                    # Проверяем, что сумма процентов не превышает 100%
                    total_percentage = sum(mg.percentage for mg in workout_data.muscle_groups)
                    if total_percentage > 100:
                        raise ValueError("Сумма процентов для групп мышц не может превышать 100%")
                    
                    # Добавляем связи с группами мышц и процентами
                    for muscle_group in workout_data.muscle_groups:
                        insert_muscle_group_query = """
                            INSERT INTO workout_muscle_groups (course_workout_uuid, muscle_group_id, percentage)
                            VALUES ($1, $2, $3)
                            ON CONFLICT (course_workout_uuid, muscle_group_id) 
                            DO UPDATE SET percentage = $3
                        """
                        await self.db.execute(
                            insert_muscle_group_query, 
                            workout['course_workout_uuid'], 
                            muscle_group.id, 
                            muscle_group.percentage
                        )
                
                # Пересчитываем счетчики курса
                await self._update_course_counters(workout_data.course_uuid)
                
                workout_dict = dict(workout)
                
                # Добавляем информацию о группах мышц с процентами
                if workout_data.muscle_groups:
                    muscle_groups_response = [
                        {"id": mg.id, "percentage": mg.percentage} 
                        for mg in workout_data.muscle_groups
                    ]
                    workout_dict['muscle_groups'] = muscle_groups_response
                else:
                    workout_dict['muscle_groups'] = []
                
                return CourseWorkoutResponse(**workout_dict)
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Ошибка при создании тренировки: {str(e)}")
            raise

    async def get_workout_by_id(self, workout_uuid: uuid.UUID, user_id: Optional[int] = None) -> Optional[CourseWorkoutResponse]:
        """Получение тренировки по UUID"""
        try:
            # Получаем данные тренировки
            query = """
                SELECT 
                    cw.course_workout_uuid, cw.course_uuid, cw.name, cw.description, 
                    cw.video_url, cw.duration, cw.rating, cw.is_paid, cw.is_published, 
                    cw.order_index, cw.created_at, cw.updated_at,
                    c.user_id as course_owner_id,
                    c.price as course_price
                FROM course_workouts cw
                JOIN courses c ON cw.course_uuid = c.course_uuid
                WHERE cw.course_workout_uuid = $1
            """
            
            workout_data = await self.db.fetch_one(query, workout_uuid)
            
            if not workout_data:
                return None
            
            workout_dict = dict(workout_data)
            
            # Получаем группы мышц для тренировки с процентами, названиями и описаниями
            muscle_groups_query = """
                SELECT wmg.muscle_group_id, wmg.percentage, mg.name, mg.description
                FROM workout_muscle_groups wmg
                JOIN muscle_groups mg ON wmg.muscle_group_id = mg.id
                WHERE wmg.course_workout_uuid = $1
            """
            
            muscle_groups = await self.db.fetch_all(muscle_groups_query, workout_uuid)
            muscle_group_response = [
                {
                    "id": mg['muscle_group_id'], 
                    "percentage": mg['percentage'],
                    "name": mg['name'],
                    "description": mg['description']
                } 
                for mg in muscle_groups
            ] if muscle_groups else []
            
            workout_dict['muscle_groups'] = muscle_group_response
            
            # Определяем права доступа пользователя
            is_owner = user_id == workout_dict['course_owner_id']
            is_admin = False  # Можно добавить проверку на роль админа
            
            # Проверяем роль пользователя, если он авторизован
            if user_id:
                role_query = """
                    SELECT role_id FROM users WHERE id = $1
                """
                role_result = await self.db.fetch_one(role_query, user_id)
                if role_result and role_result['role_id'] == 1:
                    is_admin = True
            
            # Определяем статус подписки, если пользователь авторизован
            has_active_subscription = False
            if user_id and not is_owner and not is_admin:
                # Проверяем наличие активной платной или бесплатной подписки
                subscription_query = """
                    SELECT 1 FROM subscriptions
                    WHERE user_id = $1 AND course_id = $2
                    AND status IN ('active', 'free')
                    AND (end_date IS NULL OR end_date > NOW())
                    LIMIT 1
                """
                
                has_subscription = await self.db.fetch_val(
                    subscription_query,
                    user_id,
                    str(workout_dict['course_uuid'])
                )
                
                has_active_subscription = bool(has_subscription)
            
            # Ограничиваем доступ к контенту для неавторизованных пользователей
            # или пользователей без подписки на платный контент
            course_is_free = workout_dict['course_price'] is None or workout_dict['course_price'] == 0
            course_uuid = workout_dict['course_uuid']
            
            # Определяем, является ли урок бесплатным
            workout_dict['is_free'] = course_is_free or not workout_dict['is_paid']
            
            # Проверяем доступ к платному контенту
            if not is_owner and not is_admin:
                # Если тренировка платная (is_paid=true) И курс платный И у пользователя нет подписки - запрещаем доступ
                if workout_dict['is_paid'] and not course_is_free and not has_active_subscription:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Для доступа к данной тренировке необходима активная подписка на курс"
                    )
            
            # Обрабатываем видимость контента
            if is_owner or is_admin:
                # Владелец и админ видят всё
                workout_dict['is_visible'] = True
            else:
                # Обычные пользователи видят ограниченный контент для платных тренировок
                if not workout_dict['is_free'] and user_id:
                    if has_active_subscription:
                        # Если есть активная подписка, показываем полный контент
                        workout_dict['is_visible'] = True
                    else:
                        # Иначе ограничиваем видимость полей
                        if workout_dict['description'] and len(workout_dict['description']) > 100:
                            workout_dict['description'] = workout_dict['description'][:100] + '...'
                        
                        # Убираем URL видео для платного контента
                        workout_dict['video_url'] = None
                        
                        # Устанавливаем флаг видимости
                        workout_dict['is_visible'] = False
                else:
                    # Бесплатный контент полностью виден
                    workout_dict['is_visible'] = True
            
            return CourseWorkoutResponse(**workout_dict)
            
        except Exception as e:
            logger.error(f"Ошибка при получении тренировки по UUID {workout_uuid}: {str(e)}")
            raise

    async def get_workouts_by_course(self, course_uuid: uuid.UUID, user_id: int, role_id: int, published_only: bool = True) -> List[CourseWorkoutResponse]:
        """Получение всех тренировок курса"""
        try:
            # Проверяем права доступа к курсу
            course_query = """
                SELECT user_id, is_published, price FROM courses WHERE course_uuid = $1
            """
            
            course_result = await self.db.fetch_one(course_query, course_uuid)
            
            if not course_result:
                raise ValueError(f"Курс с UUID {course_uuid} не найден")
            
            is_owner = user_id == course_result['user_id']
            is_admin = role_id == 1  # Администратор
            course_published = course_result['is_published']
            course_is_free = course_result['price'] is None or course_result['price'] == 0
            
            # Логика доступа:
            # 1. Автор курса видит все тренировки (скрытые/видимые, платные/бесплатные)
            # 2. Администратор видит все тренировки
            # 3. Другие пользователи видят только опубликованные тренировки с ограничениями
            
            # Формируем запрос с условиями
            if is_owner or is_admin:
                # Автор курса и админ видят все тренировки
                query = """
                    SELECT course_workout_uuid, course_uuid, name, description, video_url, 
                           duration, rating, is_paid, is_published, order_index, 
                           created_at, updated_at
                    FROM course_workouts
                    WHERE course_uuid = $1
                    ORDER BY order_index ASC, created_at ASC
                """
                results = await self.db.fetch_all(query, course_uuid)
                
                workouts = []
                for result in results:
                    workout_data = dict(result)
                    
                    # Определяем, является ли урок бесплатным
                    # Если курс бесплатный, все уроки бесплатные
                    # Если курс платный, бесплатны только уроки с is_paid=false
                    workout_data['is_free'] = course_is_free or not workout_data['is_paid']
                    workout_data['is_visible'] = True  # Владельцу и админу всё видно
                    
                    # Получаем группы мышц для тренировки с процентами
                    muscle_groups_query = """
                        SELECT wmg.muscle_group_id, wmg.percentage, mg.name, mg.description
                        FROM workout_muscle_groups wmg
                        JOIN muscle_groups mg ON wmg.muscle_group_id = mg.id
                        WHERE wmg.course_workout_uuid = $1
                    """
                    
                    muscle_groups = await self.db.fetch_all(muscle_groups_query, workout_data['course_workout_uuid'])
                    muscle_group_response = [
                        {
                            "id": mg['muscle_group_id'], 
                            "percentage": mg['percentage'],
                            "name": mg['name'],
                            "description": mg['description']
                        } 
                        for mg in muscle_groups
                    ] if muscle_groups else []
                    
                    workout_data['muscle_groups'] = muscle_group_response
                    
                    workouts.append(CourseWorkoutResponse(**workout_data))
                
                return workouts
            else:
                # Обычные пользователи видят только опубликованные тренировки
                query = """
                    SELECT course_workout_uuid, course_uuid, name, description, video_url, 
                           duration, rating, is_paid, is_published, order_index, 
                           created_at, updated_at
                    FROM course_workouts
                    WHERE course_uuid = $1 AND is_published = true
                    ORDER BY order_index ASC, created_at ASC
                """
                results = await self.db.fetch_all(query, course_uuid)
                
                # Проверяем наличие активной подписки для данного пользователя и курса
                has_active_subscription = False
                current_datetime_utc = datetime.now(timezone.utc)
                
                # Запрос на получение информации о подписке
                subscription_query = """
                    SELECT subscription_uuid, start_date, end_date, status
                    FROM subscriptions
                    WHERE user_id = $1 AND course_id = $2 AND status = 'active'
                    ORDER BY end_date DESC
                    LIMIT 1
                """
                
                subscription_result = await self.db.fetch_one(subscription_query, user_id, str(course_uuid))
                
                # Если есть активная подписка, проверяем её действительность
                if subscription_result:
                    start_date = subscription_result['start_date']
                    end_date = subscription_result['end_date']
                    status = subscription_result['status']
                    subscription_uuid = subscription_result['subscription_uuid']
                    
                    # Проверяем, что подписка ещё действительна
                    if end_date and end_date > current_datetime_utc:
                        has_active_subscription = True
                    elif end_date and end_date <= current_datetime_utc:
                        # Если подписка истекла, обновляем её статус на 'cancelled'
                        update_query = """
                            UPDATE subscriptions
                            SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
                            WHERE subscription_uuid = $1
                        """
                        await self.db.execute(update_query, subscription_uuid)
                        logger.info(f"Подписка {subscription_uuid} для пользователя {user_id} истекла и была отменена")
                
                workouts = []
                for result in results:
                    workout_data = dict(result)
                    
                    # Определяем, является ли урок бесплатным
                    workout_data['is_free'] = course_is_free or not workout_data['is_paid']
                    
                    # Для платных тренировок проверяем наличие подписки
                    if not workout_data['is_free']:
                        if has_active_subscription:
                            # Если есть активная подписка, показываем полный контент
                            workout_data['is_visible'] = True
                        else:
                            # Иначе ограничиваем видимость полей
                            # Ограничиваем описание до 100 символов
                            if workout_data['description'] and len(workout_data['description']) > 100:
                                workout_data['description'] = workout_data['description'][:100] + '...'
                            
                            # Убираем URL видео для платного контента
                            workout_data['video_url'] = None
                            
                            # Устанавливаем флаг видимости
                            workout_data['is_visible'] = False
                    else:
                        # Бесплатный контент полностью виден
                        workout_data['is_visible'] = True
                    
                    # Получаем группы мышц для тренировки с процентами
                    muscle_groups_query = """
                        SELECT wmg.muscle_group_id, wmg.percentage, mg.name, mg.description
                        FROM workout_muscle_groups wmg
                        JOIN muscle_groups mg ON wmg.muscle_group_id = mg.id
                        WHERE wmg.course_workout_uuid = $1
                    """
                    
                    muscle_groups = await self.db.fetch_all(muscle_groups_query, workout_data['course_workout_uuid'])
                    muscle_group_response = [
                        {
                            "id": mg['muscle_group_id'], 
                            "percentage": mg['percentage'],
                            "name": mg['name'],
                            "description": mg['description']
                        } 
                        for mg in muscle_groups
                    ] if muscle_groups else []
                    
                    workout_data['muscle_groups'] = muscle_group_response
                    
                    workouts.append(CourseWorkoutResponse(**workout_data))
                
                return workouts
            
        except Exception as e:
            logger.error(f"Ошибка при получении тренировок курса {course_uuid}: {e}")
            raise

    async def update_workout(self, workout_uuid: uuid.UUID, workout_data: CourseWorkoutUpdate, user_id: int) -> Optional[CourseWorkoutResponse]:
        """Обновление тренировки"""
        try:
            # Проверяем, существует ли тренировка и принадлежит ли пользователю
            workout_exists_query = """
                SELECT EXISTS(
                    SELECT 1 FROM course_workouts cw
                    JOIN courses c ON cw.course_uuid = c.course_uuid
                    WHERE cw.course_workout_uuid = $1 AND c.user_id = $2
                )
            """
            
            workout_exists = await self.db.fetch_val(
                workout_exists_query,
                workout_uuid,
                user_id
            )
            
            if not workout_exists:
                return None
            
            async with self.db.transaction():
                # Формируем часть запроса SET для обновления
                update_parts = []
                params: List[Any] = [workout_uuid]  # первый параметр - UUID тренировки
                param_index = 2  # начинаем с индекса 2
                
                if workout_data.name is not None:
                    update_parts.append(f"name = ${param_index}")
                    params.append(workout_data.name)
                    param_index += 1
                    
                if workout_data.description is not None:
                    update_parts.append(f"description = ${param_index}")
                    params.append(workout_data.description)
                    param_index += 1
                    
                if workout_data.video_url is not None:
                    update_parts.append(f"video_url = ${param_index}")
                    params.append(workout_data.video_url)
                    param_index += 1
                    
                if workout_data.duration is not None:
                    update_parts.append(f"duration = ${param_index}")
                    params.append(workout_data.duration)
                    param_index += 1
                    
                if workout_data.is_paid is not None:
                    update_parts.append(f"is_paid = ${param_index}")
                    params.append(workout_data.is_paid)
                    param_index += 1
                    
                if workout_data.is_published is not None:
                    update_parts.append(f"is_published = ${param_index}")
                    params.append(workout_data.is_published)
                    param_index += 1
                    
                if workout_data.order_index is not None:
                    update_parts.append(f"order_index = ${param_index}")
                    params.append(workout_data.order_index)
                    param_index += 1
                
                # Если нет данных для обновления, просто возвращаем текущую тренировку
                if not update_parts:
                    current_workout = await self.get_workout_by_id(workout_uuid, user_id)
                    # Если надо обновить только группы мышц, но не другие поля
                    if workout_data.muscle_groups is not None:
                        # Обновляем группы мышц
                        await self._update_workout_muscle_groups(workout_uuid, workout_data.muscle_groups)
                        
                        # Получаем обновленные данные тренировки
                        return await self.get_workout_by_id(workout_uuid, user_id)
                    
                    return current_workout
                
                # Получаем course_uuid перед обновлением для пересчета счетчиков
                course_uuid_query = """
                    SELECT course_uuid FROM course_workouts WHERE course_workout_uuid = $1
                """
                course_uuid_result = await self.db.fetch_one(course_uuid_query, workout_uuid)
                course_uuid = course_uuid_result['course_uuid'] if course_uuid_result else None
                
                # Обновляем данные тренировки
                update_query = f"""
                    UPDATE course_workouts
                    SET {", ".join(update_parts)}, updated_at = NOW()
                    WHERE course_workout_uuid = $1
                    RETURNING course_workout_uuid, course_uuid, name, description, video_url, 
                             duration, rating, is_paid, is_published, order_index, created_at, updated_at
                """
                
                updated_workout = await self.db.fetch_one(update_query, *params)
                
                # Если указаны группы мышц, обновляем их
                if workout_data.muscle_groups is not None:
                    await self._update_workout_muscle_groups(workout_uuid, workout_data.muscle_groups)
                
                # Пересчитываем счетчики курса, если изменялись поля, влияющие на них
                if course_uuid and (workout_data.is_published is not None or workout_data.duration is not None):
                    await self._update_course_counters(course_uuid)
                
                # Получаем полные данные о тренировке, включая группы мышц
                return await self.get_workout_by_id(workout_uuid, user_id)
        
        except Exception as e:
            logger.error(f"Ошибка при обновлении тренировки {workout_uuid}: {str(e)}")
            raise

    async def _update_workout_muscle_groups(self, workout_uuid: uuid.UUID, muscle_groups) -> None:
        """Обновление групп мышц для тренировки"""
        try:
            # Удаляем существующие связи
            delete_query = """
                DELETE FROM workout_muscle_groups
                WHERE course_workout_uuid = $1
            """
            await self.db.execute(delete_query, workout_uuid)
            
            # Если новые группы не переданы, завершаем
            if not muscle_groups:
                return
            
            # Проверяем, что сумма процентов не превышает 100%
            total_percentage = sum(mg.percentage for mg in muscle_groups)
            if total_percentage > 100:
                raise ValueError("Сумма процентов для групп мышц не может превышать 100%")
            
            # Добавляем новые связи с процентами
            for muscle_group in muscle_groups:
                insert_query = """
                    INSERT INTO workout_muscle_groups (course_workout_uuid, muscle_group_id, percentage)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (course_workout_uuid, muscle_group_id) 
                    DO UPDATE SET percentage = $3
                """
                await self.db.execute(
                    insert_query, 
                    workout_uuid, 
                    muscle_group.id, 
                    muscle_group.percentage
                )
        except Exception as e:
            logger.error(f"Ошибка при обновлении групп мышц для тренировки {workout_uuid}: {str(e)}")
            raise

    async def delete_workout(self, workout_uuid: uuid.UUID, user_id: int) -> bool:
        """Удаление тренировки"""
        try:
            # Проверяем права доступа
            access_query = """
                SELECT c.user_id as course_owner_id, cw.course_uuid, cw.order_index
                FROM course_workouts cw
                JOIN courses c ON cw.course_uuid = c.course_uuid
                WHERE cw.course_workout_uuid = $1
            """
            
            access_result = await self.db.fetch_one(access_query, workout_uuid)
            
            if not access_result:
                return False
            
            if access_result['course_owner_id'] != user_id:
                raise PermissionError("Только владелец курса может удалять тренировки")
            
            # Сохраняем информацию о тренировке перед удалением
            course_uuid = access_result['course_uuid']
            deleted_order_index = access_result['order_index']
            
            # Удаляем тренировку
            delete_query = """
                DELETE FROM course_workouts 
                WHERE course_workout_uuid = $1
            """
            
            result = await self.db.execute(delete_query, workout_uuid)
            
            if result != "DELETE 1":
                return False
            
            # Пересчитываем счетчики курса после удаления
            await self._update_course_counters(course_uuid)
            
            # Обновляем порядковые индексы тренировок, которые были после удаленной
            reorder_query = """
                UPDATE course_workouts
                SET order_index = order_index - 1, updated_at = CURRENT_TIMESTAMP
                WHERE course_uuid = $1 AND order_index > $2
            """
            
            await self.db.execute(reorder_query, course_uuid, deleted_order_index)
            
            logger.info(f"Удалена тренировка: {workout_uuid}, порядковые индексы обновлены")
            return True
            
        except Exception as e:
            logger.error(f"Ошибка при удалении тренировки {workout_uuid}: {e}")
            raise

    async def get_workouts_with_filters(self, filters: CourseWorkoutFilters, user_id: Optional[int] = None) -> List[CourseWorkoutResponse]:
        """Получение тренировок с фильтрацией"""
        try:
            conditions = []
            params = []
            param_count = 1
            
            # Получаем роль пользователя, если она есть
            user_role = 2  # По умолчанию - обычный пользователь
            if user_id:
                role_query = """
                    SELECT role_id FROM users WHERE id = $1
                """
                role_result = await self.db.fetch_one(role_query, user_id)
                if role_result:
                    user_role = role_result['role_id']
            
            is_admin = user_role == 1
            
            # Базовый запрос
            base_query = """
                SELECT cw.course_workout_uuid, cw.course_uuid, cw.name, cw.description, 
                       cw.video_url, cw.duration, cw.rating, cw.is_paid, cw.is_published, 
                       cw.order_index, cw.created_at, cw.updated_at,
                       c.user_id as course_owner_id, c.is_published as course_published,
                       c.price as course_price
                FROM course_workouts cw
                JOIN courses c ON cw.course_uuid = c.course_uuid
            """
            
            # Фильтрация по курсам
            if filters.course_uuids:
                placeholders = ', '.join([f'${i}' for i in range(param_count, param_count + len(filters.course_uuids))])
                conditions.append(f"cw.course_uuid IN ({placeholders})")
                params.extend(filters.course_uuids)
                param_count += len(filters.course_uuids)
            
            # Фильтрация по статусу публикации тренировки
            if filters.is_published is not None:
                conditions.append(f"cw.is_published = ${param_count}")
                params.append(filters.is_published)
                param_count += 1
            
            # Фильтрация по платности
            if filters.is_paid is not None:
                conditions.append(f"cw.is_paid = ${param_count}")
                params.append(filters.is_paid)
                param_count += 1
            
            # Если есть условия, добавляем WHERE
            where_clause = ""
            if conditions:
                where_clause = "WHERE " + " AND ".join(conditions)
            
            query = f"""
                {base_query}
                {where_clause}
                ORDER BY cw.course_uuid, cw.order_index ASC, cw.created_at ASC
            """
            
            results = await self.db.fetch_all(query, *params)
            
            # Фильтруем результаты по правам доступа
            filtered_results = []
            
            # Для проверки активных подписок
            subscriptions_cache = {}
            current_datetime_utc = datetime.now(timezone.utc)
            
            for result in results:
                workout_data = dict(result)
                is_owner = user_id == workout_data['course_owner_id']
                course_is_free = workout_data['course_price'] is None or workout_data['course_price'] == 0
                course_uuid = workout_data['course_uuid']
                
                # Определяем, является ли урок бесплатным
                workout_data['is_free'] = course_is_free or not workout_data['is_paid']
                
                # Показываем тренировку если:
                # 1. Пользователь - владелец курса
                # 2. Пользователь - администратор
                # 3. Тренировка и курс опубликованы
                if is_owner or is_admin:
                    # Владелец и админ видят всё
                    workout_data['is_visible'] = True
                else:
                    # Если тренировка и курс опубликованы, проверяем доступ
                    if workout_data['is_published'] and workout_data['course_published']:
                        # Для платных тренировок проверяем наличие подписки
                        if not workout_data['is_free'] and user_id:
                            # Проверяем наличие активной подписки (используем кэш для уменьшения запросов)
                            has_active_subscription = False
                            course_uuid_str = str(course_uuid)
                            
                            # Если информация о подписке не кэширована, запрашиваем её
                            if course_uuid_str not in subscriptions_cache and user_id:
                                # Запрос на получение информации о подписке
                                subscription_query = """
                                    SELECT subscription_uuid, start_date, end_date, status
                                    FROM subscriptions
                                    WHERE user_id = $1 AND course_id = $2 AND status = 'active'
                                    ORDER BY end_date DESC
                                    LIMIT 1
                                """
                                
                                subscription_result = await self.db.fetch_one(subscription_query, user_id, course_uuid_str)
                                
                                # Если есть активная подписка, проверяем её действительность
                                if subscription_result:
                                    start_date = subscription_result['start_date']
                                    end_date = subscription_result['end_date']
                                    status = subscription_result['status']
                                    subscription_uuid = subscription_result['subscription_uuid']
                                    
                                    # Проверяем, что подписка ещё действительна
                                    if end_date and end_date > current_datetime_utc:
                                        has_active_subscription = True
                                    elif end_date and end_date <= current_datetime_utc:
                                        # Если подписка истекла, обновляем её статус на 'cancelled'
                                        update_query = """
                                            UPDATE subscriptions
                                            SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
                                            WHERE subscription_uuid = $1
                                        """
                                        await self.db.execute(update_query, subscription_uuid)
                                        logger.info(f"Подписка {subscription_uuid} для пользователя {user_id} истекла и была отменена")
                                
                                # Кэшируем результат проверки
                                subscriptions_cache[course_uuid_str] = has_active_subscription
                            else:
                                # Используем кэшированное значение
                                has_active_subscription = subscriptions_cache.get(course_uuid_str, False)
                            
                            if has_active_subscription:
                                # Если есть активная подписка, показываем полный контент
                                workout_data['is_visible'] = True
                            else:
                                # Иначе ограничиваем видимость полей
                                # Ограничиваем описание до 100 символов
                                if workout_data['description'] and len(workout_data['description']) > 100:
                                    workout_data['description'] = workout_data['description'][:100] + '...'
                                
                                # Убираем URL видео для платного контента
                                workout_data['video_url'] = None
                                
                                # Устанавливаем флаг видимости
                                workout_data['is_visible'] = False
                        else:
                            # Бесплатный контент полностью виден
                            workout_data['is_visible'] = True
                    else:
                        # Неопубликованные тренировки и курсы недоступны обычным пользователям
                        continue
                
                # Удаляем служебные поля
                del workout_data['course_owner_id']
                del workout_data['course_published']
                del workout_data['course_price']
                
                filtered_results.append(CourseWorkoutResponse(**workout_data))
            
            return filtered_results
            
        except Exception as e:
            logger.error(f"Ошибка при получении тренировок с фильтрами: {e}")
            raise

    async def reorder_workouts(self, course_uuid: uuid.UUID, workout_orders: List[Dict[str, Any]], user_id: int) -> bool:
        """Изменение порядка тренировок в курсе"""
        try:
            # Проверяем права доступа к курсу
            course_query = """
                SELECT user_id FROM courses WHERE course_uuid = $1
            """
            
            course_result = await self.db.fetch_one(course_query, course_uuid)
            
            if not course_result:
                raise ValueError(f"Курс с UUID {course_uuid} не найден")
            
            if course_result['user_id'] != user_id:
                raise PermissionError("Только владелец курса может изменять порядок тренировок")
            
            # Обновляем порядок тренировок
            for item in workout_orders:
                workout_uuid = item.get('workout_uuid')
                new_order = item.get('order_index')
                
                if workout_uuid and new_order:
                    update_query = """
                        UPDATE course_workouts 
                        SET order_index = $1, updated_at = CURRENT_TIMESTAMP
                        WHERE course_workout_uuid = $2 AND course_uuid = $3
                    """
                    await self.db.execute(update_query, new_order, workout_uuid, course_uuid)
            
            logger.info(f"Обновлен порядок тренировок для курса: {course_uuid}")
            return True
            
        except Exception as e:
            logger.error(f"Ошибка при изменении порядка тренировок: {e}")
            raise 

    # =================== WORKOUT RATINGS METHODS ===================

    async def create_workout_rating(self, rating_data: WorkoutRatingCreate, user_id: int) -> WorkoutRatingResponse:
        """Создать оценку тренировки"""
        try:
            # Проверяем, существует ли тренировка
            workout_exists_query = """
                SELECT EXISTS(
                    SELECT 1 FROM course_workouts 
                    WHERE course_workout_uuid = $1
                )
            """
            
            workout_exists = await self.db.fetch_one(workout_exists_query, rating_data.course_workout_uuid)
            
            if not workout_exists or not workout_exists['exists']:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Тренировка с UUID {rating_data.course_workout_uuid} не найдена"
                )
            
            # Проверяем, не оценивал ли пользователь уже эту тренировку
            existing_rating_query = """
                SELECT rating_uuid FROM workout_ratings 
                WHERE course_workout_uuid = $1 AND user_id = $2
            """
            
            existing_rating = await self.db.fetch_one(
                existing_rating_query,
                rating_data.course_workout_uuid,
                user_id
            )
            
            if existing_rating:
                # Если оценка уже существует, обновляем её
                update_query = """
                    UPDATE workout_ratings 
                    SET rating = $1, updated_at = CURRENT_TIMESTAMP
                    WHERE rating_uuid = $2
                    RETURNING rating_uuid, course_workout_uuid, user_id, rating, created_at, updated_at
                """
                
                result = await self.db.fetch_one(
                    update_query,
                    float(rating_data.rating),
                    existing_rating['rating_uuid']
                )
            else:
                # Если оценки нет, создаем новую
                insert_query = """
                    INSERT INTO workout_ratings (course_workout_uuid, user_id, rating) 
                    VALUES ($1, $2, $3)
                    RETURNING rating_uuid, course_workout_uuid, user_id, rating, created_at, updated_at
                """
                
                result = await self.db.fetch_one(
                    insert_query,
                    rating_data.course_workout_uuid,
                    user_id,
                    float(rating_data.rating)
                )
            
            if not result:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Не удалось создать/обновить оценку"
                )
            
            # Обновляем средний рейтинг тренировки
            await self.update_workout_rating(rating_data.course_workout_uuid)
            
            return WorkoutRatingResponse(
                rating_uuid=result['rating_uuid'],
                course_workout_uuid=result['course_workout_uuid'],
                user_id=result['user_id'],
                rating=Decimal(str(result['rating'])),
                created_at=result['created_at'],
                updated_at=result['updated_at']
            )
        except HTTPException as e:
            raise e
        except Exception as e:
            logging.error(f"Ошибка при создании/обновлении оценки тренировки: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при создании/обновлении оценки тренировки: {str(e)}"
            )

    async def update_workout_rating(self, course_workout_uuid: uuid.UUID) -> None:
        """Обновляет средний рейтинг тренировки на основе всех оценок пользователей"""
        try:
            # Запрос для расчета среднего рейтинга
            avg_rating_query = """
                SELECT ROUND(COALESCE(AVG(rating), 0)::numeric, 2) as avg_rating
                FROM workout_ratings
                WHERE course_workout_uuid = $1
            """
            
            avg_rating_result = await self.db.fetch_one(avg_rating_query, course_workout_uuid)
            avg_rating = avg_rating_result['avg_rating'] if avg_rating_result else 0
            
            # Запрос для обновления рейтинга тренировки
            update_query = """
                UPDATE course_workouts
                SET rating = $1, updated_at = CURRENT_TIMESTAMP
                WHERE course_workout_uuid = $2
            """
            
            await self.db.execute(update_query, float(avg_rating), course_workout_uuid)
            
            # Получаем course_uuid и user_id (владельца курса) для обновления рейтингов
            course_query = """
                SELECT cw.course_uuid, c.user_id 
                FROM course_workouts cw
                JOIN courses c ON cw.course_uuid = c.course_uuid
                WHERE cw.course_workout_uuid = $1
            """
            
            course_result = await self.db.fetch_one(course_query, course_workout_uuid)
            
            if course_result and course_result['course_uuid']:
                course_uuid = course_result['course_uuid']
                trainer_id = course_result['user_id']
                
                # Обновляем рейтинг курса (среднее по всем тренировкам)
                course_avg_rating_query = """
                    SELECT ROUND(COALESCE(AVG(rating), 0)::numeric, 2) as avg_rating
                    FROM course_workouts
                    WHERE course_uuid = $1 AND rating > 0
                """
                
                course_avg_result = await self.db.fetch_one(course_avg_rating_query, course_uuid)
                course_avg_rating = course_avg_result['avg_rating'] if course_avg_result else 0
                
                # Обновляем рейтинг курса
                update_course_query = """
                    UPDATE courses
                    SET rating = $1, updated_at = CURRENT_TIMESTAMP
                    WHERE course_uuid = $2
                """
                
                await self.db.execute(update_course_query, float(course_avg_rating), course_uuid)
                
                # Вместо прямого вызова триггерной функции, обновляем напрямую рейтинг тренера
                # Получаем все оценки для тренировок тренера
                trainer_rating_query = """
                    SELECT 
                        ROUND(COALESCE(AVG(wr.rating), 0)::numeric, 2) as avg_rating,
                        COUNT(DISTINCT wr.rating_uuid) as total_ratings
                    FROM workout_ratings wr
                    JOIN course_workouts cw ON wr.course_workout_uuid = cw.course_workout_uuid
                    JOIN courses c ON cw.course_uuid = c.course_uuid
                    WHERE c.user_id = $1
                """
                
                trainer_rating_result = await self.db.fetch_one(trainer_rating_query, trainer_id)
                trainer_avg_rating = trainer_rating_result['avg_rating'] if trainer_rating_result else 0
                trainer_ratings_count = trainer_rating_result['total_ratings'] if trainer_rating_result else 0
                
                # Обновляем запись в user_ratings или создаем новую
                upsert_trainer_rating_query = """
                    INSERT INTO user_ratings (user_id, rating, rating_count, updated_at)
                    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                    ON CONFLICT (user_id) 
                    DO UPDATE SET 
                        rating = $2,
                        rating_count = $3,
                        updated_at = CURRENT_TIMESTAMP
                """
                
                await self.db.execute(
                    upsert_trainer_rating_query, 
                    trainer_id, 
                    float(trainer_avg_rating), 
                    trainer_ratings_count
                )
                
        except Exception as e:
            logging.error(f"Ошибка при обновлении рейтингов (тренировка, курс, тренер): {e}")
            # Не вызываем исключение, чтобы не прерывать основной процесс

    async def get_workout_rating(self, course_workout_uuid: uuid.UUID, user_id: int) -> Optional[WorkoutRatingResponse]:
        """Получить оценку тренировки пользователем"""
        try:
            query = """
                SELECT rating_uuid, course_workout_uuid, user_id, rating, created_at, updated_at
                FROM workout_ratings
                WHERE course_workout_uuid = $1 AND user_id = $2
            """
            
            result = await self.db.fetch_one(
                query,
                course_workout_uuid,
                user_id
            )
            
            if not result:
                return None
            
            return WorkoutRatingResponse(
                rating_uuid=result['rating_uuid'],
                course_workout_uuid=result['course_workout_uuid'],
                user_id=result['user_id'],
                rating=Decimal(str(result['rating'])),
                created_at=result['created_at'],
                updated_at=result['updated_at']
            )
        except Exception as e:
            logging.error(f"Ошибка при получении оценки тренировки: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при получении оценки тренировки: {str(e)}"
            )

    async def get_workout_rating_stats(self, course_workout_uuid: uuid.UUID) -> WorkoutRatingStatsResponse:
        """Получить статистику оценок тренировки"""
        try:
            query = """
                SELECT 
                    ROUND(COALESCE(AVG(rating), 0)::numeric, 2) as average_rating, 
                    COUNT(*) as total_ratings
                FROM workout_ratings
                WHERE course_workout_uuid = $1
            """
            
            result = await self.db.fetch_one(query, course_workout_uuid)
            
            if not result:
                return WorkoutRatingStatsResponse(
                    average_rating=Decimal("0.00"),
                    total_ratings=0
                )
            
            return WorkoutRatingStatsResponse(
                average_rating=Decimal(str(result['average_rating'])),
                total_ratings=result['total_ratings']
            )
        except Exception as e:
            logging.error(f"Ошибка при получении статистики оценок тренировки: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при получении статистики оценок тренировки: {str(e)}"
            )

    async def delete_workout_rating(self, course_workout_uuid: uuid.UUID, user_id: int) -> bool:
        """Удалить оценку тренировки пользователем"""
        try:
            # Проверяем, существует ли оценка
            rating_exists_query = """
                SELECT EXISTS(
                    SELECT 1 FROM workout_ratings 
                    WHERE course_workout_uuid = $1 AND user_id = $2
                )
            """
            
            rating_exists = await self.db.fetch_one(rating_exists_query, course_workout_uuid, user_id)
            
            if not rating_exists or not rating_exists['exists']:
                return False
            
            # Удаляем оценку
            delete_query = """
                DELETE FROM workout_ratings
                WHERE course_workout_uuid = $1 AND user_id = $2
            """
            
            await self.db.execute(delete_query, course_workout_uuid, user_id)
            
            # Обновляем средний рейтинг тренировки
            await self.update_workout_rating(course_workout_uuid)
            
            return True
            
        except Exception as e:
            logging.error(f"Ошибка при удалении оценки тренировки: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при удалении оценки тренировки: {str(e)}"
            )

    async def _update_course_counters(self, course_uuid: uuid.UUID) -> None:
        """Пересчитывает и обновляет счетчики курса (exercise_count и duration) на основе опубликованных тренировок"""
        try:
            logger.info(f"Начинаем пересчет счетчиков для курса {course_uuid}")
            
            # Запрос для подсчета количества и общей длительности опубликованных тренировок
            query = """
                SELECT 
                    COUNT(*) as published_workouts_count,
                    COALESCE(SUM(duration), 0) as total_duration
                FROM course_workouts
                WHERE course_uuid = $1 AND is_published = true
            """
            
            result = await self.db.fetch_one(query, course_uuid)
            logger.info(f"Результат запроса подсчета для курса {course_uuid}: {result}")
            
            if result:
                published_count = result['published_workouts_count']
                total_duration = result['total_duration']
                
                logger.info(f"Новые значения для курса {course_uuid}: exercise_count={published_count}, duration={total_duration}")
                
                # Проверяем текущие значения в курсе
                current_query = """
                    SELECT exercise_count, duration FROM courses WHERE course_uuid = $1
                """
                current_result = await self.db.fetch_one(current_query, course_uuid)
                logger.info(f"Текущие значения в БД для курса {course_uuid}: {current_result}")
                
                # Обновляем счетчики в таблице courses
                update_query = """
                    UPDATE courses
                    SET 
                        exercise_count = $1,
                        duration = $2,
                        updated_at = NOW()
                    WHERE course_uuid = $3
                """
                
                update_result = await self.db.execute(update_query, published_count, total_duration, course_uuid)
                logger.info(f"Результат обновления для курса {course_uuid}: {update_result}")
                
                # Проверяем значения после обновления
                after_update_result = await self.db.fetch_one(current_query, course_uuid)
                logger.info(f"Значения после обновления для курса {course_uuid}: {after_update_result}")
                
                logger.info(f"Обновлены счетчики курса {course_uuid}: exercise_count={published_count}, duration={total_duration}")
            
        except Exception as e:
            logger.error(f"Ошибка при пересчете счетчиков курса {course_uuid}: {str(e)}")
            raise 