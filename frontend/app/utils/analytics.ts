// Простой модуль для работы с Яндекс Метрикой
declare global {
  interface Window {
    ym: (counterId: number, method: string, ...params: any[]) => void;
  }
}

const YANDEX_METRIKA_ID = 102273732;

// Хранилище активных сессий для отслеживания времени
interface ActiveSession {
  startTime: number;
  workoutId: string;
  workoutName?: string;
  source?: string;
}

class SessionTracker {
  private activeSessions: Map<string, ActiveSession> = new Map();

  // Начало сессии тренировки
  startWorkoutSession(workoutId: string, workoutName?: string, source?: string): string {
    const sessionId = `workout_${workoutId}_${Date.now()}`;
    
    this.activeSessions.set(sessionId, {
      startTime: Date.now(),
      workoutId,
      workoutName,
      source
    });

    // Отправляем событие начала тренировки
    YMAnalytics.goal('workout_started', {
      workout_id: workoutId,
      workout_name: workoutName,
      source: source || 'app',
      session_id: sessionId
    });

    console.log(`🏁 Начата тренировка: ${workoutName || workoutId} (${sessionId})`);
    return sessionId;
  }

  // Завершение сессии тренировки
  endWorkoutSession(sessionId: string, completionStatus: 'completed' | 'abandoned' | 'paused' = 'completed'): number {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      console.warn(`⚠️  Сессия ${sessionId} не найдена`);
      return 0;
    }

    const duration = Math.round((Date.now() - session.startTime) / 1000); // в секундах
    
    // Отправляем событие завершения тренировки
    YMAnalytics.goal('workout_ended', {
      workout_id: session.workoutId,
      workout_name: session.workoutName,
      duration_seconds: duration,
      duration_minutes: Math.round(duration / 60),
      completion_status: completionStatus,
      source: session.source || 'app',
      session_id: sessionId
    });

    // Дополнительные цели в зависимости от статуса
    if (completionStatus === 'completed') {
      YMAnalytics.goal('workout_completed', {
        workout_id: session.workoutId,
        duration_minutes: Math.round(duration / 60)
      });
    }

    this.activeSessions.delete(sessionId);
    console.log(`🏆 Завершена тренировка: ${session.workoutName || session.workoutId}, время: ${Math.round(duration / 60)} мин (${completionStatus})`);
    
    return duration;
  }

  // Получение активных сессий
  getActiveSessions(): Map<string, ActiveSession> {
    return this.activeSessions;
  }

  // Отправка промежуточных событий (например, каждые 5 минут)
  sendProgressUpdate(sessionId: string, currentExercise?: string): void {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) return;

    const duration = Math.round((Date.now() - session.startTime) / 1000);
    
    YMAnalytics.goal('workout_progress', {
      workout_id: session.workoutId,
      duration_seconds: duration,
      current_exercise: currentExercise,
      session_id: sessionId
    });
  }
}

const sessionTracker = new SessionTracker();

