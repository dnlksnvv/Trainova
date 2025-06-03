/** @type {import('next').NextConfig} */

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // Оптимизация сервис-воркера
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 365 * 24 * 60 * 60 // 1 год
        }
      }
    },
    {
      urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-font-assets',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 7 * 24 * 60 * 60 // 1 неделя
        }
      }
    },
    {
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-image-assets',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60 // 24 часа
        }
      }
    },
    {
      urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'next-data',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60 // 24 часа
        }
      }
    },
    {
      urlPattern: /\/_next\/static\/.+\.js$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'static-js-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60 // 24 часа
        }
      }
    }
  ]
});

const nextConfig = {
  eslint: {
    // Игнорируем ошибки ESLint во время сборки
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Игнорируем ошибки TypeScript во время сборки
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['localhost', 'via.placeholder.com'],
  },
  // Оптимизация загрузки страниц
  reactStrictMode: true,
  // Удаляем устаревший параметр swcMinify
  poweredByHeader: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
  },
  // Добавляем переменные окружения для API
  env: {
    API_URL: '',
    AUTH_API_PREFIX: '/api/auth',
    PROFILE_API_PREFIX: '/api/profile',
    WORKOUT_API_PREFIX: '/api/workout',
    COURSE_API_PREFIX: '/api/course',
    MOTIVATION_API_PREFIX: '/api/motivation'
  }
};

module.exports = withPWA(nextConfig); 