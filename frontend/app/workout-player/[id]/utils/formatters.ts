/**
 * Форматирует время в секундах в формат MM:SS
 */
export function formatTime(timeInSeconds: number): string {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(seconds).padStart(2, '0');
  
  return `${formattedMinutes}:${formattedSeconds}`;
}

/**
 * Форматирует индекс упражнения в формате 01, 02, etc.
 */
export function formatExerciseIndex(index: number): string {
  return String(index).padStart(2, '0');
}

/**
 * Функция для получения прямого URL к GIF на сервере
 */
export function formatExerciseGifUrl(exerciseUuid: string | undefined): string | undefined {
  if (!exerciseUuid) return undefined;
  return `${process.env.API_URL}${process.env.WORKOUT_API_PREFIX}/exercises/gif/${exerciseUuid}`;
}

/**
 * Форматирует общее время тренировки в формат HH:MM:SS
 */
export function formatTotalTime(timeInSeconds: number): string {
  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor((timeInSeconds % 3600) / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  
  const formattedHours = String(hours).padStart(2, '0');
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(seconds).padStart(2, '0');
  
  return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
} 