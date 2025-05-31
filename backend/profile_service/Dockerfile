FROM python:3.11-slim

WORKDIR /app

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Копирование файла зависимостей
COPY requirements.txt .

# Установка Python зависимостей
RUN pip install --no-cache-dir -r requirements.txt

# Копирование кода приложения
COPY . .

# Создание директории для аватаров
RUN mkdir -p /app/uploads/avatars

# Открытие порта
EXPOSE 8030

# Команда запуска
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8030"] 