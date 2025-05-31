#!/bin/bash

# Проверяем наличие Python 3.11
if ! command -v python3.11 &> /dev/null; then
    echo "Python 3.11 не установлен. Пожалуйста, установите Python 3.11"
    exit 1
fi

# Создаем виртуальное окружение, если его нет
if [ ! -d "venv" ]; then
    echo "Создаем виртуальное окружение..."
    python3.11 -m venv venv
fi

# Активируем виртуальное окружение
source venv/bin/activate

# Устанавливаем зависимости
echo "Устанавливаем зависимости..."
pip install -r requirements.txt



# Запускаем сервис
echo "Запускаем Profile Service..."
uvicorn main:app --host 0.0.0.0 --port 8005 --reload 