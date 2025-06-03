// API клиент для работы с сервисами

// Базовый URL тренировочного сервиса из переменных окружения или по умолчанию
export const API_URL = process.env.API_URL;
export const WORKOUT_API_PREFIX = process.env.WORKOUT_API_PREFIX;
export const AUTH_API_PREFIX = process.env.AUTH_API_PREFIX;
export const PROFILE_API_PREFIX = process.env.PROFILE_API_PREFIX;
export const COURSE_API_PREFIX = process.env.COURSE_API_PREFIX;

// Отладочный вывод значений для проверки
console.log('API Service - API URL:', API_URL);
console.log('API Service - AUTH PREFIX:', AUTH_API_PREFIX);
console.log('API Service - WORKOUT PREFIX:', WORKOUT_API_PREFIX);
console.log('API Service - PROFILE PREFIX:', PROFILE_API_PREFIX);
console.log('API Service - COURSE PREFIX:', COURSE_API_PREFIX);

// Функция для получения полного URL для запросов
export const getFullUrl = (prefix: string, path: string): string => {
  // Проверяем, нужно ли добавлять базовый URL
  if (API_URL) {
    // Если базовый URL есть, добавляем его
    return `${API_URL}${prefix}${path.startsWith('/') ? path : `/${path}`}`;
  } else {
    // Если базовый URL пустой, используем только префикс и путь
    return `${prefix}${path.startsWith('/') ? path : `/${path}`}`;
  }
};

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

// =================== PROFILE API INTERFACES ===================

// Интерфейс профиля пользователя
export interface ProfileResponse {
  user_id: string;
  email: string;
  role_id: number;
  is_verified: boolean;
  first_name: string;
  last_name: string;
  description: string | null;
  avatar_url: string | null;
}

// Интерфейс публичного профиля пользователя (только общедоступные данные)
export interface PublicProfileResponse {
  user_id: string;
  first_name: string;
  last_name: string;
  description: string | null;
  avatar_url: string | null;
}

// Интерфейс обновления профиля
export interface ProfileUpdateRequest {
  first_name?: string;
  last_name?: string;
  description?: string;
}

// Интерфейс изменения имени
export interface ChangeNameRequest {
  first_name?: string;
  last_name?: string;
}

// Интерфейс изменения аватара
export interface ChangeAvatarRequest {
  avatar_url: string;
}

// Интерфейс изменения описания
export interface ChangeDescriptionRequest {
  description?: string;
}

// Интерфейс информации о подписке
export interface SubscriptionInfo {
  subscription_id: string;
  course_id: string;
  course_name: string;
  start_date: string;
  end_date?: string;
  status: string;
  price: number;
  recurring: boolean;
}

// Интерфейс списка подписок
export interface SubscriptionsResponse {
  subscriptions: SubscriptionInfo[];
}

// Интерфейс информации о платеже
export interface PaymentInfo {
  payment_id: string;
  course_id: string;
  course_name: string;
  payment_date: string;
  amount: number;
  status: string;
  payment_method: string;
}

// Интерфейс истории платежей
export interface PaymentsResponse {
  payments: PaymentInfo[];
}

// Интерфейс метода оплаты
export interface PaymentMethodResponse {
  method: string;
  payment_method_id: string;
  is_saved: boolean;
  is_default: boolean;
  is_verified: boolean;
  title?: string;
  card_last4?: string;
  card_type?: string;
  card_expiry_month?: string;
  card_expiry_year?: string;
  issuer_country?: string;
}

// Интерфейс изменения метода оплаты
export interface ChangePaymentMethodRequest {
  method: string;
  details: Record<string, any>;
}

// Интерфейс доступных методов оплаты
export interface AvailablePaymentMethodsResponse {
  methods: string[];
}

// Интерфейс ответа с сообщением
export interface MessageResponse {
  message: string;
}

// Интерфейс ответа с ошибкой
export interface ErrorResponse {
  detail: string;
}

// =================== COURSE API INTERFACES ===================

