// Тип для упражнения
export interface Exercise {
  id: string;
  name: string;
  description: string;
  duration: number;
  reps?: number;
  imageUrl?: string;
}

// Тип для информации о тренере
export interface Trainer {
  id: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  rating: number;
  ratingCount?: number;
  description?: string;
}

// Тип для тренировки
export interface Workout {
  id: string;
  title: string;
  description: string;
  exercises: Exercise[];
  trainer?: Trainer;
} 