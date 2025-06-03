import logging
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from ..domain.schemas import CourseCreate, CourseUpdate, CourseResponse, MuscleGroupWithPercentage
from .database import Database

logger = logging.getLogger(__name__)


class CourseRepository:
    """Репозиторий для работы с курсами в базе данных"""
    
    def __init__(self):
        self.db = Database()
    
    async def create_course(self, course_data: CourseCreate, user_id: int) -> CourseResponse:
        """Создание нового курса"""
        query = """
            INSERT INTO courses (
                user_id, name, description, price,
                is_published, created_at, updated_at, exercise_count
            ) 
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), 0)
            RETURNING course_uuid, user_id, name, description, price, 
                     exercise_count, rating, subscribers_count, 
                     is_published, created_at, updated_at
        """
        
        try:
            result = await self.db.fetch_one(
                query, 
                user_id,
                course_data.name,
                course_data.description,
                course_data.price,
                course_data.is_published
            )
            
            if not result:
                raise Exception("Не удалось создать курс")
            
            # Рассчитываем общую длительность как сумму длительностей тренировок
            # (для нового курса всегда будет 0)
            
            return CourseResponse(
                course_uuid=result['course_uuid'],
                user_id=result['user_id'],
                name=result['name'],
                description=result['description'],
                price=result['price'],
                duration=0,  # У нового курса нет тренировок
                exercise_count=0,  # У нового курса нет тренировок
                rating=result['rating'],
                subscribers_count=result['subscribers_count'],
                is_published=result['is_published'],
                created_at=result['created_at'],
                updated_at=result['updated_at'],
                has_subscription=False,
                subscription_end_date=None,
                muscle_groups=[],  # У нового курса нет групп мышц
                author=None
            )
            
        except Exception as e:
            logger.error(f"Ошибка при создании курса: {str(e)}")
            raise
    
    async def get_course_by_uuid(self, course_uuid: uuid.UUID, user_id: Optional[int] = None) -> Optional[CourseResponse]:
        """Получение курса по UUID"""
        query = """
            SELECT course_uuid, user_id, name, description, price, duration, exercise_count,
                   rating, subscribers_count, 
                   is_published, created_at, updated_at
            FROM courses 
            WHERE course_uuid = $1
        """
        
        try:
            result = await self.db.fetch_one(query, course_uuid)
            
            if not result:
                return None
            
            course_data = dict(result)
            
            # Берем значения из базы данных (уже рассчитанные и сохраненные)
            total_duration = course_data['duration'] or 0
            workout_count = course_data['exercise_count'] or 0
            
            # Рассчитываем актуальное количество подписчиков из таблицы subscriptions
            subscribers_count_query = """
                SELECT COUNT(DISTINCT user_id) as subscribers_count
                FROM subscriptions 
                WHERE course_id = $1 
                  AND status IN ('active', 'free')
            """
            
            subscribers_result = await self.db.fetch_one(subscribers_count_query, str(course_uuid))
            actual_subscribers_count = subscribers_result['subscribers_count'] if subscribers_result else 0
            
            # По умолчанию пользователь не имеет подписки
            has_subscription = False
            subscription_end_date = None
            
            # Проверяем подписку, если пользователь авторизован
            if user_id:
                current_datetime_utc = datetime.now(timezone.utc)
                
                # Сначала проверяем бесплатные подписки
                free_subscription_query = """
                    SELECT subscription_uuid, start_date, end_date, status
                    FROM subscriptions
                    WHERE user_id = $1 AND course_id = $2 AND status = 'free'
                    ORDER BY created_at DESC
                    LIMIT 1
                """
                
                free_subscription_result = await self.db.fetch_one(free_subscription_query, user_id, str(course_uuid))
                
                if free_subscription_result:
                    # Проверяем, является ли курс бесплатным
                    is_course_free = course_data['price'] is None or course_data['price'] == 0
                    
                    if is_course_free:
                        # Курс бесплатный - бесплатная подписка остается активной
                        has_subscription = True
                        subscription_end_date = None
                        logger.info(f"Пользователь {user_id} имеет бесплатную подписку на бесплатный курс {course_uuid}")
                    else:
                        # Курс стал платным - завершаем бесплатную подписку
                        subscription_uuid = free_subscription_result['subscription_uuid']
                        update_query = """
                            UPDATE subscriptions
                            SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
                            WHERE subscription_uuid = $1
                        """
                        await self.db.execute(update_query, subscription_uuid)
                        logger.info(f"Бесплатная подписка {subscription_uuid} для пользователя {user_id} отменена из-за изменения цены курса {course_uuid}")
                
                # Проверяем платную подписку только для платных курсов
                if course_data['price'] is not None and course_data['price'] > 0:
                    # Запрос на получение информации о платной подписке
                    subscription_query = """
                        SELECT subscription_uuid, start_date, end_date, status
                        FROM subscriptions
                        WHERE user_id = $1 AND course_id = $2 AND status = 'active'
                        ORDER BY end_date DESC
                        LIMIT 1
                    """
                    
                    subscription_result = await self.db.fetch_one(subscription_query, user_id, str(course_uuid))
                    
                    # Если есть активная платная подписка, проверяем её действительность
                    if subscription_result:
                        start_date = subscription_result['start_date']
                        end_date = subscription_result['end_date']
                        status = subscription_result['status']
                        subscription_uuid = subscription_result['subscription_uuid']
                        
                        # Проверяем, что подписка ещё действительна
                        if end_date and end_date > current_datetime_utc:
                            has_subscription = True
                            subscription_end_date = end_date
                        elif end_date and end_date <= current_datetime_utc:
                            # Если подписка истекла, обновляем её статус на 'cancelled'
                            update_query = """
                                UPDATE subscriptions
                                SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
                                WHERE subscription_uuid = $1
                            """
                            await self.db.execute(update_query, subscription_uuid)
                            logger.info(f"Подписка {subscription_uuid} для пользователя {user_id} истекла и была отменена")
            
            # Получаем данные о группах мышц для курса
            muscle_groups_query = """
                SELECT 
                    mg.id, 
                    mg.name, 
                    mg.description, 
                    ROUND(AVG(wmg.percentage)) as percentage
                FROM workout_muscle_groups wmg
                JOIN muscle_groups mg ON wmg.muscle_group_id = mg.id
                JOIN course_workouts cw ON wmg.course_workout_uuid = cw.course_workout_uuid
                WHERE cw.course_uuid = $1
                GROUP BY mg.id, mg.name, mg.description
                ORDER BY percentage DESC
            """
            
            muscle_groups = await self.db.fetch_all(muscle_groups_query, course_uuid)
            muscle_groups_data = [
                MuscleGroupWithPercentage(
                    id=mg['id'],
                    name=mg['name'],
                    description=mg['description'],
                    percentage=mg['percentage']
                )
                for mg in muscle_groups
            ] if muscle_groups else []
            
            return CourseResponse(
                course_uuid=course_data['course_uuid'],
                user_id=course_data['user_id'],
                name=course_data['name'],
                description=course_data['description'],
                price=Decimal(str(course_data['price'])) if course_data['price'] is not None else None,
                duration=total_duration,
                exercise_count=workout_count,
                rating=course_data['rating'],
                subscribers_count=actual_subscribers_count,
                is_published=course_data['is_published'],
                created_at=course_data['created_at'],
                updated_at=course_data['updated_at'],
                has_subscription=has_subscription,
                subscription_end_date=subscription_end_date,
                muscle_groups=muscle_groups_data,
                author=None
            )
            
        except Exception as e:
            logger.error(f"Ошибка при получении курса: {str(e)}")
            raise
    
    async def get_courses_by_user(self, user_id: int, published_only: bool = False) -> List[CourseResponse]:
        """Получение курсов пользователя"""
        if published_only:
            query = """
                SELECT course_uuid, user_id, name, description, price, duration, exercise_count,
                       rating, subscribers_count, 
                       is_published, created_at, updated_at
                FROM courses 
                WHERE user_id = $1 AND is_published = true
                ORDER BY created_at DESC
            """
        else:
            query = """
                SELECT course_uuid, user_id, name, description, price, duration, exercise_count,
                       rating, subscribers_count, 
                       is_published, created_at, updated_at
                FROM courses 
                WHERE user_id = $1
                ORDER BY created_at DESC
            """
        
        try:
            results = await self.db.fetch_all(query, user_id)
            
            # Получаем длительность и количество тренировок для каждого курса
            courses = []
            for row in results:
                # Берем значения из базы данных (уже рассчитанные и сохраненные)
                total_duration = row['duration'] or 0
                workout_count = row['exercise_count'] or 0
                
                # Рассчитываем актуальное количество подписчиков из таблицы subscriptions
                subscribers_count_query = """
                    SELECT COUNT(DISTINCT user_id) as subscribers_count
                    FROM subscriptions 
                    WHERE course_id = $1 
                      AND status IN ('active', 'free')
                """
                
                subscribers_result = await self.db.fetch_one(subscribers_count_query, str(row['course_uuid']))
                actual_subscribers_count = subscribers_result['subscribers_count'] if subscribers_result else 0
                
                courses.append(CourseResponse(
                    course_uuid=row['course_uuid'],
                    user_id=row['user_id'],
                    name=row['name'],
                    description=row['description'],
                    price=Decimal(str(row['price'])) if row['price'] is not None else None,
                    duration=total_duration,
                    exercise_count=workout_count,
                    rating=row['rating'],
                    subscribers_count=actual_subscribers_count,
                    is_published=row['is_published'],
                    created_at=row['created_at'],
                    updated_at=row['updated_at'],
                    has_subscription=False,  # По умолчанию для списка курсов
                    subscription_end_date=None,  # По умолчанию для списка курсов
                    muscle_groups=[],  # По умолчанию пустой список групп мышц
                    author=None
                ))
            
            return courses
            
        except Exception as e:
            logger.error(f"Ошибка при получении курсов пользователя: {str(e)}")
            raise

    async def get_courses_with_filters(self, user_ids: Optional[List[int]], current_user_id: int, current_user_role: int, include_unpublished: bool = True) -> List[CourseResponse]:
        """
        Получение курсов с фильтрацией по ролям
        
        Args:
            user_ids: Список ID пользователей для фильтрации (может быть None)
            current_user_id: ID текущего пользователя
            current_user_role: Роль текущего пользователя (1 - админ, 2 - обычный пользователь)
            include_unpublished: Включать ли неопубликованные курсы (дополнительный фильтр поверх ролевой логики)
        
        Returns:
            Список курсов с учетом прав доступа
        """
        try:
            # Базовые условия запроса на основе ролей
            conditions = []
            params = []
            param_index = 1
            
            # Дополнительный фильтр include_unpublished поверх ролевой логики
            if not include_unpublished:
                # Если include_unpublished = false, показываем ТОЛЬКО опубликованные курсы для всех
                conditions.append("is_published = true")
            else:
                # Если include_unpublished = true, применяем текущую ролевую логику
                # Если обычный пользователь (не админ), показываем только опубликованные курсы других пользователей
                # и все свои курсы (и опубликованные, и неопубликованные)
                if current_user_role != 1:  # Не админ
                    conditions.append(f"(is_published = true OR user_id = ${param_index})")
                    params.append(current_user_id)
                    param_index += 1
                # Если админ (role 1), никаких ограничений по публикации не добавляем - видит все
            
            # Если указаны конкретные пользователи, фильтруем по ним
            if user_ids:
                placeholders = [f"${i}" for i in range(param_index, param_index + len(user_ids))]
                conditions.append(f"user_id IN ({', '.join(placeholders)})")
                params.extend(user_ids)
                param_index += len(user_ids)
            
            # Строим запрос
            where_clause = " AND ".join(conditions) if conditions else "1=1"
            query = f"""
                SELECT course_uuid, user_id, name, description, price, duration, exercise_count,
                       rating, subscribers_count, 
                       is_published, created_at, updated_at
                FROM courses 
                WHERE {where_clause}
                ORDER BY created_at DESC
            """
            
            # Выполняем запрос
            results = await self.db.fetch_all(query, *params)
            
            # Заполняем информацию о подписках и длительности
            courses = []
            for row in results:
                course_uuid = row['course_uuid']
                
                # Берем значения из базы данных (уже рассчитанные и сохраненные)
                total_duration = row['duration'] or 0
                workout_count = row['exercise_count'] or 0
                
                # Рассчитываем актуальное количество подписчиков из таблицы subscriptions
                subscribers_count_query = """
                    SELECT COUNT(DISTINCT user_id) as subscribers_count
                    FROM subscriptions 
                    WHERE course_id = $1 
                      AND status IN ('active', 'free')
                """
                
                subscribers_result = await self.db.fetch_one(subscribers_count_query, str(course_uuid))
                actual_subscribers_count = subscribers_result['subscribers_count'] if subscribers_result else 0
                
                # Получаем данные о группах мышц для курса
                muscle_groups_query = """
                    SELECT 
                        mg.id, 
                        mg.name, 
                        mg.description, 
                        ROUND(AVG(wmg.percentage)) as percentage
                    FROM workout_muscle_groups wmg
                    JOIN muscle_groups mg ON wmg.muscle_group_id = mg.id
                    JOIN course_workouts cw ON wmg.course_workout_uuid = cw.course_workout_uuid
                    WHERE cw.course_uuid = $1
                    GROUP BY mg.id, mg.name, mg.description
                    ORDER BY percentage DESC
                """
                
                muscle_groups = await self.db.fetch_all(muscle_groups_query, course_uuid)
                muscle_groups_data = [
                    MuscleGroupWithPercentage(
                        id=mg['id'],
                        name=mg['name'],
                        description=mg['description'],
                        percentage=mg['percentage']
                    )
                    for mg in muscle_groups
                ] if muscle_groups else []
                
                # Информация о подписке
                has_subscription = False
                subscription_end_date = None
                
                # Сначала проверяем бесплатные подписки
                free_subscription_query = """
                    SELECT subscription_uuid, start_date, end_date, status
                    FROM subscriptions
                    WHERE user_id = $1 AND course_id = $2 AND status = 'free'
                    ORDER BY created_at DESC
                    LIMIT 1
                """
                
                free_subscription_result = await self.db.fetch_one(free_subscription_query, current_user_id, str(course_uuid))
                
                if free_subscription_result:
                    # Проверяем, является ли курс бесплатным
                    is_course_free = row['price'] is None or row['price'] == 0
                    
                    if is_course_free:
                        # Курс бесплатный - бесплатная подписка остается активной
                        has_subscription = True
                        subscription_end_date = None
                        logger.info(f"Пользователь {current_user_id} имеет бесплатную подписку на бесплатный курс {course_uuid}")
                    else:
                        # Курс стал платным - завершаем бесплатную подписку
                        subscription_uuid = free_subscription_result['subscription_uuid']
                        update_query = """
                            UPDATE subscriptions
                            SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
                            WHERE subscription_uuid = $1
                        """
                        await self.db.execute(update_query, subscription_uuid)
                        logger.info(f"Бесплатная подписка {subscription_uuid} для пользователя {current_user_id} отменена из-за изменения цены курса {course_uuid}")

                # Проверяем платную подписку только для платных курсов
                if row['price'] is not None and row['price'] > 0:
                    subscription_query = """
                        SELECT subscription_uuid, start_date, end_date, status
                        FROM subscriptions
                        WHERE user_id = $1 AND course_id = $2 AND status = 'active'
                        ORDER BY end_date DESC
                        LIMIT 1
                    """
                    
                    subscription_result = await self.db.fetch_one(subscription_query, current_user_id, str(course_uuid))
                    
                    # Если есть подписка, проверяем её действительность
                    if subscription_result:
                        end_date = subscription_result['end_date']
                        if end_date and end_date > datetime.now(timezone.utc):
                            has_subscription = True
                            subscription_end_date = end_date
                
                courses.append(CourseResponse(
                    course_uuid=row['course_uuid'],
                    user_id=row['user_id'],
                    name=row['name'],
                    description=row['description'],
                    price=Decimal(str(row['price'])) if row['price'] is not None else None,
                    duration=total_duration,
                    exercise_count=workout_count,
                    rating=row['rating'],
                    subscribers_count=actual_subscribers_count,
                    is_published=row['is_published'],
                    created_at=row['created_at'],
                    updated_at=row['updated_at'],
                    has_subscription=has_subscription,
                    subscription_end_date=subscription_end_date,
                    muscle_groups=muscle_groups_data,
                    author=None
                ))
            
            return courses
            
        except Exception as e:
            logger.error(f"Ошибка при получении курсов с фильтрами: {str(e)}")
            raise

    async def update_course(self, course_uuid: uuid.UUID, course_data: CourseUpdate) -> Optional[CourseResponse]:
        """Обновление курса"""
        # Проверяем существование курса
        existing_course = await self.get_course_by_uuid(course_uuid)
        if not existing_course:
            return None
        
        # Формируем строки запроса для каждого поля
        update_parts = []
        params = []  # Параметры для запроса
        param_index = 1  # Индекс параметра в запросе
        
        # Добавляем каждое поле, которое нужно обновить
        if course_data.name is not None:
            params.append(course_data.name)
            update_parts.append(f"name = ${param_index}")
            param_index += 1
        
        if course_data.description is not None:
            params.append(course_data.description)
            update_parts.append(f"description = ${param_index}")
            param_index += 1
        
        if course_data.price is not None:
            params.append(course_data.price)
            update_parts.append(f"price = ${param_index}")
            param_index += 1
        
        if course_data.is_published is not None:
            params.append(course_data.is_published)
            update_parts.append(f"is_published = ${param_index}")
            param_index += 1
        
        # Добавляем обновление даты
        params.append(datetime.now(timezone.utc))
        update_parts.append(f"updated_at = ${param_index}")
        param_index += 1
        
        # Если нет полей для обновления, возвращаем существующий курс
        if len(update_parts) <= 1:  # Только updated_at
            return existing_course
        
        # Добавляем UUID курса как последний параметр
        params.append(course_uuid)
        
        # Формируем полный запрос
        update_query = f"""
            UPDATE courses
            SET {", ".join(update_parts)}
            WHERE course_uuid = ${param_index}
            RETURNING course_uuid, user_id, name, description, price, duration, exercise_count,
                     rating, subscribers_count, 
                     is_published, created_at, updated_at
        """
        
        try:
            result = await self.db.fetch_one(update_query, *params)
            
            if not result:
                return None
            
            # Берем значения из базы данных (уже рассчитанные и сохраненные)
            total_duration = result['duration'] or 0
            workout_count = result['exercise_count'] or 0
            
            return CourseResponse(
                course_uuid=result['course_uuid'],
                user_id=result['user_id'],
                name=result['name'],
                description=result['description'],
                price=Decimal(str(result['price'])) if result['price'] is not None else None,
                duration=total_duration,
                exercise_count=workout_count,
                rating=result['rating'],
                subscribers_count=result['subscribers_count'],
                is_published=result['is_published'],
                created_at=result['created_at'],
                updated_at=result['updated_at'],
                has_subscription=False,  # При обновлении не проверяем подписку
                subscription_end_date=None,  # При обновлении не проверяем подписку
                muscle_groups=[],  # При обновлении не проверяем группы мышц
                author=None
            )
            
        except Exception as e:
            logger.error(f"Ошибка при обновлении курса: {str(e)}")
            raise

    async def delete_course(self, course_uuid: uuid.UUID) -> bool:
        """Удаление курса"""
        query = "DELETE FROM courses WHERE course_uuid = $1"
        
        try:
            await self.db.execute(query, course_uuid)
            return True
            
        except Exception as e:
            logger.error(f"Ошибка при удалении курса: {str(e)}")
            return False

    async def get_all_published_courses(self, page: int = 1, per_page: int = 10) -> List[CourseResponse]:
        """Получение всех опубликованных курсов с пагинацией"""
        try:
            # Рассчитываем offset для пагинации
            offset = (page - 1) * per_page
            
            query = """
                SELECT course_uuid, user_id, name, description, price, duration, exercise_count,
                       rating, subscribers_count, 
                       is_published, created_at, updated_at
                FROM courses 
                WHERE is_published = true
                ORDER BY created_at DESC
                LIMIT $1 OFFSET $2
            """
            
            results = await self.db.fetch_all(query, per_page, offset)
            
            courses = []
            for row in results:
                # Берем значения из базы данных (уже рассчитанные и сохраненные)
                total_duration = row['duration'] or 0
                workout_count = row['exercise_count'] or 0
                
                # Рассчитываем актуальное количество подписчиков из таблицы subscriptions
                subscribers_count_query = """
                    SELECT COUNT(DISTINCT user_id) as subscribers_count
                    FROM subscriptions 
                    WHERE course_id = $1 
                      AND status IN ('active', 'free')
                """
                
                subscribers_result = await self.db.fetch_one(subscribers_count_query, str(row['course_uuid']))
                actual_subscribers_count = subscribers_result['subscribers_count'] if subscribers_result else 0
                
                courses.append(CourseResponse(
                    course_uuid=row['course_uuid'],
                    user_id=row['user_id'],
                    name=row['name'],
                    description=row['description'],
                    price=Decimal(str(row['price'])) if row['price'] is not None else None,
                    duration=total_duration,
                    exercise_count=workout_count,
                    rating=row['rating'],
                    subscribers_count=actual_subscribers_count,
                    is_published=row['is_published'],
                    created_at=row['created_at'],
                    updated_at=row['updated_at'],
                    has_subscription=False,  # По умолчанию для списка курсов
                    subscription_end_date=None,  # По умолчанию для списка курсов
                    muscle_groups=[],  # По умолчанию пустой список групп мышц
                    author=None
                ))
            
            return courses
            
        except Exception as e:
            logger.error(f"Ошибка при получении всех опубликованных курсов: {str(e)}")
            raise

    async def get_total_published_courses_count(self) -> int:
        """Получение общего количества опубликованных курсов"""
        try:
            query = "SELECT COUNT(*) as total FROM courses WHERE is_published = true"
            result = await self.db.fetch_one(query)
            return result['total'] if result else 0
        except Exception as e:
            logger.error(f"Ошибка при подсчете опубликованных курсов: {str(e)}")
            raise 