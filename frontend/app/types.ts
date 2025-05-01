// Тип для упражнения
export interface Exercise {
  id: string;
  name: string;
  duration: number;
  imageUrl: string;
  description?: string;
  reps?: number; // Количество повторений для упражнения
}

// Тип для тренировки
export interface Workout {
  id: string;
  title: string;
  exercises: Exercise[];
  description?: string;
} 