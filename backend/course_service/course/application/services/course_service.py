import logging
from typing import List, Optional
import uuid

from ...domain.schemas import CourseCreate, CourseUpdate, CourseResponse, CourseFilterRequest
from ...infrastructure.course_repository import CourseRepository

logger = logging.getLogger(__name__)


class CourseService:
    """Сервис для работы с курсами"""
    
    def __init__(self):
        self.repository = CourseRepository()
    
    async def create_course(self, course_data: CourseCreate, user_id: int) -> CourseResponse:
        """Создание нового курса"""
        try:
            # Валидация данных (дополнительная бизнес-логика)
            if not course_data.name or len(course_data.name.strip()) == 0:
                raise ValueError("Название курса не может быть пустым")
            
            # Создаем курс через репозиторий
            created_course = await self.repository.create_course(course_data, user_id)
            
            logger.info(f"Создан новый курс: {created_course.course_uuid} для пользователя {user_id}")
            return created_course
            
        except Exception as e:
            logger.error(f"Ошибка при создании курса: {str(e)}")
            raise
    
    async def get_course(self, course_uuid: str, user_id: Optional[int] = None) -> Optional[CourseResponse]:
        """Получение курса по UUID"""
        try:
            course_uuid_obj = uuid.UUID(course_uuid)
            return await self.repository.get_course_by_uuid(course_uuid_obj, user_id)
        except ValueError:
            logger.error(f"Неверный формат UUID: {course_uuid}")
            return None
        except Exception as e:
            logger.error(f"Ошибка при получении курса: {str(e)}")
            raise
    
    async def get_courses_with_filters(self, filter_request: CourseFilterRequest, current_user_id: int, current_user_role: int) -> List[CourseResponse]:
        """
        Получение курсов с фильтрацией по ролям
        
        Args:
            filter_request: Объект с фильтрами
            current_user_id: ID текущего пользователя
            current_user_role: Роль текущего пользователя (1 - админ, 2 - обычный пользователь)
        
        Returns:
            Список курсов с учетом прав доступа
        """
        try:
            user_ids = None
            if filter_request.filters and filter_request.filters.user_ids:
                user_ids = filter_request.filters.user_ids
            
            # Определяем нужно ли включать неопубликованные курсы
            include_unpublished = True  # По умолчанию включаем (текущее поведение)
            if filter_request.filters and filter_request.filters.include_unpublished is not None:
                include_unpublished = filter_request.filters.include_unpublished
            
            # Получаем все курсы с информацией о подписках
            courses = await self.repository.get_courses_with_filters(user_ids, current_user_id, current_user_role, include_unpublished)
            
            # Если указан фильтр по подпискам, применяем его
            if filter_request.filters and filter_request.filters.current_subscribe is not None:
                current_subscribe = filter_request.filters.current_subscribe
                if current_subscribe:
                    # Возвращаем только курсы с активной подпиской
                    courses = [course for course in courses if course.has_subscription]
                else:
                    # Возвращаем только курсы без активной подписки
                    courses = [course for course in courses if not course.has_subscription]
            
            return courses
        except Exception as e:
            logger.error(f"Ошибка при получении курсов с фильтрами: {str(e)}")
            raise
    
    async def get_user_courses(self, user_id: int, published_only: bool = False) -> List[CourseResponse]:
        """Получение курсов пользователя"""
        try:
            return await self.repository.get_courses_by_user(user_id, published_only)
        except Exception as e:
            logger.error(f"Ошибка при получении курсов пользователя: {str(e)}")
            raise
    
    async def get_all_published_courses(self, page: int = 1, per_page: int = 10) -> List[CourseResponse]:
        """Получение всех опубликованных курсов"""
        try:
            return await self.repository.get_all_published_courses(page, per_page)
        except Exception as e:
            logger.error(f"Ошибка при получении всех опубликованных курсов: {str(e)}")
            raise
    
    async def get_total_published_courses_count(self) -> int:
        """Получение общего количества опубликованных курсов"""
        try:
            return await self.repository.get_total_published_courses_count()
        except Exception as e:
            logger.error(f"Ошибка при подсчете опубликованных курсов: {str(e)}")
            raise
    
    async def update_course(self, course_uuid: str, course_data: CourseUpdate) -> Optional[CourseResponse]:
        """Обновление курса"""
        try:
            course_uuid_obj = uuid.UUID(course_uuid)
            return await self.repository.update_course(course_uuid_obj, course_data)
        except ValueError:
            logger.error(f"Неверный формат UUID: {course_uuid}")
            return None
        except Exception as e:
            logger.error(f"Ошибка при обновлении курса: {str(e)}")
            raise
    
    async def delete_course(self, course_uuid: str) -> bool:
        """Удаление курса"""
        try:
            course_uuid_obj = uuid.UUID(course_uuid)
            return await self.repository.delete_course(course_uuid_obj)
        except ValueError:
            logger.error(f"Неверный формат UUID: {course_uuid}")
            return False
        except Exception as e:
            logger.error(f"Ошибка при удалении курса: {str(e)}")
            raise 