// Простой экспорт функций для работы с аналитикой
export const YMAnalytics = {
  // Отправка цели
  goal: (target: string, params?: Record<string, any>) => {
    if (typeof window !== 'undefined' && window.ym) {
      window.ym(YANDEX_METRIKA_ID, 'reachGoal', target, params);
      console.log(`🎯 Цель отправлена: ${target}`, params);
    } else {
      console.warn('⚠️  Яндекс Метрика не загружена');
    }
  },

  // Отправка события просмотра страницы
  pageView: (url?: string) => {
    if (typeof window !== 'undefined' && window.ym) {
      window.ym(YANDEX_METRIKA_ID, 'hit', url);
      console.log(`📄 Просмотр страницы: ${url}`);
    } else {
      console.warn('⚠️  Яндекс Метрика не загружена');
    }
  },

  // Отправка пользовательских параметров
  setUserParams: (params: Record<string, any>) => {
    if (typeof window !== 'undefined' && window.ym) {
      window.ym(YANDEX_METRIKA_ID, 'userParams', params);
      console.log(`👤 Пользовательские параметры:`, params);
    } else {
      console.warn('⚠️  Яндекс Метрика не загружена');
    }
  },

  // Отправка параметров визита
  setVisitParams: (params: Record<string, any>) => {
    if (typeof window !== 'undefined' && window.ym) {
      window.ym(YANDEX_METRIKA_ID, 'params', params);
      console.log(`🔍 Параметры визита:`, params);
    } else {
      console.warn('⚠️  Яндекс Метрика не загружена');
    }
  },

  // === МЕТОДЫ ДЛЯ ТРЕНИРОВОК ===
  
  // Начало тренировки
  startWorkout: (workoutId: string, workoutName?: string, source?: string): string => {
    return sessionTracker.startWorkoutSession(workoutId, workoutName, source);
  },

  // Завершение тренировки
  endWorkout: (sessionId: string, completionStatus: 'completed' | 'abandoned' | 'paused' = 'completed'): number => {
    return sessionTracker.endWorkoutSession(sessionId, completionStatus);
  },

  // Отправка прогресса тренировки
  workoutProgress: (sessionId: string, currentExercise?: string): void => {
    sessionTracker.sendProgressUpdate(sessionId, currentExercise);
  },

  // Начало упражнения
  startExercise: (exerciseName: string, workoutId?: string): void => {
    YMAnalytics.goal('exercise_started', {
      exercise_name: exerciseName,
      workout_id: workoutId
    });
  },

  // Завершение упражнения
  completeExercise: (exerciseName: string, duration?: number, workoutId?: string): void => {
    YMAnalytics.goal('exercise_completed', {
      exercise_name: exerciseName,
      duration_seconds: duration,
      workout_id: workoutId
    });
  },

  // Пауза тренировки
  pauseWorkout: (sessionId: string): void => {
    YMAnalytics.goal('workout_paused', {
      session_id: sessionId
    });
  },

  // Возобновление тренировки
  resumeWorkout: (sessionId: string): void => {
    YMAnalytics.goal('workout_resumed', {
      session_id: sessionId
    });
  },

  // Переход к следующему упражнению
  nextExercise: (exerciseName: string, workoutId?: string): void => {
    YMAnalytics.goal('exercise_next', {
      exercise_name: exerciseName,
      workout_id: workoutId,
      direction: 'forward'
    });
  },

  // Переход к предыдущему упражнению
  previousExercise: (exerciseName: string, workoutId?: string): void => {
    YMAnalytics.goal('exercise_previous', {
      exercise_name: exerciseName,
      workout_id: workoutId,
      direction: 'backward'
    });
  },

  // === МЕТОДЫ ДЛЯ КУРСОВ И УРОКОВ ===

  // Открытие урока в курсе
  openLesson: (lessonName: string, courseId: string, lessonId?: string): void => {
    YMAnalytics.goal('lesson_opened', {
      lesson_name: lessonName,
      course_id: courseId,
      lesson_id: lessonId,
      timestamp: new Date().toISOString()
    });
  },

  // Просмотр видео урока
  watchVideo: (lessonName: string, courseId: string, lessonId?: string): void => {
    YMAnalytics.goal('lesson_video_watched', {
      lesson_name: lessonName,
      course_id: courseId,
      lesson_id: lessonId,
      timestamp: new Date().toISOString()
    });
  },

  // Завершение урока
  completeLesson: (lessonName: string, courseId: string, duration?: number, lessonId?: string): void => {
    YMAnalytics.goal('lesson_completed', {
      lesson_name: lessonName,
      course_id: courseId,
      lesson_id: lessonId,
      duration_seconds: duration,
      timestamp: new Date().toISOString()
    });
  },

  // Открытие курса
  openCourse: (courseName: string, courseId: string): void => {
    YMAnalytics.goal('course_opened', {
      course_name: courseName,
      course_id: courseId,
      timestamp: new Date().toISOString()
    });
  },

  // Подписка на курс
  subscribeCourse: (courseName: string, courseId: string, price?: number): void => {
    YMAnalytics.goal('course_subscribed', {
      course_name: courseName,
      course_id: courseId,
      price: price,
      timestamp: new Date().toISOString()
    });
  },

  // Получение бесплатного доступа к курсу
  getFreeAccess: (courseName: string, courseId: string): void => {
    YMAnalytics.goal('course_free_access', {
      course_name: courseName,
      course_id: courseId,
      timestamp: new Date().toISOString()
    });
  }
};

export default YMAnalytics; 

// Успешно протестировано на 03.06.2025 - Работоспособно