"use client";

import React, { useState, useEffect } from 'react';
import { useTheme, Box, Button, Stack, Divider, CircularProgress, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import AppTrainingCard from '../components/shared/AppTrainingCard';
import FilterListIcon from '@mui/icons-material/FilterList';
import AddIcon from '@mui/icons-material/Add';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import MainLayout from '../components/layouts/MainLayout';
import { appWorkoutsApi, AppWorkoutDto } from '../services/api';
import { useIsAdmin } from '../hooks/useIsAdmin';

export default function TrainingsPage() {
  const theme = useTheme();
  const router = useRouter();
  const isAdmin = useIsAdmin();
  
  // Состояние для списка тренировок
  const [trainings, setTrainings] = useState<AppWorkoutDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Загрузка тренировок при монтировании компонента
  useEffect(() => {
    const fetchTrainings = async () => {
      try {
        setLoading(true);
        const data = await appWorkoutsApi.getAppWorkouts();
        setTrainings(data);
        setError(null);
      } catch (error) {
        console.error('Ошибка при загрузке тренировок:', error);
        setError('Не удалось загрузить тренировки');
      } finally {
        setLoading(false);
      }
    };

    fetchTrainings();
  }, []);

  // Обработчик для кнопки "Пул упражнений"
  const handleExercisePool = () => {
    router.push('/exercise-pool');
  };

  // Обработчик для кнопки "+ Тренировка"
  const handleAddTraining = () => {
    // Перенаправляем на страницу настройки новой тренировки
    // Передаем ID 'new' чтобы обозначить создание новой тренировки
    router.push('/training-settings/new');
  };

  // Функция для преобразования данных тренировки в формат для карточки
  const mapTrainingToCardData = (training: AppWorkoutDto) => {
    // Расчет общей продолжительности тренировки
    let totalDuration = 0;
    training.exercises.forEach(ex => {
      if (ex.duration) {
        totalDuration += ex.duration;
      }
    });
    
    // Форматирование строки продолжительности
    const formattedDuration = totalDuration > 0 
      ? `${Math.floor(totalDuration / 60)} мин ${totalDuration % 60} сек`
      : "0 минут";
    
    // Форматирование даты последней тренировки (так как в AppWorkoutDto нет поля last_workout_at)
    const lastWorkout = training.updated_at 
      ? new Date(training.updated_at).toLocaleDateString('ru-RU')
      : "Никогда";
    
    return {
      id: training.app_workout_uuid || '',
      title: training.name,
      description: training.description || '',
      duration: formattedDuration,
      exercisesCount: training.exercises.length,
      lastWorkout: lastWorkout
    };
  };

  return (
    <MainLayout>
      <Stack spacing={2}>
        {/* Верхние кнопки - только для администраторов */}
        {isAdmin && (
          <Box sx={{ 
            display: 'flex', 
            gap: 2, 
            width: '100%'
          }}>
            <Button 
              fullWidth 
              variant="contained" 
              startIcon={<FormatListBulletedIcon />}
              onClick={handleExercisePool}
              sx={{ 
                bgcolor: theme.palette.highlight?.main,
                '&:hover': {
                  bgcolor: theme.palette.highlight?.accent,
                },
                py: 1.5,
                borderRadius: '24px',
                color: theme.palette.textColors?.primary,
                fontWeight: 'bold',
                textTransform: 'none'
              }}
            >
              Пул упражнений
            </Button>
            <Button 
              fullWidth 
              variant="contained" 
              startIcon={<AddIcon />}
              onClick={handleAddTraining}
              sx={{ 
                bgcolor: theme.palette.highlight?.main,
                '&:hover': {
                  bgcolor: theme.palette.highlight?.accent,
                },
                py: 1.5,
                borderRadius: '24px',
                color: theme.palette.textColors?.primary,
                fontWeight: 'bold',
                textTransform: 'none'
              }}
            >
              Тренировка
            </Button>
          </Box>
        )}

        {/* Кнопка фильтра */}
        <Button 
          fullWidth 
          variant="outlined" 
          startIcon={<FilterListIcon />}
          sx={{ 
            borderColor: theme.palette.highlight?.main,
            color: theme.palette.textColors?.primary,
            '&:hover': {
              borderColor: theme.palette.highlight?.accent,
              bgcolor: 'rgba(255, 140, 0, 0.08)'
            },
            py: 1.5,
            borderRadius: '8px',
            textTransform: 'none',
            justifyContent: 'flex-start',
            fontWeight: 'medium'
          }}
        >
          Фильтр (по включенным группам мышц)
        </Button>

        <Divider sx={{ bgcolor: theme.palette.backgrounds?.paper }} />

        {/* Отображение состояния загрузки */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: theme.palette.highlight?.main }} />
          </Box>
        ) : error ? (
          <Typography 
            variant="body1" 
            color="error" 
            align="center" 
            sx={{ py: 4 }}
          >
            {error}
          </Typography>
        ) : trainings.length === 0 ? (
          <Typography 
            variant="body1" 
            align="center" 
            sx={{ 
              py: 4, 
              color: theme.palette.textColors?.secondary 
            }}
          >
            У вас пока нет тренировок. Нажмите кнопку "+ Тренировка", чтобы создать новую.
          </Typography>
        ) : (
          /* Блоки тренировок */
          <Stack spacing={2}>
            {trainings.map((training) => (
              <AppTrainingCard 
                key={training.app_workout_uuid} 
                training={mapTrainingToCardData(training)} 
              />
            ))}
          </Stack>
        )}
      </Stack>
    </MainLayout>
  );
} 