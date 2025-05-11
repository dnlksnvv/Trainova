"use client";

import React, { useState } from 'react';
import { Box, Paper, CircularProgress, Typography, Skeleton } from '@mui/material';
import GifPlayerPage from './GifPlayerPage';
import { Exercise } from '../interfaces';
import { ErrorOutline } from '@mui/icons-material';

interface ExerciseImageProps {
  currentExercise: Exercise;
  isPaused: boolean;
  autoPlay?: boolean;
  startAnimation?: boolean;
  isCountdownActive?: boolean;
  setPngFrames?: (frames: any[]) => void;
  setError?: (error: string | null) => void;
  onLoad?: () => void;   // Обработчик успешной загрузки
  onError?: (error: string) => void;  // Обработчик ошибки загрузки
  onFrameComplete?: () => void; // Добавляем обработчик для завершения цикла анимации
  onFrameChange?: (currentFrame: number, totalFrames: number) => void; // Добавляем обработчик для информации о кадрах
}

export default function ExerciseImage({
  currentExercise,
  isPaused,
  autoPlay = true,
  startAnimation = true,
  isCountdownActive = false,
  setPngFrames,
  setError,
  onLoad,
  onError,
  onFrameComplete,
  onFrameChange
}: ExerciseImageProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Обработчик успешной загрузки GIF
  const handleGifLoad = () => {
    setLoading(false);
    setLoadError(null);
    if (setError) setError(null);
    // Вызываем обработчик родительского компонента
    if (onLoad) onLoad();
  };

  // Обработчик ошибки загрузки GIF
  const handleGifError = (errorMessage: string) => {
    setLoading(false);
    setLoadError(errorMessage);
    if (setError) setError(errorMessage);
    // Вызываем обработчик родительского компонента
    if (onError) onError(errorMessage);
  };

  // Проверка наличия URL изображения
  const imageUrl = currentExercise?.imageUrl;
  if (!imageUrl) {
    return (
      <Paper
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
          minHeight: '200px',
          aspectRatio: '1/1'
        }}
      >
        <Typography variant="body1" color="error">
          Изображение упражнения не найдено
          </Typography>
        </Paper>
    );
  }
  
  return (
    <Box 
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        aspectRatio: '1/1',
        bgcolor: 'common.white',
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      {/* Показываем скелетон во время загрузки */}
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
            bgcolor: 'common.black',
            zIndex: 2
          }}
        >
          <CircularProgress sx={{ color: 'highlight.main' }} />
        </Box>
      )}
      
      {/* Загружаем GIF в фоне, не отображая его до окончания загрузки */}
      <Box 
        sx={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          visibility: loading ? 'hidden' : 'visible',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          zIndex: 1,
          bgcolor: 'common.white'
        }}
      >
        <GifPlayerPage
          gifUrl={imageUrl}
          autoPlay={true}
          isPaused={isPaused}
          isCountdownActive={isCountdownActive}
          onLoad={handleGifLoad}
          onError={handleGifError}
          onFrameComplete={onFrameComplete}
          onFrameChange={onFrameChange}
        />
      </Box>
      
      {/* Сообщение об ошибке */}
      {loadError && (
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
            bgcolor: 'common.white',
            p: 2,
            zIndex: 3
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <ErrorOutline color="error" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="body2" color="error" align="center" sx={{ maxWidth: '80%' }}>
              {loadError}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
} 