"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  useTheme, 
  Box, 
  TextField, 
  Button, 
  Stack, 
  IconButton, 
  Typography, 
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon, 
  Paper,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Collapse,
  Fab,
  Tooltip,
  Switch,
  FormControlLabel,
  CircularProgress,
  Modal,
  Grid,
  InputAdornment,
  Card,
  CardContent,
  Chip,
  LinearProgress
} from '@mui/material';
import { useRouter } from 'next/navigation';
import MainLayout from '@/app/components/layouts/MainLayout';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteIcon from '@mui/icons-material/Delete';
import TimerIcon from '@mui/icons-material/Timer';
import RepeatIcon from '@mui/icons-material/Repeat';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import InfoIcon from '@mui/icons-material/Info';
import { DragDropContext, Draggable, Droppable, DropResult, DroppableProvided, DroppableStateSnapshot, DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import ExerciseGroupsList from '@/app/components/exercises/ExerciseGroupsList';
import { trainingsApi, TrainingDto, appWorkoutsApi, AppWorkoutDto } from '../../services/api';
import RefreshIcon from '@mui/icons-material/Refresh';

// Типы для упражнения и тренировки
interface Exercise {
  id: number | string;
  name: string;
  description: string;
  gifUuid?: string; // Добавляем поле для GIF
}

interface TrainingExercise {
  id: number;
  training_exercise_uuid?: string; // UUID упражнения в тренировке
  exercise: Exercise;
  repetitions?: number;
  duration?: number; // в секундах
}

interface MuscleGroup {
  id: number;
  name: string;
  exercises: Exercise[];
}

interface Training {
  id: number | string;
  title: string;
  description?: string;
  exercises: TrainingExercise[];
  isPublic?: boolean;
}

interface TrainingSettingsClientProps {
  id: string;
}

export default function TrainingSettingsClient({ id }: TrainingSettingsClientProps) {
  const API_URL = process.env.API_URL;
  const WORKOUT_API_PREFIX = process.env.WORKOUT_API_PREFIX;
  const theme = useTheme();
  const router = useRouter();
  const isNewTraining = id === 'new';
  
  // Состояние для тренировки
  const [training, setTraining] = useState<Training>({
    id: isNewTraining ? 0 : id,
    title: isNewTraining ? "Новая тренировка" : "",
    exercises: [],
    isPublic: false
  });

  // Состояние для групп мышц и упражнений
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Состояние для отслеживания загрузки GIF-файлов
  const [loadingGifs, setLoadingGifs] = useState(false);
  const [loadedGifsCount, setLoadedGifsCount] = useState(0);
  const [totalGifsCount, setTotalGifsCount] = useState(0);
  
  // Отслеживание открытых групп
  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>({});
  
  // Состояние для модального окна выбора упражнения
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState<boolean>(false);
  
  // Состояние для модального окна настройки параметров упражнения
  const [exerciseParamsDialogOpen, setExerciseParamsDialogOpen] = useState<boolean>(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [exerciseParams, setExerciseParams] = useState<{
    repetitions?: number;
    duration?: number;
  }>({});
  
  // Состояние для отслеживания режима редактирования
  const [editMode, setEditMode] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<number | null>(null);
  
  // Состояние для подтверждения удаления
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [exerciseToDelete, setExerciseToDelete] = useState<number | null>(null);

  // Состояние для отображения подсказки о перетаскивании
  const [dragHintShown, setDragHintShown] = useState(true);

  // Состояние для диалога удаления тренировки
  const [deleteTrainingDialogOpen, setDeleteTrainingDialogOpen] = useState(false);

  // Состояние для предпросмотра GIF
  const [previewGifDialogOpen, setPreviewGifDialogOpen] = useState(false);
  const [previewGifUrl, setPreviewGifUrl] = useState<string | null>(null);
  const [previewExerciseName, setPreviewExerciseName] = useState<string>('');

  const [gifPreviewOpen, setGifPreviewOpen] = useState(false);
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null);

  // Стейты для управления диалогами
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Стейты для работы с данными
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentGifExercise, setCurrentGifExercise] = useState<Exercise | null>(null);

  // Функция для загрузки групп мышц
  const fetchMuscleGroups = async () => {
    try {
      const response = await fetch(`${API_URL}${WORKOUT_API_PREFIX}/muscle-groups`);
      if (!response.ok) {
        throw new Error('Не удалось загрузить группы мышц');
      }
      return await response.json();
    } catch (error) {
      console.error('Ошибка при загрузке групп мышц:', error);
      setError('Не удалось загрузить группы мышц');
      return [];
    }
  };

  // Функция для загрузки упражнений для определенной группы мышц
  const fetchExercisesForMuscleGroup = async (muscleGroupId: number) => {
    try {
      const response = await fetch(`${API_URL}${WORKOUT_API_PREFIX}/muscle-groups/${muscleGroupId}/exercises`);
      if (!response.ok) {
        throw new Error(`Не удалось загрузить упражнения для группы мышц #${muscleGroupId}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Ошибка при загрузке упражнений для группы мышц #${muscleGroupId}:`, error);
      return [];
    }
  };

  // Функция для предварительной загрузки всех GIF-файлов из тренировки
  const preloadGifs = async (exercises: TrainingExercise[]) => {
    // Фильтруем упражнения, которые имеют UUID для GIF
    const exercisesWithGifs = exercises.filter(ex => ex.exercise.gifUuid);
    
    console.log('Упражнения с GIF:', exercisesWithGifs.length);
    
    if (exercisesWithGifs.length === 0) {
      console.log('Нет GIF-файлов для загрузки');
      return; // Если нет GIF для загрузки, просто выходим
    }
    
    setLoadingGifs(true);
    setTotalGifsCount(exercisesWithGifs.length);
    setLoadedGifsCount(0);
    
    // Функция для загрузки одного GIF
    const loadGif = (gifUuid: string) => {
      console.log(`Загрузка GIF: ${gifUuid}`);
      
      return new Promise<void>((resolve) => {
        // Создаем новый экземпляр изображения для загрузки в кеш браузера
        const img = new Image();
        
        img.onload = () => {
          console.log(`GIF успешно загружен: ${gifUuid}`);
          setLoadedGifsCount(prev => prev + 1);
          resolve();
        };
        
        img.onerror = (error) => {
          console.error(`Ошибка загрузки GIF ${gifUuid}:`, error);
          setLoadedGifsCount(prev => prev + 1);
          resolve();
        };
        
        // Принудительно добавляем timestamp для предотвращения кеширования на стороне сервера
        const url = `${API_URL}${WORKOUT_API_PREFIX}/exercises/gif/${gifUuid}?t=${Date.now()}`;
        console.log('URL для загрузки:', url);
        img.src = url;
        
        // Явно добавляем в DOM для гарантированной загрузки (будет скрыт)
        img.style.display = 'none';
        img.style.position = 'absolute';
        document.body.appendChild(img);
        
        // Устанавливаем таймаут для удаления изображения из DOM после загрузки
        setTimeout(() => {
          if (document.body.contains(img)) {
            document.body.removeChild(img);
          }
        }, 5000); // 5 секунд на загрузку
      });
    };
    
    try {
      console.log('Начинаем загрузку всех GIF-файлов');
      // Загружаем все GIF параллельно
      await Promise.all(
        exercisesWithGifs.map(ex => ex.exercise.gifUuid ? loadGif(ex.exercise.gifUuid) : Promise.resolve())
      );
      console.log('Все GIF-файлы загружены в кеш');
    } catch (error) {
      console.error('Ошибка при предварительной загрузке GIF-файлов:', error);
    } finally {
      setLoadingGifs(false);
    }
  };

  // Загрузка данных тренировки и групп мышц
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Загрузка групп мышц с API
        const muscleGroupsData = await fetchMuscleGroups();
        
        // Для каждой группы мышц загружаем упражнения
        const muscleGroupsWithExercises = await Promise.all(
          muscleGroupsData.map(async (group: any) => {
            const exercises = await fetchExercisesForMuscleGroup(group.id);
            
            // Преобразуем данные API в формат, который ожидает наш интерфейс
            const mappedExercises = exercises.map((ex: any) => ({
              id: ex.exercise_id,
              name: ex.title,
              description: ex.description,
              gifUuid: ex.gif_uuid
            }));
            
            return {
              id: group.id,
              name: group.name,
              exercises: mappedExercises
            };
          })
        );
        
        setMuscleGroups(muscleGroupsWithExercises);
        
        // Собираем все упражнения из всех групп в один массив
        const allExercises = muscleGroupsWithExercises.flatMap(group => group.exercises);
        setExercises(allExercises);

        // Если не создаем новую тренировку, загружаем данные существующей
        if (!isNewTraining) {
          try {
            console.log('Загрузка тренировки с ID:', id);
            
            // Загружаем данные тренировки через API
            const workoutData = await appWorkoutsApi.getAppWorkoutById(id);
            console.log('Загружена тренировка:', workoutData);
            
            if (!workoutData) {
              throw new Error(`Тренировка с ID ${id} не найдена`);
            }
            
            // Преобразуем данные в формат, который ожидает наш компонент
            const transformedExercises = workoutData.exercises.map((ex: any, index: number) => {
              // Ищем полную информацию об упражнении среди загруженных
              const fullExerciseInfo = allExercises.find(e => String(e.id) === String(ex.exercise_id));
              
              return {
                // Используем реальный id упражнения в тренировке, если он есть
                id: ex.id ? ex.id : index, 
                exercise: fullExerciseInfo || {
                  id: ex.exercise_id,
                  name: ex.exercise_name || `Упражнение ${index + 1}`,
                  description: ex.exercise_description || "Нет описания",
                  gifUuid: ex.gif_uuid
                },
                repetitions: ex.count,
                duration: ex.duration
              };
            });
            
            const transformedTraining: Training = {
              id: workoutData.app_workout_uuid || '0',
              title: workoutData.name || "Тренировка без названия",
              description: workoutData.description || "",
              isPublic: false, // В текущей версии API это поле может отсутствовать
              exercises: transformedExercises
            };
            
            console.log('Преобразованная тренировка:', transformedTraining);
            setTraining(transformedTraining);
            
            // Запускаем предварительную загрузку GIF-файлов
            console.log('Запускаем предварительную загрузку GIF-файлов');
            preloadGifs(transformedExercises);
          } catch (error) {
            console.error('Ошибка при загрузке тренировки:', error);
            setError('Не удалось загрузить данные тренировки');
          }
        }
        
        // Устанавливаем все группы как открытые по умолчанию
        const initialOpenGroups: Record<number, boolean> = {};
        muscleGroupsWithExercises.forEach(group => {
          initialOpenGroups[group.id] = true;
        });
        setOpenGroups(initialOpenGroups);
      } catch (error) {
        console.error('Ошибка при загрузке данных:', error);
        setError('Произошла ошибка при загрузке данных');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [id, isNewTraining]);
  
  // Обработчик для кнопки "назад"
  const handleBack = () => {
    router.back();
  };
  
  // Обработчик изменения полей формы тренировки
  const handleTrainingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTraining(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Обработчик для открытия/закрытия группы мышц
  const handleToggleGroup = (groupId: number) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };
  
  // Обработчик для открытия диалога выбора упражнения
  const handleOpenExerciseDialog = () => {
    setExerciseDialogOpen(true);
  };
  
  // Обработчик для закрытия диалога выбора упражнения
  const handleCloseExerciseDialog = () => {
    setExerciseDialogOpen(false);
    setSearchQuery('');
  };
  
  // Обработчик выбора упражнения
  const handleSelectExercise = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setExerciseDialogOpen(false);
    setExerciseParamsDialogOpen(true);
    setExerciseParams({}); // Сбрасываем параметры
    setEditMode(false);
    setEditingExerciseId(null);
  };
  
  // Обработчик редактирования существующего упражнения
  const handleEditExercise = (trainingExercise: TrainingExercise) => {
    setSelectedExercise(trainingExercise.exercise);
    setExerciseParams({
      repetitions: trainingExercise.repetitions,
      duration: trainingExercise.duration
    });
    setExerciseParamsDialogOpen(true);
    setEditMode(true);
    setEditingExerciseId(trainingExercise.id);
  };
  
  // Обработчик изменения параметров упражнения
  const handleExerciseParamsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setExerciseParams(prev => ({
      ...prev,
      [name]: parseInt(value) || 0
    }));
  };
  
  // Обработчик сохранения параметров упражнения
  const handleSaveExerciseParams = () => {
    if (selectedExercise && (exerciseParams.repetitions || exerciseParams.duration)) {
      if (editMode && editingExerciseId) {
        // Обновляем существующее упражнение
        setTraining(prev => ({
          ...prev,
          exercises: prev.exercises.map(ex => 
            ex.id === editingExerciseId 
              ? { 
                  ...ex, 
                  repetitions: exerciseParams.repetitions, 
                  duration: exerciseParams.duration 
                }
              : ex
          )
        }));
      } else {
        // Создаем новое упражнение для тренировки
        const newTrainingExercise: TrainingExercise = {
          id: Date.now(), // Временный ID
          exercise: {
            ...selectedExercise,
            // Убедимся, что информация о GIF сохраняется
            gifUuid: selectedExercise.gifUuid
          },
          repetitions: exerciseParams.repetitions,
          duration: exerciseParams.duration
        };
        
        // Добавляем упражнение к тренировке
        setTraining(prev => ({
          ...prev,
          exercises: [...prev.exercises, newTrainingExercise]
        }));
      }
      
      // Закрываем диалог и сбрасываем состояние редактирования
      setExerciseParamsDialogOpen(false);
      setEditMode(false);
      setEditingExerciseId(null);
    }
  };
  
  // Обработчик закрытия диалога параметров упражнения
  const handleCloseExerciseParamsDialog = () => {
    setExerciseParamsDialogOpen(false);
    
    // Открываем диалог выбора упражнений только если мы находимся в режиме добавления нового упражнения
    // Если мы редактируем существующее упражнение, просто закрываем диалог
    if (!editMode) {
      setExerciseDialogOpen(true);
    }
  };
  
  // Обработчик запроса на удаление упражнения
  const handleDeleteExerciseRequest = (exerciseId: number) => {
    setExerciseToDelete(exerciseId);
    setDeleteDialogOpen(true);
  };
  
  // Обработчик удаления упражнения
  const handleDeleteExercise = () => {
    if (exerciseToDelete !== null) {
      setTraining(prev => ({
        ...prev,
        exercises: prev.exercises.filter(ex => ex.id !== exerciseToDelete)
      }));
      setDeleteDialogOpen(false);
      setExerciseToDelete(null);
    }
  };
  
  // Обработчик сохранения тренировки
  const handleSave = async () => {
    // Проверка на наличие заголовка
    if (!training.title.trim()) {
      alert('Пожалуйста, укажите название тренировки');
      return;
    }
    
    try {
      setLoading(true);
      
      // Формируем данные для отправки на бэкенд в новом формате
      const workoutData: AppWorkoutDto = {
        name: training.title,
        description: training.description || "",
        exercises: training.exercises.map(ex => ({
          id: ex.id.toString(), // Добавляем id упражнения в тренировке для идентификации
          exercise_id: ex.exercise.id.toString(),
          count: ex.repetitions || undefined,
          duration: ex.duration || undefined
        }))
      };
      
      let savedWorkout;
      
      if (isNewTraining) {
        // Создание новой тренировки
        savedWorkout = await appWorkoutsApi.createAppWorkout(workoutData);
        console.log('Создана новая тренировка:', savedWorkout);
      } else {
        // Обновление существующей тренировки
        savedWorkout = await appWorkoutsApi.updateAppWorkout(String(id), workoutData);
        console.log('Обновлена тренировка:', savedWorkout);
      }
    
    // После успешного сохранения возвращаемся назад
      router.push('/trainings');
    } catch (error) {
      console.error('Ошибка при сохранении тренировки:', error);
      alert(`Ошибка при сохранении тренировки: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setLoading(false);
    }
  };

  // Обработчик завершения перетаскивания
  const handleDragEnd = (result: DropResult) => {
    // Если перетаскивание закончилось вне зоны или без изменения позиции
    if (!result.destination) {
      return;
    }

    // Если позиция не изменилась
    if (result.destination.index === result.source.index) {
      return;
    }

    // Создаем копию списка упражнений
    const exercisesCopy = Array.from(training.exercises);
    // Удаляем перетаскиваемый элемент
    const [reorderedItem] = exercisesCopy.splice(result.source.index, 1);
    // Вставляем его на новую позицию
    exercisesCopy.splice(result.destination.index, 0, reorderedItem);

    // Обновляем состояние
    setTraining({
      ...training,
      exercises: exercisesCopy
    });

    // Скрываем подсказку после первого перетаскивания
    setDragHintShown(false);
  };

  // Обработчик для изменения публичности тренировки
  const handlePublicToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTraining(prev => ({
      ...prev,
      isPublic: event.target.checked
    }));
  };
  
  // Обработчик удаления тренировки
  const handleDeleteTraining = async () => {
    try {
      setLoading(true);
      
      if (!isNewTraining) {
        // Удаляем существующую тренировку через API
        await appWorkoutsApi.deleteAppWorkout(String(id));
        console.log('Тренировка удалена:', id);
      }
    
    // Закрываем диалог
    setDeleteTrainingDialogOpen(false);
    
    // Перенаправляем на страницу тренировок
    router.push('/trainings');
    } catch (error) {
      console.error('Ошибка при удалении тренировки:', error);
      alert(`Ошибка при удалении тренировки: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setLoading(false);
    }
  };

  // Функция для открытия предпросмотра GIF
  const handleOpenGifPreview = (exercise: Exercise) => {
    if (exercise.gifUuid) {
      setPreviewExercise(exercise);
      setGifPreviewOpen(true);
    }
  };

  const handleCloseGifPreview = () => {
    setGifPreviewOpen(false);
  };

  // Фильтрация упражнений по поисковому запросу
  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) {
      return exercises;
    }
    
    return exercises.filter(exercise => 
      exercise.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exercise.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [exercises, searchQuery]);

  return (
    <MainLayout>
      <Stack spacing={3}>
        {/* Заголовок с кнопкой назад */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          mb: 1 
        }}>
          <IconButton 
            onClick={handleBack}
            sx={{ color: theme.palette.textColors?.primary }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ 
            flexGrow: 1, 
            textAlign: 'center', 
            fontWeight: 'bold',
            color: theme.palette.textColors?.primary,
            fontSize: '1.2rem',
            mr: 4
          }}>
            {isNewTraining ? 'Создание тренировки' : 'Настройки тренировки'}
          </Box>
        </Box>
        
        <Divider sx={{ bgcolor: theme.palette.backgrounds?.paper }} />
        
        {/* Индикатор загрузки GIF в шапке (всегда виден) */}
        {loadingGifs && (
          <Box sx={{ 
            width: '100%', 
            mb: 2, 
            mt: 1,
            p: 2,
            bgcolor: 'rgba(0,0,0,0.1)',
            borderRadius: 2
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ color: theme.palette.textColors?.primary }}>
                Загрузка GIF-файлов: {loadedGifsCount} из {totalGifsCount}
              </Typography>
              <Typography variant="body2" sx={{ color: theme.palette.highlight?.main }}>
                {Math.round((loadedGifsCount / totalGifsCount) * 100)}%
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={(loadedGifsCount / totalGifsCount) * 100}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: theme.palette.highlight?.main
                }
              }}
            />
          </Box>
        )}
        
        {/* Индикатор загрузки */}
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
        ) : (
          /* Форма редактирования тренировки */
          <Stack spacing={3} sx={{ position: 'relative' }}>
            {/* Оверлей для загрузки GIF-файлов */}
            {loadingGifs && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  bgcolor: 'rgba(0, 0, 0, 0.7)',
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backdropFilter: 'blur(3px)',
                  borderRadius: 2,
                }}
              >
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: 'white',
                    mb: 2
                  }}
                >
                  Загрузка GIF-файлов упражнений
                </Typography>
                <Box sx={{ width: '70%', mb: 2 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={(loadedGifsCount / totalGifsCount) * 100}
                    sx={{
                      height: 10,
                      borderRadius: 5,
                      bgcolor: 'rgba(255, 255, 255, 0.2)',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: theme.palette.highlight?.main
                      }
                    }}
                  />
                </Box>
                <Typography variant="body2" sx={{ color: 'white' }}>
                  {loadedGifsCount} из {totalGifsCount} файлов
                </Typography>
              </Box>
            )}
            
          {/* Название тренировки */}
          <TextField
            fullWidth
            label="Название тренировки"
            name="title"
            value={training.title}
            onChange={handleTrainingChange}
            variant="outlined"
            InputLabelProps={{
              style: { color: theme.palette.textColors?.secondary }
            }}
            InputProps={{
              style: { color: theme.palette.textColors?.primary }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.23)',
                },
                '&:hover fieldset': {
                  borderColor: theme.palette.highlight?.main,
                },
                '&.Mui-focused fieldset': {
                  borderColor: theme.palette.highlight?.main,
                },
              },
            }}
          />
          
          {/* Описание тренировки */}
          <TextField
            fullWidth
            label="Описание тренировки"
            name="description"
            value={training.description || ""}
            onChange={handleTrainingChange}
            variant="outlined"
            multiline
            rows={2}
            InputLabelProps={{
              style: { color: theme.palette.textColors?.secondary }
            }}
            InputProps={{
              style: { color: theme.palette.textColors?.primary }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.23)',
                },
                '&:hover fieldset': {
                  borderColor: theme.palette.highlight?.main,
                },
                '&.Mui-focused fieldset': {
                  borderColor: theme.palette.highlight?.main,
                },
              },
            }}
          />
          
          {/* Переключатель публичности тренировки */}
          <Paper
            elevation={1}
            sx={{ 
              bgcolor: theme.palette.backgrounds?.paper,
              p: 2,
              borderRadius: 2
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={training.isPublic || false}
                  onChange={handlePublicToggle}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: theme.palette.highlight?.main,
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.highlight?.main || '#FFA500', 0.1),
                      },
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: theme.palette.highlight?.main,
                    },
                  }}
                />
              }
              label={
                <Box>
                  <Typography variant="body1" sx={{ color: theme.palette.textColors?.primary }}>
                    Опубликовать тренировку для всех
                  </Typography>
                  <Typography variant="caption" sx={{ color: theme.palette.textColors?.secondary }}>
                    Если включено, тренировка будет доступна другим пользователям
                  </Typography>
                </Box>
              }
              sx={{ 
                m: 0,
                width: '100%',
                justifyContent: 'space-between',
                '.MuiFormControlLabel-label': {
                  flex: 1
                }
              }}
            />
          </Paper>
          
          {/* Список упражнений в тренировке */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography 
              variant="h6" 
              sx={{ 
                color: theme.palette.textColors?.primary,
                fontSize: '1.1rem'
              }}
            >
              Упражнения:
            </Typography>
            
            {training.exercises.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <DragIndicatorIcon 
                  sx={{ 
                    color: theme.palette.highlight?.main,
                    mr: 0.5
                  }} 
                />
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: theme.palette.textColors?.secondary,
                    fontStyle: 'italic'
                  }}
                >
                  Перетащите чтобы изменить порядок
                </Typography>
                <Tooltip title="Удерживайте и перетащите упражнение, чтобы изменить порядок последовательности выполнения">
                  <IconButton 
                    size="small" 
                    sx={{ color: theme.palette.textColors?.secondary, ml: 0.5 }}
                  >
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Box>
          
          {training.exercises.length === 0 ? (
            <Typography 
              variant="body2" 
              sx={{ 
                color: theme.palette.textColors?.secondary,
                textAlign: 'center',
                py: 2
              }}
            >
              Нет добавленных упражнений
            </Typography>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="droppable-exercises">
                {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    style={{
                      background: snapshot.isDraggingOver ? 'rgba(255, 140, 0, 0.05)' : 'transparent',
                      borderRadius: 8,
                      padding: 4,
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    {training.exercises.map((ex, index) => (
                      <Draggable 
                        key={ex.id.toString()} 
                        draggableId={ex.id.toString()} 
                        index={index}
                      >
                        {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            style={{
                              ...provided.draggableProps.style,
                              marginBottom: 16
                            }}
                          >
                            <Paper
                              elevation={snapshot.isDragging ? 10 : 1}
                              sx={{ 
                                bgcolor: theme.palette.backgrounds?.paper,
                                borderRadius: 2,
                                overflow: 'hidden',
                                cursor: 'pointer',
                                borderLeft: snapshot.isDragging 
                                  ? `4px solid ${theme.palette.highlight?.main}` 
                                  : 'none',
                                transition: 'all 0.2s ease',
                                transform: snapshot.isDragging ? 'scale(1.02)' : 'none'
                              }}
                              onClick={() => handleEditExercise(ex)}
                                onDoubleClick={() => ex.exercise.gifUuid && handleOpenGifPreview(ex.exercise)}
                            >
                              <ListItem 
                                sx={{ px: 2, py: 1 }}
                                secondaryAction={
                                  <IconButton 
                                    edge="end" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteExerciseRequest(ex.id);
                                    }}
                                    sx={{ color: 'rgba(255, 0, 0, 0.7)' }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                }
                              >
                                <div
                                  {...provided.dragHandleProps}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    marginRight: 8,
                                    color: theme.palette.highlight?.main,
                                    opacity: 0.7,
                                    cursor: 'grab'
                                  }}
                                >
                                  <DragIndicatorIcon />
                                </div>
                                
                                <Stack width="100%">
                                  <Typography 
                                    variant="subtitle1" 
                                    sx={{ 
                                      color: theme.palette.textColors?.primary,
                                        fontWeight: 'medium',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                  >
                                    {index + 1}. {ex.exercise.name}
                                      {ex.exercise.gifUuid && (
                                        <IconButton 
                                          size="small" 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenGifPreview(ex.exercise);
                                          }}
                                          sx={{ 
                                            ml: 1, 
                                            p: 0.5,
                                            color: theme.palette.highlight?.main
                                          }}
                                        >
                                          <FullscreenIcon fontSize="small" />
                                        </IconButton>
                                      )}
                                    </Typography>
                                    
                                    <Typography 
                                      variant="body2" 
                                      sx={{ 
                                        color: theme.palette.textColors?.secondary,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        lineHeight: '1.3em',
                                        maxHeight: '2.6em', // 2 строки * lineHeight
                                        mb: 1
                                      }}
                                    >
                                      {ex.exercise.description}
                                  </Typography>
                                  
                                  <Stack direction="row" spacing={2} mt={1}>
                                    {ex.repetitions !== undefined && ex.repetitions > 0 && (
                                      <Stack direction="row" alignItems="center" spacing={0.5}>
                                        <RepeatIcon 
                                          fontSize="small" 
                                          sx={{ color: theme.palette.highlight?.main }}
                                        />
                                        <Typography 
                                          variant="body2" 
                                          sx={{ color: theme.palette.textColors?.secondary }}
                                        >
                                          {ex.repetitions} повторений
                                        </Typography>
                                      </Stack>
                                    )}
                                    
                                    {ex.duration !== undefined && ex.duration > 0 && (
                                      <Stack direction="row" alignItems="center" spacing={0.5}>
                                        <TimerIcon 
                                          fontSize="small" 
                                          sx={{ color: theme.palette.highlight?.main }}
                                        />
                                        <Typography 
                                          variant="body2" 
                                          sx={{ color: theme.palette.textColors?.secondary }}
                                        >
                                          {ex.duration} сек
                                        </Typography>
                                      </Stack>
                                    )}
                                  </Stack>
                                </Stack>
                              </ListItem>
                            </Paper>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
          
          {/* Кнопка добавления упражнения */}
          <Fab
            color="primary"
            aria-label="add"
            onClick={handleOpenExerciseDialog}
            sx={{ 
              alignSelf: 'center',
              my: 2,
              bgcolor: theme.palette.highlight?.main,
              '&:hover': {
                bgcolor: theme.palette.highlight?.accent,
              },
            }}
          >
            <AddIcon />
          </Fab>
        </Stack>
        )}
        
        {/* Кнопка сохранения */}
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          fullWidth
          onClick={handleSave}
          sx={{
            mt: 2,
            py: 1.5,
            bgcolor: theme.palette.highlight?.main,
            '&:hover': {
              bgcolor: theme.palette.highlight?.accent,
            },
            borderRadius: '24px',
            textTransform: 'none',
            fontWeight: 'bold',
            color: theme.palette.textColors?.primary
          }}
        >
          Сохранить тренировку
        </Button>
        
        {/* Кнопка удаления тренировки */}
        <Button
          variant="outlined"
          startIcon={<DeleteIcon />}
          fullWidth
          onClick={() => setDeleteTrainingDialogOpen(true)}
          sx={{
            mt: 1,
            py: 1.5,
            borderColor: 'rgba(255, 0, 0, 0.5)',
            color: 'rgba(255, 0, 0, 0.7)',
            '&:hover': {
              borderColor: 'rgba(255, 0, 0, 0.7)',
              bgcolor: 'rgba(255, 0, 0, 0.08)',
            },
            borderRadius: '24px',
            textTransform: 'none',
            fontWeight: 'bold',
          }}
        >
          Удалить тренировку
        </Button>
        
        {/* Диалог выбора упражнения */}
        <Dialog
          open={exerciseDialogOpen}
          onClose={handleCloseExerciseDialog}
          fullWidth
          maxWidth="sm"
          PaperProps={{
            sx: { 
              bgcolor: theme.palette.backgrounds?.default,
              color: theme.palette.textColors?.primary,
              borderRadius: 2,
              minHeight: '70vh'
            }
          }}
        >
          <DialogTitle sx={{ 
            display: 'flex', 
            alignItems: 'center',
            px: 2,
            py: 1.5,
            borderBottom: `1px solid ${theme.palette.divider}`
          }}>
                      <IconButton 
              edge="start" 
              onClick={handleCloseExerciseDialog}
              sx={{ color: theme.palette.textColors?.primary }}
            >
              <ArrowBackIcon />
                      </IconButton>
            <Typography 
              variant="h6" 
                    sx={{ 
                flexGrow: 1, 
                textAlign: 'center', 
                fontWeight: 'medium',
                fontSize: '1.2rem',
                mr: 6 // Компенсация кнопки назад для центрирования
              }}
            >
              Пул упражнений
            </Typography>
          </DialogTitle>
          
          <Divider />
          
          <DialogContent sx={{ p: 0 }}>
            <ExerciseGroupsList 
              muscleGroups={muscleGroups}
              openGroups={openGroups}
              onToggleGroup={handleToggleGroup}
              onSelectExercise={handleSelectExercise}
              loading={loading}
              error={error}
              showEditControls={false}
            />
          </DialogContent>
        </Dialog>
        
        {/* Диалог настройки параметров упражнения */}
        <Dialog
          open={exerciseParamsDialogOpen}
          onClose={handleCloseExerciseParamsDialog}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle sx={{ position: 'relative', pb: 1 }}>
            <IconButton
              aria-label="back"
              onClick={handleCloseExerciseParamsDialog}
              sx={{ position: 'absolute', left: 8, top: 8 }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Box sx={{ textAlign: 'center', pt: 1 }}>
              {selectedExercise?.name}
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 2 }}>
                {selectedExercise?.description}
            </Typography>
              {selectedExercise?.gifUuid && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  <Box
                    component="img"
                    className="gif-preview"
                    src={`${API_URL}${WORKOUT_API_PREFIX}/exercises/gif/${selectedExercise.gifUuid}`}
                    alt={selectedExercise.name}
                    sx={{ maxWidth: '100%', height: 'auto', borderRadius: 1 }}
                  />
                </Box>
              )}
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={6}>
              <TextField
                fullWidth
                label="Количество повторений"
                name="repetitions"
                type="number"
                value={exerciseParams.repetitions || ""}
                onChange={handleExerciseParamsChange}
                variant="outlined"
                InputLabelProps={{
                  style: { color: theme.palette.textColors?.secondary }
                }}
                InputProps={{
                  style: { color: theme.palette.textColors?.primary }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.23)',
                    },
                    '&:hover fieldset': {
                      borderColor: theme.palette.highlight?.main,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: theme.palette.highlight?.main,
                    },
                  },
                }}
              />
              </Grid>
              <Grid item xs={6}>
              <TextField
                fullWidth
                label="Продолжительность (сек)"
                name="duration"
                type="number"
                value={exerciseParams.duration || ""}
                onChange={handleExerciseParamsChange}
                variant="outlined"
                InputLabelProps={{
                  style: { color: theme.palette.textColors?.secondary }
                }}
                InputProps={{
                  style: { color: theme.palette.textColors?.primary }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.23)',
                    },
                    '&:hover fieldset': {
                      borderColor: theme.palette.highlight?.main,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: theme.palette.highlight?.main,
                    },
                  },
                }}
              />
              </Grid>
            </Grid>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: theme.palette.highlight?.main, 
                  fontStyle: 'italic',
                  mt: -1
                }}
              >
                * Укажите количество повторений, продолжительность или оба параметра
              </Typography>
          </DialogContent>
          
          <DialogActions>
            <Button 
              onClick={handleCloseExerciseParamsDialog}
              sx={{ color: theme.palette.textColors?.secondary }}
            >
              Отмена
            </Button>
            {editMode && (
              <Button 
                onClick={() => {
                  setDeleteDialogOpen(true);
                  setExerciseToDelete(editingExerciseId);
                  handleCloseExerciseParamsDialog();
                }}
                sx={{ 
                  color: 'rgba(255, 0, 0, 0.7)',
                  '&:hover': {
                    bgcolor: 'rgba(255, 0, 0, 0.08)'
                  }
                }}
              >
                Удалить
              </Button>
            )}
            <Button 
              onClick={handleSaveExerciseParams}
              sx={{ 
                color: theme.palette.highlight?.main,
                '&:hover': {
                  bgcolor: 'rgba(255, 140, 0, 0.08)'
                }
              }}
              disabled={!exerciseParams.repetitions && !exerciseParams.duration}
            >
              {editMode ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Диалог подтверждения удаления */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          PaperProps={{
            sx: { 
              bgcolor: theme.palette.backgrounds?.paper,
              color: theme.palette.textColors?.primary
            }
          }}
        >
          <DialogTitle>Подтверждение удаления</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: theme.palette.textColors?.secondary }}>
              Вы уверены, что хотите удалить это упражнение из тренировки?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setDeleteDialogOpen(false)}
              sx={{ color: theme.palette.textColors?.secondary }}
            >
              Отмена
            </Button>
            <Button 
              onClick={handleDeleteExercise}
              sx={{ 
                color: 'rgba(255, 0, 0, 0.7)',
                '&:hover': {
                  bgcolor: 'rgba(255, 0, 0, 0.08)'
                }
              }}
              autoFocus
            >
              Удалить
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Диалог подтверждения удаления тренировки */}
        <Dialog
          open={deleteTrainingDialogOpen}
          onClose={() => setDeleteTrainingDialogOpen(false)}
          PaperProps={{
            sx: { 
              bgcolor: theme.palette.backgrounds?.paper,
              color: theme.palette.textColors?.primary
            }
          }}
        >
          <DialogTitle>Подтверждение удаления</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: theme.palette.textColors?.secondary }}>
              Вы уверены, что хотите удалить тренировку "{training.title}"? Это действие невозможно отменить.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setDeleteTrainingDialogOpen(false)}
              sx={{ color: theme.palette.textColors?.secondary }}
            >
              Отмена
            </Button>
            <Button 
              onClick={handleDeleteTraining}
              sx={{ 
                color: 'rgba(255, 0, 0, 0.7)',
                '&:hover': {
                  bgcolor: 'rgba(255, 0, 0, 0.08)'
                }
              }}
              autoFocus
            >
              Удалить
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* GIF Preview Modal */}
        <Modal
          open={gifPreviewOpen}
          onClose={handleCloseGifPreview}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            sx={{
              position: 'relative',
              bgcolor: 'background.paper',
              borderRadius: 2,
              boxShadow: 24,
              p: 2,
              maxWidth: '90vw',
              maxHeight: '90vh',
              overflow: 'hidden',
            }}
          >
            <IconButton
              sx={{ position: 'absolute', top: 8, right: 8 }}
              onClick={handleCloseGifPreview}
            >
              <CloseIcon />
            </IconButton>
            <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>
              {previewExercise?.name}
            </Typography>
            
            {previewExercise?.gifUuid ? (
              <Box sx={{ position: 'relative' }}>
                <Box
                  component="img"
                  className="gif-preview"
                  src={`${API_URL}${WORKOUT_API_PREFIX}/exercises/gif/${previewExercise.gifUuid}?t=${Date.now()}`}
                  alt={previewExercise.name}
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    console.error('Ошибка загрузки GIF для предпросмотра');
                    e.currentTarget.src = '/images/error-gif.png'; // Путь к изображению-заглушке
                    e.currentTarget.style.opacity = '0.5';
                  }}
                  sx={{
                    maxWidth: '100%',
                    maxHeight: 'calc(90vh - 100px)',
                    objectFit: 'contain',
                    display: 'block',
                    margin: '0 auto',
                  }}
                />
                <Box sx={{ 
                  mt: 2, 
                  display: 'flex', 
                  justifyContent: 'center',
                  color: theme.palette.highlight?.main  
                }}>
                  <Button 
                    variant="outlined"
                    onClick={() => {
                      // Принудительно перезагружаем GIF
                      if (previewExercise?.gifUuid) {
                        const refreshedGifUrl = `${API_URL}${WORKOUT_API_PREFIX}/exercises/gif/${previewExercise.gifUuid}?refresh=${Date.now()}`;
                        const img = document.querySelector('.gif-preview') as HTMLImageElement;
                        if (img) {
                          img.src = refreshedGifUrl;
                        }
                      }
                    }}
                    startIcon={<RefreshIcon />}
                    sx={{ 
                      borderColor: theme.palette.highlight?.main,
                      color: theme.palette.highlight?.main,
                      '&:hover': {
                        bgcolor: 'rgba(255, 140, 0, 0.08)'
                      }
                    }}
                  >
                    Обновить GIF
                  </Button>
                </Box>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                GIF не найден для этого упражнения
              </Typography>
            )}
          </Box>
        </Modal>
      </Stack>
    </MainLayout>
  );
} 