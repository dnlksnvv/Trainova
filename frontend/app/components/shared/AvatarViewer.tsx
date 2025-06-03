"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "@mui/material/styles";
import { 
  Box, 
  Modal, 
  Backdrop
} from "@mui/material";

interface AvatarViewerProps {
  avatarUrl?: string | null;
  initials?: string;
  isOpen: boolean;
  onClose: () => void;
  size?: number;
}

/**
 * Компонент для полноэкранного просмотра аватарки с плавной анимацией
 */
const AvatarViewer: React.FC<AvatarViewerProps> = ({ 
  avatarUrl, 
  initials = "", 
  isOpen, 
  onClose,
  size = 200 
}) => {
  const theme = useTheme();
  const [animationState, setAnimationState] = useState<'initial' | 'open' | 'closing'>('initial');
  
  // Управление состоянием анимации
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (isOpen && animationState === 'initial') {
      // Установить таймаут для плавного открытия
      timer = setTimeout(() => {
        setAnimationState('open');
      }, 20);
    } else if (!isOpen && animationState !== 'initial') {
      // Сбросить в начальное состояние, когда модальное окно закрыто
      setAnimationState('initial');
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, animationState]);
  
  // Обработчик закрытия
  const handleClose = () => {
    // Сначала меняем состояние на "закрывается"
    setAnimationState('closing');
    
    // Затем через timeout вызываем onClose
    setTimeout(() => {
      onClose();
    }, 150);
  };

  // Определяем стили в зависимости от состояния анимации
  const isVisible = animationState === 'open';
  const isClosing = animationState === 'closing';

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      closeAfterTransition
      slots={{ backdrop: Backdrop }}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            opacity: isVisible ? 1 : isClosing ? 0 : 0,
            transition: 'opacity 0.18s ease-out',
          }
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          outline: 'none',
          userSelect: 'none',
        }}
        onClick={handleClose}
      >
        <Box
          sx={{
            position: 'relative',
            width: isVisible ? size : 60,
            height: isVisible ? size : 60,
            opacity: isVisible ? 1 : isClosing ? 0 : 0,
            transform: isVisible 
              ? 'scale(1)' 
              : 'scale(0.2)',
            transition: `all 0.18s ease-out`,
          }}
        >
          <Box
            sx={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              overflow: 'hidden',
              boxShadow: isVisible
                ? `0 0 0 3px ${theme.palette.highlight?.main}, 0 0 30px 5px rgba(0,0,0,0.6)`
                : 'none',
              transition: 'box-shadow 0.18s ease-out',
              backgroundColor: theme.palette.backgrounds?.default,
              backgroundImage: avatarUrl ? `url(${avatarUrl})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: size * 0.4,
              fontWeight: 'bold',
              color: theme.palette.textColors?.primary,
            }}
          >
            {!avatarUrl && initials}
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};

export default AvatarViewer; 