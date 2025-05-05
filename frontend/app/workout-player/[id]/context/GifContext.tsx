"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { parseGIF, decompressFrames } from 'gifuct-js';

interface GifFrame {
  imageData: ImageData;
  delay: number;
}

interface GifData {
  frames: GifFrame[];
  width: number;
  height: number;
  isLoading: boolean;
  error: string | null;
}

interface GifCache {
  [url: string]: GifData;
}

interface GifContextType {
  getGifData: (url: string) => GifData | null;
  loadGif: (url: string) => Promise<void>;
  isGifLoading: (url: string) => boolean;
  hasGifError: (url: string) => boolean;
  clearGifCache: (url: string) => void;
}

const GifContext = createContext<GifContextType | null>(null);

export const useGif = () => {
  const context = useContext(GifContext);
  if (!context) {
    throw new Error('useGif должен использоваться внутри GifProvider');
  }
  return context;
};

export const GifProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [gifCache, setGifCache] = useState<GifCache>({});
  
  // Получение GIF из кэша
  const getGifData = useCallback((url: string) => {
    return gifCache[url] || null;
  }, [gifCache]);
  
  // Проверка, загружается ли GIF в данный момент
  const isGifLoading = useCallback((url: string) => {
    return !!gifCache[url]?.isLoading;
  }, [gifCache]);
  
  // Проверка, была ли ошибка при загрузке GIF
  const hasGifError = useCallback((url: string) => {
    return !!gifCache[url]?.error;
  }, [gifCache]);
  
  // Загрузка и обработка GIF
  const loadGif = useCallback(async (url: string) => {
    // Если GIF уже загружен или загружается, ничего не делаем
    if (gifCache[url] && (gifCache[url].frames.length > 0 || gifCache[url].isLoading)) {
      console.log(`[GifContext] GIF ${url} уже загружен или загружается, пропускаем запрос`);
      return;
    }
    
    console.log(`[GifContext] Запрос на загрузку GIF: ${url}`);
    
    // Устанавливаем состояние загрузки
    setGifCache(prev => ({
      ...prev,
      [url]: {
        frames: [],
        width: 0,
        height: 0,
        isLoading: true,
        error: null
      }
    }));
    
    try {
      // Загружаем GIF
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Не удалось загрузить GIF: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      console.log(`[GifContext] Загружен GIF: ${url}, ${buffer.byteLength} байт`);
      
      // Обрабатываем GIF
      const gif = parseGIF(buffer);
      const decompressedFrames = decompressFrames(gif, true);
      
      if (decompressedFrames.length === 0) {
        throw new Error('GIF не содержит кадров');
      }
      
      // Получаем размеры GIF
      const firstFrame = decompressedFrames[0];
      const width = firstFrame.dims.width;
      const height = firstFrame.dims.height;
      
      console.log(`[GifContext] Размеры GIF: ${width}x${height}, обрабатываем ${decompressedFrames.length} кадров`);
      
      // Обрабатываем кадры в отдельном процессе, чтобы не блокировать UI
      const frames = await renderFramesToImageData(decompressedFrames, width, height);
      
      // Кэшируем результат
      setGifCache(prev => ({
        ...prev,
        [url]: {
          frames,
          width,
          height,
          isLoading: false,
          error: null
        }
      }));
      
      console.log(`[GifContext] GIF обработан: ${url}, кадров: ${frames.length}`);
    } catch (error) {
      console.error(`[GifContext] Ошибка загрузки GIF: ${url}`, error);
      
      // Сохраняем ошибку
      setGifCache(prev => ({
        ...prev,
        [url]: {
          frames: [],
          width: 0,
          height: 0,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка'
        }
      }));
    }
  }, [gifCache]);
  
  // Обработка кадров GIF
  const renderFramesToImageData = async (
    frames: any[], 
    gifWidth: number, 
    gifHeight: number
  ): Promise<GifFrame[]> => {
    return new Promise(resolve => {
      // Выполняем тяжелую работу в setTimeout, чтобы не блокировать UI
      setTimeout(() => {
        console.log(`[GifContext] Начинаем рендеринг ${frames.length} кадров: ${gifWidth}x${gifHeight}`);
        
        // Создаем временный canvas
        const canvas = document.createElement('canvas');
        canvas.width = gifWidth;
        canvas.height = gifHeight;
        
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          console.error('[GifContext] Не удалось получить контекст канваса');
          resolve([]);
          return;
        }
        
        let previousImageData: ImageData | null = null;
        const result: GifFrame[] = [];
        
        // Создаем белый фон вместо прозрачного
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, gifWidth, gifHeight);
        
        // Обрабатываем кадры
        for (let i = 0; i < frames.length; i++) {
          const frame = frames[i];
          const { dims, disposalType, patch, delay } = frame;
          
          // Проверяем данные кадра для отладки
          if (i === 0 || i === frames.length - 1) {
            console.log(`[GifContext] Кадр ${i+1}/${frames.length}: dims=${JSON.stringify(dims)}, delay=${delay}, patch.length=${patch?.length || 0}`);
          }
          
          // Сохраняем состояние при disposal=3
          if (disposalType === 3) {
            previousImageData = ctx.getImageData(0, 0, gifWidth, gifHeight);
          }
          
          // Очищаем при disposal=2
          if (disposalType === 2) {
            ctx.clearRect(dims.left, dims.top, dims.width, dims.height);
            // Восстанавливаем белый фон для очищенной области
            ctx.fillStyle = 'white';
            ctx.fillRect(dims.left, dims.top, dims.width, dims.height);
          }
          
          // Рисуем патч
          if (patch && dims) {
            try {
              // Создаем и заполняем ImageData
              const frameCanvas = document.createElement('canvas');
              frameCanvas.width = dims.width;
              frameCanvas.height = dims.height;
              const frameCtx = frameCanvas.getContext('2d');
              
              if (frameCtx) {
                const frameImageData = frameCtx.createImageData(dims.width, dims.height);
                frameImageData.data.set(patch);
                frameCtx.putImageData(frameImageData, 0, 0);
                
                // Рисуем кадр на основном канвасе
                ctx.drawImage(frameCanvas, dims.left, dims.top);
                
                // Диагностика пикселей первого кадра
                if (i === 0) {
                  const pixelData = ctx.getImageData(0, 0, 10, 10).data;
                  let nonZeroPixels = 0;
                  for (let p = 0; p < pixelData.length; p += 4) {
                    if (pixelData[p] > 0 || pixelData[p+1] > 0 || pixelData[p+2] > 0) {
                      nonZeroPixels++;
                    }
                  }
                  console.log(`[GifContext] Первый кадр: ${nonZeroPixels} непрозрачных пикселей в верхних 10x10 пикселях`);
                }
              }
            } catch (err) {
              console.error(`[GifContext] Ошибка при рендеринге кадра ${i}:`, err);
            }
          }
          
          // Сохраняем кадр
          try {
            const fullFrame = ctx.getImageData(0, 0, gifWidth, gifHeight);
            
            // Проверяем, есть ли в кадре непустые пиксели
            let hasNonEmptyPixels = false;
            for (let p = 0; p < fullFrame.data.length; p += 4) {
              if (fullFrame.data[p] > 0 || fullFrame.data[p+1] > 0 || fullFrame.data[p+2] > 0) {
                hasNonEmptyPixels = true;
                break;
              }
            }
            
            if (!hasNonEmptyPixels) {
              console.warn(`[GifContext] Кадр ${i+1} не содержит видимых пикселей`);
            }
            
            result.push({
              imageData: fullFrame,
              delay: delay || 100
            });
          } catch (err) {
            console.error(`[GifContext] Ошибка при сохранении кадра ${i}:`, err);
          }
          
          // Восстанавливаем предыдущее состояние при disposal=3
          if (disposalType === 3 && previousImageData) {
            ctx.putImageData(previousImageData, 0, 0);
          }
        }
        
        console.log(`[GifContext] Рендеринг завершен, подготовлено ${result.length} кадров`);
        resolve(result);
      }, 0);
    });
  };
  
  // Очистка кэша для конкретного URL
  const clearGifCache = useCallback((url: string) => {
    // Проверяем, существует ли URL в кэше
    if (gifCache[url]) {
      console.log(`[GifContext] Очищаем кэш для URL: ${url}`);
      
      // Создаем новый объект кэша без указанного URL
      const newCache = { ...gifCache };
      delete newCache[url];
      setGifCache(newCache);
    }
  }, [gifCache]);
  
  const value = {
    getGifData,
    loadGif,
    isGifLoading,
    hasGifError,
    clearGifCache
  };
  
  return (
    <GifContext.Provider value={value}>
      {children}
    </GifContext.Provider>
  );
};

export default GifContext; 