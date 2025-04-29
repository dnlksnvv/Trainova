#!/bin/bash
set -e

VENV_DIR="venv"
REQUIREMENTS_FILE="requirements.txt"

# Проверка наличия Python
if ! command -v python3 &> /dev/null; then
    echo "Python не установлен. Установите Python 3.x"
    exit 1
fi

# Создание виртуальной среды, если она не существует
if [ ! -d "$VENV_DIR" ]; then
    echo "Создание виртуальной среды..."
    python3 -m venv $VENV_DIR
    echo "Виртуальная среда создана."
fi

# Активация виртуальной среды
echo "Активация виртуальной среды..."
source $VENV_DIR/bin/activate

# Установка зависимостей
echo "Установка зависимостей..."
pip install -U pip
pip install -r $REQUIREMENTS_FILE

# Запуск приложения
echo "Запуск Trainova Training Service API..."
# Запускаем main.py напрямую, который использует настройки из config.py
python main.py

# Деактивация виртуальной среды при выходе
deactivate
