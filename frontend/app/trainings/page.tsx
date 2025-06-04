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
import FilterDialog, { FilterOption, MuscleGroupFilter } from '../components/shared/FilterDialog';
import { useAuth } from '../hooks/useAuth';

// Опции фильтрации
const FILTER_OPTIONS: FilterOption[] = [
  { id: 'newest', label: 'Сначала новые' },
  { id: 'oldest', label: 'Сначала старые' },
  { id: 'muscle_groups', label: 'По включенным группам мышц' }
];

// Тестовые данные для неавторизованных пользователей
const TEST_TRAININGS = [
  {
    id: 'test-1',
    title: 'Тренировка для начинающих',
    description: 'Базовая тренировка для новичков, включающая упражнения на все группы мышц',
    duration: '45 мин 00 сек',
    exercisesCount: 8,
    lastWorkout: 'Новая',
    lastSessionTime: '',
    totalWorkoutTime: 2700,
    isInProgress: false,
    last_session_uuid: '',
    rating: 0.92
  },
  {
    id: 'test-2',
    title: 'Интенсивная кардио-тренировка',
    description: 'Высокоинтенсивная тренировка для сжигания жира и улучшения выносливости',
    duration: '60 мин 00 сек',
    exercisesCount: 12,
    lastWorkout: 'Новая',
    lastSessionTime: '',
    totalWorkoutTime: 3600,
    isInProgress: false,
    last_session_uuid: '',
    rating: 0.95
  },
  {
    id: 'test-3',
    title: 'Силовая тренировка верхней части тела',
    description: 'Тренировка для развития силы и мышечной массы верхней части тела',
    duration: '75 мин 00 сек',
    exercisesCount: 10,
    lastWorkout: 'Новая',
    lastSessionTime: '',
    totalWorkoutTime: 4500,
    isInProgress: false,
    last_session_uuid: '',
    rating: 0.98
  }
];

// Определяем тип для тренировок, включая тестовые данные
type TrainingData = AppWorkoutDto | {
  id: string;
  title: string;
  description?: string;
  duration: string;
  exercisesCount: number;
  lastWorkout: string;
  lastSessionTime: string;
  totalWorkoutTime: number;
  isInProgress: boolean;
  last_session_uuid: string;
  rating?: number;
};

