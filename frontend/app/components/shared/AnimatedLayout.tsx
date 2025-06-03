"use client";

import React, { useState, useEffect, useRef } from "react";
import { Box } from "@mui/material";

interface AnimatedLayoutProps {
  children: React.ReactNode;
  duration?: number;
  distance?: number;
  delay?: number;
}

/**
 * Компонент AnimatedLayout оборачивает контент страницы
 * и добавляет эффект плавного появления при загрузке страницы
 */
const AnimatedLayout: React.FC<AnimatedLayoutProps> = ({ 
  children, 
  duration = 350, 
  distance = 15,
  delay = 50
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const mountedRef = useRef(false);
  
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      
      // Используем requestAnimationFrame для синхронизации с обновлением экрана
      requestAnimationFrame(() => {
        // Небольшая задержка для обеспечения плавности
        setTimeout(() => {
          setIsVisible(true);
        }, delay);
      });
    }
    
    return () => {
      mountedRef.current = false;
    };
  }, [delay]);
  
  return (
    <Box
      sx={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : `translateY(${distance}px)`,
        transition: `opacity ${duration/1000}s ease-out, transform ${duration/1000}s ease-out`,
        width: '100%',
        height: '100%',
        willChange: 'opacity, transform', // Подсказка браузеру для оптимизации анимации
        isolation: 'isolate', // Создаем новый контекст наложения для лучшей производительности
      }}
    >
      {children}
    </Box>
  );
};

export default AnimatedLayout; 