FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --legacy-peer-deps

COPY . .

ARG AUTH_API_PREFIX=$AUTH_API_PREFIX
ARG WORKOUT_API_PREFIX=$AUTH_API_PREFIX
ARG API_URL=$WORKOUT_API_PREFIX

RUN echo "AUTH_API_PREFIX=$AUTH_API_PREFIX" > .env.local && \
    echo "WORKOUT_API_PREFIX=$WORKOUT_API_PREFIX" >> .env.local && \
    echo "API_URL=$API_URL" >> .env.local

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"] 