"use client";

import React, { useRef, useState, useEffect } from 'react';
import { useGif } from '../context/GifContext';
import styles from './GifPlayer.module.css';

interface GifPlayerProps {
  gifUrl: string;
  autoPlay?: boolean;
  isPaused?: boolean;
  onLoad?: () => void;
  onError?: (error: string) => void;
}

const GifPlayer = React.forwardRef<any, GifPlayerProps>(({ 
  gifUrl, 
  autoPlay = true, 
  isPaused = false,
  onLoad,
  onError
}, ref) => {
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay && !isPaused);
  const urlRef = useRef<string>('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationTimerRef = useRef<number | null>(null);

  // Используем GifContext для загрузки и кэширования
  const { getGifData, loadGif, isGifLoading, hasGifError } = useGif();
  const gifData = getGifData(gifUrl);
  const frames = gifData?.frames || [];
  const loading = isGifLoading(gifUrl);
  const error = gifData?.error || null;
  const totalFrames = frames.length;

  // Сбрасываем состояние при изменении URL
  useEffect(() => {
    // Сбрасываем состояние только если URL изменился
    if (urlRef.current !== gifUrl) {
      console.log(`[GifPlayer] URL изменился: ${urlRef.current} -> ${gifUrl}`);
      urlRef.current = gifUrl;
      setCurrentFrameIndex(0);
      
      // Останавливаем текущую анимацию
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }
      
      // Очищаем канвас
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
      
      // Устанавливаем состояние воспроизведения
      setIsPlaying(autoPlay && !isPaused);
    }
  }, [gifUrl, autoPlay, isPaused]);

  // Экспортируем API для родительского компонента через ref
  React.useImperativeHandle(ref, () => ({
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
    reset: () => {
      setCurrentFrameIndex(0);
      if (!isPaused) setIsPlaying(true);
    },
    goToFrame: (index: number) => {
      if (index >= 0 && index < totalFrames) {
        setCurrentFrameIndex(index);
      }
    }
  }));

  // Отслеживаем изменения isPaused из пропсов
  useEffect(() => {
    setIsPlaying(!isPaused);
  }, [isPaused]);

  // Загружаем GIF один раз через context
  useEffect(() => {
    const loadGifData = async () => {
      try {
        await loadGif(gifUrl);
        
        // Уведомляем о загрузке
        if (onLoad && frames.length > 0) {
          onLoad();
        }
      } catch (err) {
        console.error('Ошибка при загрузке GIF:', err);
        if (onError) {
          onError(`Ошибка загрузки: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    };
    
    loadGifData();
  }, [gifUrl, loadGif, onLoad, onError, frames.length]);

  // Уведомляем об ошибках
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Рисуем первый кадр даже если анимация на паузе
  useEffect(() => {
    if (frames.length > 0 && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      
      const frame = frames[currentFrameIndex];
      if (!frame) return;
      
      console.log(`[GifPlayer] Размер ImageData: ${frame.imageData.width}x${frame.imageData.height}, delay: ${frame.delay}ms`);
      
      // Проверяем, нужно ли обновить размеры канваса
      const needResize = canvasRef.current.width !== frame.imageData.width || 
                         canvasRef.current.height !== frame.imageData.height;
                         
      if (needResize) {
        console.log(`[GifPlayer] Обновляем размеры канваса с ${canvasRef.current.width}x${canvasRef.current.height} на ${frame.imageData.width}x${frame.imageData.height}`);
        canvasRef.current.width = frame.imageData.width;
        canvasRef.current.height = frame.imageData.height;
      }
      
      // Рисуем белый фон перед отрисовкой кадра
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      
      try {
        // Проверяем, не пустой ли ImageData
        let hasData = false;
        for (let i = 0; i < frame.imageData.data.length; i += 4) {
          if (frame.imageData.data[i+3] > 0) {
            hasData = true;
            break;
          }
        }
        
        if (!hasData) {
          console.warn('[GifPlayer] ImageData пустой или прозрачный');
        }
        
        // Рисуем кадр
        ctx.putImageData(frame.imageData, 0, 0);
        console.log(`[GifPlayer] Отрисован кадр ${currentFrameIndex + 1}/${frames.length}`);
        
      } catch (err) {
        console.error('[GifPlayer] Ошибка при отрисовке кадра:', err);
      }
    }
  }, [frames, currentFrameIndex]);

  // Анимация
  useEffect(() => {
    if (frames.length === 0 || !isPlaying) return;
    
    const renderCurrentFrame = () => {
      if (!canvasRef.current) return;
      
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      
      const frame = frames[currentFrameIndex];
      if (!frame) return;
      
      // Устанавливаем размеры canvas, если они отличаются
      if (canvasRef.current.width !== frame.imageData.width || 
          canvasRef.current.height !== frame.imageData.height) {
        canvasRef.current.width = frame.imageData.width;
        canvasRef.current.height = frame.imageData.height;
      }
      
      // Рисуем белый фон перед отрисовкой
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      
      // Рисуем кадр
      ctx.putImageData(frame.imageData, 0, 0);
      
      // Планируем следующий кадр
      const nextFrameIndex = (currentFrameIndex + 1) % frames.length;
      animationTimerRef.current = window.setTimeout(() => {
        setCurrentFrameIndex(nextFrameIndex);
      }, frame.delay);
    };
    
    renderCurrentFrame();
    
    return () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }
    };
  }, [frames, currentFrameIndex, isPlaying]);
  
  // Управление
  const handlePrevFrame = () => {
    setIsPlaying(false);
    setCurrentFrameIndex((currentFrameIndex - 1 + totalFrames) % totalFrames);
  };
  
  const handleTogglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };
  
  const handleNextFrame = () => {
    setIsPlaying(false);
    setCurrentFrameIndex((currentFrameIndex + 1) % totalFrames);
  };
  
  // Основной интерфейс
  if (loading) {
    return (
      <div className={styles.container}>
        <h2>Загрузка GIF...</h2>
        <div className={styles.loader}></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={styles.container}>
        <h2>Ошибка:</h2>
        <p className={styles.error}>{error}</p>
      </div>
    );
  }
  
  return (
    <div className={styles.container}>
      <div className={styles.playerContainer}>
        <div className={styles.canvasContainer}>
          <canvas ref={canvasRef} className={styles.animationCanvas} />
          <div className={styles.frameInfo}>
            Кадр: {currentFrameIndex + 1} из {totalFrames}
          </div>
        </div>
        
        <div className={styles.controls}>
          <button 
            className={styles.controlButton} 
            onClick={handlePrevFrame}
            aria-label="Предыдущий кадр"
          >
            ⏮️
          </button>
          
          <button 
            className={styles.controlButton} 
            onClick={handleTogglePlayPause}
            aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          
          <button 
            className={styles.controlButton} 
            onClick={handleNextFrame}
            aria-label="Следующий кадр"
          >
            ⏭️
          </button>
        </div>
        
        <div className={styles.frameDetails}>
          Задержка: {frames[currentFrameIndex]?.delay || 0}мс
        </div>
      </div>
    </div>
  );
});

// Устанавливаем displayName для DevTools
GifPlayer.displayName = 'GifPlayer';

export default GifPlayer; 