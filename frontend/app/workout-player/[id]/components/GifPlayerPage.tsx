"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { Box, IconButton, Typography, LinearProgress, CircularProgress } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';

interface GifPlayerPageProps {
  gifUrl: string;
  autoPlay?: boolean;
  isPaused?: boolean;
  isCountdownActive?: boolean;
  onLoad?: () => void;
  onError?: (error: string) => void;
  onFrameComplete?: () => void;
  onFrameChange?: (currentFrame: number, totalFrames: number) => void;
}

interface GifFrame {
  imageData: ImageData;
  delay: number;
}

export default function GifPlayerPage({
  gifUrl,
  autoPlay = true,
  isPaused = false,
  isCountdownActive = false,
  onLoad,
  onError,
  onFrameComplete,
  onFrameChange
}: GifPlayerPageProps) {
  const [frames, setFrames] = useState<GifFrame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalFrames, setTotalFrames] = useState(0);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 300, height: 300 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationTimerRef = useRef<number | null>(null);
  const urlRef = useRef<string | null>(null);
  const initializedRef = useRef<boolean>(false);
  const completedCycleRef = useRef<boolean>(false);
  const lastFrameTimeRef = useRef<number>(0);
  const animationFrameIdRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(!isPaused);

  // Обработчик завершения цикла GIF - мемоизируем для предотвращения лишних ререндеров
  const handleCycleComplete = useCallback(() => {
    if (onFrameComplete && !completedCycleRef.current) {
      completedCycleRef.current = true;
      console.log('GifPlayerPage: Завершен полный цикл анимации');
      
      // Вызываем callback только если GIF не на паузе и прошло достаточно времени
      // с момента начала воспроизведения (минимум 500мс)
      if (!isPaused && Date.now() - lastFrameTimeRef.current > 500) {
        onFrameComplete();
      }
    }
  }, [onFrameComplete, isPaused]);

  // Эффект для отслеживания изменения currentFrameIndex и вызова onFrameChange
  useEffect(() => {
    if (onFrameChange && totalFrames > 0) {
      // Сразу передаем информацию о текущем кадре в родительский компонент
      onFrameChange(currentFrameIndex, totalFrames);
    }
    
    // Сброс флага completedCycle когда индекс кадра не последний
    if (totalFrames > 0 && currentFrameIndex < totalFrames - 1) {
      completedCycleRef.current = false;
    }
    
    // Если это последний кадр - вызываем handleCycleComplete
    // Но только если анимация проиграла несколько секунд (предотвращает быстрый счет при загрузке)
    if (totalFrames > 0 && currentFrameIndex === totalFrames - 1) {
      // Добавляем таймер, чтобы избежать слишком быстрого подсчета при начальной загрузке
      const timeElapsed = Date.now() - lastFrameTimeRef.current;
      
      // Только если прошло достаточно времени от начала анимации до последнего кадра
      if (timeElapsed > 500 && !completedCycleRef.current) {
        handleCycleComplete();
      }
    }
  }, [currentFrameIndex, totalFrames, onFrameChange, handleCycleComplete]);

  // Синхронизация с внешним состоянием isPaused и isCountdownActive
  useEffect(() => {
    // Если активен отсчет - всегда останавливаем воспроизведение
    // Иначе используем значение isPaused
    const shouldPlay = !isPaused && !isCountdownActive;
    setIsPlaying(shouldPlay);
    isPlayingRef.current = shouldPlay;
  }, [isPaused, isCountdownActive]);

  // Анимация GIF - обновляем условие для запуска анимации
  useEffect(() => {
    // Не запускаем анимацию, если нет кадров или если анимация должна быть на паузе или активен отсчет
    if (!frames.length || !isPlaying) return;
    
    let startTime = 0;
    let lastFrameTime = lastFrameTimeRef.current;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - lastFrameTime;
      
      // Проверяем актуальное состояние isPlayingRef перед обновлением кадра
      if (isPlayingRef.current && frames.length > 0) {
        const currentFrame = frames[currentFrameIndex];
        
        if (elapsed > currentFrame.delay) {
          lastFrameTime = timestamp;
          lastFrameTimeRef.current = timestamp;
          
          // Перед изменением индекса кадра, передаем текущий индекс в родительский компонент
          if (onFrameChange && totalFrames > 0) {
            onFrameChange(currentFrameIndex, totalFrames);
          }
          
          const nextIndex = (currentFrameIndex + 1) % totalFrames;
          setCurrentFrameIndex(nextIndex);
        }
        
        animationFrameIdRef.current = requestAnimationFrame(animate);
      }
    };
    
    animationFrameIdRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [frames, isPlaying, currentFrameIndex, totalFrames, onFrameChange]);

  // Загрузка и обработка GIF
  useEffect(() => {
    // Если URL тот же, не перезагружаем
    if (gifUrl === urlRef.current) return;
    
    // Сбрасываем состояние при смене URL
    if (urlRef.current) {
      setCurrentFrameIndex(0);
      initializedRef.current = false;
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }
    }
    
    urlRef.current = gifUrl;
    
    const extractFrames = async () => {
      try {
        setLoading(true);
        setError(null);
        setFrames([]);
        
        // Создаем временный canvas, если его еще нет
        if (!tempCanvasRef.current) {
          tempCanvasRef.current = document.createElement('canvas');
          tempCanvasRef.current.style.display = 'none';
          document.body.appendChild(tempCanvasRef.current);
        }
        
        // Загружаем GIF
        console.log('Загружаем GIF из URL:', gifUrl);
        const response = await fetch(gifUrl);
        if (!response.ok) {
          throw new Error(`Не удалось загрузить GIF: ${response.statusText}`);
        }
        
        const buffer = await response.arrayBuffer();
        console.log('GIF загружен, размер буфера:', buffer.byteLength);
        const gif = parseGIF(buffer);
        const decompressedFrames = decompressFrames(gif, 1);
        console.log('Распаковано кадров:', decompressedFrames.length);
        
        if (!decompressedFrames || decompressedFrames.length === 0) {
          throw new Error('Не удалось декодировать кадры GIF');
        }
        
        setTotalFrames(decompressedFrames.length);
        
        // Обрабатываем кадры
        const renderedFrames = await renderFramesToImageData(decompressedFrames);
        console.log('Подготовлено кадров для отображения:', renderedFrames.length);
        setFrames(renderedFrames);
        setCurrentFrameIndex(0);
        
        // Вызываем callback при успешной загрузке
        if (onLoad) onLoad();
      } catch (err) {
        console.error('Ошибка при загрузке GIF:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        
        // Вызываем callback при ошибке
        if (onError) onError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    
    extractFrames();
    
    // Функция очистки при размонтировании компонента
    return () => {
      if (tempCanvasRef.current) {
        try {
          document.body.removeChild(tempCanvasRef.current);
        } catch (e) {
          console.warn('Ошибка при удалении временного canvas:', e);
        }
        tempCanvasRef.current = null;
      }
      
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }
    };
  }, [gifUrl, onLoad, onError]);
  
  // Обработка кадров
  const renderFramesToImageData = async (frames: any[]): Promise<GifFrame[]> => {
    if (!frames.length) {
      console.warn('Нет кадров для обработки');
      return [];
    }
    
    // Если временный canvas не создан, создаем его
    if (!tempCanvasRef.current) {
      tempCanvasRef.current = document.createElement('canvas');
      tempCanvasRef.current.style.display = 'none';
      document.body.appendChild(tempCanvasRef.current);
    }
    
    const firstFrame = frames[0];
    if (!firstFrame || !firstFrame.dims) {
      console.warn('Первый кадр некорректен:', firstFrame);
      return [];
    }
    
    const gifWidth = firstFrame.dims.width;
    const gifHeight = firstFrame.dims.height;
    
    console.log('Размеры GIF:', gifWidth, 'x', gifHeight);
    
    const canvas = tempCanvasRef.current;
    canvas.width = gifWidth;
    canvas.height = gifHeight;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      console.error('Не удалось получить контекст canvas');
      return [];
    }
    
    let previousImageData: ImageData | null = null;
    const result: GifFrame[] = [];
    
    // Создаем прозрачный фон
    const transparentImageData = ctx.createImageData(gifWidth, gifHeight);
    for (let i = 0; i < transparentImageData.data.length; i += 4) {
      transparentImageData.data[i + 3] = 0;
    }
    ctx.putImageData(transparentImageData, 0, 0);
    
    // Обрабатываем кадры
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const { dims, disposalType, patch, delay } = frame;
      
      // Сохраняем состояние при disposal=3
      if (disposalType === 3) {
        previousImageData = ctx.getImageData(0, 0, gifWidth, gifHeight);
      }
      
      // Очищаем при disposal=2
      if (disposalType === 2) {
        ctx.clearRect(dims.left, dims.top, dims.width, dims.height);
      }
      
      // Рисуем патч
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = dims.width;
      frameCanvas.height = dims.height;
      const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true });
      
      if (frameCtx) {
        const frameImageData = frameCtx.createImageData(dims.width, dims.height);
        frameImageData.data.set(patch);
        frameCtx.putImageData(frameImageData, 0, 0);
        
        // Высокое качество отрисовки
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(frameCanvas, dims.left, dims.top);
      }
      
      // Сохраняем кадр
      const fullFrame = ctx.getImageData(0, 0, gifWidth, gifHeight);
      result.push({
        imageData: fullFrame,
        delay: delay || 100
      });
      
      // Восстанавливаем предыдущее состояние при disposal=3
      if (disposalType === 3 && previousImageData) {
        ctx.putImageData(previousImageData, 0, 0);
      }
    }
    
    return result;
  };
  
  // Функция для отрисовки кадра с масштабированием
  const drawScaledFrame = (ctx: CanvasRenderingContext2D, frame: GifFrame, canvasWidth: number, canvasHeight: number) => {
    if (!frame.imageData) return;
    
    const frameWidth = frame.imageData.width;
    const frameHeight = frame.imageData.height;
    
    // Очищаем canvas перед рисованием нового кадра
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Создаем временный canvas для исходного кадра
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = frameWidth;
    tempCanvas.height = frameHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    // Рисуем исходные данные изображения на временный canvas
    tempCtx.putImageData(frame.imageData, 0, 0);
    
    // Рассчитываем коэффициент масштабирования и смещение для центрирования
    const scale = Math.min(canvasWidth / frameWidth, canvasHeight / frameHeight);
    const scaledWidth = frameWidth * scale;
    const scaledHeight = frameHeight * scale;
    const offsetX = (canvasWidth - scaledWidth) / 2;
    const offsetY = (canvasHeight - scaledHeight) / 2;
    
    // Устанавливаем высокое качество сглаживания
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Применяем небольшой размытие для сглаживания
    ctx.filter = 'blur(0.5px)';
    
    // Рисуем масштабированное изображение на основной canvas
    ctx.drawImage(
      tempCanvas,
      0, 0, frameWidth, frameHeight,
      offsetX, offsetY, scaledWidth, scaledHeight
    );
    
    // Сбрасываем фильтр
    ctx.filter = 'none';
  };
  
  // При загрузке первого кадра рендерим его сразу
  useEffect(() => {
    if (frames.length > 0 && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d', {
        alpha: true,
        willReadFrequently: true
      });
      if (ctx) {
        const currentFrame = frames[currentFrameIndex];
        if (currentFrame) {
          // Обновляем размеры canvas для соответствия контейнеру
          const container = canvasRef.current.parentElement;
          if (container) {
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            
            // Используем повышенную плотность пикселей для улучшения качества
            const pixelRatio = Math.max(window.devicePixelRatio, 1);
            const displayWidth = containerWidth;
            const displayHeight = containerHeight;
            const bufferWidth = containerWidth * pixelRatio;
            const bufferHeight = containerHeight * pixelRatio;
            
            // Устанавливаем размеры буфера canvas с учетом плотности пикселей
            canvasRef.current.width = bufferWidth;
            canvasRef.current.height = bufferHeight;
            
            // Обновляем CSS размеры для соответствия контейнеру
            canvasRef.current.style.width = `${displayWidth}px`;
            canvasRef.current.style.height = `${displayHeight}px`;
            
            setCanvasDimensions({
              width: bufferWidth,
              height: bufferHeight
            });
            
            // Масштабируем контекст в соответствии с плотностью пикселей
            ctx.scale(pixelRatio, pixelRatio);
            
            // Рисуем кадр с масштабированием
            drawScaledFrame(ctx, currentFrame, displayWidth, displayHeight);
            
            // Восстанавливаем нормальный масштаб контекста
            ctx.setTransform(1, 0, 0, 1, 0, 0);
          } else {
            // Если нет родительского элемента, используем размеры изображения
            canvasRef.current.width = currentFrame.imageData.width;
            canvasRef.current.height = currentFrame.imageData.height;
            ctx.putImageData(currentFrame.imageData, 0, 0);
          }
          
          initializedRef.current = true;
        }
      }
    }
  }, [frames, currentFrameIndex]);
  
  // Обработка кнопки "Предыдущий кадр"
  const handlePrevFrame = () => {
    if (!frames.length) return;
    
    const prevIndex = (currentFrameIndex - 1 + totalFrames) % totalFrames;
    setCurrentFrameIndex(prevIndex);
    
    // Рендерим новый кадр
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx && frames[prevIndex]) {
        ctx.putImageData(frames[prevIndex].imageData, 0, 0);
      }
    }
  };
  
  // Обработка кнопки "Следующий кадр"
  const handleNextFrame = () => {
    if (!frames.length) return;
    
    const nextIndex = (currentFrameIndex + 1) % totalFrames;
    setCurrentFrameIndex(nextIndex);
    
    // Рендерим новый кадр
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx && frames[nextIndex]) {
        ctx.putImageData(frames[nextIndex].imageData, 0, 0);
      }
    }
  };
  
  // Обработка кнопки "Воспроизведение/Пауза"
  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  // После окончания загрузки, автоматически запускаем анимацию только если нет отсчета
  useEffect(() => {
    if (!loading && frames.length > 0) {
      const shouldPlay = !isPaused && !isCountdownActive;
      setIsPlaying(shouldPlay);
      isPlayingRef.current = shouldPlay;
    }
  }, [loading, frames.length, isPaused, isCountdownActive]);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        bgcolor: 'background.paper',
        borderRadius: 1,
        overflow: 'hidden'
      }}
    >
      {/* Холст для отображения GIF - отображаем только когда GIF загружен */}
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden', // Скрываем всё, что выходит за границы
          aspectRatio: '1/1', // Поддерживаем квадратную форму
        }}
      >
        {/* Отображаем canvas только когда GIF загружен */}
        {!loading && frames.length > 0 && (
          <canvas
            ref={canvasRef}
            width={canvasDimensions.width}
            height={canvasDimensions.height}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover', // Заполняем всю доступную площадь
              objectPosition: 'center', // Центрируем изображение
              display: 'block',
              backgroundColor: 'transparent'
            }}
          />
        )}
        
        {/* Иконка паузы - отображаем только когда GIF загружен */}
        {!loading && isPaused && (
          <Box
            sx={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2
            }}
          >
            <Box
              sx={{
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '50%',
                width: 60,
                height: 60,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <PauseIcon sx={{ color: 'white', fontSize: 40 }} />
            </Box>
          </Box>
        )}
        
        {/* Сообщение о загрузке */}
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'backgrounds.paper',
              zIndex: 2
            }}
          >
            <CircularProgress sx={{ color: 'highlight.main' }} />
          </Box>
        )}
        
        {/* Сообщение об ошибке */}
        {error && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'backgrounds.paper',
              p: 2,
              zIndex: 2
            }}
          >
            <Typography variant="body2" color="error" align="center" sx={{ maxWidth: '80%' }}>
              {error}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
} 