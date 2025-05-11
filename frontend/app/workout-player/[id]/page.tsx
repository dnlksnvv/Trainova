import WorkoutPageClient from './WorkoutPageClient';

export default async function WorkoutPlayerPage({ params }: { params: { id: string } }) {
  // Получаем параметры маршрута
  const resolvedParams = await params;
  const workoutId = resolvedParams.id;
  
  // Передаем только ID тренировки в клиентский компонент
  return <WorkoutPageClient workoutId={workoutId} />;
} 