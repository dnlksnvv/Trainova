import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
import asyncpg
import json
from collections import defaultdict
from decimal import Decimal
from llm_analyzer import analyze_user_data_direct

logger = logging.getLogger(__name__)


class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super(DecimalEncoder, self).default(o)


class MotivationWorker:
    def __init__(self, db_pool: asyncpg.Pool, check_interval: int = 10):
        self.db_pool = db_pool
        self.running = False
        self.check_interval = check_interval  # Проверяем очередь каждые N секунд
        self.stuck_task_timeout = 5  # Задачи старше 5 минут считаются зависшими
        self.recent_stuck_timeout = 2  # Недавно зависшие - старше 2 минут

    async def start(self):
        """Запуск воркера"""
        self.running = True
        current_time_utc = datetime.now(timezone.utc)
        logger.info(f"🚀 Background Worker запущен в UTC: {current_time_utc}")
        
        # Восстанавливаем зависшие задачи при старте
        await self.recover_stuck_tasks()
        
        while self.running:
            try:
                await self.process_pending_tasks()
                await asyncio.sleep(self.check_interval)
            except Exception as e:
                logger.error(f"Ошибка в background worker: {str(e)}")
                await asyncio.sleep(self.check_interval)

    async def stop(self):
        """Остановка воркера"""
        self.running = False
        current_time_utc = datetime.now(timezone.utc)
        logger.info(f"🛑 Background Worker остановлен в UTC: {current_time_utc}")

    async def recover_stuck_tasks(self):
        """Восстановление зависших задач после падения сервиса"""
        try:
            current_time_utc = datetime.now(timezone.utc)
            logger.info(f"🔧 Проверка зависших задач в UTC: {current_time_utc}")
            
            async with self.db_pool.acquire() as connection:
                # Инициализируем списки для подсчета
                stuck_tasks = []
                deepfit_error_tasks = []
                failed_tasks = []
                failed_no_completion_tasks = []
                
                # 1. Восстанавливаем зависшие задачи in_progress (старше 5 минут)
                query = """
                    SELECT neuro_generation_queue_id, daily_motivation_uuid, datetime_started
                    FROM neuro_generation_queue
                    WHERE status = 'in_progress' 
                    AND ($1::TIMESTAMPTZ - datetime_started) > INTERVAL '%s minutes'
                """ % self.stuck_task_timeout
                stuck_tasks = await connection.fetch(query, current_time_utc)
                
                if stuck_tasks:
                    logger.info(f"🔧 Найдено {len(stuck_tasks)} зависших задач для восстановления")
                    
                    for task in stuck_tasks:
                        task_id = task['neuro_generation_queue_id']
                        motivation_uuid = task['daily_motivation_uuid']
                        started_time = task['datetime_started']
                        
                        # Сбрасываем статус задачи обратно в 'new'
                        await connection.execute("""
                            UPDATE neuro_generation_queue
                            SET status = $1::VARCHAR,
                                datetime_started = NULL
                            WHERE neuro_generation_queue_id = $2
                        """, 'new', task_id)
                        
                        # Сбрасываем статус мотивации обратно в 'new' с UTC timestamp
                        await connection.execute("""
                            UPDATE daily_motivation
                            SET status = $1::VARCHAR,
                                updated_at = $2::TIMESTAMPTZ
                            WHERE daily_motivation_uuid = $3::UUID
                        """, 'new', current_time_utc, motivation_uuid)
                        
                        logger.info(f"🔄 Восстановлена зависшая задача {task_id} (зависла с {started_time} UTC)")
                
                # 2. Восстанавливаем задачи с ошибкой валидации deepfit-error (старше 10 минут)
                deepfit_error_query = """
                    SELECT neuro_generation_queue_id, daily_motivation_uuid, datetime_completed
                    FROM neuro_generation_queue
                    WHERE status = 'deepfit-error' 
                    AND ($1::TIMESTAMPTZ - datetime_completed) > INTERVAL '10 minutes'
                """
                deepfit_error_tasks = await connection.fetch(deepfit_error_query, current_time_utc)
                
                if deepfit_error_tasks:
                    logger.info(f"🔧 Найдено {len(deepfit_error_tasks)} задач deepfit-error для повторной обработки")
                    
                    for task in deepfit_error_tasks:
                        task_id = task['neuro_generation_queue_id']
                        motivation_uuid = task['daily_motivation_uuid']
                        error_time = task['datetime_completed']
                        
                        # Сбрасываем статус задачи обратно в 'new'
                        await connection.execute("""
                            UPDATE neuro_generation_queue
                            SET status = $1::VARCHAR,
                                datetime_started = NULL,
                                datetime_completed = NULL
                            WHERE neuro_generation_queue_id = $2
                        """, 'new', task_id)
                        
                        # Сбрасываем статус мотивации обратно в 'new'
                        await connection.execute("""
                            UPDATE daily_motivation
                            SET status = $1::VARCHAR,
                                updated_at = $2::TIMESTAMPTZ
                            WHERE daily_motivation_uuid = $3::UUID
                        """, 'new', current_time_utc, motivation_uuid)
                        
                        logger.info(f"🔄 Восстановлена задача deepfit-error {task_id} (ошибка с {error_time} UTC)")
                
                # 3. Восстанавливаем задачи с ошибкой failed (старше 2 минут)
                failed_query = """
                    SELECT neuro_generation_queue_id, daily_motivation_uuid, datetime_completed
                    FROM neuro_generation_queue
                    WHERE status = 'failed' 
                    AND datetime_completed IS NOT NULL
                    AND ($1::TIMESTAMPTZ - datetime_completed) > INTERVAL '2 minutes'
                """
                failed_tasks = await connection.fetch(failed_query, current_time_utc)
                
                if failed_tasks:
                    logger.info(f"🔧 Найдено {len(failed_tasks)} задач failed для повторной обработки")
                    
                    for task in failed_tasks:
                        task_id = task['neuro_generation_queue_id']
                        motivation_uuid = task['daily_motivation_uuid']
                        error_time = task['datetime_completed']
                        
                        # Сбрасываем статус задачи обратно в 'new'
                        await connection.execute("""
                            UPDATE neuro_generation_queue
                            SET status = $1::VARCHAR,
                                datetime_started = NULL,
                                datetime_completed = NULL
                            WHERE neuro_generation_queue_id = $2
                        """, 'new', task_id)
                        
                        # Сбрасываем статус мотивации обратно в 'new'
                        await connection.execute("""
                            UPDATE daily_motivation
                            SET status = $1::VARCHAR,
                                updated_at = $2::TIMESTAMPTZ
                            WHERE daily_motivation_uuid = $3::UUID
                        """, 'new', current_time_utc, motivation_uuid)
                        
                        logger.info(f"🔄 Восстановлена задача failed {task_id} (ошибка с {error_time} UTC)")
                
                # 4. Восстанавливаем задачи failed без datetime_completed (старше 2 минут от создания)
                failed_no_completion_query = """
                    SELECT neuro_generation_queue_id, daily_motivation_uuid, datetime_created
                    FROM neuro_generation_queue
                    WHERE status = 'failed' 
                    AND datetime_completed IS NULL
                    AND ($1::TIMESTAMPTZ - datetime_created) > INTERVAL '2 minutes'
                """
                failed_no_completion_tasks = await connection.fetch(failed_no_completion_query, current_time_utc)
                
                if failed_no_completion_tasks:
                    logger.info(f"🔧 Найдено {len(failed_no_completion_tasks)} задач failed без datetime_completed для повторной обработки")
                    
                    for task in failed_no_completion_tasks:
                        task_id = task['neuro_generation_queue_id']
                        motivation_uuid = task['daily_motivation_uuid']
                        created_time = task['datetime_created']
                        
                        # Сбрасываем статус задачи обратно в 'new'
                        await connection.execute("""
                            UPDATE neuro_generation_queue
                            SET status = $1::VARCHAR,
                                datetime_started = NULL,
                                datetime_completed = NULL
                            WHERE neuro_generation_queue_id = $2
                        """, 'new', task_id)
                        
                        # Сбрасываем статус мотивации обратно в 'new'
                        await connection.execute("""
                            UPDATE daily_motivation
                            SET status = $1::VARCHAR,
                                updated_at = $2::TIMESTAMPTZ
                            WHERE daily_motivation_uuid = $3::UUID
                        """, 'new', current_time_utc, motivation_uuid)
                        
                        logger.info(f"🔄 Восстановлена задача failed без completion {task_id} (создана {created_time} UTC)")
                
                total_recovered = len(stuck_tasks) + len(deepfit_error_tasks) + len(failed_tasks) + len(failed_no_completion_tasks)
                if total_recovered > 0:
                    logger.info(f"✅ Всего восстановлено {total_recovered} задач")
                else:
                    logger.info("✅ Задач для восстановления не найдено")
                    
        except Exception as e:
            logger.error(f"Ошибка при восстановлении зависших задач: {str(e)}")

    async def process_pending_tasks(self):
        """Обработка задач в очереди"""
        async with self.db_pool.acquire() as connection:
            # Получаем задачи со статусом 'new' + проверяем на зависшие in_progress
            pending_tasks = await self.get_pending_tasks(connection)
            
            if not pending_tasks:
                # Дополнительно проверяем на свежие зависшие задачи (каждую итерацию)
                await self.check_recent_stuck_tasks(connection)
                return  # Нет задач для обработки
            
            logger.info(f"📋 Найдено {len(pending_tasks)} задач для обработки")
            
            for task in pending_tasks:
                try:
                    await self.process_single_task(connection, task)
                except Exception as e:
                    logger.error(f"Ошибка при обработке задачи {task['neuro_generation_queue_id']}: {str(e)}")
                    # При ошибке ставим статус 'failed'
                    await self.update_task_status(
                        connection, 
                        task['neuro_generation_queue_id'], 
                        'failed'
                    )

    async def get_pending_tasks(self, connection: asyncpg.Connection) -> List[dict]:
        """Получение задач со статусом 'new' в порядке поступления (FIFO)"""
        query = """
            SELECT neuro_generation_queue_id, daily_motivation_uuid, status, datetime_created
            FROM neuro_generation_queue
            WHERE status = 'new'
            ORDER BY datetime_created ASC, neuro_generation_queue_id ASC
            LIMIT 5
        """
        rows = await connection.fetch(query)
        
        # Логируем порядок обработки для отладки
        if rows:
            task_ids = [row['neuro_generation_queue_id'] for row in rows]
            logger.info(f"📋 Порядок обработки задач: {task_ids}")
        
        return [dict(row) for row in rows]

    async def process_single_task(self, connection: asyncpg.Connection, task: dict):
        """Обработка одной задачи"""
        task_id = task['neuro_generation_queue_id']
        motivation_uuid = task['daily_motivation_uuid']
        created_time = task['datetime_created']
        current_time_utc = datetime.now(timezone.utc)
        
        logger.info(f"🔄 Обрабатываем задачу ID={task_id} (создана: {created_time} UTC) для мотивации {motivation_uuid}")
        
        # 1. Обновляем статус задачи на 'in_progress'
        await self.update_task_status(connection, task_id, 'in_progress')
        
        # 2. Получаем данные пользователя и генерируем мотивационный контент
        motivation_data = await self.generate_motivation_content(connection, motivation_uuid)
        
        # 3. Обрабатываем результат в зависимости от статуса
        result_status = motivation_data.get("status", "success")
        
        if result_status == "success":
            # Успешный анализ - записываем результат и ставим completed
            await self.update_daily_motivation(
                connection, 
                motivation_uuid, 
                motivation_data['message'],
                motivation_data['fact'],
                motivation_data['advice'],
                'completed'
            )
            await self.update_task_status(connection, task_id, 'completed')
            
            end_time_utc = datetime.now(timezone.utc)
            processing_time = (end_time_utc - current_time_utc).total_seconds()
            logger.info(f"✅ Задача ID={task_id} успешно выполнена за {processing_time:.2f} сек (UTC: {end_time_utc})")
            
        elif result_status == "validation_error":
            # Ошибка валидации - ставим deepfit-error статус для повторной обработки
            await self.update_daily_motivation(
                connection, 
                motivation_uuid, 
                motivation_data['message'],
                motivation_data['fact'],
                motivation_data['advice'],
                'deepfit-error'
            )
            await self.update_task_status(connection, task_id, 'deepfit-error')
            
            logger.warning(f"⚠️ Задача ID={task_id} - ошибка валидации LLM, установлен статус deepfit-error")
            
        else:
            # Другие ошибки (llm_error, data_error) - ставим failed
            await self.update_daily_motivation(
                connection, 
                motivation_uuid, 
                motivation_data['message'],
                motivation_data['fact'],
                motivation_data['advice'],
                'failed'
            )
            await self.update_task_status(connection, task_id, 'failed')
            
            logger.error(f"❌ Задача ID={task_id} завершена с ошибкой: {result_status}")

    async def update_task_status(self, connection: asyncpg.Connection, task_id: int, status: str):
        """Обновление статуса задачи в очереди с UTC timestamps"""
        current_time_utc = datetime.now(timezone.utc)
        
        query = """
            UPDATE neuro_generation_queue
            SET status = $1::VARCHAR,
                datetime_started = CASE WHEN $1::VARCHAR = 'in_progress' THEN $2::TIMESTAMPTZ ELSE datetime_started END,
                datetime_completed = CASE WHEN $1::VARCHAR IN ('completed', 'failed') THEN $2::TIMESTAMPTZ ELSE datetime_completed END
            WHERE neuro_generation_queue_id = $3
        """
        await connection.execute(query, status, current_time_utc, task_id)

    async def update_daily_motivation(self, connection: asyncpg.Connection, 
                                     motivation_uuid: str, message: str, fact: str, advice: str, status: str):
        """Обновление мотивационной записи с результатом и UTC timestamp"""
        current_time_utc = datetime.now(timezone.utc)
        
        query = """
            UPDATE daily_motivation
            SET motivation_message = $1::TEXT,
                fact = $2::TEXT,
                advice = $3::TEXT,
                status = $4::VARCHAR,
                updated_at = $5::TIMESTAMPTZ
            WHERE daily_motivation_uuid = $6::UUID
        """
        await connection.execute(query, message, fact, advice, status, current_time_utc, motivation_uuid)

    async def generate_motivation_content(self, connection: asyncpg.Connection, motivation_uuid: str) -> dict:
        """Генерация мотивационного контента на основе реальных данных пользователя"""
        try:
            # 1. Получаем user_id, date_start, date_ended из daily_motivation
            motivation_query = """
                SELECT user_id, date_start, date_ended
                FROM daily_motivation
                WHERE daily_motivation_uuid = $1::UUID
            """
            motivation_row = await connection.fetchrow(motivation_query, motivation_uuid)
            
            if not motivation_row:
                raise Exception(f"Не найдена мотивация с UUID: {motivation_uuid}")
            
            user_id = motivation_row['user_id']
            date_start = motivation_row['date_start']
            date_ended = motivation_row['date_ended']
            
            # 2. Получаем уровень жёсткости ответов пользователя
            user_level_query = """
                SELECT response_level_id
                FROM user_response_levels
                WHERE user_id = $1
            """
            user_level_row = await connection.fetchrow(user_level_query, user_id)
            response_level_id = user_level_row['response_level_id'] if user_level_row else 1  # По умолчанию лояльный
            
            logger.info(f"🎯 Генерация мотивации для user_id={user_id} с уровнем жёсткости: {response_level_id}")
            
            # 3. Получаем данные веса пользователя за период
            weights_query = """
                SELECT record_date, weight
                FROM user_weights
                WHERE user_id = $1 
                AND record_date >= $2 
                AND record_date <= $3
                ORDER BY record_date ASC
            """
            weights_data = await connection.fetch(weights_query, user_id, date_start, date_ended)
            
            # 4. Получаем данные активности пользователя за период
            activities_query = """
                SELECT record_date, workout_count
                FROM user_activities
                WHERE user_id = $1 
                AND record_date >= $2 
                AND record_date <= $3
                ORDER BY record_date ASC
            """
            activities_data = await connection.fetch(activities_query, user_id, date_start, date_ended)
            
            # 5. Получаем данные о выполненных упражнениях за период
            exercises_query = """
                SELECT 
                    ues.exercise_session_uuid,
                    ues.workout_session_uuid,
                    ues.exercise_uuid,
                    ues.datetime_start,
                    ues.datetime_end,
                    ues.status,
                    DATE(ues.datetime_start AT TIME ZONE 'UTC') as session_date
                FROM user_exercise_sessions ues
                WHERE ues.user_id = $1 
                AND ues.datetime_start IS NOT NULL
                AND DATE(ues.datetime_start AT TIME ZONE 'UTC') >= $2
                AND DATE(ues.datetime_start AT TIME ZONE 'UTC') <= $3
                ORDER BY ues.datetime_start ASC
            """
            exercises_sessions_data = await connection.fetch(exercises_query, user_id, date_start, date_ended)
            
            # 6. Для каждого exercise_uuid получаем подробную информацию
            exercise_details = []
            if exercises_sessions_data:
                for session in exercises_sessions_data:
                    exercise_uuid = session['exercise_uuid']
                    workout_session_uuid = session['workout_session_uuid']
                    
                    # Получаем workout_uuid из user_workout_sessions
                    workout_session_query = """
                        SELECT workout_uuid
                        FROM user_workout_sessions
                        WHERE workout_session_uuid = $1::UUID
                        LIMIT 1
                    """
                    workout_session_row = await connection.fetchrow(workout_session_query, workout_session_uuid)
                    workout_uuid = workout_session_row['workout_uuid'] if workout_session_row else None
                    
                    # Получаем информацию из app_workout_exercises
                    workout_exercise_query = """
                        SELECT duration, count, exercise_id
                        FROM app_workout_exercises
                        WHERE id = $1::UUID
                        LIMIT 1
                    """
                    workout_exercise_row = await connection.fetchrow(workout_exercise_query, exercise_uuid)
                    
                    if not workout_exercise_row:
                        continue
                    
                    exercise_id = workout_exercise_row['exercise_id'] 
                    
                    # Получаем информацию об упражнении из таблицы exercises
                    exercise_info_query = """
                        SELECT muscle_group_id, title
                        FROM exercises
                        WHERE exercise_id = $1::UUID
                    """
                    exercise_info_row = await connection.fetchrow(exercise_info_query, exercise_id)
                    
                    if not exercise_info_row:
                        # Рассчитываем фактическое время выполнения упражнения
                        actual_duration_seconds = None
                        if session['datetime_start'] and session['datetime_end']:
                            duration_delta = session['datetime_end'] - session['datetime_start']
                            actual_duration_seconds = int(duration_delta.total_seconds())
                        
                        exercise_type_id = 2 if workout_exercise_row['count'] else 1
                        planned_count = workout_exercise_row['count'] if workout_exercise_row['count'] else "не указано"
                        
                        exercise_details.append({
                            'exercise_session_uuid': session['exercise_session_uuid'],
                            'workout_session_uuid': session['workout_session_uuid'],
                            'workout_uuid': workout_uuid,
                            'exercise_uuid': session['exercise_uuid'],
                            'exercise_id': exercise_id,
                            'datetime_start': session['datetime_start'],
                            'datetime_end': session['datetime_end'],
                            'status': session['status'],
                            'actual_duration_seconds': actual_duration_seconds,
                            'planned_count': planned_count,
                            'exercise_type_id': exercise_type_id,
                            'exercise_title': f'Упражнение {exercise_id}',
                            'muscle_group_id': None,
                            'muscle_group_name': 'Неизвестно'
                        })
                        continue
                        
                    muscle_group_id = exercise_info_row['muscle_group_id']
                    
                    # Получаем название группы мышц
                    muscle_group_query = """
                        SELECT name
                        FROM muscle_groups
                        WHERE id = $1
                    """
                    muscle_group_row = await connection.fetchrow(muscle_group_query, muscle_group_id)
                    
                    # Рассчитываем фактическое время выполнения упражнения
                    actual_duration_seconds = None
                    if session['datetime_start'] and session['datetime_end']:
                        duration_delta = session['datetime_end'] - session['datetime_start']
                        actual_duration_seconds = int(duration_delta.total_seconds())
                    
                    # Определяем ID типа упражнения: 1 - статическое, 2 - динамическое
                    exercise_type_id = 2 if workout_exercise_row['count'] else 1
                    planned_count = workout_exercise_row['count'] if workout_exercise_row['count'] else "не указано"
                    
                    exercise_details.append({
                        'exercise_session_uuid': session['exercise_session_uuid'],
                        'workout_session_uuid': session['workout_session_uuid'],
                        'workout_uuid': workout_uuid,
                        'exercise_uuid': session['exercise_uuid'],
                        'exercise_id': exercise_id,
                        'datetime_start': session['datetime_start'],
                        'datetime_end': session['datetime_end'],
                        'status': session['status'],
                        'actual_duration_seconds': actual_duration_seconds,
                        'planned_count': planned_count,
                        'exercise_type_id': exercise_type_id,
                        'exercise_title': exercise_info_row['title'],
                        'muscle_group_id': muscle_group_id,
                        'muscle_group_name': muscle_group_row['name'] if muscle_group_row else 'Неизвестно'
                    })
            
            # Получаем информацию о тренировках
            workout_info = {}
            if exercise_details:
                unique_workout_uuids = list(set(ex['workout_uuid'] for ex in exercise_details if ex['workout_uuid']))
                if unique_workout_uuids:
                    for workout_uuid in unique_workout_uuids:
                        workout_query = """
                            SELECT name, description
                            FROM app_workouts
                            WHERE app_workout_uuid = $1::UUID
                        """
                        workout_row = await connection.fetchrow(workout_query, workout_uuid)
                        if workout_row:
                            workout_info[workout_uuid] = {
                                'name': workout_row['name'],
                                'description': workout_row['description']
                            }
            
            # Генерируем данные для передачи в LLM
            user_data = self.generate_analysis_data(
                user_id, date_start, date_ended, 
                weights_data, activities_data, 
                exercise_details, workout_info
            )
            
            # Логируем JSON, который отправляется в нейросеть
            logger.info(f"🧠 JSON для нейросети (user_id={user_id}, уровень={response_level_id}):")
            logger.info(json.dumps(user_data, ensure_ascii=False, indent=2, cls=DecimalEncoder))
            
            # Анализируем данные через LLM
            try:
                llm_result = analyze_user_data_direct(user_data, response_level_id)
                
                # Проверяем валидацию
                if llm_result.get("validation_token") != "deepfit-ok":
                    logger.error("Валидация LLM ответа не прошла - неверный validation_token")
                    return {
                        "status": "validation_error",
                        "message": "Ошибка валидации",
                        "fact": "Ошибка валидации",
                        "advice": "Ошибка валидации"
                    }
                
                # Возвращаем результат от LLM
                return {
                    "status": "success",
                    "message": llm_result["motivation_message"],
                    "fact": llm_result["fact"],
                    "advice": llm_result["advice"]
                }
                
            except Exception as e:
                logger.error(f"Ошибка при запросе к LLM: {str(e)}")
                return {
                    "status": "llm_error",
                    "message": "Ошибка анализа",
                    "fact": "Ошибка анализа", 
                    "advice": "Ошибка анализа"
                }
            
        except Exception as e:
            logger.error(f"Ошибка при обработке данных: {str(e)}")
            
            return {
                "status": "data_error",
                "message": "Ошибка обработки данных",
                "fact": "Ошибка обработки данных", 
                "advice": "Ошибка обработки данных"
            }

    async def check_recent_stuck_tasks(self, connection):
        """Проверка на недавно зависшие задачи (timeout 2 минуты)"""
        current_time_utc = datetime.now(timezone.utc)
        
        # Исправляем SQL для корректной работы с PostgreSQL timestamp with time zone
        query = """
            SELECT neuro_generation_queue_id, daily_motivation_uuid
            FROM neuro_generation_queue
            WHERE status = 'in_progress' 
            AND ($1::TIMESTAMPTZ - datetime_started) > INTERVAL '%s minutes'
            LIMIT 3
        """ % self.recent_stuck_timeout
        
        recent_stuck = await connection.fetch(query, current_time_utc)
        
        if recent_stuck:
            logger.warning(f"⚠️ Найдено {len(recent_stuck)} недавно зависших задач")
            
            for task in recent_stuck:
                task_id = task['neuro_generation_queue_id'] 
                motivation_uuid = task['daily_motivation_uuid']
                
                # Сбрасываем в 'new'
                await connection.execute("""
                    UPDATE neuro_generation_queue
                    SET status = $1::VARCHAR,
                        datetime_started = NULL
                    WHERE neuro_generation_queue_id = $2
                """, 'new', task_id)
                
                await connection.execute("""
                    UPDATE daily_motivation
                    SET status = $1::VARCHAR,
                        updated_at = $2::TIMESTAMPTZ
                    WHERE daily_motivation_uuid = $3::UUID
                """, 'new', current_time_utc, motivation_uuid)
                
                logger.info(f"🔄 Восстановлена недавно зависшая задача {task_id}") 

    def generate_analysis_data(self, user_id: int, date_start: str, date_ended: str, 
                              weights_data: List, activities_data: List, 
                              exercise_details: List, workout_info: Dict) -> Dict:
        """Генерация структуры данных для LLM с группировкой по дням"""
        
        # Создаем словарь веса по дням
        weight_by_date = {str(w['record_date']): float(w['weight']) if isinstance(w['weight'], Decimal) else w['weight'] for w in weights_data}
        
        # Создаем словарь активности по дням  
        activity_by_date = {str(a['record_date']): a['workout_count'] for a in activities_data}
        
        # Группируем упражнения по дням и тренировочным сессиям
        sessions_by_date = defaultdict(lambda: defaultdict(list))
        
        for ex in exercise_details:
            if ex['datetime_start']:
                date = ex['datetime_start'].date().isoformat()
                workout_session_uuid = str(ex['workout_session_uuid']) if ex['workout_session_uuid'] else 'unknown'
                sessions_by_date[date][workout_session_uuid].append(ex)
        
        # Формируем дни с тренировками
        days = []
        
        for date in sorted(sessions_by_date.keys()):
            day_weight = weight_by_date.get(date)
            sessions = sessions_by_date[date]
            
            workouts = []
            for workout_session_uuid, exercises in sessions.items():
                if not exercises:
                    continue
                    
                # Берем данные о тренировке из первого упражнения
                first_exercise = exercises[0]
                workout_uuid = first_exercise['workout_uuid']
                
                # Получаем название тренировки
                workout_name = "Неизвестная тренировка"
                if workout_uuid and workout_uuid in workout_info:
                    workout_name = workout_info[workout_uuid]['name']
                
                # Формируем список упражнений для этой тренировки
                exercises_list = []
                for ex in exercises:
                    # Пропускаем упражнения длительностью более 20 минут (1200 секунд)
                    if ex['actual_duration_seconds'] is not None and ex['actual_duration_seconds'] > 1200:
                        continue
                        
                    # Определяем тип упражнения
                    exercise_type = "Динамическое" if ex['exercise_type_id'] == 2 else "Статическое"
                    
                    exercise_data = {
                        "exercise_name": ex['exercise_title'],
                        "muscle_group_name": ex['muscle_group_name'],
                        "type": exercise_type,
                        "duration_seconds": ex['actual_duration_seconds'],
                        "status": "завершено" if ex['status'] == 'ended' else ex['status'],
                        "start_time": ex['datetime_start'].isoformat() if ex['datetime_start'] else None,
                        "end_time": ex['datetime_end'].isoformat() if ex['datetime_end'] else None
                    }
                    
                    # Добавляем repetitions только если больше 0
                    if ex['planned_count'] != "не указано" and ex['planned_count'] and ex['planned_count'] > 0:
                        exercise_data["repetitions"] = ex['planned_count']
                    
                    exercises_list.append(exercise_data)
                
                # Пропускаем тренировки без упражнений (после фильтрации)
                if not exercises_list:
                    continue
                
                # Находим общее время тренировки (используем только оставшиеся упражнения)
                filtered_exercises = [ex for ex in exercises if not (ex['actual_duration_seconds'] is not None and ex['actual_duration_seconds'] > 1200)]
                start_times = [ex['datetime_start'] for ex in filtered_exercises if ex['datetime_start']]
                end_times = [ex['datetime_end'] for ex in filtered_exercises if ex['datetime_end'] and ex['status'] == 'ended']
                
                workout_start_time = min(start_times).isoformat() if start_times else None
                workout_end_time = max(end_times).isoformat() if end_times else None
                
                # Вычисляем общую длительность тренировки
                total_duration_seconds = None
                if start_times and end_times:
                    total_duration_seconds = int((max(end_times) - min(start_times)).total_seconds())
                
                workout_data = {
                    "workout_name": workout_name,
                    "start_time": workout_start_time,
                    "end_time": workout_end_time,
                    "total_duration_seconds": total_duration_seconds,
                    "exercises": exercises_list
                }
                workouts.append(workout_data)
            
            day_data = {
                "date": date,
                "weight_kg": day_weight,
                "workouts": workouts
            }
            
            # Добавляем информацию о внешних тренировках
            total_activity = activity_by_date.get(date, 0)
            app_workouts_count = len(workouts)
            external_workouts = total_activity - app_workouts_count
            
            if external_workouts > 0:
                day_data["external_workouts_note"] = f"Другие тренировки, отмеченные пользователем, выполненные не в приложении: {external_workouts} тренировки."
            
            days.append(day_data)
        
        # Добавляем дни только с весом (без тренировок)
        for w in weights_data:
            date_str = str(w['record_date'])
            if not any(day['date'] == date_str for day in days):
                day_data = {
                    "date": date_str,
                    "weight_kg": float(w['weight']) if isinstance(w['weight'], Decimal) else w['weight'],
                    "workouts": []
                }
                
                # Проверяем внешние тренировки для дней без данных в приложении
                total_activity = activity_by_date.get(date_str, 0)
                if total_activity > 0:
                    day_data["external_workouts_note"] = f"Другие тренировки, отмеченные пользователем, выполненные не в приложении: {total_activity} тренировки."
                
                days.append(day_data)
        
        # Добавляем дни только с активностью (без веса и тренировок в приложении)
        for a in activities_data:
            date_str = str(a['record_date'])
            if not any(day['date'] == date_str for day in days):
                if a['workout_count'] > 0:
                    day_data = {
                        "date": date_str,
                        "weight_kg": None,
                        "workouts": [],
                        "external_workouts_note": f"Другие тренировки, отмеченные пользователем, выполненные не в приложении: {a['workout_count']} тренировки."
                    }
                    days.append(day_data)
        
        # Сортируем дни по дате
        days.sort(key=lambda x: x['date'])
        
        # Считаем аналитику (исключаем упражнения длительностью более 20 минут)
        filtered_exercise_details = [ex for ex in exercise_details if not (ex['actual_duration_seconds'] is not None and ex['actual_duration_seconds'] > 1200)]
        
        total_exercises = len(filtered_exercise_details)
        completed_exercises = len([ex for ex in filtered_exercise_details if ex['status'] == 'ended'])
        total_exercise_time_seconds = sum(ex['actual_duration_seconds'] for ex in filtered_exercise_details 
                                        if ex['actual_duration_seconds'] is not None and ex['status'] == 'ended')
        
        # Собираем уникальные группы мышц
        muscle_groups_worked = set(ex['muscle_group_name'] for ex in filtered_exercise_details if ex['status'] == 'ended')
        
        # Формируем итоговую упрощенную структуру
        result = {
            "user_id": user_id,
            "period_start": str(date_start),
            "period_end": str(date_ended),
            "total_days": (datetime.fromisoformat(str(date_ended)) - datetime.fromisoformat(str(date_start))).days + 1,
            "days": days,
            "summary": {
                "total_exercises": total_exercises,
                "completed_exercises": completed_exercises,
                "completion_rate_percent": round((completed_exercises / total_exercises * 100) if total_exercises > 0 else 0, 1),
                "total_exercise_time_seconds": total_exercise_time_seconds,
                "unique_workouts": len(set(ex['workout_uuid'] for ex in filtered_exercise_details if ex['workout_uuid'])),
                "muscle_groups_worked": sorted(list(muscle_groups_worked)),
                "days_with_workouts": len([day for day in days if day['workouts']]),
                "weight_records": len(weights_data)
            }
        }
        
        return result 