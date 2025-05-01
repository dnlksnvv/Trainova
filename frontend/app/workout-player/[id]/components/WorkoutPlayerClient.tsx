"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkout } from '../hooks/useWorkout';
import { formatTime } from '../utils/formatters';
import { Workout, Exercise } from '@/app/types';
import { Box, Typography, IconButton, Paper, Modal, Fade, Backdrop, Divider, Grid, LinearProgress, Button, Container } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import { motion, AnimatePresence } from 'framer-motion';
import ExerciseImage from './ExerciseImage';
import { workoutProgressApi, getCurrentUserId } from '@/app/services/api';

interface WorkoutPlayerClientProps {
  workout: Workout;
}

export default function WorkoutPlayerClient({ workout }: WorkoutPlayerClientProps) {
  const router = useRouter();
  const [infoOpen, setInfoOpen] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isGifLoading, setIsGifLoading] = useState(true);
  const [currentReps, setCurrentReps] = useState(0);
  const [totalReps, setTotalReps] = useState(0);
  const [isRepBased, setIsRepBased] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [showingCountdown, setShowingCountdown] = useState(false);
  const [initialExerciseLoad, setInitialExerciseLoad] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [imageWidth, setImageWidth] = useState(320);
  const lastRepTimeRef = useRef<number>(0);
  const [animationPaused, setAnimationPaused] = useState(false);
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const {
    currentExercise,
    exerciseIndex,
    totalExercises,
    remainingTime,
    nextExercise,
    prevExercise,
    togglePause,
    exerciseElapsedTime,
    isCompleted: workoutCompleted,
    isPaused: workoutPaused,
    skipToExercise,
    isTimeComplete
  } = useWorkout({
    workout,
    onComplete: () => {
      console.log('Тренировка завершена!');
      setIsCompleted(true);
    },
    onExerciseTimeComplete: () => {
      console.log('Время упражнения истекло!');
      setShowCompletionMessage(true);
    }
  });

  // Синхронизация состояния с хуком
  useEffect(() => {
    setIsPaused(workoutPaused);
    setIsCompleted(workoutCompleted);
  }, [workoutPaused, workoutCompleted]);

  // Инициализация таймера для текущего упражнения
  useEffect(() => {
    if (currentExercise) {
      // Проверяем, содержит ли упражнение информацию о повторениях
      const hasReps = currentExercise.reps !== undefined && currentExercise.reps > 0;
      
      setIsRepBased(hasReps);
      
      // Сбрасываем состояния при смене упражнения
      setCurrentReps(0);
      setInitialExerciseLoad(true);
      setIsPaused(true); // Начинаем с паузы для любого типа упражнения
      setAnimationPaused(false); // Но анимация всегда проигрывается
      
      if (hasReps) {
        // Для упражнений с повторениями
        setTotalReps(currentExercise.reps || 0);
      } else {
        // Для упражнений с таймером
        setTimeRemaining(currentExercise.duration);
      }
      
      // При смене упражнения сбрасываем состояние загрузки
      setIsGifLoading(true);
      // Отсчет будет запущен после загрузки GIF в handleGifLoad
    }
  }, [currentExercise?.id]);

  // Функция для запуска отсчета перед началом упражнения
  const startCountdown = () => {
    // Очищаем предыдущий таймер если он есть
    if (countdownRef.current) {
      clearTimeout(countdownRef.current);
      countdownRef.current = null;
    }
    
    setShowingCountdown(true);
    setCountdownValue(3);
    
    // Функция для обновления счетчика
    const updateCountdown = (value: number) => {
      if (value > 0) {
        setCountdownValue(value);
        countdownRef.current = setTimeout(() => updateCountdown(value - 1), 1000);
      } else {
        // Закончили отсчет
        setShowingCountdown(false);
        setCountdownValue(null);
        // Запускаем упражнение
        setIsPaused(false);
      }
    };
    
    // Запускаем отсчет
    updateCountdown(3);
  };

  // Обработка таймера - не запускаем, пока GIF загружается или идет отсчет
  useEffect(() => {
    // Не запускаем таймер, пока GIF не загрузится или идет отсчет
    if (isGifLoading || showingCountdown) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    
    if (!isPaused && timeRemaining > 0) {
      timerRef.current = setTimeout(() => {
        const newTimeRemaining = timeRemaining - 1;
        setTimeRemaining(newTimeRemaining);
        
        // Если время истекло, показываем сообщение
        if (newTimeRemaining === 0) {
          setShowCompletionMessage(true);
        }
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPaused, timeRemaining, isGifLoading, showingCountdown]);

  // Очистка таймеров при размонтировании
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  }, []);

  // Обработка завершения тренировки
  useEffect(() => {
    if (isCompleted) {
      // Можно добавить логику для сохранения результатов
      console.log('Тренировка завершена!');
    }
  }, [isCompleted]);

  // Переход к следующему упражнению
  const handleNext = () => {
    // Сбрасываем сообщение о завершении
    setShowCompletionMessage(false);
    // Добавляем задержку в 1 секунду перед переходом к следующему упражнению
    setTimeout(() => {
      nextExercise();
      if (exerciseIndex >= workout.exercises.length - 1) {
        setIsCompleted(true);
        setIsPaused(true);
      } else {
        // Сбрасываем флаг для начального упражнения, чтобы отсчет показался для следующего упражнения
        setInitialExerciseLoad(true);
      }
    }, 1000);
  };

  // Переход к предыдущему упражнению
  const handlePrevious = () => {
    // Если это первое упражнение, просто сбрасываем его и перезапускаем отсчет
    if (exerciseIndex === 0) {
      // Сброс текущего упражнения
      if (isRepBased) {
        setCurrentReps(0);
        setInitialExerciseLoad(true);
        startCountdown();
      } else {
        // Для упражнений с таймером
        if (currentExercise) {
          setTimeRemaining(currentExercise.duration);
          // Сбрасываем сообщение о завершении времени
          setShowCompletionMessage(false);
        }
        setIsPaused(true);
      }
    } else {
      // Переходим к предыдущему упражнению
      prevExercise();
      setInitialExerciseLoad(true);
      // Сбрасываем сообщение о завершении времени
      setShowCompletionMessage(false);
    }
  };

  // Переключение паузы - анимация всегда продолжает проигрываться
  const handleTogglePause = () => {
    // Если идет отсчет, игнорируем нажатие
    if (showingCountdown) {
      return;
    }
    
    if (isGifLoading) {
      console.log("GIF ещё загружается, нельзя запустить таймер");
      return;
    }
    
    // Для упражнений с повторениями, если мы нажимаем плей после паузы, запускаем отсчет
    if (isRepBased && isPaused && !showingCountdown) {
      startCountdown();
      return;
    }
    
    togglePause();
    setIsPaused(prev => !prev);
    // Не меняем состояние animationPaused, чтобы анимация продолжала проигрываться
  };

  // Увеличение количества повторений
  const incrementReps = () => {
    if (!isRepBased || isGifLoading || showingCountdown) return;
    
    setCurrentReps(prev => {
      const newCount = prev + 1;
      // Если достигли нужного количества повторений, ставим анимацию на паузу
      if (newCount >= totalReps) {
        // Просто ставим на паузу, но не переходим автоматически к следующему упражнению
        setAnimationPaused(true);
        setShowCompletionMessage(true);
      }
      return newCount;
    });
  };

  // Вычисление прогресса
  const progress = currentExercise ? 
    isRepBased 
      ? (currentReps / totalReps) * 100
      : ((currentExercise.duration - timeRemaining) / currentExercise.duration) * 100 
    : 0;

  // Отслеживаем размер контейнера изображения
  useEffect(() => {
    const updateImageWidth = () => {
      if (imageContainerRef.current) {
        setImageWidth(imageContainerRef.current.clientWidth);
      }
    };

    // Начальное измерение
    updateImageWidth();

    // Слушаем событие изменения размера окна
    window.addEventListener('resize', updateImageWidth);
    
    return () => {
      window.removeEventListener('resize', updateImageWidth);
    };
  }, []);

  // Обработчик успешной загрузки GIF
  const handleGifLoad = () => {
    console.log("GIF загружен");
    setIsGifLoading(false);
    
    // Теперь, когда GIF загружен, можем начать отсчет
    if (initialExerciseLoad) {
      console.log('GIF загружен, начинаем отсчет');
      setTimeout(() => {
        startCountdown();
        setInitialExerciseLoad(false);
      }, 500);
    }
  };

  // Обработчик ошибки загрузки GIF
  const handleGifError = (error: string) => {
    console.error("Ошибка загрузки GIF:", error);
    setIsGifLoading(false);
  };

  // Обработчик изменения текущего кадра
  const handleFrameChange = (current: number, total: number) => {
    setCurrentFrame(current);
    setTotalFrames(total);
    
    // Если упражнение с повторениями, воспроизведение НЕ на паузе, и достигли последнего кадра
    if (isRepBased && !isPaused && !isGifLoading && !showingCountdown && 
        total > 0 && current === total - 1 && currentReps < totalReps) {
      // Добавляем защиту от множественных вызовов
      const now = Date.now();
      if (now - lastRepTimeRef.current < 700) {
        console.log('Слишком частые фреймы, игнорируем');
        return;
      }
      
      console.log('Последний кадр анимации, увеличиваем счетчик повторений');
      lastRepTimeRef.current = now;
      
      // Автоматически увеличиваем счетчик повторений
      setCurrentReps(prev => {
        const newCount = prev + 1;
        console.log(`Повторение ${newCount}/${totalReps}`);
        
        // Если достигли нужного количества повторений, ставим анимацию на паузу
        if (newCount >= totalReps) {
          // Просто ставим на паузу, но не переходим автоматически к следующему упражнению
          setAnimationPaused(true);
          setShowCompletionMessage(true);
        }
        return newCount;
      });
    }
  };

  // Обработчик завершения цикла GIF-анимации теперь не используется для подсчета повторений
  const handleFrameComplete = () => {
    console.log('Завершен цикл анимации');
  };

  // Функция для сохранения прогресса тренировки и перехода к списку тренировок
  const saveWorkoutProgressAndExit = async () => {
    setIsSaving(true);
    
    try {
      // Используем API из services/api.ts для сохранения прогресса
      const response = await workoutProgressApi.saveProgress({
        user_id: getCurrentUserId(), // Получаем ID текущего пользователя
        workout_uuid: workout.id,
        completed_at: new Date().toISOString()
      });
      
      console.log(`Тренировка с ID ${workout.id} сохранена в прогрессе:`, response);
      setSaveSuccess(true);
      
      // Перенаправляем через короткую задержку
      setTimeout(() => {
        router.push('/trainings');
      }, 1000);
    } catch (error) {
      console.error('Ошибка при сохранении прогресса тренировки:', error);
      
      // Даже при ошибке позволяем пользователю завершить тренировку
      setSaveSuccess(true);
      setTimeout(() => {
        router.push('/trainings');
      }, 1000);
    } finally {
      setIsSaving(false);
    }
  };

  // Отображение завершения тренировки
  if (isCompleted) {
    return (
      <Box 
        sx={{ 
          textAlign: 'center', 
          p: 4, 
          height: '100vh', 
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          bgcolor: 'backgrounds.default'
        }}
      >
        <Paper 
          elevation={4} 
          sx={{ 
            p: 4, 
            borderRadius: 2,
            width: '100%',
            maxWidth: 480,
            bgcolor: 'backgrounds.paper',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}
        >
          <Box 
            component={motion.div}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Typography 
              variant="h4" 
              gutterBottom
              sx={{ 
                fontWeight: 'bold',
                color: 'textColors.primary',
                mb: 3
              }}
            >
              Тренировка завершена!
            </Typography>
            
            {saveSuccess ? (
              <Box 
                component={motion.div}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Typography 
                  variant="body1" 
                  sx={{ 
                    mb: 2, 
                    color: 'highlight.main',
                    fontWeight: 'medium'
                  }}
                >
                  Прогресс успешно сохранен
                </Typography>
                <Typography variant="body2" sx={{ color: 'textColors.secondary' }}>
                  Перенаправление на список тренировок...
                </Typography>
              </Box>
            ) : (
              <Button 
                variant="contained" 
                fullWidth
                size="large"
                onClick={saveWorkoutProgressAndExit}
                disabled={isSaving}
                sx={{ 
                  mt: 2,
                  py: 1.5,
                  bgcolor: 'highlight.main',
                  color: 'white',
                  fontWeight: 'bold',
                  '&:hover': {
                    bgcolor: 'highlight.accent'
                  }
                }}
              >
                {isSaving ? 'Сохранение...' : 'Отметить в прогрессе и выйти'}
              </Button>
            )}
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Container maxWidth="sm" disableGutters sx={{ height: '100%' }}>
      {/* Верхняя панель */}
      <Box sx={{ 
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}>
        <IconButton color="inherit" onClick={() => router.push("/trainings")}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
          {workout.title}
        </Typography>
        {/* Иконка информации появляется только при наличии описания */}
        {currentExercise?.description ? (
          <IconButton color="inherit" onClick={() => setInfoOpen(true)}>
            <InfoIcon />
          </IconButton>
        ) : (
          <Box sx={{ width: 40 }} />
        )}
      </Box>

      <Box sx={{ px: 2, py: 1 }}>
        {/* Индикатор прогресса (точки) */}
        <Box sx={{ 
          display: 'flex',
          justifyContent: 'center', 
          gap: 1,
          mb: 2
        }}>
          {Array.from({ length: totalExercises }).map((_, i) => (
            <Box
              component={motion.div}
              key={i}
              initial={{ width: '8px' }}
              animate={{ 
                width: i === exerciseIndex ? '32px' : '8px'
              }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              sx={{
                height: '8px',
                borderRadius: '4px',
                bgcolor: i <= exerciseIndex ? 'highlight.main' : 'backgrounds.paper'
              }}
            />
          ))}
        </Box>

        {/* Название упражнения */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            {currentExercise?.name || 'Загрузка...'}
          </Typography>
        </Box>
      </Box>

      {/* Основной контент */}
      <Box sx={{ px: { xs: 2, sm: 4 } }}>
        {/* Изображение упражнения с фиксированным соотношением сторон */}
        <Box 
          ref={imageContainerRef}
          sx={{ 
            width: '100%',
            aspectRatio: '1/1',
            borderRadius: 2,
            overflow: 'hidden',
            boxShadow: 1,
            mb: 4,
            mx: 'auto',
            bgcolor: 'background.paper',
            position: 'relative'
          }}
        >
          {/* Слой для отображения отсчета */}
          <AnimatePresence>
            {showingCountdown && countdownValue !== null && (
              <Box
                component={motion.div}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.5 }}
                key={countdownValue}
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(0, 0, 0, 0.7)',
                  zIndex: 10,
                  borderRadius: 2
                }}
              >
                <Typography 
                  variant="h1" 
                  component={motion.h1}
                  initial={{ scale: 1.5 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.8 }}
                  sx={{ 
                    color: 'highlight.main', 
                    fontWeight: 'bold',
                    textShadow: '0 0 10px rgba(255, 140, 0, 0.6)'
                  }}
                >
                  {countdownValue}
                </Typography>
              </Box>
            )}
          </AnimatePresence>

          {/* Слой для отображения сообщения о завершении времени */}
          <AnimatePresence>
            {!isRepBased && (timeRemaining === 0 || isTimeComplete) && showCompletionMessage && (
              <Box
                component={motion.div}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                sx={{
                  position: 'absolute',
                  bottom: 20,
                  left: 20,
                  right: 20,
                  padding: 2,
                  bgcolor: 'rgba(255, 140, 0, 0.9)',
                  borderRadius: 2,
                  zIndex: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}
              >
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: 'white', 
                    fontWeight: 'bold',
                    textAlign: 'center',
                    mb: 1
                  }}
                >
                  Время истекло!
                </Typography>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  sx={{
                    bgcolor: 'white',
                    color: 'highlight.main',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.9)'
                    }
                  }}
                >
                  Следующее упражнение
                </Button>
              </Box>
            )}
          </AnimatePresence>

          {/* Слой для отображения сообщения о завершении повторений */}
          <AnimatePresence>
            {isRepBased && currentReps >= totalReps && showCompletionMessage && (
              <Box
                component={motion.div}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                sx={{
                  position: 'absolute',
                  bottom: 20,
                  left: 20,
                  right: 20,
                  padding: 2,
                  bgcolor: 'rgba(255, 140, 0, 0.9)',
                  borderRadius: 2,
                  zIndex: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}
              >
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: 'white', 
                    fontWeight: 'bold',
                    textAlign: 'center',
                    mb: 1
                  }}
                >
                  Повторения выполнены!
                </Typography>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  sx={{
                    bgcolor: 'white',
                    color: 'highlight.main',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.9)'
                    }
                  }}
                >
                  Следующее упражнение
                </Button>
              </Box>
            )}
          </AnimatePresence>

          {/* Слой индикации паузы */}
          <AnimatePresence>
            {isPaused && !showingCountdown && !isGifLoading && (
              <Box
                component={motion.div}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                sx={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  bgcolor: 'rgba(0, 0, 0, 0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 5
                }}
              >
                <PauseIcon sx={{ color: 'white', fontSize: '20px' }} />
              </Box>
            )}
          </AnimatePresence>

          {currentExercise ? (
            <ExerciseImage 
              currentExercise={currentExercise} 
              isPaused={animationPaused || showingCountdown} // Обновленная логика паузы
              autoPlay={true}
              startAnimation={!showingCountdown}
              isCountdownActive={showingCountdown} // Передаем состояние отсчета
              onLoad={handleGifLoad}
              onError={handleGifError}
              onFrameComplete={handleFrameComplete}
              onFrameChange={handleFrameChange}
            />
          ) : (
            <Box sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Typography>Загрузка упражнения...</Typography>
            </Box>
          )}
        </Box>

        {/* Таймер или Счетчик повторений */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          {isRepBased ? (
            <>
              <Typography variant="h3" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box component="span" sx={{ color: 'highlight.main' }}>{currentReps}</Box>
                <Box component="span" sx={{ mx: 1 }}>/</Box>
                <Box component="span">{totalReps}</Box>
              </Typography>
              <Typography variant="body1" sx={{ color: 'textColors.secondary', mt: 0.5 }}>
                повторений
              </Typography>
              {/* Информация о кадрах */}
              {!isGifLoading && totalFrames > 0 && (
                <Typography variant="body2" sx={{ color: 'textColors.secondary', mt: 1 }}>
                  Кадр: {currentFrame}/{totalFrames}
                </Typography>
              )}
            </>
          ) : (
            <>
              <Typography variant="h3" sx={{ 
                fontWeight: 'bold',
                color: isTimeComplete ? 'highlight.main' : 'inherit'
              }}>
                {formatTime(timeRemaining)}
              </Typography>
              <Typography variant="body1" sx={{ 
                color: isTimeComplete ? 'highlight.main' : 'textColors.secondary', 
                mt: 0.5,
                fontWeight: isTimeComplete ? 'bold' : 'normal'
              }}>
                {isTimeComplete ? 'Время истекло!' : 'осталось'}
              </Typography>
              {/* Информация о кадрах */}
              {!isGifLoading && totalFrames > 0 && (
                <Typography variant="body2" sx={{ color: 'textColors.secondary', mt: 1 }}>
                  Кадр: {currentFrame}/{totalFrames}
                </Typography>
              )}
            </>
          )}
        </Box>

        {/* Индикатор прогресса упражнения */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ 
            bgcolor: 'backgrounds.paper', 
            height: '6px', 
            borderRadius: '3px', 
            width: '100%',
            overflow: 'hidden',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)'
          }}>
            <Box
              component={motion.div}
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 30 }}
              sx={{
                bgcolor: 'highlight.main',
                height: '100%'
              }}
            />
          </Box>
        </Box>

        {/* Кнопки управления */}
        <Grid 
          container 
          justifyContent="center" 
          alignItems="center" 
          spacing={2} 
          sx={{ mb: 4 }}
        >
          <Grid item>
            <IconButton 
              onClick={handlePrevious}
              disabled={isGifLoading || showingCountdown}
              sx={{ 
                width: 56,
                height: 56,
                borderRadius: 2,
                bgcolor: 'transparent',
                border: 1,
                borderColor: 'action.disabled',
                color: 'textColors.primary',
                '&:disabled': {
                  opacity: 0.5
                }
              }}
            >
              <SkipPreviousIcon fontSize="large" />
            </IconButton>
          </Grid>
          <Grid item>
            {/* Для всех типов упражнений используем кнопку паузы/воспроизведения */}
            <IconButton 
              onClick={handleTogglePause}
              disabled={isGifLoading || showingCountdown}
              sx={{ 
                width: 72,
                height: 72,
                borderRadius: 2,
                bgcolor: (isGifLoading || showingCountdown) ? 'action.disabledBackground' : 'highlight.main',
                color: 'common.white',
                boxShadow: 2,
                '&:hover': {
                  bgcolor: (isGifLoading || showingCountdown) ? 'action.disabledBackground' : 'highlight.dark'
                },
                '&:disabled': {
                  opacity: 0.7
                }
              }}
            >
              {isPaused || showingCountdown ? <PlayArrowIcon fontSize="large" /> : <PauseIcon fontSize="large" />}
            </IconButton>
          </Grid>
          <Grid item>
            <IconButton 
              onClick={handleNext}
              disabled={exerciseIndex === totalExercises - 1 || isGifLoading || showingCountdown}
              sx={{ 
                width: 56,
                height: 56,
                borderRadius: 2,
                bgcolor: 'transparent',
                border: 1,
                borderColor: 'action.disabled',
                color: 'textColors.primary',
                '&:disabled': {
                  opacity: 0.5
                }
              }}
            >
              <SkipNextIcon fontSize="large" />
            </IconButton>
          </Grid>
        </Grid>
      </Box>

      {/* Модальное окно с описанием упражнения */}
      <Modal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        closeAfterTransition
        slots={{ backdrop: Backdrop }}
        slotProps={{
          backdrop: {
            timeout: 500,
          },
        }}
      >
        <Fade in={infoOpen}>
          <Box sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '90%', sm: '70%', md: '50%' },
            maxWidth: 600,
            maxHeight: '80vh',
            bgcolor: 'backgrounds.default',
            borderRadius: 2,
            boxShadow: 24,
            p: 4,
            overflowY: 'auto'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold' }}>
                {currentExercise?.name}
              </Typography>
              <IconButton onClick={() => setInfoOpen(false)} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
            <Typography sx={{ mt: 2 }}>
              {currentExercise?.description}
            </Typography>
          </Box>
        </Fade>
      </Modal>
    </Container>
  );
} 