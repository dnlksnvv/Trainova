'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Декларируем глобальный объект ym
declare global {
  interface Window {
    ym: (counterId: number, method: string, ...params: any[]) => void;
  }
}

const YANDEX_METRIKA_ID = 102273732;

export function useYandexMetrika() {
  const pathname = usePathname();

  useEffect(() => {
    // Безопасное получение search params без useSearchParams
    const getSearchParams = () => {
      if (typeof window !== 'undefined') {
        return window.location.search;
      }
      return '';
    };

    // Формируем полный URL для отслеживания
    const searchParams = getSearchParams();
    const url = pathname + searchParams;
    
    // Отправляем данные о просмотре страницы
    if (typeof window !== 'undefined' && window.ym) {
      window.ym(YANDEX_METRIKA_ID, 'hit', url);
      console.log(`📊 Яндекс Метрика: просмотр страницы ${url}`);
    } else {
      // Если ym еще не загружен, ждем и пытаемся снова
      const timer = setTimeout(() => {
        if (window.ym) {
          window.ym(YANDEX_METRIKA_ID, 'hit', url);
          console.log(`📊 Яндекс Метрика: просмотр страницы ${url} (отложенно)`);
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [pathname]); // Убираем searchParams из зависимостей

  // Возвращаем методы для ручной отправки событий
  return {
    // Отправка цели
    goal: (target: string, params?: Record<string, any>) => {
      if (typeof window !== 'undefined' && window.ym) {
        window.ym(YANDEX_METRIKA_ID, 'reachGoal', target, params);
        console.log(`🎯 Яндекс Метрика: цель ${target}`, params);
      }
    },

    // Отправка события просмотра страницы вручную
    pageView: (url?: string) => {
      if (typeof window !== 'undefined' && window.ym) {
        window.ym(YANDEX_METRIKA_ID, 'hit', url || pathname);
        console.log(`📄 Яндекс Метрика: ручной просмотр ${url || pathname}`);
      }
    },

    // Отправка пользовательских параметров
    setUserParams: (params: Record<string, any>) => {
      if (typeof window !== 'undefined' && window.ym) {
        window.ym(YANDEX_METRIKA_ID, 'userParams', params);
        console.log(`👤 Яндекс Метрика: пользовательские параметры`, params);
      }
    },

    // Отправка параметров визита
    setVisitParams: (params: Record<string, any>) => {
      if (typeof window !== 'undefined' && window.ym) {
        window.ym(YANDEX_METRIKA_ID, 'params', params);
        console.log(`🔍 Яндекс Метрика: параметры визита`, params);
      }
    }
  };
} 