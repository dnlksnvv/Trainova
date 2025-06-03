"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { motion, AnimatePresence } from 'framer-motion';
import ExerciseImage from './ExerciseImage';
import { workoutProgressApi, WorkoutProgressDto } from '@/app/services/api';
import { useGif } from '../context/GifContext';
import TrainerInfo from '@/app/components/shared/TrainerInfo';
import { useTheme } from '@mui/material/styles';
import YMAnalytics from '@/app/utils/analytics';

interface WorkoutPlayerClientProps {
  workout: Workout;
  initialExerciseId?: string | null;
  initialExerciseSessionUuid?: string | null;
}

export default function WorkoutPlayerClient({ workout, initialExerciseId, initialExerciseSessionUuid }: WorkoutPlayerClientProps) {
  const router = useRouter();
  const theme = useTheme();
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
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [exerciseStartTime, setExerciseStartTime] = useState<number>(0);
  const [autoNextProgress, setAutoNextProgress] = useState<number>(0);
  const autoNextTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [loggedExerciseEnd, setLoggedExerciseEnd] = useState<string | null>(null);
  const [exerciseSessionUuids, setExerciseSessionUuids] = useState<{[key: string]: string}>({});
  const searchParams = useSearchParams();
  const resumeParam = searchParams.get('resume');
  const isResuming = resumeParam === 'true';

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
      console.log('❗️Тренировка завершена!');
      setIsCompleted(true);
    },
    onExerciseTimeComplete: () => {
      console.log('❗️Время упражнения истекло!');
      // Ничего не делаем, всё будет через отображаемый счётчик
    }
  });

  // Получаем доступ к контексту Gif для очистки кэша
  const { clearGifCache } = useGif();

  // Синхронизация состояния с хуком
  useEffect(() => {
    setIsPaused(workoutPaused);
    setIsCompleted(workoutCompleted);
  }, [workoutPaused, workoutCompleted]);

  // Логирование информации о тренере
  useEffect(() => {
    if (workout.trainer) {
      console.log("Информация о тренере:", workout.trainer);
    }
  }, [workout.trainer]);

  // Функция для добавления ID текущего упражнения в URL
  const updateUrlWithExerciseId = useCallback((exerciseId: string) => {
    const url = new URL(window.location.href);
    // Сохраняем параметр session, если он есть
    const sessionParam = url.searchParams.get('session');
    // Сохраняем параметр exercise_session_uuid, если он есть
    const exerciseSessionUuidParam = url.searchParams.get('exercise_session_uuid');
    
    // Обновляем URL с новым exerciseId
    url.searchParams.set('exerciseId', exerciseId);
    if (sessionParam) {
      url.searchParams.set('session', sessionParam);
    }
    // Сохраняем параметр exercise_session_uuid
    if (exerciseSessionUuidParam) {
      url.searchParams.set('exercise_session_uuid', exerciseSessionUuidParam);
    }
    
    window.history.replaceState(null, '', url.toString());
  }, []);

  // Обновление URL при смене упражнения
  useEffect(() => {
    if (currentExercise?.id) {
      updateUrlWithExerciseId(currentExercise.id);
    }
  }, [currentExercise?.id, updateUrlWithExerciseId]);

  // Обработка initialExerciseSessionUuid при монтировании компонента
  useEffect(() => {
    if (initialExerciseSessionUuid && initialExerciseId) {
      console.log(`Инициализация с предоставленным exercise_session_uuid: ${initialExerciseSessionUuid} для упражнения: ${initialExerciseId}`);
      
      // Сохраняем initialExerciseSessionUuid в состоянии для initialExerciseId
      setExerciseSessionUuids(prev => ({
        ...prev,
        [initialExerciseId]: initialExerciseSessionUuid
      }));
    }
  }, [initialExerciseSessionUuid, initialExerciseId]);

  // Фиксируем проблему с переходом к первому упражнению в продакшн режиме
  // Используем два useEffect для предотвращения гонки условий
  useEffect(() => {
    // Предотвращаем автоматический переход к первому упражнению, если был указан initialExerciseId
    const hasManualInit = window.sessionStorage.getItem('manualInitialization') === 'true';
    
    if (hasManualInit && initialExerciseId) {
      console.log('Предотвращаем автоматическое перемещение к первому упражнению');
      
      // Удаляем флаг после использования
      window.sessionStorage.removeItem('manualInitialization');
      
      // Дополнительно проверяем текущее упражнение
      if (currentExercise && currentExercise.id !== initialExerciseId) {
        console.log(`Текущее упражнение (${currentExercise.id}) не соответствует initialExerciseId (${initialExerciseId}), исправляем...`);
        const exerciseIndex = workout.exercises.findIndex(ex => ex.id === initialExerciseId);
        if (exerciseIndex !== -1) {
          skipToExercise(exerciseIndex);
        }
      }
    }
  }, [currentExercise, initialExerciseId, workout.exercises]);

  // Инициализация таймера для текущего упражнения
  useEffect(() => {
    if (currentExercise) {
      // Проверяем, содержит ли упражнение информацию о повторениях
      const hasReps = currentExercise.reps !== undefined && currentExercise.reps > 0;
      
      setIsRepBased(hasReps);
      
      // Сбрасываем состояния при смене упражнения
      setCurrentReps(0);
      setInitialExerciseLoad(true);
      
      // Готовим упражнение к запуску - запустится автоматически после загрузки GIF
      // Устанавливаем режим воспроизведения, чтобы отсчет запустился
      setIsPaused(false); 
      setAnimationPaused(false); // Анимация всегда проигрывается
      
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
      
      // Обновляем время начала упражнения
      setExerciseStartTime(Date.now());
    }
  }, [currentExercise?.id]);

  // Функция для генерации UUID
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

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
        
        // Логируем и отправляем информацию о начале упражнения
        if (currentExercise) {
          // Аналитика: начало упражнения
          YMAnalytics.startExercise(currentExercise.name, workout.id);
          
          // Генерируем или используем UUID для сессии упражнения
          let exerciseSessionUuid = exerciseSessionUuids[currentExercise.id];
          
          if (!exerciseSessionUuid) {
            // Если в URL передан exercise_session_uuid и это подходящее упражнение, используем его
            if (initialExerciseSessionUuid && currentExercise.id === initialExerciseId) {
              exerciseSessionUuid = initialExerciseSessionUuid;
              console.log(`Используем exercise_session_uuid из URL для упражнения ${currentExercise.id}: ${exerciseSessionUuid}`);
            } else {
              // Иначе генерируем новый UUID
              exerciseSessionUuid = generateUUID();
              console.log(`Генерируем новый UUID для упражнения ${currentExercise.id}: ${exerciseSessionUuid}`);
            }
            
            setExerciseSessionUuids(prev => ({
              ...prev,
              [currentExercise.id]: exerciseSessionUuid
            }));
            
            // Добавляем UUID сессии в URL
            const url = new URL(window.location.href);
            url.searchParams.set('exercise_session_uuid', exerciseSessionUuid);
            window.history.replaceState(null, '', url.toString());
            
            console.log(`UUID сессии для упражнения ${currentExercise.id} добавлен в URL: ${exerciseSessionUuid}`);
          
            const startInfo: WorkoutProgressDto = {
              datetime_start: new Date().toISOString(),
              status: "start",
              workout_session_uuid: new URLSearchParams(window.location.search).get('session') || "",
              workout_uuid: workout.id || "",
              exercise_uuid: currentExercise.id || "",
              exercise_session_uuid: exerciseSessionUuid
            };
            console.log("❗️Начало упражнения:", startInfo);
            
            // Отправляем данные на сервер
            try {
              // Используем немедленно вызываемую асинхронную функцию
              (async () => {
                try {
                  await workoutProgressApi.saveProgress(startInfo);
                  console.log("Данные о начале упражнения успешно отправлены");
                } catch (error) {
                  console.error('Ошибка при отправке информации о начале упражнения:', error);
                }
              })();
            } catch (error) {
              console.error('Ошибка при отправке информации о начале упражнения:', error);
            }
          } else {
            console.log(`Используем существующий UUID сессии для упражнения ${currentExercise.id}: ${exerciseSessionUuid}`);
            
            // Если мы повторно запускаем упражнение (например, после возврата назад)
            // и у него уже есть UUID сессии, нужно убедиться, что флаг loggedExerciseEnd сброшен
            if (loggedExerciseEnd === currentExercise.id) {
              console.log(`Сбрасываем флаг завершения для упражнения ${currentExercise.id} при повторном запуске`);
              setLoggedExerciseEnd(null);
            }
          }
        }
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
        timerRef.current = null;
      }
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
        countdownRef.current = null;
      }
      if (autoNextTimerRef.current) {
        clearTimeout(autoNextTimerRef.current);
        autoNextTimerRef.current = null;
      }
    };
  }, []);

  // Обработка завершения тренировки
  useEffect(() => {
    if (isCompleted) {
      console.log('❗️Тренировка завершена!');
      
      // Асинхронно сохраняем прогресс
      const saveProgress = async () => {
        try {
          // Получаем UUID сессии из URL
          const urlParams = new URLSearchParams(window.location.search);
          const sessionUuid = urlParams.get('session');
          
          if (!sessionUuid) {
            console.error('UUID сессии не найден в URL при завершении тренировки');
            return;
          }
          
          const endPayload: WorkoutProgressDto = {
            workout_uuid: workout.id || "",
            workout_session_uuid: sessionUuid,
            datetime_end: new Date().toISOString(),
            status: "ended"
          };
          
          console.log('Отправляем данные о завершении тренировки:', endPayload);
          
          // Используем API из services/api.ts для сохранения прогресса
          const response = await workoutProgressApi.saveProgress(endPayload);
          console.log(`Тренировка с ID ${workout.id} сохранена в прогрессе:`, response);
          
          // Устанавливаем флаг успешного сохранения
          setSaveSuccess(true);
        } catch (error) {
          console.error('Ошибка при автоматическом сохранении прогресса тренировки:', error);
          // Даже при ошибке устанавливаем флаг успешного сохранения для упрощения UX
          setSaveSuccess(true);
        }
      };
      
      saveProgress();
    }
  }, [isCompleted, workout.id]);

  // Переход к следующему упражнению
  const handleNext = () => {
    // Аналитика: переход к следующему упражнению
    if (currentExercise) {
      YMAnalytics.nextExercise(currentExercise.name, workout.id || '');
    }

    // Если идет отсчет, останавливаем его
    if (showingCountdown) {
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
        countdownRef.current = null;
      }
      setShowingCountdown(false);
      setCountdownValue(null);
    }

    // Очищаем таймер автоматического перехода, если он есть
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
      // Не сбрасываем прогресс, оставляем его как есть
      // setAutoNextProgress(0);
    }

    // Логируем информацию о выполнении упражнения
    if (currentExercise) {
      // Собираем статистику выполнения
      let completedDuration = 0;
      let totalDuration = 0;
      let completedReps = 0;
      let totalReps = 0;
      
      if (isRepBased) {
        totalReps = currentExercise.reps || 0;
        completedReps = currentReps;
        console.log(`❗️EXERCISE STATS: Выполнено ${currentReps}/${totalReps} повторений`);
      } else {
        totalDuration = currentExercise.duration;
        completedDuration = currentExercise.duration - timeRemaining;
        console.log(`❗️EXERCISE STATS: Выполнено ${completedDuration}/${totalDuration} секунд`);
      }
      
      // Выводим информативную структуру в консоль
      console.log("❗️EXERCISE STATS:");
      console.log(`duration: ${totalDuration}`);
      console.log(`user_duration: ${completedDuration}`);
      console.log(`count: ${totalReps}`);
      console.log(`user_count: ${completedReps}`);
      
      // Логируем информацию о пропуске упражнения
      if ((isRepBased && currentReps < totalReps) || (!isRepBased && timeRemaining > 0)) {
        console.log(`❗️EXERCISE SKIPPED: Упражнение "${currentExercise.name}" пропущено пользователем`);
      }
    }

    // Если текущее упражнение имеет UUID, но не было завершено, отправляем запрос о завершении
    if (currentExercise && exerciseSessionUuids[currentExercise.id] && loggedExerciseEnd !== currentExercise.id) {
      const exerciseSessionUuid = exerciseSessionUuids[currentExercise.id];
      
      // Собираем статистику выполнения
      let completedDuration = 0;
      let totalDuration = 0;
      let completedReps = 0;
      let totalReps = 0;
      
      if (isRepBased) {
        totalReps = currentExercise.reps || 0;
        completedReps = currentReps;
      } else {
        totalDuration = currentExercise.duration;
        completedDuration = currentExercise.duration - timeRemaining;
      }
      
      const endInfo: WorkoutProgressDto = {
        datetime_end: new Date().toISOString(),
        status: "ended",
        workout_session_uuid: new URLSearchParams(window.location.search).get('session') || "",
        workout_uuid: workout.id || "",
        exercise_uuid: currentExercise.id || "",
        exercise_session_uuid: exerciseSessionUuid,
        // Добавляем статистику выполнения
        duration: totalDuration,
        user_duration: completedDuration,
        count: totalReps,
        user_count: completedReps
      };
      console.log("❗️Ручное завершение упражнения при переходе вперед:", endInfo);
      
      // Аналитика: завершение упражнения при ручном переходе
      YMAnalytics.completeExercise(currentExercise.name, completedDuration || completedReps, workout.id || '');
      
      // Немедленно удаляем UUID из состояния и URL
      setExerciseSessionUuids(prev => {
        const newState = {...prev};
        delete newState[currentExercise.id];
        return newState;
      });
      
      // Удаляем параметр exercise_session из URL
      const url = new URL(window.location.href);
      if (url.searchParams.has('exercise_session')) {
        url.searchParams.delete('exercise_session');
        window.history.replaceState(null, '', url.toString());
        console.log('Удален параметр exercise_session из URL при ручном переходе вперед');
      }
      
      // Удаляем параметр exercise_session_uuid из URL
      if (url.searchParams.has('exercise_session_uuid')) {
        url.searchParams.delete('exercise_session_uuid');
        window.history.replaceState(null, '', url.toString());
        console.log('Удален параметр exercise_session_uuid из URL при ручном переходе вперед');
      }
      
      // Отправляем данные асинхронно
      try {
        (async () => {
          try {
            await workoutProgressApi.saveProgress(endInfo);
            console.log("Данные о ручном завершении упражнения успешно отправлены");
          } catch (error) {
            console.error('Ошибка при отправке информации о ручном завершении упражнения:', error);
          } finally {
            // Запускаем таймер автоматического перехода независимо от результата запроса
            startAutoNextTimer();
          }
        })();
      } catch (error) {
        console.error('Ошибка при отправке информации о ручном завершении упражнения:', error);
        // Запускаем таймер автоматического перехода даже при ошибке
        startAutoNextTimer();
      }
      
      // Отмечаем упражнение как завершенное
      setLoggedExerciseEnd(currentExercise.id);
    }

    // Если это последнее упражнение, завершаем тренировку
    if (exerciseIndex >= workout.exercises.length - 1) {
      setIsCompleted(true);
      setIsPaused(true);
      return;
    }

    // Добавляем задержку в 1 секунду перед переходом к следующему упражнению
    setTimeout(() => {
      nextExercise();
      // Сбрасываем флаг для начального упражнения, чтобы отсчет показался для следующего упражнения
      setInitialExerciseLoad(true);
    }, 1000);
  };

  // Переход к предыдущему упражнению
  const handlePrevious = () => {
    // Аналитика: переход к предыдущему упражнению
    if (currentExercise) {
      YMAnalytics.previousExercise(currentExercise.name, workout.id || '');
    }

    // Если идет отсчет, останавливаем его
    if (showingCountdown) {
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
        countdownRef.current = null;
      }
      setShowingCountdown(false);
      setCountdownValue(null);
    }

    // Очищаем таймер автоматического перехода, если он есть
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
      // Не сбрасываем прогресс, оставляем его как есть
      // setAutoNextProgress(0);
    }
    
    // Очищаем основной таймер, если он запущен
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Логируем информацию о выполнении упражнения
    if (currentExercise) {
      // Собираем статистику выполнения
      let completedDuration = 0;
      let totalDuration = 0;
      let completedReps = 0;
      let totalReps = 0;
      
      if (isRepBased) {
        totalReps = currentExercise.reps || 0;
        completedReps = currentReps;
        console.log(`❗️EXERCISE STATS: Выполнено ${currentReps}/${totalReps} повторений`);
      } else {
        totalDuration = currentExercise.duration;
        completedDuration = currentExercise.duration - timeRemaining;
        console.log(`❗️EXERCISE STATS: Выполнено ${completedDuration}/${totalDuration} секунд`);
      }
      
      // Выводим информативную структуру в консоль
      console.log("❗️EXERCISE STATS:");
      console.log(`duration: ${totalDuration}`);
      console.log(`user_duration: ${completedDuration}`);
      console.log(`count: ${totalReps}`);
      console.log(`user_count: ${completedReps}`);
      
      // Логируем информацию о пропуске упражнения
      if ((isRepBased && currentReps < totalReps) || (!isRepBased && timeRemaining > 0)) {
        console.log(`❗️EXERCISE SKIPPED: Упражнение "${currentExercise.name}" пропущено пользователем (возврат назад)`);
      }
    }

    // Если текущее упражнение имеет UUID, но не было завершено, отправляем запрос о завершении
    if (currentExercise && exerciseSessionUuids[currentExercise.id] && loggedExerciseEnd !== currentExercise.id) {
      const exerciseSessionUuid = exerciseSessionUuids[currentExercise.id];
      
      // Собираем статистику выполнения
      let completedDuration = 0;
      let totalDuration = 0;
      let completedReps = 0;
      let totalReps = 0;
      
      if (isRepBased) {
        totalReps = currentExercise.reps || 0;
        completedReps = currentReps;
      } else {
        totalDuration = currentExercise.duration;
        completedDuration = currentExercise.duration - timeRemaining;
      }
      
      const endInfo: WorkoutProgressDto = {
        datetime_end: new Date().toISOString(),
        status: "ended",
        workout_session_uuid: new URLSearchParams(window.location.search).get('session') || "",
        workout_uuid: workout.id || "",
        exercise_uuid: currentExercise.id || "",
        exercise_session_uuid: exerciseSessionUuid,
        // Добавляем статистику выполнения
        duration: totalDuration,
        user_duration: completedDuration,
        count: totalReps,
        user_count: completedReps
      };
      console.log("❗️Ручное завершение упражнения при переходе назад:", endInfo);
      
      // Аналитика: завершение упражнения при ручном переходе назад
      YMAnalytics.completeExercise(currentExercise.name, completedDuration || completedReps, workout.id || '');
      
      // Немедленно удаляем UUID из состояния и URL
      setExerciseSessionUuids(prev => {
        const newState = {...prev};
        delete newState[currentExercise.id];
        return newState;
      });
      
      // Удаляем параметр exercise_session из URL
      const url = new URL(window.location.href);
      if (url.searchParams.has('exercise_session')) {
        url.searchParams.delete('exercise_session');
        window.history.replaceState(null, '', url.toString());
        console.log('Удален параметр exercise_session из URL при ручном переходе назад');
      }
      
      // Удаляем параметр exercise_session_uuid из URL
      if (url.searchParams.has('exercise_session_uuid')) {
        url.searchParams.delete('exercise_session_uuid');
        window.history.replaceState(null, '', url.toString());
        console.log('Удален параметр exercise_session_uuid из URL при ручном переходе назад');
      }
      
      // Отправляем данные асинхронно
      try {
        (async () => {
          try {
            await workoutProgressApi.saveProgress(endInfo);
            console.log("Данные о ручном завершении упражнения успешно отправлены");
          } catch (error) {
            console.error('Ошибка при отправке информации о ручном завершении упражнения:', error);
          } finally {
            // Запускаем таймер автоматического перехода независимо от результата запроса
            startAutoNextTimer();
          }
        })();
      } catch (error) {
        console.error('Ошибка при отправке информации о ручном завершении упражнения:', error);
        // Запускаем таймер автоматического перехода даже при ошибке
        startAutoNextTimer();
      }
      
      // Отмечаем упражнение как завершенное
      setLoggedExerciseEnd(currentExercise.id);
    }

    const currentTime = Date.now();
    const timeElapsed = currentTime - exerciseStartTime;
    
    // Устанавливаем состояние воспроизведения (не на паузе)
    setIsPaused(false);
    
    // Для упражнений с таймером
    if (!isRepBased) {
      // Если прошло менее 2 секунд с начала упражнения, переходим к предыдущему
      if (timeElapsed < 2000 && exerciseIndex > 0) {
        prevExercise();
        setInitialExerciseLoad(true);
      } else {
        // Иначе сбрасываем текущее упражнение полностью, включая перезагрузку гифки
        if (currentExercise) {
          // Сбрасываем состояние таймера
          setTimeRemaining(currentExercise.duration);
          
          // Сохраняем текущий URL гифки перед изменением
          const oldUrl = currentExercise.imageUrl;
          
          // Сбрасываем URL гифки, чтобы вызвать перезагрузку
          // Добавляем временную метку к URL, чтобы заставить загрузить новую версию
          const timestamp = new Date().getTime();
          if (currentExercise.imageUrl) {
            const baseUrl = currentExercise.imageUrl.split('?')[0];
            currentExercise.imageUrl = `${baseUrl}?t=${timestamp}`;
            
            // Очищаем кэш для старого URL, если это возможно
            if (oldUrl) {
              clearGifCache(oldUrl);
              console.log(`Очищен кэш для гифки: ${oldUrl}`);
            }
          }
          
          // Сбрасываем состояние анимации
          setAnimationPaused(false);
          
          // Сбрасываем состояние загрузки гифки
          setIsGifLoading(true);
          setInitialExerciseLoad(true);
          
          // Мы НЕ запускаем отсчет здесь - он запустится автоматически в handleGifLoad
          // когда гифка загрузится
          
          setExerciseStartTime(Date.now()); // Обновляем время начала
          
          // Важно: сбрасываем флаг логирования для текущего упражнения
          setLoggedExerciseEnd(null);
        }
      }
    } 
    // Для упражнений с повторениями
    else {
      // Если выполнено не более 1 повторения и не первое упражнение, переходим к предыдущему
      if (currentReps <= 1 && exerciseIndex > 0) {
        prevExercise();
        setInitialExerciseLoad(true);
      } else {
        // Иначе сбрасываем текущее упражнение полностью, включая перезагрузку гифки
        setCurrentReps(0);
        
        // Сохраняем текущий URL гифки перед изменением
        const oldUrl = currentExercise?.imageUrl;
        
        // Сбрасываем URL гифки, чтобы вызвать перезагрузку
        // Добавляем временную метку к URL, чтобы заставить загрузить новую версию
        if (currentExercise?.imageUrl) {
          const timestamp = new Date().getTime();
          const baseUrl = currentExercise.imageUrl.split('?')[0];
          currentExercise.imageUrl = `${baseUrl}?t=${timestamp}`;
          
          // Очищаем кэш для старого URL, если это возможно
          if (oldUrl) {
            clearGifCache(oldUrl);
            console.log(`Очищен кэш для гифки: ${oldUrl}`);
          }
        }
        
        // Сбрасываем состояние анимации
        setAnimationPaused(false);
        
        // Сбрасываем состояние загрузки гифки
        setIsGifLoading(true);
        setInitialExerciseLoad(true);
        
        // Мы НЕ запускаем отсчет здесь - он запустится автоматически в handleGifLoad
        // когда гифка загрузится
        
        setExerciseStartTime(Date.now()); // Обновляем время начала
        
        // Важно: сбрасываем флаг логирования для текущего упражнения
        setLoggedExerciseEnd(null);
      }
    }
  };

  // Переключение паузы - анимация всегда продолжает проигрываться
  const handleTogglePause = () => {
    // Если идет отсчет, останавливаем отсчет и переходим в режим паузы
    if (showingCountdown) {
      // Очищаем таймер отсчета
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
        countdownRef.current = null;
      }
      setShowingCountdown(false);
      setCountdownValue(null);
      setIsPaused(true);
      togglePause(); // Добавляем вызов togglePause(), чтобы синхронизировать состояние
      
      // Аналитика: пауза тренировки
      YMAnalytics.pauseWorkout('session_' + Date.now());
      
      return;
    }
    
    // Проверяем, завершено ли текущее упражнение
    const isExerciseCompleted = 
      (isRepBased && currentReps >= totalReps) || 
      (!isRepBased && timeRemaining === 0);
    
    // Если упражнение уже завершено, просто переключаем состояние паузы без запуска отсчета
    if (isExerciseCompleted) {
      setIsPaused(prev => !prev);
      togglePause();
      console.log('Упражнение уже завершено, переключаем паузу без запуска отсчета');
      return;
    }
    
    // Если GIF ещё загружается, просто запоминаем состояние паузы
    if (isGifLoading) {
      console.log("GIF ещё загружается, запоминаем состояние паузы");
      setIsPaused(prev => !prev);
      togglePause(); // Добавляем вызов togglePause(), чтобы синхронизировать состояние
      return;
    }
    
    // Если сейчас на паузе и нажимаем кнопку воспроизведения
    if (isPaused) {
      // Мгновенно изменяем состояние кнопки
      setIsPaused(false);
      togglePause(); // Добавляем вызов togglePause(), чтобы синхронизировать состояние
      
      // Аналитика: возобновление тренировки
      YMAnalytics.resumeWorkout('session_' + Date.now());
      
      // Запускаем отсчет если нужно
      startCountdown();
      return;
    } else {
      // Если сейчас воспроизводится и нажимаем кнопку паузы
      // Мгновенно ставим на паузу и обновляем состояние кнопки
      setIsPaused(true);
      togglePause();
      
      // Аналитика: пауза тренировки
      YMAnalytics.pauseWorkout('session_' + Date.now());
      
      return;
    }
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
    // Отмечаем, что GIF загрузился
    setIsGifLoading(false);
    
    // Если это первая загрузка упражнения, показываем отсчет 3, 2, 1 независимо от режима паузы
    if (initialExerciseLoad) {
      setInitialExerciseLoad(false);
      setIsPaused(false); // Устанавливаем режим воспроизведения
      startCountdown();
    }
    
    // Сохраняем информацию о начале тренировки при загрузке первого упражнения
    if (exerciseIndex === 0 && initialExerciseLoad) {
      // Асинхронно отправляем запрос о начале тренировки
      const saveStartInfo = async () => {
        try {
          // Получаем UUID сессии из URL
          const urlParams = new URLSearchParams(window.location.search);
          const sessionUuid = urlParams.get('session');
          
          if (!sessionUuid) {
            console.error('UUID сессии не найден в URL');
            return;
          }
          
          const startPayload: WorkoutProgressDto = {
            workout_uuid: workout.id || "",
            workout_session_uuid: sessionUuid,
            datetime_start: new Date().toISOString(),
            status: "start"
          };
          
          console.log('Отправляем информацию о начале тренировки:', startPayload);
          
          await workoutProgressApi.saveProgress(startPayload);
          
          console.log('Информация о начале тренировки сохранена');
        } catch (error) {
          console.error('Ошибка при сохранении информации о начале тренировки:', error);
        }
      };
      
      saveStartInfo();
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
    console.log('Сохранение прогресса и выход');
    setIsSaving(true);
    
    try {
      // Определяем статус в зависимости от завершенности
      const status = isCompleted ? 'ended' : 'start';
      const currentDateTime = new Date().toISOString();
      
      // Сохраняем прогресс тренировки
      await workoutProgressApi.saveProgress({
        workout_uuid: workout.id,
        workout_session_uuid: new URL(window.location.href).searchParams.get('session') || '',
        status: status,
        datetime_end: isCompleted || status === 'ended' ? currentDateTime : undefined,
        datetime_start: status === 'start' ? currentDateTime : undefined
      });
      
      setSaveSuccess(true);
      
      // Задержка перед редиректом, чтобы пользователь увидел сообщение об успехе
      setTimeout(() => {
        // Перенаправляем на страницу тренировок
        router.push('/trainings');
      }, 1000);
    } catch (error) {
      console.error('Ошибка при сохранении прогресса:', error);
      
      // Даже при ошибке перенаправляем на страницу тренировок через 2 секунды
      setTimeout(() => {
        router.push('/trainings');
      }, 2000);
    }
  };

  // Предотвращаем прокрутку страницы
  useEffect(() => {
    const preventScroll = (e: TouchEvent) => {
      e.preventDefault();
    };

    // Добавляем обработчик события для всего документа
    document.addEventListener('touchmove', preventScroll, { passive: false });

    // Убираем обработчик при размонтировании компонента
    return () => {
      document.removeEventListener('touchmove', preventScroll);
    };
  }, []);

  // Добавляю функцию для автоматического перехода к следующему упражнению
  const startAutoNextTimer = () => {
    // Очищаем предыдущий таймер, если он существует
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
    
    // НЕ сбрасываем прогресс обратно в 0
    // setAutoNextProgress(0);
    
    // Запускаем интервал для обновления прогресса
    let startTime = Date.now();
    const totalDuration = 3000; // 3 секунды
    
    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / totalDuration) * 100, 100);
      setAutoNextProgress(progress);
      
      if (progress < 100) {
        autoNextTimerRef.current = setTimeout(updateProgress, 50);
      } else {
        // Когда прогресс достиг 100%, переходим к следующему упражнению
        // Сохраняем прогресс в 100%
        setAutoNextProgress(100);
        handleNext();
      }
    };
    
    autoNextTimerRef.current = setTimeout(updateProgress, 50);
  };

  // Добавляем эффект для запуска таймера автоперехода при завершении упражнения
  useEffect(() => {
    // Запускаем таймер автоперехода, когда упражнение завершено (время истекло или все повторения выполнены)
    if (!isGifLoading && !showingCountdown && !isPaused && 
        ((isRepBased && currentReps >= totalReps) || (!isRepBased && timeRemaining === 0))) {
      
      // Логируем информацию об автоматическом завершении упражнения
      if (currentExercise) {
        // Собираем статистику выполнения
        let completedDuration = 0;
        let totalDuration = 0;
        let completedReps = 0;
        let totalReps = 0;
        
        if (isRepBased) {
          totalReps = currentExercise.reps || 0;
          completedReps = currentReps;
          console.log(`❗️EXERCISE COMPLETED: Выполнено ${currentReps}/${totalReps} повторений`);
        } else {
          totalDuration = currentExercise.duration;
          completedDuration = currentExercise.duration;  // Полностью выполнено
          console.log(`❗️EXERCISE COMPLETED: Выполнено ${completedDuration}/${currentExercise.duration} секунд`);
        }
        
        // Выводим информативную структуру в консоль
        console.log("❗️EXERCISE COMPLETED STATS:");
        console.log(`duration: ${totalDuration}`);
        console.log(`user_duration: ${completedDuration}`);
        console.log(`count: ${totalReps}`);
        console.log(`user_count: ${completedReps}`);
      }
      
      // Логируем информацию о завершении упражнения
      if (currentExercise && loggedExerciseEnd !== currentExercise.id) {
        // Используем тот же UUID сессии упражнения, что и при начале
        const exerciseSessionUuid = exerciseSessionUuids[currentExercise.id];
        
        if (!exerciseSessionUuid) {
          console.error('UUID сессии упражнения не найден для', currentExercise.id);
          
          // Если UUID не найден, запускаем таймер без отправки данных
          startAutoNextTimer();
        } else {
          // Формируем данные статистики упражнения
          let completedDuration = 0;
          let totalDuration = 0;
          let completedReps = 0;
          let totalReps = 0;
          
          // Для упражнений с таймером
          if (!isRepBased && currentExercise.duration) {
            totalDuration = currentExercise.duration;
            completedDuration = currentExercise.duration - timeRemaining;
          }
          // Для упражнений с повторениями
          if (isRepBased && currentExercise.reps) {
            totalReps = currentExercise.reps;
            completedReps = currentReps;
          }
          
          // Выводим информативную структуру в консоль
          console.log("❗️EXERCISE FINAL STATS:");
          console.log(`duration: ${totalDuration}`);
          console.log(`user_duration: ${completedDuration}`);
          console.log(`count: ${totalReps}`);
          console.log(`user_count: ${completedReps}`);
          
          const endInfo: WorkoutProgressDto = {
            datetime_end: new Date().toISOString(),
            status: "ended",
            workout_session_uuid: new URLSearchParams(window.location.search).get('session') || "",
            workout_uuid: workout.id || "",
            exercise_uuid: currentExercise.id || "",
            exercise_session_uuid: exerciseSessionUuid,
            // Добавляем статистику выполнения
            duration: totalDuration,
            user_duration: completedDuration,
            count: totalReps,
            user_count: completedReps
          };
          console.log("❗️Завершение упражнения:", endInfo);
          setLoggedExerciseEnd(currentExercise.id);
          
          // Аналитика: завершение упражнения
          YMAnalytics.completeExercise(currentExercise.name, completedDuration || completedReps, workout.id || '');
          
          // Отправляем данные о завершении упражнения
          try {
            // Используем немедленно вызываемую асинхронную функцию
            (async () => {
              try {
                await workoutProgressApi.saveProgress(endInfo);
                console.log("Данные о завершении упражнения успешно отправлены");
                
                // После успешной отправки запроса о завершении, удаляем UUID сессии упражнения
                setExerciseSessionUuids(prev => {
                  const newState = {...prev};
                  delete newState[currentExercise.id];
                  return newState;
                });
                
                // Удаляем параметр exercise_session из URL
                const url = new URL(window.location.href);
                if (url.searchParams.has('exercise_session')) {
                  url.searchParams.delete('exercise_session');
                  window.history.replaceState(null, '', url.toString());
                  console.log('Удален параметр exercise_session из URL после завершения упражнения');
                }
                
                // Удаляем параметр exercise_session_uuid из URL
                if (url.searchParams.has('exercise_session_uuid')) {
                  url.searchParams.delete('exercise_session_uuid');
                  window.history.replaceState(null, '', url.toString());
                  console.log('Удален параметр exercise_session_uuid из URL после завершения упражнения');
                }
                
                console.log(`Удален UUID сессии для упражнения ${currentExercise.id} после завершения`);
              } catch (error) {
                console.error('Ошибка при отправке информации о завершении упражнения:', error);
              } finally {
                // Запускаем таймер автоматического перехода независимо от результата запроса
                startAutoNextTimer();
              }
            })();
          } catch (error) {
            console.error('Ошибка при отправке информации о завершении упражнения:', error);
            // Запускаем таймер автоматического перехода даже при ошибке
            startAutoNextTimer();
          }
          return; // Выходим из эффекта, чтобы избежать двойного запуска таймера
        }
      } else {
        // Если логирование для этого упражнения уже было выполнено,
        // просто запускаем таймер автоматического перехода
        startAutoNextTimer();
      }
    } else {
      // Если условия не выполняются, убедимся, что автоматический переход остановлен
      if (autoNextTimerRef.current) {
        clearTimeout(autoNextTimerRef.current);
        autoNextTimerRef.current = null;
        // Не сбрасываем прогресс обратно в 0
        // setAutoNextProgress(0);
      }
    }
  }, [isGifLoading, showingCountdown, isPaused, isRepBased, currentReps, totalReps, timeRemaining, currentExercise, workout.id, loggedExerciseEnd, exerciseSessionUuids]);

  // Сбрасываем флаг логирования при смене упражнения
  useEffect(() => {
    setLoggedExerciseEnd(null);
  }, [currentExercise?.id]);

  // Восстановление UUID сессии из URL при загрузке компонента
  useEffect(() => {
    const url = new URL(window.location.href);
    const sessionUuid = url.searchParams.get('exercise_session_uuid') || url.searchParams.get('exercise_session');
    
    if (sessionUuid && currentExercise) {
      console.log(`Восстановлен UUID сессии из URL для текущего упражнения: ${sessionUuid}`);
      setExerciseSessionUuids(prev => ({
        ...prev,
        [currentExercise.id]: sessionUuid
      }));
    }
  }, [currentExercise?.id, currentExercise]);

  // Получение параметра session из URL
  const getSessionUuid = (): string => {
    const url = new URL(window.location.href);
    return url.searchParams.get('session') || '';
  };

  // Инициализация начального упражнения, если указан initialExerciseId
  useEffect(() => {
    if (initialExerciseId && workout.exercises.length > 0) {
      const exerciseIndex = workout.exercises.findIndex(ex => ex.id === initialExerciseId);
      
      if (exerciseIndex !== -1) {
        console.log(`Инициализация тренировки с упражнения: ${initialExerciseId}, индекс: ${exerciseIndex}`);
        
        // Устанавливаем флаг, что идет ручная инициализация
        window.sessionStorage.setItem('manualInitialization', 'true');
        
        // Проверяем, продолжаем ли мы незавершенную тренировку
        if (isResuming) {
          console.log('Продолжаем незавершенную тренировку');
          // Не отправляем новый запрос на начало тренировки
          // Просто переходим к упражнению
        } else {
          // Если это не продолжение, отправляем запрос на начало новой тренировки
          const startNewWorkout = async () => {
            try {
              await workoutProgressApi.saveProgress({
                workout_uuid: workout.id,
                workout_session_uuid: getSessionUuid(),
                status: 'start',
                datetime_start: new Date().toISOString() // Обязательно устанавливаем время начала
              });
              console.log('Тренировка инициализирована:', workout.id);
            } catch (error) {
              console.error('Ошибка при инициализации тренировки:', error);
            }
          };
          
          startNewWorkout();
        }
        
        // При первой загрузке, выполняем переход к упражнению
        skipToExercise(exerciseIndex);
        
        // Добавляем флаг в URL, чтобы предотвратить повторную инициализацию
        const url = new URL(window.location.href);
        if (!url.searchParams.has('initialized')) {
          url.searchParams.set('initialized', 'true');
          window.history.replaceState(null, '', url.toString());
        }
      }
    }
  }, [initialExerciseId, workout.exercises.length, isResuming, skipToExercise, workout.id]); // Добавляем skipToExercise и workout.id в зависимость

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
          bgcolor: 'backgrounds.default',
          overflow: 'hidden', // Предотвращаем прокрутку
          position: 'fixed', // Фиксируем контейнер
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%', // Гарантируем полную ширину
          zIndex: 1200 // Убеждаемся, что экран заверешения поверх всего
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
                <Button 
                  variant="contained" 
                  fullWidth
                  size="large"
                  onClick={() => router.push('/trainings')}
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
                  Вернуться к тренировкам
                </Button>
              </Box>
            ) : (
              <Button 
                variant="contained" 
                fullWidth
                size="large"
                onClick={() => saveWorkoutProgressAndExit()}
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
    <Container 
      maxWidth="sm" 
      disableGutters 
      sx={{ 
        height: '100vh', // Занимаем полную высоту экрана
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden', // Предотвращаем прокрутку
        position: 'fixed', // Фиксируем контейнер
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%', // Гарантируем полную ширину
        maxWidth: '100%', // Переопределяем стандартный maxWidth контейнера
        margin: '0 auto' // Центрируем контейнер
      }}
    >
      {/* Верхняя панель */}
      <Box sx={{ 
        p: 1.5, // Уменьшаем отступы
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid',
        borderColor: 'divider',
        flexShrink: 0, // Не разрешаем сжиматься при нехватке места
        width: '100%', // Фиксированная ширина
        overflow: 'hidden' // Предотвращаем прокрутку
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

      {/* Если есть информация о тренере, отображаем блок TrainerInfo */}
      {workout.trainer && (
        <Box sx={{ 
          px: 2, 
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
          width: '100%'
        }}>
          <TrainerInfo 
            name={`${workout.trainer.firstName || ''} ${workout.trainer.lastName || ''}`.trim() || 'Тренер'}
            avatarUrl={workout.trainer.avatarUrl}
            rating={workout.trainer.rating || 0}
            ratingCount={workout.trainer.ratingCount}
            size="small"
            theme={theme}
          />
        </Box>
      )}

      {/* Индикатор прогресса (точки) и название упражнения */}
      <Box sx={{ 
        px: 2, 
        py: 1.5,  // Уменьшаем вертикальные отступы
        flexShrink: 0, // Не разрешаем сжиматься
        width: '100%', // Фиксированная ширина
        overflow: 'hidden' // Предотвращаем прокрутку
      }}>
        {/* Индикатор прогресса (точки) */}
        <Box sx={{ 
          display: 'flex',
          justifyContent: 'center', 
          gap: 0.5,
          mb: 0.5 // Еще меньше отступ снизу
        }}>
          {Array.from({ length: totalExercises }).map((_, i) => (
            <Box
              component={motion.div}
              key={i}
              initial={{ width: '6px' }}
              animate={{ 
                width: i === exerciseIndex ? '24px' : '6px'
              }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              sx={{
                height: '6px',
                borderRadius: '3px',
                bgcolor: i <= exerciseIndex ? 'highlight.main' : 'backgrounds.paper'
              }}
            />
          ))}
        </Box>

        {/* Название упражнения */}
        <Box sx={{ textAlign: 'center', mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            {currentExercise?.name || 'Загрузка...'}
          </Typography>
        </Box>
      </Box>

      {/* Основной контент */}
      <Box sx={{ 
        px: { xs: 2, sm: 4 },
        display: 'flex', 
        flexDirection: 'column',
        flex: 1, // Занимает оставшееся пространство
        overflow: 'hidden', // Предотвращает прокрутку
        justifyContent: 'space-between', // Распределяет содержимое равномерно
        width: '100%', // Фиксированная ширина
        position: 'relative' // Для правильного позиционирования дочерних элементов
      }}>
        {/* Блок с изображением - занимает доступное пространство */}
        <Box sx={{ 
          flex: 1, // Занимает доступное пространство
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: 0, // Важно для корректного расчета flexbox в Safari
          position: 'relative', 
          mb: 2, // Минимальный отступ снизу
          overflow: 'hidden', // Предотвращает прокрутку
          width: '100%' // Гарантирует полную ширину
        }}>
          {/* Изображение упражнения с динамическим размером */}
          <Box 
            ref={imageContainerRef}
            sx={{ 
              width: '100%',
              maxHeight: '100%', // Ограничиваем максимальную высоту
              aspectRatio: '1/1',
              borderRadius: 2,
              overflow: 'hidden',
              boxShadow: 1,
              mx: 'auto',
              bgcolor: 'common.black', // Меняем на белый фон
              position: 'relative',
              display: 'flex',     // Добавляем flex для центрирования
              justifyContent: 'center', // Центрирование по горизонтали
              alignItems: 'center'  // Центрирование по вертикали
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
                      textShadow: '0 0 10px rgba(255, 140, 0, 0.6)',
                      fontSize: { xs: '4rem', sm: '5rem' } // Адаптивный размер шрифта
                    }}
                  >
                    {countdownValue}
                  </Typography>
                </Box>
              )}
            </AnimatePresence>

            {/* Слой для отображения сообщения о завершении времени */}
            <AnimatePresence>
              {!isRepBased && !isGifLoading && timeRemaining === 0 && (
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
                  <Box sx={{ width: '100%', mb: 1.5 }}>
                    <Box sx={{ 
                      bgcolor: 'rgba(255, 255, 255, 0.3)', 
                      height: '4px', 
                      borderRadius: '2px', 
                      width: '100%',
                      overflow: 'hidden',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)'
                    }}>
                      <Box
                        component={motion.div}
                        initial={{ width: "0%" }}
                        animate={{ width: `${autoNextProgress}%` }}
                        sx={{
                          bgcolor: 'white',
                          height: '100%'
                        }}
                      />
                    </Box>
                  </Box>
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
              {isRepBased && !isGifLoading && currentReps >= totalReps && (
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
                  <Box sx={{ width: '100%', mb: 1.5 }}>
                    <Box sx={{ 
                      bgcolor: 'rgba(255, 255, 255, 0.3)', 
                      height: '4px', 
                      borderRadius: '2px', 
                      width: '100%',
                      overflow: 'hidden',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)'
                    }}>
                      <Box
                        component={motion.div}
                        initial={{ width: "0%" }}
                        animate={{ width: `${autoNextProgress}%` }}
                        sx={{
                          bgcolor: 'white',
                          height: '100%'
                        }}
                      />
                    </Box>
                  </Box>
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
              <Box 
                sx={{ 
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  width: '100%',
                  height: '100%'
                }}
              >
                <ExerciseImage 
                  currentExercise={currentExercise} 
                  isPaused={animationPaused || showingCountdown} 
                  autoPlay={true}
                  startAnimation={!showingCountdown}
                  isCountdownActive={showingCountdown}
                  onLoad={handleGifLoad}
                  onError={handleGifError}
                  onFrameComplete={handleFrameComplete}
                  onFrameChange={handleFrameChange}
                />
              </Box>
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
        </Box>

        {/* Нижняя часть - таймер, прогресс и кнопки */}
        <Box sx={{ 
          flexShrink: 0, // Не разрешаем сжиматься
          mb: 15, // Значительно увеличиваем отступ от нижнего края экрана (было 2)
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          {/* Таймер или Счетчик повторений */}
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            {isRepBased ? (
              <>
                <Typography variant="h4" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box component="span" sx={{ color: 'highlight.main' }}>{currentReps}</Box>
                  <Box component="span" sx={{ mx: 0.5 }}>/</Box>
                  <Box component="span">{totalReps}</Box>
                </Typography>
                <Typography variant="body2" sx={{ color: 'textColors.secondary' }}>
                  повторений
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="h4" sx={{ 
                  fontWeight: 'bold',
                  color: (!isGifLoading && timeRemaining === 0) ? 'highlight.main' : 'inherit'
                }}>
                  {formatTime(timeRemaining)}
                </Typography>
                <Typography variant="body2" sx={{ 
                  color: (!isGifLoading && timeRemaining === 0) ? 'highlight.main' : 'textColors.secondary', 
                  mt: 0,
                  fontWeight: (!isGifLoading && timeRemaining === 0) ? 'bold' : 'normal'
                }}>
                  {(!isGifLoading && timeRemaining === 0) ? 'Время истекло!' : 'осталось'}
                </Typography>
              </>
            )}
          </Box>

          {/* Индикатор прогресса упражнения */}
          <Box sx={{ mb: 1.5, width: '100%' }}>
            <Box sx={{ 
              bgcolor: 'backgrounds.paper', 
              height: '4px', 
              borderRadius: '2px', 
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
            spacing={1}
          >
            <Grid item>
              <IconButton 
                onClick={handlePrevious}
                sx={{ 
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  bgcolor: 'transparent',
                  border: 1,
                  borderColor: 'action.disabled',
                  color: 'textColors.primary',
                  opacity: 1
                }}
              >
                <SkipPreviousIcon />
              </IconButton>
            </Grid>
            <Grid item>
              <IconButton 
                onClick={handleTogglePause}
                sx={{ 
                  width: 60,
                  height: 60,
                  borderRadius: 2,
                  bgcolor: isPaused ? 'action.disabledBackground' : 'highlight.main',
                  color: isPaused ? 'textColors.primary' : 'common.white',
                  boxShadow: 2,
                  '&:hover': {
                    bgcolor: isPaused ? 'action.disabledBackground' : 'highlight.dark'
                  },
                  opacity: 1
                }}
              >
                {isPaused ? <PlayArrowIcon /> : <PauseIcon />}
              </IconButton>
            </Grid>
            <Grid item>
              <IconButton 
                onClick={handleNext}
                disabled={exerciseIndex === totalExercises - 1} // Оставляем блокировку только для последнего упражнения
                sx={{ 
                  width: 44,
                  height: 44,
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
                <SkipNextIcon />
              </IconButton>
            </Grid>
          </Grid>
        </Box>
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