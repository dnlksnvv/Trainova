from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Dict, Any
import logging
from datetime import datetime, timezone

from motivation.application.services.motivation_service import MotivationService
from motivation.domain.models import DailyMotivationResponse, UserResponseLevelResponse, UserResponseLevelUpdate

logger = logging.getLogger(__name__)


class MotivationRouter:
    def __init__(self, motivation_service: MotivationService):
        self.motivation_service = motivation_service
        self.router = APIRouter(tags=["motivation"])
        self._setup_routes()

    def _setup_routes(self):
        """Настройка маршрутов"""
        
        @self.router.get("/user/{user_id}")
        async def get_user_motivation(user_id: int) -> Dict[str, Any]:
            """Получение данных мотивации пользователя"""
            try:
                return await self.motivation_service.get_motivation_data(user_id)
            except Exception as e:
                logger.error(f"Ошибка при получении данных мотивации: {str(e)}")
                raise HTTPException(status_code=500, detail="Ошибка сервера")

        @self.router.put("/user/{user_id}/level")
        async def update_motivation_level(user_id: int, level: int) -> Dict[str, Any]:
            """Обновление уровня мотивации пользователя"""
            try:
                success = await self.motivation_service.update_motivation_level(user_id, level)
                if success:
                    return {"message": "Уровень мотивации обновлен", "user_id": user_id, "level": level}
                else:
                    raise HTTPException(status_code=400, detail="Не удалось обновить уровень мотивации")
            except Exception as e:
                logger.error(f"Ошибка при обновлении уровня мотивации: {str(e)}")
                raise HTTPException(status_code=500, detail="Ошибка сервера")

        @self.router.get("/daily-motivation", response_model=DailyMotivationResponse)
        async def get_daily_motivation(
            request: Request,
            date_start: str,  # Query параметр: дата начала периода (сегодняшняя дата)
            date_end: str     # Query параметр: дата окончания периода (date_start - 7 дней)
        ) -> DailyMotivationResponse:
            """
            Получение ежедневной мотивации для пользователя за указанный период
            
            Args:
                date_start: Дата начала периода в формате YYYY-MM-DD (сегодняшняя дата)
                date_end: Дата окончания периода в формате YYYY-MM-DD (date_start - N дней)
            """
            try:
                current_time_utc = datetime.now(timezone.utc)
                
                # Извлекаем user_id из JWT токена
                user_id = request.state.user.get("user_id")
                if not user_id:
                    raise HTTPException(status_code=401, detail="User ID не найден в токене")

                # Преобразуем в int если это строка
                if isinstance(user_id, str):
                    user_id = int(user_id)

                logger.info(f"🎯 API: Запрос мотивации для user_id={user_id}, период: {date_start} → {date_end} (UTC: {current_time_utc})")

                # Получаем мотивацию через сервис с переданными датами
                result = await self.motivation_service.get_daily_motivation(
                    user_id=user_id,
                    date_start=date_start, 
                    date_end=date_end
                )
                
                response_time_utc = datetime.now(timezone.utc)
                logger.info(f"✅ API: Мотивация получена для user_id={user_id}, статус={result.status} (UTC: {response_time_utc})")
                return result

            except ValueError as e:
                logger.error(f"Ошибка валидации: {str(e)}")
                raise HTTPException(status_code=400, detail=str(e))
            except Exception as e:
                error_time_utc = datetime.now(timezone.utc)
                logger.error(f"Ошибка при получении мотивации в UTC {error_time_utc}: {str(e)}")
                raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")

        @self.router.post("/regenerate-motivation", response_model=DailyMotivationResponse)
        async def regenerate_motivation(
            request: Request,
            regeneration_request: dict
        ) -> DailyMotivationResponse:
            """
            Перегенерация мотивационного сообщения для пользователя
            
            Args:
                regeneration_request: JSON с полями date_start и date_end
            """
            try:
                current_time_utc = datetime.now(timezone.utc)
                
                # Извлекаем user_id из JWT токена
                user_id = request.state.user.get("user_id")
                if not user_id:
                    raise HTTPException(status_code=401, detail="User ID не найден в токене")

                # Преобразуем в int если это строка
                if isinstance(user_id, str):
                    user_id = int(user_id)

                # Извлекаем даты из запроса
                date_start = regeneration_request.get("date_start")
                date_end = regeneration_request.get("date_end")
                
                if not date_start or not date_end:
                    raise HTTPException(status_code=400, detail="Требуются поля date_start и date_end")

                logger.info(f"🔄 API: Запрос перегенерации мотивации для user_id={user_id}, период: {date_start} → {date_end} (UTC: {current_time_utc})")

                # Вызываем метод перегенерации в сервисе
                result = await self.motivation_service.regenerate_daily_motivation(
                    user_id=user_id,
                    date_start=date_start, 
                    date_end=date_end
                )
                
                response_time_utc = datetime.now(timezone.utc)
                logger.info(f"✅ API: Перегенерация инициирована для user_id={user_id}, статус={result.status} (UTC: {response_time_utc})")
                return result

            except ValueError as e:
                logger.error(f"Ошибка валидации при перегенерации: {str(e)}")
                raise HTTPException(status_code=400, detail=str(e))
            except Exception as e:
                error_time_utc = datetime.now(timezone.utc)
                logger.error(f"Ошибка при перегенерации мотивации в UTC {error_time_utc}: {str(e)}")
                raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")

        @self.router.get("/user-response-level", response_model=UserResponseLevelResponse)
        async def get_user_response_level(request: Request) -> UserResponseLevelResponse:
            """Получение уровня жёсткости ответов пользователя"""
            try:
                # Извлекаем user_id из JWT токена
                user_id = request.state.user.get("user_id")
                if not user_id:
                    raise HTTPException(status_code=401, detail="User ID не найден в токене")

                # Преобразуем в int если это строка
                if isinstance(user_id, str):
                    user_id = int(user_id)

                logger.info(f"🔍 API: Запрос уровня жёсткости для user_id={user_id}")

                # Получаем уровень через сервис
                level = await self.motivation_service.get_user_response_level(user_id)
                
                logger.info(f"✅ API: Уровень жёсткости получен для user_id={user_id}: {level}")
                return UserResponseLevelResponse(response_level_id=level)

            except Exception as e:
                logger.error(f"Ошибка при получении уровня жёсткости: {str(e)}")
                raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")

        @self.router.put("/user-response-level", response_model=UserResponseLevelResponse)
        async def update_user_response_level(
            request: Request,
            level_update: UserResponseLevelUpdate
        ) -> UserResponseLevelResponse:
            """Обновление уровня жёсткости ответов пользователя"""
            try:
                # Извлекаем user_id из JWT токена
                user_id = request.state.user.get("user_id")
                if not user_id:
                    raise HTTPException(status_code=401, detail="User ID не найден в токене")

                # Преобразуем в int если это строка
                if isinstance(user_id, str):
                    user_id = int(user_id)

                logger.info(f"🔄 API: Обновление уровня жёсткости для user_id={user_id} на {level_update.response_level_id}")

                # Обновляем уровень через сервис
                updated_level = await self.motivation_service.update_user_response_level(
                    user_id, level_update.response_level_id
                )
                
                logger.info(f"✅ API: Уровень жёсткости обновлён для user_id={user_id}: {updated_level}")
                return UserResponseLevelResponse(response_level_id=updated_level)

            except ValueError as e:
                logger.error(f"Ошибка валидации уровня жёсткости: {str(e)}")
                raise HTTPException(status_code=400, detail=str(e))
            except Exception as e:
                logger.error(f"Ошибка при обновлении уровня жёсткости: {str(e)}")
                raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")

        @self.router.get("/health")
        async def health_check() -> Dict[str, str]:
            """Проверка состояния сервиса"""
            current_time_utc = datetime.now(timezone.utc)
            return {
                "status": "healthy", 
                "service": "motivation",
                "timestamp_utc": current_time_utc.isoformat()
            } 