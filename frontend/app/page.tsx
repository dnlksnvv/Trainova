"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "@mui/material/styles";
import { Stack, Box, Divider, Typography, CircularProgress, Button } from "@mui/material";
import { useRouter } from "next/navigation";
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import MainLayout from "@/app/components/layouts/MainLayout";
import MyChart from "@/app/components/shared/MyChart";
import PurchasedCourseCard, {
  PurchasedCourseData,
} from "@/app/courses/components/PurchasedCourseCard";
import AppTrainingCard, { AppTrainingData } from "@/app/components/shared/AppTrainingCard";
import { appWorkoutsApi, AppWorkoutDto, AppWorkoutExerciseDto } from "@/app/services/api";

export default function HomePage() {
  const theme = useTheme();
  const router = useRouter();
  const [recentWorkouts, setRecentWorkouts] = useState<AppTrainingData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Функция для преобразования данных тренировки в формат для карточки
  const mapTrainingToCardData = (training: AppWorkoutDto) => {
    // Форматирование строки продолжительности с использованием общего времени или расчетного времени
    let formattedDuration = "0 минут";
    
    if (training.total_workout_time && training.total_workout_time > 0) {
      // Используем точное время из последней сессии в секундах
      const totalSeconds = training.total_workout_time;
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      formattedDuration = `${minutes} мин ${seconds} сек`;
    } else {
      // Расчет по упражнениям, если нет данных о фактической тренировке
      let totalDuration = 0;
      training.exercises.forEach((ex: AppWorkoutExerciseDto) => {
        if (ex.duration) {
          totalDuration += ex.duration;
        }
      });
      
      if (totalDuration > 0) {
        const minutes = Math.floor(totalDuration / 60);
        const seconds = totalDuration % 60;
        formattedDuration = `${minutes} мин ${seconds} сек`;
      }
    }
    
    // Форматирование даты последней тренировки
    let lastWorkout = "Новая";
    let lastSessionTime = ""; // Время начала последней тренировки
    let isInProgress = false; // Индикатор незавершенной тренировки
    let lastSessionUuid = training.last_session_uuid || "";
    
    if (training.last_session_start) {
      const lastSessionDate = new Date(training.last_session_start);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      
      const sessionDate = new Date(lastSessionDate.getFullYear(), lastSessionDate.getMonth(), lastSessionDate.getDate());
      
      // Проверяем, завершена ли тренировка
      isInProgress = training.last_session_status === "start" && !training.last_session_stop;
      
      // Форматируем время в любом случае
      lastSessionTime = lastSessionDate.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      // Определяем текст для даты
      if (sessionDate.getTime() === today.getTime()) {
        lastWorkout = "Сегодня";
      } else if (sessionDate.getTime() === yesterday.getTime()) {
        lastWorkout = "Вчера";
      } else if (sessionDate.getTime() === twoDaysAgo.getTime()) {
        lastWorkout = "Позавчера";
      } else {
        lastWorkout = lastSessionDate.toLocaleDateString('ru-RU');
      }
    } else if (training.updated_at) {
      // Для тренировок, которые не запускались, но были созданы/обновлены
      lastWorkout = "Новая";
    }
    
    return {
      id: training.app_workout_uuid || '',
      title: training.name,
      description: training.description || '',
      duration: formattedDuration,
      exercisesCount: training.exercises.length,
      lastWorkout: lastWorkout,
      lastSessionTime: lastSessionTime,
      totalWorkoutTime: training.total_workout_time,
      isInProgress: isInProgress,
      last_session_uuid: lastSessionUuid
    };
  };

  // Mock data for purchased courses
  const purchasedCourses: PurchasedCourseData[] = [
    {
      title: "Недельный интенсив «Большая грудь»",
      subscriptionUntil: "03.05.2025",
      description: "Курс направлен на памп груди. За неделю мы наберем 1кг мышечной массы. Адаптируем тело к высоким нагрузкам и поднимаем силу духа.",
      duration: "5 часов",
      muscleUsage: [
        {
          name: "Руки",
          color: theme.palette.muscleColors?.pink ?? "#FF8080",
          percent: 30,
        },
        {
          name: "Ноги",
          color: theme.palette.muscleColors?.green ?? "#81c784",
          percent: 20,
        },
        {
          name: "Грудь",
          color: theme.palette.muscleColors?.blue ?? "#64b5f6",
          percent: 50,
        },
      ],
      lastWorkout: "Вчера",
      completedLessons: 9,
      totalLessons: 13,
      trainerName: "Виктор Чак-Чак",
      trainerRating: 0.9, // 4.5 звезды
      courseRating: 0.8,  // 4 звезды
      subscribersCount: 1256
    },
    {
      title: "Недельный интенсив «Большая нога»",
      subscriptionUntil: "03.05.2025",
      description: "Курс направлен на памп груди. За неделю мы наберем 1кг мышечной массы. Адаптируем тело к высоким нагрузкам и поднимаем силу духа.",
      duration: "5 часов",
      muscleUsage: [
        {
          name: "Руки",
          color: theme.palette.muscleColors?.pink ?? "#FF8080",
          percent: 20,
        },
        {
          name: "Ноги",
          color: theme.palette.muscleColors?.green ?? "#81c784",
          percent: 50,
        },
        {
          name: "Грудь",
          color: theme.palette.muscleColors?.blue ?? "#64b5f6",
          percent: 30,
        },
      ],
      lastWorkout: "Вчера",
      completedLessons: 4,
      totalLessons: 10,
      trainerName: "Виктор Чак-Чак",
      trainerRating: 0.9, // 4.5 звезды
      courseRating: 0.8,  // 4 звезды
      subscribersCount: 1543
    }
  ];

  // Загрузка последних тренировок при монтировании компонента
  useEffect(() => {
    const fetchRecentWorkouts = async () => {
      try {
        setLoading(true);
        // Запрашиваем 2 самые последние тренировки
        const data = await appWorkoutsApi.getAppWorkouts("newest", 2);
        // Преобразуем данные в формат для карточек
        const mappedWorkouts = data.map(mapTrainingToCardData);
        setRecentWorkouts(mappedWorkouts);
        setError(null);
      } catch (error) {
        console.error('Ошибка при загрузке тренировок:', error);
        setError('Не удалось загрузить тренировки');
      } finally {
        setLoading(false);
      }
    };

    fetchRecentWorkouts();
  }, []);

  // Обработчик перехода на страницу всех тренировок
  const handleViewAllWorkouts = () => {
    router.push('/trainings');
  };

  return (
    <MainLayout>
      <Stack spacing={3} sx={{ pb: 3 }}>
        {/* График (вес + тренировки) - теперь данные получаются через API */}
        <MyChart />

        {/* Заголовок "Тренировки от приложения" */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box flex={1}>
            <Divider />
          </Box>
          <Typography
            variant="body2"
            fontWeight="bold"
            sx={{ fontSize: "1rem", color: theme.palette.textColors?.primary }}
          >
            Тренировки от приложения
          </Typography>
          <Box flex={1}>
            <Divider />
          </Box>
        </Stack>

        {/* Список тренировок от приложения */}
        <Stack spacing={2}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : error ? (
            <Typography color="error" sx={{ p: 2, textAlign: 'center' }}>
              {error}
            </Typography>
          ) : recentWorkouts.length > 0 ? (
            <>
              {recentWorkouts.map((training, idx) => (
                <AppTrainingCard key={idx} training={training}/>
              ))}
              <Button 
                variant="text" 
                endIcon={<ArrowForwardIcon />}
                onClick={handleViewAllWorkouts}
                sx={{ 
                  alignSelf: 'flex-end',
                  color: theme.palette.highlight?.main,
                  '&:hover': { 
                    backgroundColor: 'transparent',
                    color: theme.palette.highlight?.accent,
                  },
                  textTransform: 'none',
                  mt: 1,
                  mb: 2
                }}
              >
                Все тренировки
              </Button>
            </>
          ) : (
            <Typography sx={{ p: 2, textAlign: 'center', color: theme.palette.textColors?.secondary }}>
              Тренировки не найдены
            </Typography>
          )}
        </Stack>
      </Stack>
    </MainLayout>
  );
}
