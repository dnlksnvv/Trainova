#!/bin/bash

# Скрипт запуска course service

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Запуск Trainova Comment Service ===${NC}"

# Проверка наличия Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python3 не найден. Пожалуйста, установите Python3.${NC}"
    exit 1
fi

# Создание виртуального окружения, если его нет
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Виртуальное окружение не найдено. Создание...${NC}"
    python3 -m venv venv
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Ошибка при создании виртуального окружения${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Виртуальное окружение создано успешно${NC}"
fi

# Активация виртуального окружения
echo -e "${YELLOW}Активация виртуального окружения...${NC}"
source venv/bin/activate

if [ $? -ne 0 ]; then
    echo -e "${RED}Ошибка при активации виртуального окружения${NC}"
    exit 1
fi

# Проверка и установка зависимостей
if [ -f "requirements.txt" ]; then
    echo -e "${BLUE}Проверка зависимостей...${NC}"
    
    # Проверяем, установлены ли основные зависимости
    if ! pip show fastapi uvicorn &> /dev/null; then
        echo -e "${YELLOW}Установка зависимостей из requirements.txt...${NC}"
        pip install --upgrade pip
        pip install -r requirements.txt
        
        if [ $? -ne 0 ]; then
            echo -e "${RED}Ошибка при установке зависимостей${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}Зависимости установлены успешно${NC}"
    else
        echo -e "${GREEN}Зависимости уже установлены${NC}"
    fi
else
    echo -e "${YELLOW}Файл requirements.txt не найден, пропуск установки зависимостей...${NC}"
fi

# Запуск приложения
echo -e "${GREEN}Запуск Course Comment на порту 8009...${NC}"
echo -e "${BLUE}Сервис будет доступен по адресу: http://localhost:8009${NC}"
echo -e "${YELLOW}Для остановки нажмите Ctrl+C${NC}"
echo ""

uvicorn main:app --host 0.0.0.0 --port 8009 --reload 