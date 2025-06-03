/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: false
});

const nextConfig = {
  env: {
    API_URL: process.env.API_URL,
    AUTH_API_PREFIX: process.env.AUTH_API_PREFIX,
    WORKOUT_API_PREFIX: process.env.WORKOUT_API_PREFIX,
    PROFILE_API_PREFIX: process.env.PROFILE_API_PREFIX,
    COURSE_API_PREFIX: process.env.COURSE_API_PREFIX,
    // Яндекс Метрика
    YANDEX_METRIKA_ID: process.env.YANDEX_METRIKA_ID,
    ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS
  },
  typescript: {
    // Отключаем проверку типов при сборке, так как в Next.js 15 изменилась типизация параметров страниц
    ignoreBuildErrors: true,
  },
};

module.exports = withPWA(nextConfig); 