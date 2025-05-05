// API клиент для работы с сервисами

// Базовый URL тренировочного сервиса из переменных окружения или по умолчанию
export const API_URL = process.env.API_URL;
export const WORKOUT_API_PREFIX = process.env.WORKOUT_API_PREFIX;


// Функция для получения токена из хранилища
const getAccessToken = (): string | null => {
  // Используем localStorage, если доступен (только на клиенте)
  if (typeof window !== 'undefined') {
    return document.cookie
      .split('; ')
      .find(row => row.startsWith('access_token='))
      ?.split('=')[1] || null;
  }
  return null;
};

// Общая функция для выполнения запросов с авторизацией
export async function fetchWithAuth<T>(
  url: string, 
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken();
  
  const headers = new Headers(options.headers);
  
  // Не устанавливаем Content-Type для multipart/form-data запросов (загрузка файлов)
  if (!options.body || !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Неизвестная ошибка' }));
    throw new Error(error.detail || `Ошибка ${response.status}`);
  }
  
  return await response.json();
}

// Перечисление для групп мышц
export enum MuscleGroupEnum {
  CHEST = "chest",
  BACK = "back",
  LEGS = "legs",
  SHOULDERS = "shoulders",
  ARMS = "arms",
  ABS = "abs",
  FULL_BODY = "full_body",
  CARDIO = "cardio",
  OTHER = "other"
}

