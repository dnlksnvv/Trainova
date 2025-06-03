// "use client";

import { Metadata } from "next";
import { Lato } from "next/font/google";
import "./globals.css";
import ThemeRegistry from "./ThemeRegistry";
import { Providers } from "./providers";
import Script from 'next/script';
import YandexMetrikaTracker from './components/YandexMetrikaTracker';

// Импортируем Lato из next/font/google
const lato = Lato({
  weight: ["100", "300", "400", "700", "900"],
  subsets: ["latin"],
  variable: "--font-lato",
});

// Скрипт для инъекции трекера в iframe
const injectTrackerScript = `
  // Мы больше не используем трекер видео
`;

// Скрипт для регистрации сервис-воркера
const registerServiceWorker = `
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js').then(
        function(registration) {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        },
        function(err) {
          console.log('ServiceWorker registration failed: ', err);
        }
      );
    });
  }
`;

// Скрипт для предотвращения масштабирования на iOS при фокусе на поля ввода
const preventIOSZoom = `
  // Предотвращаем масштабирование на iOS только при фокусе на поля ввода
  (function() {
    // Сохраняем оригинальный контент viewport
    let originalViewport = '';
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      originalViewport = viewportMeta.content;
    }

    // Устанавливаем жесткий запрет на масштабирование для всех полей ввода
    const allInputs = document.querySelectorAll('input, textarea, select');
    allInputs.forEach(input => {
      input.style.fontSize = '16px';
    });

    // При фокусе на поле ввода
    document.addEventListener('focusin', function(event) {
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT') {
        // Устанавливаем viewport, запрещающий масштабирование
        if (viewportMeta) {
          viewportMeta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0';
        }
        
        // Дополнительно устанавливаем размер шрифта для конкретного элемента
        event.target.style.fontSize = '16px';
      }
    }, true);

    // При потере фокуса возвращаем исходный viewport
    document.addEventListener('focusout', function(event) {
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT') {
        // Возвращаем оригинальный viewport
        if (viewportMeta && originalViewport) {
          setTimeout(function() {
            viewportMeta.content = originalViewport;
          }, 300); // Небольшая задержка для iOS
        }
      }
    }, true);
    
    // Предотвращаем двойной тап для масштабирования
    document.addEventListener('touchend', function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        e.preventDefault();
        e.target.focus();
      }
    }, false);
  })();
`;

// Определяем метаданные приложения
export const metadata: Metadata = {
  title: "Trainova App",
  description: "Trainova - платформа для тренировок",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <meta name="emotion-insertion-point" content="" />
        <meta name="application-name" content="Trainova" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Trainova" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#2a2a2a" />
        <meta name="msapplication-navbutton-color" content="#3a3a3a" />
        <meta name="msapplication-TileColor" content="#3a3a3a" />
        <meta name="msapplication-starturl" content="/" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        {/* Удалён скрипт video-tracker.js */}
        {/* Удалена инъекция скрипта трекера */}
        {/* Регистрация сервис-воркера */}
        <script dangerouslySetInnerHTML={{ __html: registerServiceWorker }} />
        {/* Предотвращение масштабирования на iOS */}
        <script dangerouslySetInnerHTML={{ __html: preventIOSZoom }} />
        
        {/* Яндекс Метрика */}
        <script dangerouslySetInnerHTML={{
          __html: `
            (function(m,e,t,r,i,k,a){
              m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for (var j = 0; j < document.scripts.length; j++) {
                if (document.scripts[j].src === r) { return; }
              }
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
            })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

            ym(102273732, "init", {
              clickmap:true,
              trackLinks:true,
              accurateTrackBounce:true,
              webvisor:true
            });
          `
        }} />
        
        {/* NoScript версия Яндекс Метрики */}
        <noscript>
          <div>
            <img src="https://mc.yandex.ru/watch/102273732" style={{position:'absolute', left:'-9999px'}} alt="" />
          </div>
        </noscript>
        
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Предотвращаем смещение элементов при работе с поиском на iOS
              document.addEventListener('DOMContentLoaded', function() {
                // Сохраняем оригинальную высоту viewport
                let originalHeight = window.innerHeight;
                
                // Функция для обработки изменений размера окна
                function handleResize() {
                  // Если высота окна уменьшилась (клавиатура открылась)
                  if (window.innerHeight < originalHeight) {
                    // Ничего не делаем, позволяем клавиатуре появиться нормально
                  } else {
                    // Если высота вернулась к оригинальной (клавиатура закрылась)
                    originalHeight = window.innerHeight;
                    
                    // Небольшая задержка для стабилизации интерфейса
                    setTimeout(function() {
                      window.scrollTo(0, 0);
                    }, 100);
                  }
                }
                
                // Добавляем обработчик изменения размера окна
                window.addEventListener('resize', handleResize);
                
                // Обработчик для полей ввода
                document.addEventListener('focusin', function(e) {
                  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                    // Сохраняем текущую позицию прокрутки
                    const scrollY = window.scrollY;
                    
                    // Предотвращаем автоматическую прокрутку браузера
                    setTimeout(function() {
                      window.scrollTo(0, scrollY);
                    }, 50);
                  }
                });
                
                // Обработчик для потери фокуса с полей ввода
                document.addEventListener('focusout', function(e) {
                  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                    // Небольшая задержка для стабилизации интерфейса
                    setTimeout(function() {
                      window.scrollTo(0, 0);
                    }, 100);
                  }
                });
              });
            `,
          }}
        />
      </head>
      <body>
        {/* Подключаем MUI-тему, Emotion Cache и провайдеры */}
        <ThemeRegistry>
          <Providers>
            {/* Удаляем VideoPlayerProvider и GlobalVideoPlayer */}
            {children}
          </Providers>
        </ThemeRegistry>
        <YandexMetrikaTracker />
      </body>
    </html>
  );
}