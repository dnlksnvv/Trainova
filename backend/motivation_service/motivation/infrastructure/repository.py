import asyncpg
import logging
from typing import Optional
import datetime as dt
import uuid
from datetime import timezone

from motivation.domain.models import DailyMotivation, DailyMotivationCreate, NeuroGenerationQueue

logger = logging.getLogger(__name__)


class MotivationRepository:
    def __init__(self, db_pool: asyncpg.Pool):
        self.db_pool = db_pool

    async def get_daily_motivation_by_user_and_date(self, user_id: int, date_start: dt.date, date_end: dt.date) -> Optional[DailyMotivation]:
        """Получение самой последней completed мотивации за указанный период по updated_at"""
        async with self.db_pool.acquire() as connection:
            try:
                # Получаем самую последнюю completed запись из указанного периода по updated_at
                query = """
                    SELECT daily_motivation_uuid, user_id, date_start, date_ended, status, 
                           motivation_message, fact, advice, created_at, updated_at
                    FROM daily_motivation
                    WHERE user_id = $1 
                    AND date_start >= $2 
                    AND date_ended <= $3 
                    AND status = 'completed'
                    ORDER BY updated_at DESC
                    LIMIT 1
                """
                row = await connection.fetchrow(query, user_id, date_start, date_end)
                
                if not row:
                    logger.info(f"🔍 Completed мотивация не найдена для user_id={user_id} в периоде {date_start} → {date_end}")
                    return None
                
                logger.info(f"🔍 Найдена completed мотивация для user_id={user_id}, updated_at={row['updated_at']}")
                
                # Обработка timezone
                created_at = row['created_at']
                updated_at = row['updated_at']
                
                if created_at and created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                if updated_at and updated_at.tzinfo is None:
                    updated_at = updated_at.replace(tzinfo=timezone.utc)
                
                return DailyMotivation(
                    daily_motivation_uuid=row['daily_motivation_uuid'],
                    user_id=row['user_id'],
                    date_start=row['date_start'],
                    date_ended=row['date_ended'],
                    status=row['status'],
                    motivation_message=row['motivation_message'],
                    fact=row['fact'],
                    advice=row['advice'],
                    created_at=created_at,
                    updated_at=updated_at
                )
                
            except Exception as e:
                logger.error(f"Ошибка при получении мотивации: {str(e)}")
                raise

    async def create_daily_motivation_with_queue_task(self, motivation_data: DailyMotivationCreate) -> DailyMotivation:
        """Создание записи мотивации с задачей в очереди"""
        async with self.db_pool.acquire() as connection:
            async with connection.transaction():
                try:
                    # 1. Создаем запись мотивации
                    motivation_uuid = uuid.uuid4()
                    current_time_utc = dt.datetime.now(timezone.utc)
                    
                    query = """
                        INSERT INTO daily_motivation 
                        (daily_motivation_uuid, user_id, date_start, date_ended, status, created_at, updated_at)
                        VALUES ($1::UUID, $2, $3, $4, $5::VARCHAR, $6::TIMESTAMPTZ, $7::TIMESTAMPTZ)
                        RETURNING daily_motivation_uuid, user_id, date_start, date_ended, status, 
                                 motivation_message, fact, advice, created_at, updated_at
                    """
                    
                    row = await connection.fetchrow(
                        query, 
                        motivation_uuid,
                        motivation_data.user_id,
                        motivation_data.date_start,
                        motivation_data.date_ended,
                        motivation_data.status,
                        current_time_utc,
                        current_time_utc
                    )
                    
                    # 2. Создаем задачу в очереди
                    queue_query = """
                        INSERT INTO neuro_generation_queue 
                        (daily_motivation_uuid, status, datetime_created)
                        VALUES ($1::UUID, $2::VARCHAR, $3::TIMESTAMPTZ)
                        RETURNING neuro_generation_queue_id, daily_motivation_uuid, status, datetime_created, datetime_started, datetime_completed
                    """
                    
                    queue_row = await connection.fetchrow(queue_query, motivation_uuid, 'new', current_time_utc)
                    
                    logger.info(f"Создана мотивация {motivation_uuid} и задача {queue_row['neuro_generation_queue_id']} в UTC: {current_time_utc}")
                    
                    # Убеждаемся, что возвращаемые datetime имеют UTC timezone
                    created_at = row['created_at']
                    updated_at = row['updated_at']
                    if created_at and created_at.tzinfo is None:
                        created_at = created_at.replace(tzinfo=timezone.utc)
                    if updated_at and updated_at.tzinfo is None:
                        updated_at = updated_at.replace(tzinfo=timezone.utc)
                    
                    return DailyMotivation(
                        daily_motivation_uuid=row['daily_motivation_uuid'],
                        user_id=row['user_id'],
                        date_start=row['date_start'],
                        date_ended=row['date_ended'],
                        status=row['status'],
                        motivation_message=row['motivation_message'],
                        fact=row['fact'],
                        advice=row['advice'],
                        created_at=created_at,
                        updated_at=updated_at
                    )
                    
                except Exception as e:
                    logger.error(f"Ошибка при создании мотивации: {str(e)}")
                    raise

    async def get_user_response_level(self, user_id: int) -> Optional[int]:
        """Получение уровня жёсткости ответов пользователя"""
        async with self.db_pool.acquire() as connection:
            try:
                query = """
                    SELECT response_level_id
                    FROM user_response_levels
                    WHERE user_id = $1
                """
                row = await connection.fetchrow(query, user_id)
                
                if row:
                    logger.info(f"🔍 Найден уровень жёсткости для user_id={user_id}: {row['response_level_id']}")
                    return row['response_level_id']
                else:
                    logger.info(f"🔍 Уровень жёсткости не найден для user_id={user_id}")
                    return None
                    
            except Exception as e:
                logger.error(f"Ошибка при получении уровня жёсткости: {str(e)}")
                raise

    async def create_or_update_user_response_level(self, user_id: int, response_level_id: int) -> int:
        """Создание или обновление уровня жёсткости ответов пользователя"""
        async with self.db_pool.acquire() as connection:
            try:
                current_time_utc = dt.datetime.now(timezone.utc)
                
                # Используем UPSERT (ON CONFLICT)
                query = """
                    INSERT INTO user_response_levels (user_id, response_level_id, created_at, updated_at)
                    VALUES ($1, $2, $3, $3)
                    ON CONFLICT (user_id) 
                    DO UPDATE SET 
                        response_level_id = EXCLUDED.response_level_id,
                        updated_at = EXCLUDED.updated_at
                    RETURNING response_level_id
                """
                
                row = await connection.fetchrow(query, user_id, response_level_id, current_time_utc)
                
                logger.info(f"✅ Уровень жёсткости сохранён для user_id={user_id}: {row['response_level_id']}")
                return row['response_level_id']
                
            except Exception as e:
                logger.error(f"Ошибка при сохранении уровня жёсткости: {str(e)}")
                raise

    async def check_motivation_exists_for_exact_interval(self, user_id: int, date_start: dt.date, date_ended: dt.date) -> bool:
        """Проверка существования мотивации для точного интервала дат"""
        async with self.db_pool.acquire() as connection:
            try:
                query = """
                    SELECT 1
                    FROM daily_motivation
                    WHERE user_id = $1 
                    AND date_start = $2 
                    AND date_ended = $3
                    LIMIT 1
                """
                row = await connection.fetchrow(query, user_id, date_start, date_ended)
                
                exists = row is not None
                logger.info(f"🔍 Проверка существования записи для user_id={user_id}, интервал {date_start} → {date_ended}: {'найдена' if exists else 'не найдена'}")
                
                return exists
                
            except Exception as e:
                logger.error(f"Ошибка при проверке существования мотивации: {str(e)}")
                raise

    async def get_motivation_by_status(self, user_id: int, date_start: dt.date, date_ended: dt.date, status: str) -> Optional[DailyMotivation]:
        """Получение мотивации с определенным статусом за указанный период"""
        async with self.db_pool.acquire() as connection:
            try:
                query = """
                    SELECT daily_motivation_uuid, user_id, date_start, date_ended, status, 
                           motivation_message, fact, advice, created_at, updated_at
                    FROM daily_motivation
                    WHERE user_id = $1 
                    AND date_start = $2 
                    AND date_ended = $3 
                    AND status = $4
                    ORDER BY updated_at DESC
                    LIMIT 1
                """
                row = await connection.fetchrow(query, user_id, date_start, date_ended, status)
                
                if not row:
                    logger.info(f"🔍 Мотивация со статусом '{status}' не найдена для user_id={user_id} в периоде {date_start} → {date_ended}")
                    return None
                
                logger.info(f"🔍 Найдена мотивация со статусом '{status}' для user_id={user_id}, updated_at={row['updated_at']}")
                
                # Обработка timezone
                created_at = row['created_at']
                updated_at = row['updated_at']
                
                if created_at and created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                if updated_at and updated_at.tzinfo is None:
                    updated_at = updated_at.replace(tzinfo=timezone.utc)
                
                return DailyMotivation(
                    daily_motivation_uuid=row['daily_motivation_uuid'],
                    user_id=row['user_id'],
                    date_start=row['date_start'],
                    date_ended=row['date_ended'],
                    status=row['status'],
                    motivation_message=row['motivation_message'],
                    fact=row['fact'],
                    advice=row['advice'],
                    created_at=created_at,
                    updated_at=updated_at
                )
                
            except Exception as e:
                logger.error(f"Ошибка при получении мотивации со статусом '{status}': {str(e)}")
                raise 