// Типы для курсов
export interface CourseCreate {
  name: string;
  description?: string;
  price?: number;
  duration?: number; // Длительность в секундах
  exercise_count: number;
  is_published: boolean;
}

export interface CourseUpdate {
  name?: string;
  description?: string;
  price?: number;
  duration?: number; // Длительность в секундах
  exercise_count?: number;
  is_published?: boolean;
}

export interface CourseResponse {
  course_uuid: string;
  user_id: number;
  name: string;
  description?: string;
  price?: number;
  duration?: number;
  exercise_count: number;
  rating: number;
  subscribers_count: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  has_subscription?: boolean;
  subscription_end_date?: string;
  muscle_groups?: MuscleGroupWithPercentage[];
}

export interface MuscleGroupWithPercentage {
  id: number;
  name: string;
  description?: string;
  percentage: number;
}

export interface CourseFilters {
  user_ids?: number[];
  current_subscribe?: boolean;
  muscle_group_ids?: number[];
  duration_min?: number;
  duration_max?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface CourseFilterRequest {
  filters?: CourseFilters;
}

// API для работы с курсами
export const coursesApi = {
  // Создание курса
  async create(course: CourseCreate): Promise<CourseResponse> {
    const token = getAccessToken();
    const response = await fetch(`${API_URL}${COURSE_API_PREFIX}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(course)
    });

    if (!response.ok) {
      throw new Error(`Ошибка создания курса: ${response.statusText}`);
    }

    return response.json();
  },

  // Получение курсов с фильтрацией (новый метод)
  async getCoursesWithFilters(filters?: CourseFilterRequest): Promise<CourseResponse[]> {
    const token = getAccessToken();
    const response = await fetch(`${API_URL}${COURSE_API_PREFIX}/courses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(filters || {})
    });

    if (!response.ok) {
      throw new Error(`Ошибка получения курсов: ${response.statusText}`);
    }

    return response.json();
  },

  // Получение курса по UUID
  async getById(id: string): Promise<CourseResponse> {
    const token = getAccessToken();
    const response = await fetch(`${API_URL}${COURSE_API_PREFIX}/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Неизвестная ошибка' }));
      const error = new Error(errorData.detail || `Ошибка получения курса: ${response.statusText}`) as any;
      error.response = {
        status: response.status,
        data: errorData
      };
      throw error;
    }

    return response.json();
  },

  // Получение курсов пользователя (старый метод, оставляем для совместимости)
  async getUserCourses(userId: number, publishedOnly: boolean = false): Promise<CourseResponse[]> {
    const token = getAccessToken();
    const response = await fetch(`${API_URL}${COURSE_API_PREFIX}/user/${userId}?published_only=${publishedOnly}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Ошибка получения курсов пользователя: ${response.statusText}`);
    }

    return response.json();
  },

  // Обновление курса
  async update(id: string, course: CourseUpdate): Promise<CourseResponse> {
    const token = getAccessToken();
    const response = await fetch(`${API_URL}${COURSE_API_PREFIX}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(course)
    });

    if (!response.ok) {
      throw new Error(`Ошибка обновления курса: ${response.statusText}`);
    }

