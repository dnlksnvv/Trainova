"""
API маршруты для работы с тренировками курсов
"""
from typing import List, Optional
import uuid
import logging
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer

from ..domain.schemas import (
    CourseWorkoutCreate,
    CourseWorkoutUpdate,
    CourseWorkoutResponse,
    CourseWorkoutsListResponse,
    CourseWorkoutFilterRequest,
    SuccessResponse,
    ErrorResponse,
    WorkoutRatingCreate,
    WorkoutRatingResponse,
    WorkoutRatingStatsResponse
)
from ..infrastructure.course_workout_repository import CourseWorkoutRepository
from ..infrastructure.auth import get_current_user_id, get_current_user_optional

router = APIRouter()
security = HTTPBearer()
logger = logging.getLogger(__name__)


@router.post("/workouts", response_model=CourseWorkoutResponse, status_code=status.HTTP_201_CREATED)
async def create_workout(
    workout_data: CourseWorkoutCreate,
    current_user_id: int = Depends(get_current_user_id)
):
    """Создание новой тренировки курса"""
    try:
        repo = CourseWorkoutRepository()
        workout = await repo.create_workout(workout_data, current_user_id)
        logger.info(f"Пользователь {current_user_id} создал тренировку {workout.course_workout_uuid}")
        return workout
        
    except PermissionError as e:
        logger.warning(f"Ошибка доступа при создании тренировки: {e}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для создания тренировки"
        )
    except ValueError as e:
        logger.warning(f"Ошибка валидации при создании тренировки: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Неожиданная ошибка при создании тренировки: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        )


@router.get("/workouts/{workout_uuid}", response_model=CourseWorkoutResponse)
async def get_workout(
    workout_uuid: uuid.UUID,
    current_user_data: Optional[tuple] = Depends(get_current_user_optional)
):
    """Получение тренировки по UUID"""
    try:
        repo = CourseWorkoutRepository()
        user_id = current_user_data[0] if current_user_data else None
        workout = await repo.get_workout_by_id(workout_uuid, user_id)
        
        if not workout:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Тренировка не найдена"
            )
        
        return workout
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении тренировки {workout_uuid}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        )


@router.get("/courses/{course_uuid}/workouts", response_model=List[CourseWorkoutResponse])
async def get_course_workouts(
    course_uuid: uuid.UUID,
    published_only: bool = True,
    current_user_data: Optional[tuple] = Depends(get_current_user_optional)
):
    """Получение всех тренировок курса"""
    try:
        repo = CourseWorkoutRepository()
        
        if current_user_data:
            user_id, role_id = current_user_data
            workouts = await repo.get_workouts_by_course(course_uuid, user_id, role_id, published_only)
        else:
            # Неавторизованные пользователи не могут получать тренировки
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Доступ к тренировкам курса разрешен только авторизованным пользователям"
            )
        
        return workouts
        
    except ValueError as e:
        logger.warning(f"Ошибка при получении тренировок курса {course_uuid}: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении тренировок курса {course_uuid}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        )


@router.put("/workouts/{workout_uuid}", response_model=CourseWorkoutResponse)
async def update_workout(
    workout_uuid: uuid.UUID,
    workout_data: CourseWorkoutUpdate,
    current_user_id: int = Depends(get_current_user_id)
):
    """Обновление тренировки"""
    try:
        repo = CourseWorkoutRepository()
        workout = await repo.update_workout(workout_uuid, workout_data, current_user_id)
        
        if not workout:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Тренировка не найдена"
            )
        
        logger.info(f"Пользователь {current_user_id} обновил тренировку {workout_uuid}")
        return workout
        
    except PermissionError as e:
        logger.warning(f"Ошибка доступа при обновлении тренировки: {e}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для редактирования тренировки"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при обновлении тренировки {workout_uuid}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        )


@router.delete("/workouts/{workout_uuid}", response_model=SuccessResponse)
async def delete_workout(
    workout_uuid: uuid.UUID,
    current_user_id: int = Depends(get_current_user_id)
):
    """Удаление тренировки"""
    try:
        repo = CourseWorkoutRepository()
        success = await repo.delete_workout(workout_uuid, current_user_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Тренировка не найдена"
            )
        
        logger.info(f"Пользователь {current_user_id} удалил тренировку {workout_uuid}")
        return SuccessResponse(message="Тренировка успешно удалена")
        
    except PermissionError as e:
        logger.warning(f"Ошибка доступа при удалении тренировки: {e}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для удаления тренировки"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при удалении тренировки {workout_uuid}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        )


