from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
import uuid
import logging

from ..domain.schemas import (
    CourseCreate, CourseUpdate, CourseResponse, 
    CoursesListResponse, HealthResponse,
    CourseFilterRequest
)
from ..application.services.course_service import CourseService
from ..infrastructure.auth import get_current_user_id, get_current_user_optional, get_current_user_data
from .course_workout_routes import router as workout_router

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["courses"],
    responses={404: {"description": "Not found"}},
)

# Подключаем роутер тренировок
router.include_router(workout_router, tags=["workouts"])

# Инициализируем сервис курсов
course_service = CourseService()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Проверка здоровья сервиса курсов"""
    return HealthResponse(
        service="course_service",
        status="healthy",
        message="Course Service работает нормально"
    )


@router.post("/", response_model=CourseResponse)
async def create_course(
    course_data: CourseCreate,
    current_user_id: int = Depends(get_current_user_id)
):
    """Создание нового курса"""
    try:
        logger.info(f"Создание курса пользователем {current_user_id}: {course_data.name}")
        
        created_course = await course_service.create_course(course_data, current_user_id)
        
        logger.info(f"Курс успешно создан: {created_course.course_uuid}")
        return created_course
    except Exception as e:
        logger.error(f"Ошибка при создании курса: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при создании курса: {str(e)}"
        )


@router.post("/courses", response_model=List[CourseResponse])
async def get_filtered_courses(
    filter_request: CourseFilterRequest,
    current_user_data: tuple = Depends(get_current_user_data)
):
    """
    Получение курсов с фильтрацией по ролям
    
    Логика фильтрации:
    - Если role_id = 1 (админ): видит все курсы включая неопубликованные (при include_unpublished=true)
    - Если role_id = 2 (обычный пользователь): видит опубликованные курсы + свои неопубликованные (при include_unpublished=true)
    
    Фильтры:
    - user_ids: список ID пользователей для фильтрации (опционально)
    - current_subscribe: флаг для фильтрации курсов по подпискам (опционально)
      - true - только курсы с активной подпиской
      - false - только курсы без активной подписки
      - не указано - все курсы
    - include_unpublished: включать ли неопубликованные курсы (по умолчанию true)
      - true - применяет ролевую логику (текущее поведение)
      - false - показывает ТОЛЬКО опубликованные курсы для всех (админов и пользователей)
    """
    try:
        current_user_id, current_user_role = current_user_data
        
        logger.info(f"Получение курсов пользователем {current_user_id} (роль: {current_user_role})")
        logger.info(f"Фильтры: {filter_request}")
        
        courses = await course_service.get_courses_with_filters(
            filter_request, 
            current_user_id, 
            current_user_role
        )
        
        logger.info(f"Найдено курсов: {len(courses)}")
        return courses
        
    except Exception as e:
        logger.error(f"Ошибка при получении курсов: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении курсов: {str(e)}"
        )


@router.get("/{course_uuid}", response_model=CourseResponse)
async def get_course(
    course_uuid: str,
    current_user_data: Optional[tuple] = Depends(get_current_user_optional)
):
    """Получение курса по UUID с проверкой прав доступа к неопубликованным курсам"""
    try:
        # Получаем ID пользователя, если пользователь авторизован
        current_user_id = None
        if current_user_data:
            current_user_id, _ = current_user_data
        
        course = await course_service.get_course(course_uuid, current_user_id)
        
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Курс не найден"
            )
        
        # Проверяем права доступа к неопубликованным курсам
        if not course.is_published:
            if current_user_data is None:
                # Неавторизованные пользователи не могут видеть неопубликованные курсы
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Курс скрыт и недоступен для просмотра"
                )
            
            current_user_id, current_user_role = current_user_data
            
            # Проверяем: является ли пользователь владельцем курса или имеет роль 1 (админ)
            is_owner = current_user_id == course.user_id
            is_admin = current_user_role == 1  # role_id = 1 это админ
            
            if not (is_owner or is_admin):
                logger.warning(f"Пользователь {current_user_id} (роль: {current_user_role}) пытался получить доступ к неопубликованному курсу {course_uuid}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Курс скрыт и недоступен для просмотра"
                )
            
            logger.info(f"Доступ к неопубликованному курсу {course_uuid} разрешен пользователю {current_user_id} (владелец: {is_owner}, админ: {is_admin})")
        
        return course
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении курса {course_uuid}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении курса: {str(e)}"
        )


@router.get("/courses", response_model=CoursesListResponse)
async def get_courses(
    user_id: Optional[int] = None,
    published_only: bool = True,
    page: int = 1,
    per_page: int = 10
):
    """Получение списка курсов"""
    try:
        if user_id:
            # Получаем курсы конкретного пользователя
            courses = await course_service.get_user_courses(user_id, published_only)
            # Простая пагинация для курсов пользователя
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page
            paginated_courses = courses[start_idx:end_idx]
            total = len(courses)
        else:
            # Получаем все опубликованные курсы с пагинацией
            paginated_courses = await course_service.get_all_published_courses(page, per_page)
            total = await course_service.get_total_published_courses_count()
        
        return CoursesListResponse(
            courses=paginated_courses,
            total=total,
            page=page,
            per_page=per_page
        )
    except Exception as e:
        logger.error(f"Ошибка при получении курсов: {str(e)}")
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.get("/user/{user_id}", response_model=List[CourseResponse])
async def get_user_courses(
    user_id: int, 
    published_only: bool = False,
    current_user_id: int = Depends(get_current_user_id)
):
    """Получение курсов пользователя"""
    try:
        logger.info(f"Получение курсов пользователя {user_id} (published_only: {published_only})")
        
        courses = await course_service.get_user_courses(user_id, published_only)
        
        logger.info(f"Найдено курсов пользователя {user_id}: {len(courses)}")
        return courses
        
    except Exception as e:
        logger.error(f"Ошибка при получении курсов пользователя {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении курсов пользователя: {str(e)}"
        )


@router.put("/{course_uuid}", response_model=CourseResponse)
async def update_course(
    course_uuid: str,
    course_data: CourseUpdate,
    current_user_id: int = Depends(get_current_user_id)
):
    """Обновление курса"""
    try:
        logger.info(f"Обновление курса {course_uuid} пользователем {current_user_id}")
        
        updated_course = await course_service.update_course(course_uuid, course_data)
        
        if not updated_course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Курс не найден"
            )
        
        logger.info(f"Курс {course_uuid} успешно обновлен")
        return updated_course
        
    except HTTPException:
        raise
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Ошибка при обновлении курса {course_uuid}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при обновлении курса: {str(e)}"
        )


@router.delete("/{course_uuid}")
async def delete_course(
    course_uuid: str,
    current_user_id: int = Depends(get_current_user_id)
):
    """Удаление курса"""
    try:
        logger.info(f"Удаление курса {course_uuid} пользователем {current_user_id}")
        
        success = await course_service.delete_course(course_uuid)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Курс не найден"
            )
        
        logger.info(f"Курс {course_uuid} успешно удален")
        return {"message": "Курс успешно удален"}
        
    except HTTPException:
        raise
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Ошибка при удалении курса {course_uuid}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при удалении курса: {str(e)}"
        ) 