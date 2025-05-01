import { useState, useEffect, useCallback, useRef } from 'react';
import { Exercise, Workout } from '../../../types';

interface UseWorkoutProps {
  workout: Workout;
  onComplete?: () => void;
  onExerciseTimeComplete?: () => void;
}

interface UseWorkoutReturn {
  currentExercise: Exercise | null;
  exerciseIndex: number;
  totalExercises: number;
  progress: number;
  isCompleted: boolean;
  isPaused: boolean;
  remainingTime: number;
  elapsedTime: number;
  totalTime: number;
  nextExercise: () => void;
  prevExercise: () => void;
  togglePause: () => void;
  resetWorkout: () => void;
  resetCurrentExercise: () => void;
  skipToExercise: (index: number) => void;
  exerciseElapsedTime: number;
  isTimeComplete: boolean;
}

export const useWorkout = ({ workout, onComplete, onExerciseTimeComplete }: UseWorkoutProps): UseWorkoutReturn => {
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [exerciseElapsedTime, setExerciseElapsedTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isTimeComplete, setIsTimeComplete] = useState(false);
  
  const totalExercises = workout.exercises.length;
  const currentExercise = exerciseIndex < totalExercises ? workout.exercises[exerciseIndex] : null;
  
  // Вычисляем общее время тренировки
  const totalTime = workout.exercises.reduce((total: number, exercise: Exercise) => total + exercise.duration, 0);
  
  // Вычисляем прогресс тренировки (от 0 до 1)
  const progress = totalTime > 0 ? elapsedTime / totalTime : 0;

  // Установка времени для текущего упражнения
  useEffect(() => {
    if (currentExercise) {
      setRemainingTime(currentExercise.duration);
      setExerciseElapsedTime(0);
      setIsTimeComplete(false);
    }
  }, [exerciseIndex, currentExercise]);

  // Обработка таймера
  useEffect(() => {
    if (isCompleted || isPaused || !currentExercise) return;
    
    // Проверяем тип упражнения
    // Если упражнение основано на повторениях (есть поле reps), то не используем автоматический таймер
    if (currentExercise.reps !== undefined && currentExercise.reps > 0) {
      return; // Для упражнений с повторениями выходим из этого эффекта
    }

    const timer = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          
          // Больше не переходим к следующему упражнению автоматически
          // Вместо этого устанавливаем флаг завершения времени и вызываем колбэк
          setIsTimeComplete(true);
          
          // Вызываем колбэк, если он предоставлен
          if (onExerciseTimeComplete) {
            onExerciseTimeComplete();
          }
          
          return 0;
        }
        return prev - 1;
      });
      
      setElapsedTime(prev => prev + 1);
      setExerciseElapsedTime(prev => prev + 1); // Увеличиваем счетчик времени упражнения
    }, 1000);

    return () => clearInterval(timer);
  }, [exerciseIndex, isPaused, isCompleted, currentExercise, onExerciseTimeComplete]);

  // Функция для перехода к следующему упражнению
  const nextExercise = useCallback(() => {
    if (exerciseIndex < totalExercises - 1) {
      setExerciseIndex(prev => prev + 1);
    } else {
      // Если это последнее упражнение, отмечаем тренировку как завершенную
      setIsCompleted(true);
      onComplete?.();
    }
  }, [exerciseIndex, totalExercises, onComplete]);

  // Функция для перехода к предыдущему упражнению с новой логикой
  const prevExercise = useCallback(() => {
    // Если прошло более 1 секунды в текущем упражнении, сбрасываем текущее упражнение
    if (exerciseElapsedTime > 1) {
      resetCurrentExercise();
    } 
    // Иначе переходим к предыдущему упражнению, если это возможно
    else if (exerciseIndex > 0) {
      setExerciseIndex(prev => prev - 1);
    }
  }, [exerciseIndex, exerciseElapsedTime]);

  // Сброс текущего упражнения
  const resetCurrentExercise = useCallback(() => {
    if (currentExercise) {
      setRemainingTime(currentExercise.duration);
      setExerciseElapsedTime(0);
      setIsTimeComplete(false);
    }
  }, [currentExercise]);

  // Переключение состояния паузы
  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  // Сброс тренировки
  const resetWorkout = useCallback(() => {
    setExerciseIndex(0);
    setElapsedTime(0);
    setExerciseElapsedTime(0);
    setIsPaused(false);
    setIsCompleted(false);
    setIsTimeComplete(false);
  }, []);

  // Перейти к определенному упражнению
  const skipToExercise = useCallback((index: number) => {
    if (index >= 0 && index < totalExercises) {
      setExerciseIndex(index);
    }
  }, [totalExercises]);

  return {
    currentExercise,
    exerciseIndex,
    totalExercises,
    progress,
    isCompleted,
    isPaused,
    remainingTime,
    elapsedTime,
    totalTime,
    nextExercise,
    prevExercise,
    togglePause,
    resetWorkout,
    resetCurrentExercise,
    skipToExercise,
    exerciseElapsedTime,
    isTimeComplete
  };
}; 