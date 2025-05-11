export interface Exercise {
  id: string;
  name: string;
  description?: string;
  imageUrl: string;
  duration?: number;
  sets?: number;
  reps?: number;
  restTime?: number;
  intensity?: 'light' | 'medium' | 'hard';
} 