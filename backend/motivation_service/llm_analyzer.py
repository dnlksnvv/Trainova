import json
import requests
from pathlib import Path
import logging
from config import settings
import prompts_lvls

logger = logging.getLogger(__name__)

API_KEY = settings.API_KEY
API_URL = settings.API_URL
MODEL = settings.MODEL


def generate_prompt_and_messages(data, response_level_id=1):
    """Генерация промпта и сообщений для LLM в зависимости от уровня жёсткости"""
    prompt = prompts_lvls.get_prompt_for_level(response_level_id, data)
    
    # ✅ ВСТАВКА: если тренировок вообще нет
    if all(len(day.get("workouts", [])) == 0 and "external_workouts_note" not in day for day in data.get("days", [])):
        prompt.append(
            "\n‼️ Если нет вообще ни одной тренировки и ни одного external_workouts_note — верни строго такой JSON:"
            """{
  "period_start": "...",
  "period_end": "...",
  "fact": "Тренировок нет.",
  "motivation_message": "Пора начинать тренировки.",
  "advice": "...",
  "validation_token": "deepfit-ok"
}"""
        )

    prompt.append("")
    prompt.append("Вот данные пользователя:")
    prompt.append(json.dumps(data, ensure_ascii=False, indent=2))
    
    # Получаем сообщения для указанного уровня
    messages = prompts_lvls.get_messages_for_level(response_level_id, prompt)
    
    return messages


def get_insight(data, response_level_id=1):
    """Получение анализа от LLM с учётом уровня жёсткости"""
    messages = generate_prompt_and_messages(data, response_level_id)

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": MODEL,
        "messages": messages,
        "temperature": 0.85,
        "max_tokens": 500
    }

    response = requests.post(API_URL, headers=headers, json=payload)
    response.raise_for_status()
    content = response.json()['choices'][0]['message']['content'].strip()

    # Очистка от markdown-обёртки
    if content.startswith("```json"):
        content = content.removeprefix("```json").removesuffix("```").strip()
    elif content.startswith("```"):
        content = content.removeprefix("```").removesuffix("```").strip()

    try:
        parsed = json.loads(content)
        required_keys = {"period_start", "period_end", "fact", "motivation_message", "advice", "validation_token"}
        assert parsed.get("validation_token") == "deepfit-ok"
        assert required_keys.issubset(parsed)
        return parsed
    except Exception as e:
        raise ValueError(f"Ошибка разбора JSON: {e}\nОтвет: {content}")


def analyze_user_data_direct(user_data_dict, response_level_id=1):
    """Оптимизированная функция для анализа данных пользователя (прямая передача данных)"""
    try:
        result = get_insight(user_data_dict, response_level_id)
        logger.info(f"Успешно получен анализ от LLM (прямая передача, уровень жёсткости: {response_level_id})")
        return result
    except Exception as e:
        logger.error(f"Ошибка при анализе данных (прямая передача): {str(e)}")
        raise