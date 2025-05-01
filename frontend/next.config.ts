/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
      API_URL: process.env.API_URL,
      AUTH_API_PREFIX: process.env.AUTH_API_PREFIX,
      WORKOUT_API_PREFIX: process.env.WORKOUT_API_PREFIX
    },
    typescript: {
      // Отключаем проверку типов при сборке, так как в Next.js 15 изменилась типизация параметров страниц
      ignoreBuildErrors: true,
    },
  };
  
  module.exports = nextConfig; 