// Интерфейсы для работы с группами мышц
export interface MuscleGroup {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MuscleGroupCreate {
  name: string;
  description?: string;
}

export interface MuscleGroupUpdate {
  name?: string;
  description?: string;
}

// Интерфейсы для работы с упражнениями
export interface Exercise {
  exercise_id: string;
  title: string;
  description: string;
  muscle_group_id?: number;
  muscle_group_name?: string;
  gif_uuid?: string; // UUID для GIF-анимации
}

export interface ExerciseCreate {
  title: string;
  description: string;
  muscle_group_id: number | null;
  gif_uuid?: string; // Опционально при создании
}

export interface ExerciseUpdate {
  title?: string;
  description?: string;
  muscle_group_id?: number | null;
  gif_uuid?: string | null; // Опционально при обновлении, null для удаления
}

// API для работы с группами мышц
export const muscleGroupsApi = {
  // Получение всех групп мышц
  getAll: async (): Promise<MuscleGroup[]> => {
    return fetchWithAuth<MuscleGroup[]>(`${API_URL}${WORKOUT_API_PREFIX}/muscle-groups`);
  },
  
  // Получение группы мышц по ID
  getById: async (id: number): Promise<MuscleGroup> => {
    return fetchWithAuth<MuscleGroup>(`${API_URL}${WORKOUT_API_PREFIX}/muscle-groups/${id}`);
  },
  
  // Создание новой группы мышц
  create: async (data: MuscleGroupCreate): Promise<MuscleGroup> => {
    return fetchWithAuth<MuscleGroup>(`${API_URL}${WORKOUT_API_PREFIX}/muscle-groups`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  // Обновление группы мышц
  update: async (id: number, data: MuscleGroupUpdate): Promise<MuscleGroup> => {
    return fetchWithAuth<MuscleGroup>(`${API_URL}${WORKOUT_API_PREFIX}/muscle-groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  // Удаление группы мышц
  delete: async (id: number): Promise<boolean> => {
    return fetchWithAuth<boolean>(`${API_URL}${WORKOUT_API_PREFIX}/muscle-groups/${id}`, {
      method: 'DELETE',
    });
  },
  
  // Получение упражнений по группе мышц
  getExercises: async (id: number): Promise<Exercise[]> => {
    return fetchWithAuth<Exercise[]>(`${API_URL}${WORKOUT_API_PREFIX}/muscle-groups/${id}/exercises`);
  },
};

// API для работы с упражнениями
export const exercisesApi = {
  // Получение всех упражнений
  getAll: async (): Promise<Exercise[]> => {
    return fetchWithAuth<Exercise[]>(`${API_URL}${WORKOUT_API_PREFIX}/exercises`);
  },
  
  // Получение упражнения по ID
  getById: async (exercise_id: string): Promise<Exercise> => {
    return fetchWithAuth<Exercise>(`${API_URL}${WORKOUT_API_PREFIX}/exercises/${exercise_id}`);
  },
  
  // Создание нового упражнения
  create: async (data: ExerciseCreate): Promise<Exercise> => {
    return fetchWithAuth<Exercise>(`${API_URL}${WORKOUT_API_PREFIX}/exercises`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  // Создание упражнения с загрузкой GIF
  createWithGif: async (data: ExerciseCreate, gifFile: File): Promise<Exercise> => {
    // Создаем упражнение
    const exercise = await exercisesApi.create(data);
    
    // Затем загружаем GIF, если он есть
    if (gifFile) {
      return exercisesApi.uploadGif(exercise.exercise_id, gifFile);
    }
    
    return exercise;
  },
  
  // Новый метод для создания упражнения с одновременной загрузкой GIF
  createExerciseWithGif: async (exerciseData: Omit<ExerciseCreate, 'gif_uuid'>, gifFile: File | null): Promise<Exercise> => {
    // Если нет GIF-файла, используем обычный метод создания
    if (!gifFile) {
      return exercisesApi.create(exerciseData);
    }
    
    // Сначала создаем упражнение
    const createdExercise = await exercisesApi.create(exerciseData);
    
    try {
      // Затем загружаем GIF
      const exerciseWithGif = await exercisesApi.uploadGif(createdExercise.exercise_id, gifFile);
      return exerciseWithGif;
    } catch (error) {
      // В случае ошибки при загрузке GIF, возвращаем созданное упражнение без GIF
      console.error('Ошибка при загрузке GIF:', error);
      return createdExercise;
    }
  },
  
  // Обновление упражнения
  update: async (exercise_id: string, data: ExerciseUpdate): Promise<Exercise> => {
    return fetchWithAuth<Exercise>(`${API_URL}${WORKOUT_API_PREFIX}/exercises/${exercise_id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  // Удаление упражнения
  delete: async (exercise_id: string): Promise<boolean> => {
    return fetchWithAuth<boolean>(`${API_URL}${WORKOUT_API_PREFIX}/exercises/${exercise_id}`, {
      method: 'DELETE',
    });
  },
  
  // Получение упражнений по ID группы мышц
  getByMuscleGroupId: async (muscle_group_id: number): Promise<Exercise[]> => {
    return fetchWithAuth<Exercise[]>(`${API_URL}${WORKOUT_API_PREFIX}/muscle-groups/${muscle_group_id}/exercises`);
  },
  
  // Загрузка GIF для упражнения
  uploadGif: async (exercise_id: string, file: File): Promise<Exercise> => {
    const formData = new FormData();
    formData.append('gif_file', file);
    
    const token = getAccessToken();
    const headers = new Headers();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    
    const response = await fetch(`${API_URL}${WORKOUT_API_PREFIX}/exercises/${exercise_id}/upload-gif`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: headers
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Ошибка при загрузке GIF' }));
      throw new Error(errorData.detail || `Ошибка при загрузке GIF: ${response.status}`);
    }
    
    return response.json();
  },
  
  // Удаление GIF для упражнения
  deleteGif: async (exercise_id: string): Promise<Exercise> => {
    const token = getAccessToken();
    const headers = new Headers();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    
    const response = await fetch(`${API_URL}${WORKOUT_API_PREFIX}/exercises/${exercise_id}/delete-gif`, {
      method: 'DELETE',
      credentials: 'include',
      headers: headers
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Ошибка при удалении GIF' }));
      throw new Error(errorData.detail || `Ошибка при удалении GIF: ${response.status}`);
    }
    
    return await response.json();
  },
  
  // Получение URL для GIF
  getGifUrl: (gif_uuid: string): string => {
    if (!gif_uuid) return '';
    return `${API_URL}${WORKOUT_API_PREFIX}/exercises/gif/${gif_uuid}`;
  }
};

// Добавляем методы для работы с тренировками

// Интерфейс для тренировок
export interface TrainingDto {
  training_id?: number;
  title: string;
  description?: string;
  is_public?: boolean;
  exercises: TrainingExerciseDto[];
  created_at?: string;
  updated_at?: string;
  last_workout_at?: string;
}

// Интерфейс для упражнений в тренировке
export interface TrainingExerciseDto {
  id?: number;
  exercise_id: number;
  repetitions?: number;
  duration?: number;
  order?: number;
}

// API для работы с тренировками
export const trainingsApi = {
  // Получение списка всех тренировок пользователя
  getTrainings: async (): Promise<TrainingDto[]> => {
    try {
      const response = await fetch(`${API_URL}${WORKOUT_API_PREFIX}/trainings`);
      if (!response.ok) {
        throw new Error('Не удалось получить список тренировок');
      }
      return await response.json();
    } catch (error) {
      console.error('Ошибка при получении списка тренировок:', error);
      throw error;
    }
  },

  // Получение конкретной тренировки по ID
  getTrainingById: async (trainingId: string | number): Promise<TrainingDto> => {
    try {
      const response = await fetch(`${API_URL}${WORKOUT_API_PREFIX}/trainings/${trainingId}`);
      if (!response.ok) {
        throw new Error(`Не удалось получить тренировку с ID ${trainingId}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Ошибка при получении тренировки с ID ${trainingId}:`, error);
      throw error;
    }
  },

  // Создание новой тренировки
  createTraining: async (trainingData: TrainingDto): Promise<TrainingDto> => {
    try {
      const response = await fetch(`${API_URL}${WORKOUT_API_PREFIX}/trainings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(trainingData),
      });
      if (!response.ok) {
        throw new Error('Не удалось создать тренировку');
      }
      return await response.json();
    } catch (error) {
      console.error('Ошибка при создании тренировки:', error);
      throw error;
    }
  },

  // Обновление существующей тренировки
  updateTraining: async (trainingId: string | number, trainingData: TrainingDto): Promise<TrainingDto> => {
    try {
      const response = await fetch(`${API_URL}${WORKOUT_API_PREFIX}/trainings/${trainingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(trainingData),
      });
      if (!response.ok) {
        throw new Error(`Не удалось обновить тренировку с ID ${trainingId}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Ошибка при обновлении тренировки с ID ${trainingId}:`, error);
      throw error;
    }
  },

  // Удаление тренировки
  deleteTraining: async (trainingId: string | number): Promise<void> => {
    try {
      const response = await fetch(`${API_URL}${WORKOUT_API_PREFIX}/trainings/${trainingId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`Не удалось удалить тренировку с ID ${trainingId}`);
      }
    } catch (error) {
      console.error(`Ошибка при удалении тренировки с ID ${trainingId}:`, error);
      throw error;
    }
  }
};

// Интерфейсы для пользовательских тренировок (app_workouts)
export interface AppWorkoutExerciseDto {
  id: string;
  app_workout_uuid: string;
  exercise_id: string;
  duration: number | null;
  count: number | null;
  created_at: string;
  updated_at: string;
  exercise_name: string;
  exercise_description: string;
  gif_uuid: string;
  muscle_group_name: string;
  muscle_group_id?: number;
  order: number;
}

export interface AppWorkoutDto {
  app_workout_uuid?: string;
  name: string;
  description?: string;
  exercises: AppWorkoutExerciseDto[];
  created_at?: string;
  updated_at?: string;
  // Новые поля для последней сессии тренировки
  last_session_uuid?: string;
  last_session_start?: string;
  last_session_stop?: string;
  last_session_status?: string;
  // Новые поля для последнего упражнения
  last_exercise_session_uuid?: string;
  last_exercise_start?: string;
  last_exercise_stop?: string;
  last_exercise_status?: string;
  // Общее время тренировки
  total_workout_time?: number;
}

// API для работы с пользовательскими тренировками
export const appWorkoutsApi = {
  // Получение списка всех пользовательских тренировок
  getAppWorkouts: async (orderBy?: string, limit?: number): Promise<AppWorkoutDto[]> => {
    try {
      // Формируем URL с параметрами запроса
      let url = `${API_URL}${WORKOUT_API_PREFIX}/app-workouts`;
      const params = new URLSearchParams();
      
      // Добавляем параметры, если они указаны
      if (orderBy) params.append('order_by', orderBy);
      if (limit) params.append('limit', limit.toString());
      
      // Добавляем параметры в URL, если они есть
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
      
      const response = await fetchWithAuth<AppWorkoutDto[]>(url);
      return response;
    } catch (error) {
      console.error('Ошибка при получении списка тренировок:', error);
      throw error;
    }
  },

  // Получение пользовательской тренировки по ID
  getAppWorkoutById: async (workoutUuid: string): Promise<AppWorkoutDto> => {
    try {
      const response = await fetchWithAuth<AppWorkoutDto>(`${API_URL}${WORKOUT_API_PREFIX}/app-workouts/${workoutUuid}`);
      return response;
    } catch (error) {
      console.error(`Ошибка при получении тренировки с ID ${workoutUuid}:`, error);
      throw error;
    }
  },

  // Создание новой пользовательской тренировки
  createAppWorkout: async (workoutData: AppWorkoutDto): Promise<AppWorkoutDto> => {
    try {
      const response = await fetchWithAuth<AppWorkoutDto>(`${API_URL}${WORKOUT_API_PREFIX}/app-workouts`, {
        method: 'POST',
        body: JSON.stringify(workoutData),
      });
      return response;
    } catch (error) {
      console.error('Ошибка при создании тренировки:', error);
      throw error;
    }
  },

  // Обновление существующей пользовательской тренировки
  updateAppWorkout: async (workoutUuid: string, workoutData: AppWorkoutDto): Promise<AppWorkoutDto> => {
    try {
      const response = await fetchWithAuth<AppWorkoutDto>(`${API_URL}${WORKOUT_API_PREFIX}/app-workouts/${workoutUuid}`, {
        method: 'PUT',
        body: JSON.stringify(workoutData),
      });
      return response;
    } catch (error) {
      console.error(`Ошибка при обновлении тренировки с ID ${workoutUuid}:`, error);
      throw error;
    }
  },

  // Удаление пользовательской тренировки
  deleteAppWorkout: async (workoutUuid: string): Promise<boolean> => {
    try {
      const response = await fetchWithAuth<boolean>(`${API_URL}${WORKOUT_API_PREFIX}/app-workouts/${workoutUuid}`, {
        method: 'DELETE',
      });
      return response;
    } catch (error) {
      console.error(`Ошибка при удалении тренировки с ID ${workoutUuid}:`, error);
      throw error;
    }
  },

  getAllTrainings: async (): Promise<AppWorkoutDto[]> => {
    const response = await fetch(`${API_URL}${WORKOUT_API_PREFIX}/trainings`);
    if (!response.ok) {
      throw new Error(`Ошибка при получении тренировок: ${response.status}`);
    }
    return response.json();
  },

  getTrainingById: async (trainingId: string): Promise<AppWorkoutDto> => {
    const response = await fetch(`${API_URL}${WORKOUT_API_PREFIX}/trainings/${trainingId}`);
    if (!response.ok) {
      throw new Error(`Ошибка при получении тренировки: ${response.status}`);
    }
    return response.json();
  },

  createTraining: async (trainingData: AppWorkoutDto): Promise<AppWorkoutDto> => {
    const response = await fetch(`${API_URL}${WORKOUT_API_PREFIX}/trainings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(trainingData),
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка при создании тренировки: ${response.status}`);
    }
    
    return response.json();
  },

  updateTraining: async (trainingId: string, trainingData: AppWorkoutDto): Promise<AppWorkoutDto> => {
    const response = await fetch(`${API_URL}${WORKOUT_API_PREFIX}/trainings/${trainingId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(trainingData),
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка при обновлении тренировки: ${response.status}`);
    }
    
    return response.json();
  },

  deleteTraining: async (trainingId: string): Promise<boolean> => {
    const response = await fetch(`${API_URL}${WORKOUT_API_PREFIX}/trainings/${trainingId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка при удалении тренировки: ${response.status}`);
    }
    
    return true;
  }
};

// Интерфейс для данных пользовательской активности
export interface UserActivity {
  record_date: string;
  workout_count: number;
  weight: number | null;
}

// API для работы с данными активности пользователя
export const userActivityApi = {
  // Получение данных активности за период
  getActivity: async (startDate?: string, endDate?: string): Promise<UserActivity[]> => {
    let url = `${API_URL}${WORKOUT_API_PREFIX}/user-activity`;
    
    // Добавляем параметры запроса, если они указаны
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
    
    // Пользователь определяется по токену на бэкенде
    return fetchWithAuth<UserActivity[]>(url);
  },
  
  // Обновление данных активности
  updateActivity: async (activityData: UserActivity): Promise<UserActivity> => {
    // ID пользователя определяется на бэкенде по токену авторизации
    return fetchWithAuth<UserActivity>(`${API_URL}${WORKOUT_API_PREFIX}/user-activity`, {
      method: 'POST',
      body: JSON.stringify(activityData),
    });
  }
};

// Интерфейс для отправки данных о прогрессе тренировки
export interface WorkoutProgressDto {
  workout_uuid?: string;
  workout_session_uuid: string;
  status: "start" | "ended";
  datetime_start?: string; // UTC время старта тренировки
  datetime_end?: string;   // UTC время окончания тренировки
  exercise_uuid?: string;  // UUID упражнения (если отслеживается упражнение)
  exercise_session_uuid?: string; // UUID сессии упражнения (для отслеживания конкретного выполнения)
  duration?: number;      // Заданная длительность упражнения в секундах
  user_duration?: number; // Фактически выполненная длительность упражнения в секундах
  count?: number;         // Заданное количество повторений
  user_count?: number;    // Фактически выполненное количество повторений
}

// API для работы с прогрессом тренировок
export const workoutProgressApi = {
  // Сохранение прогресса тренировки
  saveProgress: async (data: WorkoutProgressDto): Promise<any> => {
    console.log('Отправляем данные прогресса тренировки:', JSON.stringify(data));
    
    return fetchWithAuth<any>(`${API_URL}${WORKOUT_API_PREFIX}/user-activity/save-progress`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
}; 