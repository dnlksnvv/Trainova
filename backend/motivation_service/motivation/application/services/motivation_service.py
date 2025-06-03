import logging
import asyncio
from datetime import datetime, date, timezone
from typing import Dict, Any, Optional

from motivation.domain.models import DailyMotivation, DailyMotivationCreate, DailyMotivationResponse
from motivation.infrastructure.repository import MotivationRepository

logger = logging.getLogger(__name__)


class MotivationService:
    def __init__(self):
        self.repository: Optional[MotivationRepository] = None
        self._locks = {}  # Словарь блокировок для каждого пользователя

    def set_repository(self, repository: MotivationRepository):
        """Устанавливает репозиторий для работы с базой данных"""
        self.repository = repository

    async def get_daily_motivation(self, user_id: int, date_start: str, date_end: str) -> DailyMotivationResponse:
        """Получение мотивации пользователя за указанный период"""
        if not self.repository:
            raise ValueError("Repository не установлен")

        # Используем блокировку для каждого пользователя отдельно
        if user_id not in self._locks:
            self._locks[user_id] = asyncio.Lock()

        async with self._locks[user_id]:
            current_time_utc = datetime.now(timezone.utc)
            
            # Конвертируем строки в даты
            try:
                date_start_obj = datetime.strptime(date_start, "%Y-%m-%d").date()
                date_end_obj = datetime.strptime(date_end, "%Y-%m-%d").date()
            except ValueError as e:
                raise ValueError(f"Неверный формат даты. Используйте YYYY-MM-DD: {str(e)}")
            
            # Валидация дат
            if date_start_obj >= date_end_obj:
                raise ValueError("date_start должен быть меньше date_end")
            
            logger.info(f"🔍 Поиск мотивации для user_id={user_id}, период: {date_start_obj} → {date_end_obj} (UTC: {current_time_utc})")

            # НОВАЯ ЛОГИКА: Проверяем точное совпадение интервала дат
            exact_interval_exists = await self.repository.check_motivation_exists_for_exact_interval(
                user_id=user_id,
                date_start=date_start_obj,
                date_ended=date_end_obj
            )

            if exact_interval_exists:
                # Проверяем если есть запись в процессе регенерации
                regenerating_motivation = await self.repository.get_motivation_by_status(
                    user_id=user_id,
                    date_start=date_start_obj,
                    date_ended=date_end_obj,
                    status='regenerating'
                )
                
                if regenerating_motivation:
                    logger.info(f"🔄 Найдена мотивация в процессе регенерации, ищем предыдущую completed")
                    # Ищем предыдущую completed запись для этого же периода
                    previous_motivation = await self.repository.get_daily_motivation_by_user_and_date(
                        user_id=user_id, 
                        date_start=date_start_obj,
                        date_end=date_end_obj
                    )
                    if previous_motivation:
                        # Возвращаем предыдущую мотивацию со статусом 'regenerated'
                        logger.info(f"✅ Возвращаем предыдущую мотивацию со статусом 'regenerated'")
                        return DailyMotivationResponse(
                            generation_date=previous_motivation.date_ended.strftime("%Y-%m-%d"),
                            date_period=f"{previous_motivation.date_start.strftime('%Y-%m-%d')} → {previous_motivation.date_ended.strftime('%Y-%m-%d')}",
                            status='regenerated',
                            motivation_message=previous_motivation.motivation_message,
                            fact=previous_motivation.fact,
                            advice=previous_motivation.advice
                        )
                
                # Если запись существует и не в процессе регенерации, получаем её и возвращаем
                existing_motivation = await self.repository.get_daily_motivation_by_user_and_date(
                    user_id=user_id, 
                    date_start=date_start_obj,
                    date_end=date_end_obj
                )
                if existing_motivation:
                    found_time_utc = datetime.now(timezone.utc)
                    logger.info(f"✅ Найдена существующая мотивация: status={existing_motivation.status} (UTC: {found_time_utc})")
                    return self._create_response(existing_motivation)
                else:
                    logger.warning(f"❌ Запись для интервала {date_start_obj} → {date_end_obj} уже существует для user_id={user_id}")
                    raise ValueError(f"Мотивация для интервала {date_start_obj} → {date_end_obj} уже существует. Используйте regenerate-motivation для перегенерации.")

            # Создаем новую запись с задачей в очереди
            create_time_utc = datetime.now(timezone.utc)
            logger.info(f"📝 Создаем новую мотивацию для user_id={user_id} (UTC: {create_time_utc})")
            
            motivation_data = DailyMotivationCreate(
                user_id=user_id,
                date_start=date_start_obj,
                date_ended=date_end_obj,
                status='new'
            )

            new_motivation = await self.repository.create_daily_motivation_with_queue_task(motivation_data)
            
            created_time_utc = datetime.now(timezone.utc)
            logger.info(f"✅ Создана новая мотивация: {new_motivation.daily_motivation_uuid} (UTC: {created_time_utc})")

            return self._create_response(new_motivation)

    def _create_response(self, motivation: DailyMotivation) -> DailyMotivationResponse:
        """Создание ответа из модели мотивации"""
        response_time_utc = datetime.now(timezone.utc)
        
        # Форматируем дату (используем date_ended как generation_date)
        generation_date = motivation.date_ended.strftime("%Y-%m-%d")
        
        # Форматируем период (от ранней к поздней дате: date_start → date_ended)
        date_period = f"{motivation.date_start.strftime('%Y-%m-%d')} → {motivation.date_ended.strftime('%Y-%m-%d')}"
        
        logger.debug(f"📄 Создаем ответ для мотивации {motivation.daily_motivation_uuid} (UTC: {response_time_utc})")
        
        return DailyMotivationResponse(
            generation_date=generation_date,
            date_period=date_period,
            status=motivation.status,
            motivation_message=motivation.motivation_message,
            fact=motivation.fact,
            advice=motivation.advice
        )

    async def get_motivation_data(self, user_id: int) -> Dict[str, Any]:
        """Получение данных мотивации пользователя (заглушка)"""
        current_time_utc = datetime.now(timezone.utc)
        logger.info(f"📊 Получение данных мотивации для user_id={user_id} (UTC: {current_time_utc})")
        
        return {
            "user_id": user_id,
            "level": 1,
            "points": 0,
            "timestamp_utc": current_time_utc.isoformat()
        }

    async def update_motivation_level(self, user_id: int, level: int) -> bool:
        """Обновление уровня мотивации пользователя (заглушка)"""
        current_time_utc = datetime.now(timezone.utc)
        logger.info(f"🔄 Обновление уровня мотивации user_id={user_id}, level={level} (UTC: {current_time_utc})")
        
        return True

    async def regenerate_daily_motivation(self, user_id: int, date_start: str, date_end: str) -> DailyMotivationResponse:
        """Перегенерация мотивации пользователя за указанный период"""
        if not self.repository:
            raise ValueError("Repository не установлен")

        # Используем блокировку для каждого пользователя отдельно
        if user_id not in self._locks:
            self._locks[user_id] = asyncio.Lock()

        async with self._locks[user_id]:
            current_time_utc = datetime.now(timezone.utc)
            
            # Конвертируем строки в даты
            try:
                date_start_obj = datetime.strptime(date_start, "%Y-%m-%d").date()
                date_end_obj = datetime.strptime(date_end, "%Y-%m-%d").date()
            except ValueError as e:
                raise ValueError(f"Неверный формат даты. Используйте YYYY-MM-DD: {str(e)}")
            
            # Валидация дат
            if date_start_obj >= date_end_obj:
                raise ValueError("date_start должен быть меньше date_end")
            
            logger.info(f"🔄 Перегенерация мотивации для user_id={user_id}, период: {date_start_obj} → {date_end_obj} (UTC: {current_time_utc})")

            # ВАЖНО: Проверяем что предыдущая запись имеет статус completed
            existing_motivation = await self.repository.get_daily_motivation_by_user_and_date(
                user_id=user_id, 
                date_start=date_start_obj,
                date_end=date_end_obj
            )

            if existing_motivation:
                if existing_motivation.status != 'completed':
                    logger.warning(f"❌ Нельзя регенерировать мотивацию со статусом {existing_motivation.status}")
                    raise ValueError(f"Регенерация разрешена только для мотивации со статусом 'completed'. Текущий статус: {existing_motivation.status}")

            # Создаем новую запись для перегенерации (старая остается в базе)
            motivation_data = DailyMotivationCreate(
                user_id=user_id,
                date_start=date_start_obj,
                date_ended=date_end_obj,
                status='regenerating'
            )

            new_motivation = await self.repository.create_daily_motivation_with_queue_task(motivation_data)
            
            created_time_utc = datetime.now(timezone.utc)
            logger.info(f"✅ Создана новая мотивация для перегенерации: {new_motivation.daily_motivation_uuid} (UTC: {created_time_utc})")

            return self._create_response(new_motivation)

    async def get_user_response_level(self, user_id: int) -> int:
        """Получение уровня жёсткости ответов пользователя"""
        if not self.repository:
            raise ValueError("Repository не установлен")

        logger.info(f"🔍 Получение уровня жёсткости для user_id={user_id}")
        
        level = await self.repository.get_user_response_level(user_id)
        if level is None:
            # Если уровень не найден, создаём запись с уровнем 1 (лояльный)
            logger.info(f"📝 Создаём уровень жёсткости по умолчанию для user_id={user_id}")
            level = await self.repository.create_or_update_user_response_level(user_id, 1)
        
        return level

    async def update_user_response_level(self, user_id: int, response_level_id: int) -> int:
        """Обновление уровня жёсткости ответов пользователя"""
        if not self.repository:
            raise ValueError("Repository не установлен")

        # Валидация уровня
        if response_level_id not in [1, 2, 3]:
            raise ValueError("response_level_id должен быть 1, 2 или 3")

        logger.info(f"🔄 Обновление уровня жёсткости для user_id={user_id} на {response_level_id}")
        
        updated_level = await self.repository.create_or_update_user_response_level(user_id, response_level_id)
        
        return updated_level 