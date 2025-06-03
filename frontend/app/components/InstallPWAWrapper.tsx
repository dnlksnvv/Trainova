import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import InstallPWA from './InstallPWA';

// Глобальное состояние для отслеживания показа уведомления
let isNotificationShown = false;

const InstallPWAWrapper: React.FC = () => {
  const router = useRouter();
  const [location, setLocation] = useState<'welcome' | 'settings' | null>(null);
  const [showPWA, setShowPWA] = useState(false);
  
  // Проверка закрытия уведомления
  const wasClosed = typeof window !== 'undefined' && localStorage.getItem('installPwaClosed_v3') === 'true';
  
  useEffect(() => {
    // Если уведомление было закрыто ранее, не показываем его
    if (wasClosed) return;
    
    // Если уведомление уже показано, не дублируем
    if (isNotificationShown) return;
    
    if (!router.isReady) return;
    
    // Явно исключаем страницу профиля
    if (router.pathname.includes('/profile')) {
      return;
    }
    
    let currentLocation: 'welcome' | 'settings' | null = null;
    
    // Определяем текущую страницу
    if (router.pathname === '/welcome' || router.pathname === '/' || router.pathname === '' || router.pathname === '/home') {
      currentLocation = 'welcome';
    } else if (router.pathname === '/settings' || router.pathname.includes('/settings')) {
      // Дополнительная проверка на профиль
      if (!router.pathname.includes('/profile')) {
        currentLocation = 'settings';
      }
    }
    
    // Если находимся на нужной странице и уведомление еще не показано
    if (currentLocation && !isNotificationShown) {
      setLocation(currentLocation);
      setShowPWA(true);
      isNotificationShown = true; // Отмечаем, что уведомление показано
    }
  }, [router.isReady, router.pathname, wasClosed]);
  
  // Обработчик закрытия
  const handleClose = () => {
    setShowPWA(false);
    isNotificationShown = false; // Сбрасываем флаг
    
    // Сохраняем информацию о закрытии
    if (typeof window !== 'undefined') {
      localStorage.setItem('installPwaClosed_v3', 'true');
      
      // Дополнительная очистка DOM через небольшую задержку
      setTimeout(() => {
        // Проверяем наличие элементов с z-index: 1300 и удаляем их
        const pwaOverlays = document.querySelectorAll('[style*="z-index: 1300"]');
        pwaOverlays.forEach(overlay => {
          if (overlay.parentNode && 
              !overlay.classList.contains('MuiDialog-root') && // Не удаляем диалоги
              !overlay.classList.contains('search-bar-component')) { // Не удаляем SearchBar
            overlay.parentNode.removeChild(overlay);
          }
        });
      }, 500);
    }
  };
  
  // Если не нужно показывать или не определили страницу
  if (!showPWA || !location) return null;
  
  return <InstallPWA location={location} onClose={handleClose} />;
};

export default InstallPWAWrapper; 