    return response.json();
  },

  // Удаление курса
  async delete(id: string): Promise<void> {
    const token = getAccessToken();
    const response = await fetch(`${API_URL}${COURSE_API_PREFIX}/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Ошибка удаления курса: ${response.statusText}`);
    }
  },

  // Проверка здоровья сервиса курсов
  healthCheck: async (): Promise<{ service: string; status: string; message: string }> => {
    return fetchWithAuth(`${API_URL}${COURSE_API_PREFIX}/health`);
  },

  // Получение тренировок курса
  async getCourseWorkouts(courseId: string): Promise<CourseWorkoutResponse[]> {
    const token = getAccessToken();
    const response = await fetch(`${API_URL}${COURSE_API_PREFIX}/courses/${courseId}/workouts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Неизвестная ошибка' }));
      const error = new Error(errorData.detail || `Ошибка получения тренировок курса: ${response.statusText}`) as any;
      error.response = {
        status: response.status,
        data: errorData
      };
      throw error;
    }

    return response.json();
  }
};

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
  // Флаг видимости тренировки для других пользователей
  is_visible?: boolean;
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

// =================== PROFILE API ===================

// Интерфейс запроса на подписку на курс
export interface CourseSubscriptionRequest {
  course_uuid: string;
}

// Интерфейс ответа на запрос подписки на курс
export interface CourseSubscriptionResponse {
  success: boolean;
  message: string;
  code?: string;
  subscription_id?: string;
}

// API для работы с профилем пользователя
export const profileApi = {
  // Получение профиля текущего пользователя
  getMyProfile: async (): Promise<ProfileResponse> => {
    return fetchWithAuth<ProfileResponse>(`${API_URL}${PROFILE_API_PREFIX}/me`);
  },

  // Получение публичного профиля пользователя по ID
  getUserProfile: async (userId: string): Promise<PublicProfileResponse> => {
    return fetchWithAuth<PublicProfileResponse>(`${API_URL}${PROFILE_API_PREFIX}/user/${userId}`);
  },

  // Обновление профиля
  updateProfile: async (data: ProfileUpdateRequest): Promise<ProfileResponse> => {
    return fetchWithAuth<ProfileResponse>(`${API_URL}${PROFILE_API_PREFIX}/update`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Получение списка подписок пользователя
  getSubscriptions: async (): Promise<SubscriptionsResponse> => {
    return fetchWithAuth<SubscriptionsResponse>(`${API_URL}${PROFILE_API_PREFIX}/subscriptions`);
  },

  // Получение истории платежей
  getPayments: async (): Promise<PaymentsResponse> => {
    return fetchWithAuth<PaymentsResponse>(`${API_URL}${PROFILE_API_PREFIX}/payments`);
  },

  // Изменение имени профиля
  changeName: async (data: ChangeNameRequest): Promise<MessageResponse> => {
    return fetchWithAuth<MessageResponse>(`${API_URL}${PROFILE_API_PREFIX}/name-change`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Изменение аватара профиля (URL)
  changeAvatar: async (data: ChangeAvatarRequest): Promise<MessageResponse> => {
    return fetchWithAuth<MessageResponse>(`${API_URL}${PROFILE_API_PREFIX}/avatar-change`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Изменение описания профиля
  changeDescription: async (data: ChangeDescriptionRequest): Promise<MessageResponse> => {
    return fetchWithAuth<MessageResponse>(`${API_URL}${PROFILE_API_PREFIX}/description-change`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Загрузка файла аватара
  uploadAvatar: async (file: File): Promise<{ avatar_url: string }> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = getAccessToken();
    const headers = new Headers();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${API_URL}${PROFILE_API_PREFIX}/upload-avatar`, {
      method: 'POST',
      body: formData,
      headers: headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Ошибка при загрузке аватара' }));
      throw new Error(error.detail || `Ошибка ${response.status}`);
    }

    return await response.json();
  },

  // Получение текущего метода оплаты
  getPaymentMethod: async (): Promise<PaymentMethodResponse> => {
    return fetchWithAuth<PaymentMethodResponse>(`${API_URL}${PROFILE_API_PREFIX}/payment-method`);
  },

  // Изменение метода оплаты
  changePaymentMethod: async (data: ChangePaymentMethodRequest): Promise<MessageResponse> => {
    return fetchWithAuth<MessageResponse>(`${API_URL}${PROFILE_API_PREFIX}/payment-method-change`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Получение доступных методов оплаты
  getAvailablePaymentMethods: async (): Promise<AvailablePaymentMethodsResponse> => {
    return fetchWithAuth<AvailablePaymentMethodsResponse>(`${API_URL}${PROFILE_API_PREFIX}/available-payment-methods`);
  },

  // Отмена подписки
  cancelSubscription: async (courseId: string): Promise<MessageResponse> => {
    return fetchWithAuth<MessageResponse>(`${API_URL}${PROFILE_API_PREFIX}/subscriptions-cancel?course_id=${courseId}`, {
      method: 'DELETE',
    });
  },

  // Получение аватара с авторизацией
  getAvatar: async (avatarPath: string): Promise<string> => {
    if (!avatarPath) {
      return '';
    }
    
    // Если путь уже полный URL, возвращаем как есть
    if (avatarPath.startsWith('http')) {
      return avatarPath;
    }
    
    // Если путь уже содержит префикс, используем как есть
    let fullAvatarPath = avatarPath;
    if (!avatarPath.startsWith('/api/profile/uploads/avatars/')) {
      // Добавляем префикс только если его нет
      fullAvatarPath = `${PROFILE_API_PREFIX}/uploads/avatars/${avatarPath.replace(/^.*\//, '')}`;
    }
    
    const finalUrl = `${API_URL}${fullAvatarPath}`;
    
    try {
      const token = getAccessToken();
      
      const headers = new Headers();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const response = await fetch(finalUrl, {
        method: 'GET',
        headers: headers,
      });

      if (!response.ok) {
        console.error(`Ошибка при загрузке аватара: ${response.status}`);
        return '';
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      return blobUrl;
    } catch (error) {
      console.error('Ошибка при получении аватара:', error);
      return '';
    }
  },

  // Получение URL аватара (устаревший метод, оставляем для совместимости)
  getAvatarUrl: (avatarPath: string): string => {
    if (!avatarPath) return '';
    // Если путь уже полный URL, возвращаем как есть
    if (avatarPath.startsWith('http')) return avatarPath;
    
    // Если путь уже содержит префикс, используем как есть
    let fullAvatarPath = avatarPath;
    if (!avatarPath.startsWith('/api/profile/uploads/avatars/')) {
      // Добавляем префикс только если его нет
      fullAvatarPath = `${PROFILE_API_PREFIX}/uploads/avatars/${avatarPath.replace(/^.*\//, '')}`;
    }
    
    // Иначе формируем полный URL
    return `${API_URL}${fullAvatarPath}`;
  },

  getPaymentMethods: async (): Promise<{ payment_methods: PaymentMethodResponse[] }> => {
    return fetchWithAuth<{ payment_methods: PaymentMethodResponse[] }>(`${API_URL}${PROFILE_API_PREFIX}/payment-methods`);
  },

  setDefaultPaymentMethod: async (paymentMethodId: string): Promise<MessageResponse> => {
    return fetchWithAuth<MessageResponse>(`${API_URL}${PROFILE_API_PREFIX}/set-default-payment-method/${paymentMethodId}`, {
      method: "PUT"
    });
  },

  payWithSavedMethod: async (courseUuid: string, paymentMethodId: string): Promise<any> => {
    return fetchWithAuth<any>(`${API_URL}${PROFILE_API_PREFIX}/pay-with-saved-method`, {
      method: "POST",
      body: JSON.stringify({
        course_uuid: courseUuid,
        payment_method_id: paymentMethodId
      })
    });
  },

  subscribe: async (courseUuid: string, paymentMethodId?: string): Promise<any> => {
    return fetchWithAuth<any>(`${API_URL}${PROFILE_API_PREFIX}/subscribe`, {
      method: "POST",
      body: JSON.stringify({ 
        course_uuid: courseUuid,
        payment_method_id: paymentMethodId
      })
    });
  },
};

// =================== COURSES API ===================

export interface CreateCourseData {
  name: string;
  description?: string;
  price?: number;
  duration?: number;
  exercise_count?: number;
  is_published?: boolean;
}

export interface UpdateCourseData {
  name?: string;
  description?: string;
  price?: number;
  duration?: number;
  exercise_count?: number;
  is_published?: boolean;
}

// =================== COURSE WORKOUTS API ===================

export interface CourseWorkoutResponse {
  course_workout_uuid: string;
  course_uuid: string;
  name: string;
  description?: string;
  video_url?: string;
  duration?: number;
  rating: number | null;
  is_paid: boolean;
  is_published: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
  is_free?: boolean;
  is_visible?: boolean;
}

export interface CreateWorkoutData {
  course_uuid: string;
  name: string;
  description?: string;
  video_url?: string;
  duration?: number;
  is_paid?: boolean;
  is_published?: boolean;
  order_index?: number;
}

export interface UpdateWorkoutData {
  name?: string;
  description?: string;
  video_url?: string;
  duration?: number;
  is_paid?: boolean;
  is_published?: boolean;
  order_index?: number;
}

// API для работы с тренировками курсов
export const workoutsApi = {
  // Создание новой тренировки
  create: async (workoutData: CreateWorkoutData, token: string): Promise<CourseWorkoutResponse> => {
    const response = await fetch(`${API_URL}${COURSE_API_PREFIX}/workouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(workoutData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Ошибка при создании тренировки');
    }

    return response.json();
  },

  // Получение тренировки по ID
  getById: async (workoutId: string, token?: string): Promise<CourseWorkoutResponse> => {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${COURSE_API_PREFIX}/workouts/${workoutId}`, {
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Тренировка не найдена');
    }

    return response.json();
  },

  // Получение всех тренировок курса
  getByCourseId: async (courseId: string, publishedOnly = true, token?: string): Promise<CourseWorkoutResponse[]> => {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${COURSE_API_PREFIX}/courses/${courseId}/workouts?published_only=${publishedOnly}`, {
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Ошибка при получении тренировок');
    }

    return response.json();
  },

  // Обновление тренировки
  update: async (workoutId: string, updateData: UpdateWorkoutData, token: string): Promise<CourseWorkoutResponse> => {
    const response = await fetch(`${API_URL}${COURSE_API_PREFIX}/workouts/${workoutId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Ошибка при обновлении тренировки');
    }

    return response.json();
  },

  // Удаление тренировки
  delete: async (workoutId: string, token: string): Promise<void> => {
    const response = await fetch(`${API_URL}${COURSE_API_PREFIX}/workouts/${workoutId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Ошибка при удалении тренировки');
    }
  },

  // Изменение порядка тренировок в курсе
  reorder: async (courseId: string, workoutOrders: Array<{workout_uuid: string, order_index: number}>, token: string): Promise<void> => {
    const response = await fetch(`${API_URL}${COURSE_API_PREFIX}/courses/${courseId}/workouts/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(workoutOrders)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Ошибка при изменении порядка тренировок');
    }
  }
};

// API для работы с оценками тренировок
export const workoutRatingsApi = {
  // Получение статистики оценок тренировки
  getWorkoutRatingStats: async (workoutId: string, token: string): Promise<{average_rating: number, total_ratings: number}> => {
    const response = await fetch(`${API_URL}${COURSE_API_PREFIX}/workouts/${workoutId}/rating/stats`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.error(`Ошибка при получении статистики оценок: ${response.status}`);
      return { average_rating: 0, total_ratings: 0 };
    }

    return response.json();
  },

  // Получение оценки пользователя для тренировки
  getUserRating: async (workoutId: string, token: string): Promise<{rating: number}> => {
    const response = await fetch(`${API_URL}${COURSE_API_PREFIX}/workouts/${workoutId}/rating`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { rating: 0 }; // Пользователь еще не оценивал эту тренировку
      }
      console.error(`Ошибка при получении оценки пользователя: ${response.status}`);
      return { rating: 0 };
    }

    return response.json();
  },

  // Оценка тренировки
  rateWorkout: async (workoutId: string, rating: number, token: string): Promise<{success: boolean}> => {
    const response = await fetch(`${API_URL}${COURSE_API_PREFIX}/workouts/${workoutId}/rating`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ rating })
    });

    if (!response.ok) {
      console.error(`Ошибка при отправке оценки: ${response.status}`);
      throw new Error('Не удалось сохранить оценку');
    }

    return response.json();
  },

  // Удаление оценки
  deleteRating: async (workoutId: string, token: string): Promise<{success: boolean}> => {
    const response = await fetch(`${API_URL}${COURSE_API_PREFIX}/workouts/${workoutId}/rating`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.error(`Ошибка при удалении оценки: ${response.status}`);
      throw new Error('Не удалось удалить оценку');
    }

    return response.json();
  }
}; 