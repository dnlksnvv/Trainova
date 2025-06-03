'use client';

import { useEffect, useRef, useCallback } from 'react';
import YMAnalytics from '@/app/utils/analytics';

interface UseWorkoutAnalyticsProps {
  workoutId: string;
  workoutName?: string;
  source?: string;
  autoStart?: boolean;
}

export function useWorkoutAnalytics({ 
  workoutId, 
  workoutName, 
  source = 'app',
  autoStart = true 
}: UseWorkoutAnalyticsProps) {
  const sessionIdRef = useRef<string | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Начало тренировки
  const startWorkout = useCallback(() => {
    if (sessionIdRef.current) {
      console.warn('⚠️  Тренировка уже начата');
      return sessionIdRef.current;
    }

    sessionIdRef.current = YMAnalytics.startWorkout(workoutId, workoutName, source);
    
    // Запускаем отправку прогресса каждые 5 минут
    progressIntervalRef.current = setInterval(() => {
      if (sessionIdRef.current) {
        YMAnalytics.workoutProgress(sessionIdRef.current);
      }
    }, 5 * 60 * 1000); // 5 минут

    return sessionIdRef.current;
  }, [workoutId, workoutName, source]);

  // Завершение тренировки
  const endWorkout = useCallback((completionStatus: 'completed' | 'abandoned' | 'paused' = 'completed') => {
    if (!sessionIdRef.current) {
      console.warn('⚠️  Тренировка не была начата');
      return 0;
    }

    // Очищаем интервал прогресса
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    const duration = YMAnalytics.endWorkout(sessionIdRef.current, completionStatus);
    sessionIdRef.current = null;
    
    return duration;
  }, []);

  // Пауза тренировки
  const pauseWorkout = useCallback(() => {
    if (sessionIdRef.current) {
      YMAnalytics.pauseWorkout(sessionIdRef.current);
    }
  }, []);

  // Возобновление тренировки
  const resumeWorkout = useCallback(() => {
    if (sessionIdRef.current) {
      YMAnalytics.resumeWorkout(sessionIdRef.current);
    }
  }, []);

  // Отслеживание начала упражнения
  const startExercise = useCallback((exerciseName: string) => {
    YMAnalytics.startExercise(exerciseName, workoutId);
  }, [workoutId]);

  // Отслеживание завершения упражнения
  const completeExercise = useCallback((exerciseName: string, duration?: number) => {
    YMAnalytics.completeExercise(exerciseName, duration, workoutId);
  }, [workoutId]);

  // Автоматический старт при монтировании компонента
  useEffect(() => {
    if (autoStart) {
      startWorkout();
    }

    // Завершаем тренировку при размонтировании компонента
    return () => {
      if (sessionIdRef.current) {
        endWorkout('abandoned');
      }
    };
  }, [autoStart, startWorkout, endWorkout]);

  // Очистка интервала при размонтировании
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  return {
    sessionId: sessionIdRef.current,
    startWorkout,
    endWorkout,
    pauseWorkout,
    resumeWorkout,
    startExercise,
    completeExercise
  };
} 