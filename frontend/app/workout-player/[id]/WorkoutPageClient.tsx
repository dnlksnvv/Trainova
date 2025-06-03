"use client";

import React, { useState, useEffect } from 'react';
import { Workout, Exercise } from '../../types';
import dynamic from 'next/dynamic';
import MainLayout from '../../components/layouts/MainLayout';
import { appWorkoutsApi, workoutProgressApi, profileApi } from '../../services/api';
import { Box, CircularProgress, Typography } from '@mui/material';
import { v4 as uuidv4 } from 'uuid';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWorkoutAnalytics } from '../../hooks/useWorkoutAnalytics';

// Динамический импорт можно использовать только в клиентских компонентах
const WorkoutPlayerClient = dynamic(
  () => import('./components/WorkoutPlayerClient'),
  { ssr: false }
);

interface WorkoutPageClientProps {
  workoutId: string;
}

// Функция для преобразования данных с API в формат, ожидаемый компонентом
function mapAppWorkoutDtoToWorkout(appWorkout: any): Workout {
  // Ставим метку времени, чтобы сбросить кеш
  const timestamp = new Date().toISOString();
  console.log(`Mapping workout with timestamp: ${timestamp}`);
  
  // Принудительно очищаем кеш изображений добавляя timestamp к URL
  // Маппинг упражнений
  const exercises: Exercise[] = appWorkout.exercises.map((ex: any) => {
    // Добавляем отладочную информацию
    console.log(`Exercise: ${ex.exercise_name}, GIF UUID: ${ex.gif_uuid}, Count: ${ex.count}`);
    
    const imageUrl = ex.gif_uuid 
      ? `${process.env.API_URL}${process.env.WORKOUT_API_PREFIX}/exercises/gif/${ex.gif_uuid}?t=${timestamp}` 
      : undefined;
      
    console.log(`Generated image URL: ${imageUrl}`);
    
    return {
      id: ex.id || ex.exercise_id,
      name: ex.exercise_name,
      description: ex.exercise_description || '',
      duration: ex.duration || 30, // Если duration не указан, используем значение по умолчанию
      reps: ex.count || undefined, // Добавляем поле reps из поля count из API
      imageUrl
    };
  });

  // Создаем объект тренировки
  const workout: Workout = {
    id: appWorkout.app_workout_uuid,
    title: appWorkout.name,
    description: appWorkout.description || '',
    exercises
  };

  // Добавляем информацию о тренере, если она есть
  if (appWorkout.trainer_id || appWorkout.trainer_name || appWorkout.trainer_rating) {
    console.log(`Обрабатываем информацию о тренере:`, {
      id: appWorkout.trainer_id,
      firstName: appWorkout.trainer_first_name,
      lastName: appWorkout.trainer_last_name,
      rating: appWorkout.trainer_rating
    });
    
    workout.trainer = {
      id: appWorkout.trainer_id || '',
      firstName: appWorkout.trainer_first_name || '',
      lastName: appWorkout.trainer_last_name || '',
      avatarUrl: appWorkout.trainer_avatar_url,
      rating: typeof appWorkout.trainer_rating === 'number' ? appWorkout.trainer_rating : 0,
      ratingCount: appWorkout.trainer_rating_count || 0,
      description: appWorkout.trainer_description || ''
    };
    
    console.log(`Добавлена информация о тренере: ${JSON.stringify(workout.trainer)}`);
    
    // Если есть ID тренера, попробуем получить его актуальный рейтинг
    if (workout.trainer.id) {
      // Асинхронно обновляем рейтинг
      (async () => {
        try {
          console.log(`Запрашиваем рейтинг для тренера: ${workout.trainer!.id}`);
          const ratingData = await profileApi.getUserRating(workout.trainer!.id);
          console.log(`Получены данные о рейтинге тренера: `, ratingData);
          
          if (workout.trainer) {
            workout.trainer.rating = ratingData.rating;
            workout.trainer.ratingCount = ratingData.count;
            console.log(`Обновлен рейтинг тренера: ${ratingData.rating} (${ratingData.count} оценок)`);
          }
        } catch (error) {
          console.error('Ошибка при получении рейтинга тренера:', error);
        }
      })();
    }
  } else {
    console.log(`Нет информации о тренере в данных тренировки`);
  }

  return workout;
}

