"use client";

import React, { useState, useEffect } from 'react';
import { Workout, Exercise } from '../../types';
import dynamic from 'next/dynamic';
import MainLayout from '../../components/layouts/MainLayout';
import { appWorkoutsApi } from '../../services/api';
import { Box, CircularProgress, Typography } from '@mui/material';

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

  return {
    id: appWorkout.app_workout_uuid,
    title: appWorkout.name,
    description: appWorkout.description || '',
    exercises
  };
}

export default function WorkoutPageClient({ workoutId }: WorkoutPageClientProps) {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <WorkoutPlayerClient workout={workout} />
    </MainLayout>
  );
} 