@router.post("/workouts/filter", response_model=List[CourseWorkoutResponse])
async def filter_workouts(
    filter_request: CourseWorkoutFilterRequest,
    current_user_data: Optional[tuple] = Depends(get_current_user_optional)
):
    """Поиск тренировок с фильтрацией"""
    try:
        repo = CourseWorkoutRepository()
        user_id = current_user_data[0] if current_user_data else None
        
        if not filter_request.filters:
            # Если фильтры не указаны, возвращаем пустой список
            return []
        
        workouts = await repo.get_workouts_with_filters(filter_request.filters, user_id)
        return workouts
        
    except Exception as e:
        logger.error(f"Ошибка при фильтрации тренировок: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        )


@router.put("/courses/{course_uuid}/workouts/reorder", response_model=SuccessResponse)
async def reorder_workouts(
    course_uuid: uuid.UUID,
    workout_orders: List[dict],
    current_user_id: int = Depends(get_current_user_id)
):
    """Изменение порядка тренировок в курсе"""
    try:
        repo = CourseWorkoutRepository()
        success = await repo.reorder_workouts(course_uuid, workout_orders, current_user_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Не удалось изменить порядок тренировок"
            )
        
        logger.info(f"Пользователь {current_user_id} изменил порядок тренировок в курсе {course_uuid}")
        return SuccessResponse(message="Порядок тренировок успешно изменен")
        
    except PermissionError as e:
        logger.warning(f"Ошибка доступа при изменении порядка тренировок: {e}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для изменения порядка тренировок"
        )
    except ValueError as e:
        logger.warning(f"Ошибка при изменении порядка тренировок: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при изменении порядка тренировок в курсе {course_uuid}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        )


# =================== WORKOUT RATINGS ROUTES ===================

@router.post("/workouts/{workout_uuid}/ratings", response_model=WorkoutRatingResponse, status_code=status.HTTP_201_CREATED)
async def create_workout_rating(
    workout_uuid: uuid.UUID,
    rating_data: dict,
    current_user_id: int = Depends(get_current_user_id)
):
    """Создание/обновление оценки тренировки"""
    try:
        repo = CourseWorkoutRepository()
        # Проверяем, что в запросе есть поле rating
        if 'rating' not in rating_data:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Поле 'rating' обязательно"
            )
            
        rating_value = rating_data.get('rating')
        # Проверяем, что рейтинг - число
        try:
            from decimal import Decimal
            rating_value = Decimal(str(rating_value))
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Поле 'rating' должно быть числом от 0 до 5"
            )
            
        # Создаем объект WorkoutRatingCreate с данными из пути и запроса
        rating_data_with_uuid = WorkoutRatingCreate(
            course_workout_uuid=workout_uuid,
            rating=rating_value
        )
        
        rating = await repo.create_workout_rating(rating_data_with_uuid, current_user_id)
        
        logger.info(f"Пользователь {current_user_id} оценил тренировку {workout_uuid}")
        return rating
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при создании/обновлении оценки тренировки: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )


@router.get("/workouts/{workout_uuid}/ratings/user", response_model=Optional[WorkoutRatingResponse])
async def get_workout_user_rating(
    workout_uuid: uuid.UUID,
    current_user_id: int = Depends(get_current_user_id)
):
    """Получение оценки тренировки текущим пользователем"""
    try:
        repo = CourseWorkoutRepository()
        rating = await repo.get_workout_rating(workout_uuid, current_user_id)
        
        if not rating:
            return None
        
        return rating
        
    except Exception as e:
        logger.error(f"Ошибка при получении оценки тренировки {workout_uuid}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        )


@router.get("/workouts/{workout_uuid}/ratings/stats", response_model=WorkoutRatingStatsResponse)
async def get_workout_rating_stats(
    workout_uuid: uuid.UUID,
    current_user_id: Optional[int] = Depends(get_current_user_optional)
):
    """Получение статистики оценок тренировки"""
    try:
        repo = CourseWorkoutRepository()
        stats = await repo.get_workout_rating_stats(workout_uuid)
        return stats
        
    except Exception as e:
        logger.error(f"Ошибка при получении статистики оценок тренировки {workout_uuid}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        )


@router.delete("/workouts/{workout_uuid}/ratings", response_model=SuccessResponse)
async def delete_workout_rating(
    workout_uuid: uuid.UUID,
    current_user_id: int = Depends(get_current_user_id)
):
    """Удаление оценки тренировки"""
    try:
        repo = CourseWorkoutRepository()
        success = await repo.delete_workout_rating(workout_uuid, current_user_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Оценка не найдена"
            )
        
        logger.info(f"Пользователь {current_user_id} удалил оценку тренировки {workout_uuid}")
        return SuccessResponse(message="Оценка успешно удалена")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при удалении оценки тренировки {workout_uuid}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        )

# Для совместимости со старыми маршрутами, сохраняем их временно
@router.post("/workouts/ratings", response_model=WorkoutRatingResponse, status_code=status.HTTP_201_CREATED)
async def create_workout_rating_legacy(
    rating_data: WorkoutRatingCreate,
    current_user_id: int = Depends(get_current_user_id)
):
    """Создание/обновление оценки тренировки (устаревший маршрут)"""
    try:
        repo = CourseWorkoutRepository()
        rating = await repo.create_workout_rating(rating_data, current_user_id)
        
        logger.info(f"Пользователь {current_user_id} оценил тренировку {rating_data.course_workout_uuid} (устаревший маршрут)")
        return rating
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при создании/обновлении оценки тренировки: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )


@router.get("/workouts/{workout_uuid}/rating", response_model=Optional[WorkoutRatingResponse])
async def get_workout_rating_legacy(
    workout_uuid: uuid.UUID,
    current_user_id: int = Depends(get_current_user_id)
):
    """Получение оценки тренировки текущим пользователем (устаревший маршрут)"""
    return await get_workout_user_rating(workout_uuid, current_user_id)


@router.get("/workouts/{workout_uuid}/rating/stats", response_model=WorkoutRatingStatsResponse)
async def get_workout_rating_stats_legacy(
    workout_uuid: uuid.UUID,
    current_user_id: Optional[int] = Depends(get_current_user_optional)
):
    """Получение статистики оценок тренировки (устаревший маршрут)"""
    return await get_workout_rating_stats(workout_uuid, current_user_id)


@router.delete("/workouts/{workout_uuid}/rating", response_model=SuccessResponse)
async def delete_workout_rating_legacy(
    workout_uuid: uuid.UUID,
    current_user_id: int = Depends(get_current_user_id)
):
    """Удаление оценки тренировки (устаревший маршрут)"""
    return await delete_workout_rating(workout_uuid, current_user_id) 