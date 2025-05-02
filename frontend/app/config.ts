// Файл конфигурации для переменных окружения
const config = {
  // API prefixes
  authApiPrefix: process.env.NEXT_PUBLIC_AUTH_API_PREFIX || '/api/auth',
  workoutApiPrefix: process.env.NEXT_PUBLIC_WORKOUT_API_PREFIX || '/api/workout',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || '',
  
  // Другие переменные окружения можно добавить здесь
};

export default config; 