export default function WorkoutPageClient({ workoutId }: WorkoutPageClientProps) {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialExerciseId, setInitialExerciseId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Аналитика тренировки
  const workoutAnalytics = useWorkoutAnalytics({
    workoutId,
    workoutName: workout?.title,
    source: 'workout-player',
    autoStart: false // Не запускаем автоматически, запустим когда загрузятся данные
  });

  // Генерация UUID сессии при монтировании компонента или обновление существующей
  useEffect(() => {
    // Проверяем параметры маршрута
    const resumeParam = searchParams.get('resume');
    const restartParam = searchParams.get('restart');
    
    // Проверяем, есть ли в URL параметр session
    const sessionParam = searchParams.get('session');
    // Если параметр session уже есть в URL, используем его
    // Иначе генерируем новый UUID
    let sessionUuid = sessionParam;
    
    // Если указан параметр restart, создаем новую сессию
    if (restartParam === 'true') {
      console.log("Перезапуск тренировки, создаем новую сессию");
      sessionUuid = uuidv4();
      
      // Отправляем запрос для начала новой сессии
      workoutProgressApi.saveProgress({
        workout_uuid: workoutId,
        workout_session_uuid: sessionUuid,
        status: "start",
        datetime_start: new Date().toISOString() // Обязательно устанавливаем время начала
      }).catch(error => {
        console.error('Ошибка при создании новой сессии:', error);
      });
    } 
    // Если sessionUuid не был определён (не было ни session в URL, ни restart=true),
    // генерируем новый
    else if (!sessionUuid) {
      sessionUuid = uuidv4();
    }
    
    // Проверяем, есть ли в URL параметр exerciseId
    const exerciseIdParam = searchParams.get('exerciseId');
    if (exerciseIdParam) {
      console.log("Установка initialExerciseId из URL:", exerciseIdParam);
      setInitialExerciseId(exerciseIdParam);
    }
    
    // Добавляем UUID сессии в URL без перезагрузки страницы
    // Сохраняем параметр exerciseId, если он был указан
    const currentUrl = window.location.pathname;
    const queryParams = new URLSearchParams();
    queryParams.set('session', sessionUuid);
    if (exerciseIdParam) {
      queryParams.set('exerciseId', exerciseIdParam);
    }
    
    // Сохраняем параметр exercise_session_uuid, если он указан в URL
    const exerciseSessionUuidParam = searchParams.get('exercise_session_uuid');
    if (exerciseSessionUuidParam) {
      console.log("Найден exercise_session_uuid в URL:", exerciseSessionUuidParam);
      queryParams.set('exercise_session_uuid', exerciseSessionUuidParam);
    }
    
    // При резюме тренировки, сохраняем параметр resume
    if (resumeParam === 'true') {
      queryParams.set('resume', 'true');
    }
    
    const newUrl = `${currentUrl}?${queryParams.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, []);

  // Отдельный эффект для обработки initialExerciseId при изменении workout
  useEffect(() => {
    if (workout && initialExerciseId) {
      console.log("Проверяем наличие initialExerciseId в тренировке:", initialExerciseId);
      // Проверяем, существует ли упражнение с таким ID в текущей тренировке
      const exerciseExists = workout.exercises.some(ex => ex.id === initialExerciseId);
      
      if (!exerciseExists) {
        console.warn(`Упражнение с ID ${initialExerciseId} не найдено в тренировке ${workout.id}. Будет использовано первое упражнение.`);
        // Если упражнение не найдено, сбрасываем initialExerciseId
        setInitialExerciseId(null);
      } else {
        console.log(`Упражнение с ID ${initialExerciseId} найдено в тренировке ${workout.id}. Будет открыто это упражнение.`);
      }
    }
  }, [workout, initialExerciseId]);

  // Загрузка данных тренировки при монтировании компонента
  useEffect(() => {
    const fetchWorkout = async () => {
      try {
        setLoading(true);
        // Получаем данные тренировки с API
        const appWorkout = await appWorkoutsApi.getAppWorkoutById(workoutId);
        console.log("Received workout data:", appWorkout);
        
        // Преобразуем данные в ожидаемый формат
        const workoutData = mapAppWorkoutDtoToWorkout(appWorkout);
        console.log("Mapped workout data:", workoutData);
        
        setWorkout(workoutData);
        setError(null);
      } catch (error) {
        console.error('Ошибка при загрузке тренировки:', error);
        setError('Не удалось загрузить данные тренировки');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkout();
  }, [workoutId]);

  // Запуск аналитики когда тренировка загружена
  useEffect(() => {
    if (workout && !loading) {
      workoutAnalytics.startWorkout();
    }
  }, [workout, loading, workoutAnalytics]);

  // Получаем exercise_session_uuid из URL (если есть)
  const exerciseSessionUuid = searchParams.get('exercise_session_uuid');

  // Отображение состояния загрузки
  if (loading) {
    return (
      <MainLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  // Отображение ошибки
  if (error || !workout) {
    return (
      <MainLayout>
        <Box sx={{ textAlign: 'center', p: 3, minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Ошибка при загрузке тренировки
          </Typography>
          <Typography>
            {error || 'Не удалось загрузить данные тренировки. Пожалуйста, попробуйте позже.'}
          </Typography>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <WorkoutPlayerClient 
        workout={workout} 
        initialExerciseId={initialExerciseId} 
        initialExerciseSessionUuid={exerciseSessionUuid}
        analytics={workoutAnalytics}
      />
    </MainLayout>
  );
} 
