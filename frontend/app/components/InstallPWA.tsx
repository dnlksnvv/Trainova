import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, IconButton, useTheme, Fade, Slide } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import GetAppIcon from '@mui/icons-material/GetApp';

// Интерфейс события beforeinstallprompt
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallPWAProps {
  location?: 'welcome' | 'settings';
  onClose?: () => void;
}

// Глобальная переменная для хранения события установки
let deferredPrompt: BeforeInstallPromptEvent | null = null;

// Проверка, установлено ли приложение
const isAppInstalled = (): boolean => {
  // Проверка режима отображения
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  // Проверка для iOS
  const isIOSStandalone = Boolean(
    (window.navigator as any).standalone || 
    window.location.href.includes('homescreen=1')
  );
  
  // Проверка localStorage (если приложение ранее было установлено)
  const wasInstalled = localStorage.getItem('pwa_installed') === 'true';
  
  return isStandalone || isIOSStandalone || wasInstalled;
};

const InstallPWA: React.FC<InstallPWAProps> = ({ location = 'welcome', onClose }) => {
  const theme = useTheme();
  // По умолчанию не показываем
  const [isVisible, setIsVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  
  // Глобальный обработчик события beforeinstallprompt
  useEffect(() => {
    // Сразу проверяем, установлено ли приложение
    if (isAppInstalled()) {
      console.log('Приложение уже установлено, скрываем уведомление');
      return; // Не показываем уведомление, если приложение установлено
    }
    
    const handleBeforeInstallPrompt = (e: Event) => {
      // Предотвращаем стандартное поведение
      e.preventDefault();
      
      // Проверяем еще раз, не установлено ли приложение
      if (isAppInstalled()) {
        return;
      }
      
      // Сохраняем событие для использования позже
      deferredPrompt = e as BeforeInstallPromptEvent;
      
      // Устанавливаем флаг, что приложение можно установить
      setCanInstall(true);
      
      // Показываем уведомление только если можно установить
      setIsVisible(true);
      
      console.log('Событие beforeinstallprompt перехвачено!', e);
    };
    
    // Добавляем глобальный обработчик
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Слушаем событие appinstalled
    const handleAppInstalled = () => {
      console.log('Приложение успешно установлено!');
      localStorage.setItem('pwa_installed', 'true');
      setIsVisible(false);
    };
    
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);
  
  // Обработчик установки приложения
  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      console.log('Событие установки недоступно');
      alert('Для установки приложения используйте функцию "Добавить на главный экран" в меню вашего браузера');
      return;
    }
    
    // Показываем диалог установки
    try {
      console.log('Запускаем установку PWA');
      deferredPrompt.prompt();
      
      // Ждем результат выбора пользователя
      const choiceResult = await deferredPrompt.userChoice;
      console.log('Результат установки:', choiceResult.outcome);
      
      // Сбрасываем событие установки, так как его можно использовать только один раз
      deferredPrompt = null;
      setCanInstall(false);
      
      if (choiceResult.outcome === 'accepted') {
        console.log('Приложение успешно установлено');
        
        // Сохраняем информацию об установке
        localStorage.setItem('pwa_installed', 'true');
        
        handleCloseWithAnimation();
      }
    } catch (error) {
      console.error('Ошибка при установке:', error);
    }
  };
  
  // Плавное закрытие с анимацией
  const handleCloseWithAnimation = () => {
    setExiting(true);
    
    // Задержка для анимации
    setTimeout(() => {
      setIsVisible(false);
      if (onClose) {
        onClose();
      }
    }, 300);
  };
  
  if (!isVisible) {
    return null;
  }
  
  // Определяем позицию в зависимости от страницы
  const positionStyles = location === 'welcome' 
    ? { top: 16 } 
    : { top: 70 }; // Позиция для страницы настроек - между верхом и блоком
  
  return (
    <Fade in={isVisible && !exiting} timeout={{ enter: 600, exit: 300 }} unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          ...positionStyles,
          left: 0,
          right: 0,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1300,
          pointerEvents: 'none', // Блок не перехватывает клики
        }}
      >
        <Slide direction="down" in={isVisible && !exiting} timeout={{ enter: 500, exit: 300 }}>
          <Paper
            elevation={2}
            sx={{
              width: 'auto',
              maxWidth: '360px',
              backgroundColor: theme.palette.backgrounds?.paper,
              borderRadius: 100,
              boxShadow: theme.customShadows.medium,
              p: 0.8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              pointerEvents: 'auto', // Только сама карточка перехватывает клики
            }}
          >
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center',
              ml: 1
            }}>
              <GetAppIcon 
                sx={{ 
                  color: theme.palette.highlight?.main,
                  fontSize: 22,
                  mr: 1
                }}
              />
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 500,
                  fontSize: '0.9rem'
                }}
              >
                Установить приложение
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Button
                size="small"
                variant="contained"
                onClick={handleInstallClick}
                disableElevation
                sx={{
                  mr: 0.5,
                  ml: 1,
                  backgroundColor: theme.palette.highlight?.main,
                  borderRadius: 20,
                  fontSize: '0.75rem',
                  px: 1.5,
                  py: 0.5,
                  minWidth: 'auto',
                  height: 28,
                  '&:hover': {
                    backgroundColor: theme.palette.highlight?.accent,
                  },
                  textTransform: 'none',
                }}
              >
                Установить
              </Button>
              <IconButton 
                size="small" 
                onClick={handleCloseWithAnimation}
                sx={{ 
                  color: theme.palette.textColors?.secondary,
                  p: 0.5,
                  width: 24,
                  height: 24,
                  mr: 0.5
                }}
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Paper>
        </Slide>
      </Box>
    </Fade>
  );
};

export default InstallPWA; 