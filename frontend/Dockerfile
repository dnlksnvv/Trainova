FROM node:20-alpine

# Установка рабочей директории
WORKDIR /app

# Копирование файлов package.json и package-lock.json
COPY package.json package-lock.json ./

# Установка зависимостей с флагом --legacy-peer-deps
RUN npm ci --legacy-peer-deps

# Копирование остальных файлов проекта
COPY . .

# Сборка приложения
RUN npm run build

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "run", "start"] 