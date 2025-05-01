FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Создаем директорию для хранения GIF-файлов и устанавливаем правильные права доступа (будем монтироваться из volumes) 
RUN mkdir -p /app/exercises_content

# Создаем пользователя без прав root
RUN adduser --disabled-password --gecos '' appuser

RUN chown -R appuser:appuser /app/exercises_content && \
    chmod -R 777 /app/exercises_content

USER appuser

ENV PYTHONPATH=/app

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"] 