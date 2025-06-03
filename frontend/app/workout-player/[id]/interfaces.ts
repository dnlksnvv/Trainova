export interface Exercise {
  id: string;
  name: string;
  description: string;
  duration: number;
  imageUrl?: string;
  reps?: number;
  sets?: number;
  restTime?: number;
  intensity?: 'light' | 'medium' | 'hard';
} 