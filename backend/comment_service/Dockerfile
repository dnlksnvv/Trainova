FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Переменные окружения
ENV APP_NAME="Comment Service"
ENV DB_HOST="postgres"
ENV DB_PORT=5432
ENV DB_NAME="trainova"
ENV DB_USER="postgres"
ENV DB_PASSWORD="postgres"

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"] 