export default function TrainingsPage() {
  const theme = useTheme();
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const { isAuthenticated } = useAuth();
  
  // Состояние для списка тренировок
  const [trainings, setTrainings] = useState<TrainingData[]>([]);
  const [filteredTrainings, setFilteredTrainings] = useState<TrainingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Состояние для фильтра
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('newest'); // По умолчанию - сначала новые
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroupFilter[]>([]);
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<number[]>([]);

  // Загрузка тренировок при монтировании компонента
  useEffect(() => {
    // Если пользователь не авторизован, используем тестовые данные
    if (!isAuthenticated) {
      setTrainings(TEST_TRAININGS);
      setFilteredTrainings(TEST_TRAININGS);
      setLoading(false);
      return;
    }

    const fetchTrainings = async () => {
      try {
        setLoading(true);
        const data = await appWorkoutsApi.getAppWorkouts();
        
        // Собираем все уникальные группы мышц из тренировок
        const uniqueMuscleGroups = new Map<number, string>();
        
        data.forEach(workout => {
          workout.exercises.forEach(exercise => {
            if (exercise.muscle_group_id && exercise.muscle_group_name) {
              uniqueMuscleGroups.set(exercise.muscle_group_id, exercise.muscle_group_name);
            }
          });
        });
        
        // Преобразуем Map в массив объектов для состояния
        const muscleGroupsArray: MuscleGroupFilter[] = Array.from(uniqueMuscleGroups).map(
          ([id, name]) => ({ id, name, selected: false })
        );
        
        setMuscleGroups(muscleGroupsArray);
        setTrainings(data);
        setFilteredTrainings(data);
        setError(null);
      } catch (error) {
        console.error('Ошибка при загрузке тренировок:', error);
        setError('Не удалось загрузить тренировки');
      } finally {
        setLoading(false);
      }
    };

    fetchTrainings();
  }, [isAuthenticated]);

  // Применение фильтра при изменении списка тренировок или выбранного фильтра
  useEffect(() => {
    if (trainings.length === 0) {
      setFilteredTrainings([]);
      return;
    }

    // Создаем копию массива для сортировки и фильтрации
    let filtered = [...trainings];

    // Сначала применяем фильтр по группам мышц, если он выбран
    if (selectedFilter === 'muscle_groups' && selectedMuscleGroups.length > 0) {
      filtered = filtered.filter(workout => {
        // Для тестовых данных пропускаем фильтрацию по группам мышц
        if (!('exercises' in workout)) return true;
        
        // Получаем все уникальные ID групп мышц в этой тренировке
        const workoutMuscleGroupIds = new Set<number>();
        workout.exercises.forEach(exercise => {
          if (exercise.muscle_group_id) {
            workoutMuscleGroupIds.add(exercise.muscle_group_id);
          }
        });
        
        // Проверяем, есть ли хотя бы одна выбранная группа мышц в тренировке
        return selectedMuscleGroups.some(id => workoutMuscleGroupIds.has(id));
      });
    }

    // Затем сортируем результат
    if (selectedFilter === 'newest' || selectedFilter === 'muscle_groups') {
      // Для тестовых данных сортировка не требуется
      if (!isAuthenticated) {
        setFilteredTrainings(filtered);
        return;
      }
      
      // Сначала новые тренировки (по дате последней сессии или дате обновления)
      filtered.sort((a, b) => {
        if (!('last_session_start' in a) || !('last_session_start' in b)) return 0;
        
        const dateA = a.last_session_start ? new Date(a.last_session_start).getTime() : a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const dateB = b.last_session_start ? new Date(b.last_session_start).getTime() : b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return dateB - dateA; // От новых к старым
      });
    } else if (selectedFilter === 'oldest') {
      // Для тестовых данных сортировка не требуется
      if (!isAuthenticated) {
        setFilteredTrainings(filtered);
        return;
      }
      
      // Сначала старые тренировки
      filtered.sort((a, b) => {
        if (!('last_session_start' in a) || !('last_session_start' in b)) return 0;
        
        const dateA = a.last_session_start ? new Date(a.last_session_start).getTime() : a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const dateB = b.last_session_start ? new Date(b.last_session_start).getTime() : b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return dateA - dateB; // От старых к новым
      });
    }

    setFilteredTrainings(filtered);
  }, [trainings, selectedFilter, selectedMuscleGroups, isAuthenticated]);

  // Обработчик для кнопки "Пул упражнений"
  const handleExercisePool = () => {
    router.push('/exercise-pool');
  };

  // Обработчик для кнопки "+ Тренировка"
  const handleAddTraining = () => {
    // Если пользователь не авторизован, перенаправляем на страницу входа
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
    
    // Перенаправляем на страницу настройки новой тренировки
    router.push('/training-settings/new');
  };

  // Обработчик открытия/закрытия диалогового окна фильтра
  const toggleFilterDialog = () => {
    setFilterDialogOpen(!filterDialogOpen);
  };

  // Обработчик выбора опции фильтрации
  const handleFilterSelect = (filterId: string) => {
    setSelectedFilter(filterId);
    // Если выбрана не фильтрация по группам мышц, сбрасываем выбранные группы
    if (filterId !== 'muscle_groups') {
      setSelectedMuscleGroups([]);
    }
  };

  // Обработчик применения фильтра по группам мышц
  const handleApplyMuscleGroupFilter = (selectedGroups: number[]) => {
    setSelectedMuscleGroups(selectedGroups);
  };

  // Функция для получения текста кнопки фильтра на основе выбранного фильтра
  const getFilterButtonText = () => {
    if (selectedFilter === 'muscle_groups' && selectedMuscleGroups.length > 0) {
      // Получаем названия выбранных групп мышц
      const selectedGroupNames = muscleGroups
        .filter(group => selectedMuscleGroups.includes(group.id))
        .map(group => group.name);
      
      if (selectedGroupNames.length === 1) {
        return `Фильтр (${selectedGroupNames[0]})`;
      } else if (selectedGroupNames.length <= 3) {
        return `Фильтр (${selectedGroupNames.join(', ')})`;
      } else {
        return `Фильтр (${selectedGroupNames.length} групп мышц)`;
      }
    }
    
    const selectedOption = FILTER_OPTIONS.find(option => option.id === selectedFilter);
    return selectedOption ? `Фильтр (${selectedOption.label})` : 'Фильтр';
  };

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
      training.exercises.forEach(ex => {
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
    let lastSessionUuid = training.last_session_uuid || ""; // UUID последней сессии
    
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
          onClick={toggleFilterDialog}
          sx={{ 
            borderColor: theme.palette.highlight?.main,
            color: theme.palette.textColors?.primary,
            '&:hover': {
              borderColor: theme.palette.highlight?.accent,
              bgcolor: `${theme.palette.highlight?.main}14`
            },
            py: 1.5,
            borderRadius: '12px',
            textTransform: 'none',
            justifyContent: 'flex-start',
            fontWeight: 'medium'
          }}
        >
          {getFilterButtonText()}
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
        ) : filteredTrainings.length === 0 ? (
          <Typography 
            variant="body1" 
            align="center" 
            sx={{ 
              py: 4, 
              color: theme.palette.textColors?.secondary 
            }}
          >
            {selectedFilter === 'muscle_groups' && selectedMuscleGroups.length > 0 
              ? 'Нет тренировок, содержащих выбранные группы мышц' 
              : isAuthenticated 
                ? 'У вас пока нет тренировок. Нажмите кнопку "+ Тренировка", чтобы создать новую.'
                : 'Для создания и сохранения тренировок необходимо авторизоваться.'
            }
          </Typography>
        ) : (
          /* Блоки тренировок */
          <Stack spacing={2}>
            {filteredTrainings.map((training, index) => (
              <AppTrainingCard 
                key={index} 
                training={
                  'exercises' in training ? 
                  mapTrainingToCardData(training) : 
                  training
                }
                isDemo={!isAuthenticated}
              />
            ))}
          </Stack>
        )}
      </Stack>

      {/* Диалоговое окно фильтра */}
      <FilterDialog
        open={filterDialogOpen}
        onClose={() => setFilterDialogOpen(false)}
        options={FILTER_OPTIONS}
        selectedOption={selectedFilter}
        onOptionSelect={handleFilterSelect}
        availableMuscleGroups={muscleGroups}
        selectedMuscleGroups={selectedMuscleGroups}
        onApplyMuscleGroupFilter={handleApplyMuscleGroupFilter}
      />
    </MainLayout>
  );
} 