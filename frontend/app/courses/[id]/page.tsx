"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "@mui/material/styles";
import { 
  Stack, 
  Box, 
  Typography, 
  Avatar,
  useMediaQuery,
  Button,
  IconButton,
  Rating,
  Divider,
  Paper,
  TextField,
  Switch,
  FormControlLabel,
  RadioGroup,
  Radio,
  FormControl,
  FormLabel,
  CircularProgress,
  FormHelperText
} from "@mui/material";
import { useParams, useRouter } from "next/navigation";
import SettingsIcon from '@mui/icons-material/Settings';
import LockIcon from '@mui/icons-material/Lock';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
import MainLayout from "@/app/components/layouts/MainLayout";
import SearchBar from "@/app/components/shared/SearchBar";
import PeopleIcon from '@mui/icons-material/People';
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import StarIcon from '@mui/icons-material/Star';
import { useAuth } from "@/app/auth/hooks/useAuth";
import { coursesApi, CourseResponse, profileApi, PublicProfileResponse, CourseWorkoutResponse, workoutsApi } from "@/app/services/api";
import { useAvatar } from "@/app/hooks/useAvatar";
import CourseSettingsPage from './components/CourseSettingsPage';
import { CourseErrorBlock } from "./components/CourseErrorBlock";
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import MuscleUsageChart from '../components/MuscleUsageChart';
import WorkoutCard from './components/WorkoutCard';
import TrainerInfo from '@/app/components/shared/TrainerInfo';
import YMAnalytics from '@/app/utils/analytics';

// Функция для получения цвета по ID группы мышц
function getColorForMuscleGroup(id: number, theme: any): string {
  // Массив предустановленных цветов для разных групп мышц
  const colors = [
    theme.palette.highlight?.main ?? "#64b5f6",  // Основной цвет
    theme.palette.success.main ?? "#4caf50",     // Зеленый
    theme.palette.warning.main ?? "#ff9800",     // Оранжевый
    theme.palette.error.main ?? "#f44336",       // Красный
    theme.palette.info.main ?? "#2196f3",        // Синий
    "#9c27b0",  // Фиолетовый
    "#e91e63",  // Розовый
    "#009688",  // Бирюзовый
    "#cddc39",  // Лаймовый
    "#ff5722"   // Темно-оранжевый
  ];
  
  // Выбираем цвет по остатку от деления ID на количество цветов
  return colors[(id - 1) % colors.length];
}

export default function CoursePage() {
  const theme = useTheme();
  const params = useParams();
  const courseId = params.id as string;
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Состояния для данных курса
  const [courseData, setCourseData] = useState<CourseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorType, setErrorType] = useState<'hidden' | 'notFound' | null>(null);

  // Состояния для данных автора курса
  const [authorData, setAuthorData] = useState<PublicProfileResponse | null>(null);
  const [authorLoading, setAuthorLoading] = useState(false);

  // Состояния для тренировок курса
  const [workouts, setWorkouts] = useState<CourseWorkoutResponse[]>([]);
  const [workoutsLoading, setWorkoutsLoading] = useState(false);
  const [workoutsError, setWorkoutsError] = useState<string | null>(null);

  // Состояния для подписки на курс
  const [subscribeLoading, setSubscribeLoading] = useState(false);

  // Состояния для перетаскивания и изменения порядка тренировок
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [originalWorkoutsOrder, setOriginalWorkoutsOrder] = useState<CourseWorkoutResponse[]>([]);
  const [reorderLoading, setReorderLoading] = useState(false);

  // Получение аватарки автора курса с использованием хука useAvatar
  const { avatarUrl: authorAvatarUrl, loading: authorAvatarLoading } = useAvatar(authorData?.avatar_url);

  // Состояния для модального окна настроек
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration: 0, // Длительность в секундах (рассчитывается автоматически)
    is_published: false,
    is_paid: false,
    price: 0
  });

  // Состояния для диалога подтверждения удаления
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Состояния для управления панелью поиска при скролле
  const [isSearchBarVisible, setIsSearchBarVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isAtTop, setIsAtTop] = useState(true);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollTimeRef = useRef(Date.now());
  const lastScrollPositionRef = useRef(0);

  // Состояние для хранения данных рейтинга тренера
  const [trainerRating, setTrainerRating] = useState<{ rating: number, rating_count: number } | null>(null);
  const [trainerRatingLoading, setTrainerRatingLoading] = useState<boolean>(false);

  // Состояние для управления раскрытием описания курса
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState<boolean>(false);

  // Определяем, является ли текущий пользователь владельцем курса
  const isOwner = React.useMemo(() => {
    console.log('=== ПРОВЕРКА ВЛАДЕЛЬЦА КУРСА ===');
    console.log('authLoading:', authLoading);
    console.log('user:', user);
    console.log('courseData:', courseData);
    
    if (authLoading || !user || !courseData) {
      console.log('Владелец = false (нет данных)');
      return false;
    }
    
    const userIdStr = String(user.user_id);
    const courseUserIdStr = String(courseData.user_id);
    console.log('userIdStr:', userIdStr);
    console.log('courseUserIdStr:', courseUserIdStr);
    
    const isMatch = userIdStr === courseUserIdStr;
    console.log('isOwner:', isMatch);
    console.log('===========================');
    
    return isMatch;
  }, [user, courseData, authLoading]);

  // Загружаем данные курса при монтировании компонента
  useEffect(() => {
    const loadCourse = async () => {
      try {
        setLoading(true);
        setErrorType(null);
        const course = await coursesApi.getById(courseId);
        setCourseData(course);
        
        // Аналитика: открытие курса
        if (course?.name) {
          YMAnalytics.openCourse(course.name, courseId);
        }
        
        // После загрузки курса загружаем данные автора
        if (course?.user_id) {
          await loadAuthor(course.user_id.toString());
        }
        
        // Загружаем тренировки курса для авторизованных пользователей
        await loadWorkouts(courseId);
      } catch (error: any) {
        console.error('Ошибка при загрузке курса:', error);
        console.log('Структура ошибки:', {
          error,
          response: error?.response,
          status: error?.response?.status,
          data: error?.response?.data
        });
        
        // Проверяем, если курс скрыт (403 ошибка)
        if (error?.response?.status === 403 || error?.status === 403) {
          console.log('Курс скрыт - устанавливаем errorType = hidden');
          setErrorType('hidden');
          setCourseData(null);
        } else {
          console.log('Другая ошибка - используем fallback');
          // Если не удалось загрузить по другой причине, считаем что курс не найден
          setErrorType('notFound');
          setCourseData(null);
        }
      } finally {
        setLoading(false);
      }
    };

    const loadAuthor = async (userId: string) => {
      try {
        setAuthorLoading(true);
        console.log('Загружаем данные автора курса с user_id:', userId);
        const author = await profileApi.getUserProfile(userId);
        console.log('Данные автора загружены:', author);
        setAuthorData(author);
        
        // Загружаем данные о рейтинге тренера
        await loadTrainerRating(userId);
      } catch (error) {
        console.error('Ошибка при загрузке данных автора:', error);
        // Если не удалось загрузить автора, оставляем authorData как null
      } finally {
        setAuthorLoading(false);
      }
    };

    if (courseId && !courseId.startsWith('new-')) {
      loadCourse();
    } else {
      setLoading(false);
    }
  }, [courseId]);

  // Функция загрузки тренировок (выносим отдельно для переиспользования)
  const loadWorkouts = async (courseId: string) => {
    try {
      setWorkoutsLoading(true);
      setWorkoutsError(null);
      console.log('Загружаем тренировки курса:', courseId);
      const courseWorkouts = await coursesApi.getCourseWorkouts(courseId);
      console.log('Тренировки курса загружены:', courseWorkouts);
      setWorkouts(courseWorkouts);
    } catch (error: any) {
      console.error('Ошибка при загрузке тренировок курса:', error);
      
      // Устанавливаем сообщение об ошибке
      if (error?.response?.status === 403) {
        setWorkoutsError('Доступ к тренировкам курса разрешен только автору курса или администратору');
      } else {
        setWorkoutsError('Не удалось загрузить тренировки курса');
      }
      setWorkouts([]);
    } finally {
      setWorkoutsLoading(false);
    }
  };

  // Функция загрузки данных о рейтинге тренера
  const loadTrainerRating = async (userId: string) => {
    try {
      setTrainerRatingLoading(true);
      const ratingData = await profileApi.getUserRating(userId);
      console.log('Данные о рейтинге тренера загружены:', ratingData);
      setTrainerRating({
        rating: ratingData.rating,
        rating_count: ratingData.count
      });
    } catch (error) {
      console.error('Ошибка при загрузке данных о рейтинге тренера:', error);
      // В случае ошибки оставляем trainerRating как null
    } finally {
      setTrainerRatingLoading(false);
    }
  };

  // Обработчик скролла
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const currentTime = Date.now();
      const timeDiff = Math.max(1, currentTime - lastScrollTimeRef.current);
      
      const direction = currentScrollY < lastScrollY ? 'up' : 'down';
      const distance = Math.abs(currentScrollY - lastScrollPositionRef.current);
      const atTop = currentScrollY < 10;
      setIsAtTop(atTop);
      
      if (atTop) {
        setIsSearchBarVisible(true);
      } else if (direction === 'down' && distance > 30) {
        setIsSearchBarVisible(false);
      } else if (direction === 'up') {
        setIsSearchBarVisible(true);
      }
      
      setLastScrollY(currentScrollY);
      lastScrollTimeRef.current = currentTime;
      lastScrollPositionRef.current = currentScrollY;
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [lastScrollY]);

  // Функция для возврата назад
  const handleGoBack = () => {
    // Перенаправляем на страницу профиля автора курса
    if (courseData?.user_id) {
      router.push(`/courses/coach-profile/${courseData.user_id}`);
    } else {
      // Если нет ID автора, то перенаправляем на страницу курсов
      router.push('/courses');
    }
  };

  // Функция для перехода на страницу тренера
  const handleCoachClick = () => {
    if (courseData?.user_id) {
      router.push(`/courses/coach-profile/${courseData.user_id}`);
    }
  };

  // Функция для перехода к другим курсам
  const handleViewOtherCourses = () => {
    router.push('/courses');
  };

  // Функция для настроек курса (будет доступна только владельцу)
  const handleSettingsClick = () => {
    if (!courseData) return;
    
    // Заполняем форму текущими данными курса
    setFormData({
      name: courseData.name || '',
      description: courseData.description || '',
      duration: courseData.duration || 0,
      is_published: courseData.is_published || false,
      is_paid: (courseData.price && courseData.price > 0) || false,
      price: courseData.price || 0
    });
    
    setSettingsOpen(true);
  };

  // Функция для закрытия модального окна настроек
  const handleSettingsClose = () => {
    setSettingsOpen(false);
  };

  // Обработчик изменения полей формы настроек
  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Если это цена, то также обновляем статус платности
      if (field === 'price') {
        newData.is_paid = value > 0;
      }
      
      // Если меняем статус платности и курс становится бесплатным, обнуляем цену
      if (field === 'is_paid' && value === false) {
        newData.price = 0;
      }
      
      return newData;
    });
  };

  // Функция для удаления курса
  const handleDeleteCourse = async () => {
    if (!courseData) return;

    try {
      setDeleteLoading(true);
      
      // Отправляем запрос на удаление курса
      await coursesApi.delete(courseData.course_uuid);
      
      // Закрываем настройки
      setSettingsOpen(false);
      
      // Перенаправляем на страницу курсов
      router.push('/courses');
      
    } catch (error) {
      console.error('Ошибка при удалении курса:', error);
      alert('Ошибка при удалении курса. Попробуйте еще раз.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Функция для сохранения настроек
  const handleSettingsSave = async () => {
    if (!courseData) return;

    try {
      setSettingsLoading(true);
      
      const updateData = {
        name: formData.name,
        description: formData.description,
        duration: formData.duration,
        is_published: formData.is_published,
        price: formData.is_paid ? formData.price : 0
      };

      const updatedCourse = await coursesApi.update(courseData.course_uuid, updateData);
      setCourseData(updatedCourse);
      setSettingsOpen(false);
      
    } catch (error) {
      console.error('Ошибка при сохранении настроек:', error);
      alert('Ошибка при сохранении настроек. Попробуйте еще раз.');
    } finally {
      setSettingsLoading(false);
    }
  };

  // Функция для создания тренировки (только для владельца курса)
  const handleCreateWorkout = () => {
    if (!isOwner || !courseData) return;
    
    // Переходим на страницу создания тренировки с ID курса
    router.push(`/workouts/create?courseId=${courseData.course_uuid}`);
  };

  // Функции для управления порядком тренировок
  const handleStartEditingOrder = () => {
    setOriginalWorkoutsOrder([...workouts]);
    setIsEditingOrder(true);
  };

  const handleCancelEditingOrder = () => {
    setWorkouts([...originalWorkoutsOrder]);
    setIsEditingOrder(false);
    setOriginalWorkoutsOrder([]);
  };

  const handleSaveWorkoutOrder = async () => {
    if (!courseData || !isOwner) return;

    try {
      setReorderLoading(true);
      
      // Подготавливаем данные для отправки на сервер
      const workoutOrders = workouts.map((workout, index) => ({
        workout_uuid: workout.course_workout_uuid,
        order_index: index + 1
      }));

      // Получаем токен (можно было бы вынести в отдельную функцию)
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('access_token='))
        ?.split('=')[1];

      if (!token) {
        throw new Error('Токен авторизации не найден');
      }

      await workoutsApi.reorder(courseData.course_uuid, workoutOrders, token);
      
      setIsEditingOrder(false);
      setOriginalWorkoutsOrder([]);
      
      // Перезагружаем тренировки чтобы получить актуальный порядок
      await loadWorkouts(courseData.course_uuid);
      
    } catch (error) {
      console.error('Ошибка при сохранении порядка тренировок:', error);
      // Возвращаем исходный порядок при ошибке
      setWorkouts([...originalWorkoutsOrder]);
      alert('Ошибка при сохранении порядка тренировок. Попробуйте еще раз.');
    } finally {
      setReorderLoading(false);
    }
  };

  // Таймер для автоматического сохранения после перетаскивания
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(workouts);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setWorkouts(items);
    
    // Если режим редактирования порядка активен, автоматически сохраняем через 1 секунду
    if (isEditingOrder && isOwner && courseData) {
      // Очищаем предыдущий таймер, если он был
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      
      // Устанавливаем новый таймер
      saveTimerRef.current = setTimeout(() => {
        const workoutOrders = items.map((workout, index) => ({
          workout_uuid: workout.course_workout_uuid,
          order_index: index + 1
        }));

        // Получаем токен
        const token = document.cookie
          .split('; ')
          .find(row => row.startsWith('access_token='))
          ?.split('=')[1];

        if (!token) {
          console.error('Токен авторизации не найден');
          return;
        }

        // Устанавливаем индикатор загрузки
        setReorderLoading(true);
        
        // Отправляем запрос на сервер
        workoutsApi.reorder(courseData.course_uuid, workoutOrders, token)
          .then(() => {
            console.log('Порядок тренировок успешно обновлен');
          })
          .catch((error) => {
            console.error('Ошибка при автоматическом сохранении порядка тренировок:', error);
          })
          .finally(() => {
            setReorderLoading(false);
          });
      }, 1000); // 1 секунда задержки
    }
  };

  // Очистка таймера при размонтировании компонента
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Функция для обработки клика на drag handle
  const handleDragHandleClick = (e: React.MouseEvent<HTMLElement, MouseEvent> | React.TouchEvent<HTMLElement>) => {
    e.stopPropagation(); // Предотвращаем всплытие события
    if (!isEditingOrder) {
      handleStartEditingOrder();
    }
  };

  // Функция для оформления подписки
  const handleSubscribe = () => {
    if (!courseData) return;
    
    // Проверяем, бесплатный ли курс
    const isFree = !courseData.price || courseData.price <= 0;
    
    if (isFree) {
      // Аналитика: получение бесплатного доступа
      YMAnalytics.getFreeAccess(courseData.name || '', courseId);
      
      // Для бесплатных курсов отправляем запрос на получение бесплатной подписки
      handleFreeSubscription();
    } else {
      // Аналитика: попытка оформления платной подписки
      YMAnalytics.subscribeCourse(courseData.name || '', courseId, courseData.price);
      
      // Перенаправляем на страницу выбора способа оплаты
      const paymentUrl = `/courses/${courseId}/payment`;
      console.log('Перенаправление на страницу оплаты:', paymentUrl);
      
      // Используем replace вместо push для предотвращения проблем с историей браузера
      router.replace(paymentUrl);
    }
  };

  // Функция для получения бесплатной подписки
  const handleFreeSubscription = async () => {
    if (!courseData) return;
    
    try {
      setSubscribeLoading(true);
      
      // Используем метод из API
      const result = await profileApi.subscribeFree(courseData.course_uuid);
      
      console.log('Бесплатная подписка успешно оформлена:', result);
      
      // Перезагружаем данные курса для обновления статуса подписки
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error: any) {
      console.error('Ошибка при получении бесплатной подписки:', error);
      alert('Ошибка при получении доступа к курсу');
    } finally {
      setSubscribeLoading(false);
    }
  };

  // Функция для форматирования числа подписчиков
  const formatSubscribersCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  // Функция для форматирования времени из секунд в читаемый формат
  const formatDuration = (seconds: number | undefined | null): string => {
    if (!seconds || seconds <= 0) {
      return "Не указано";
    }
    
    if (seconds < 60) {
      return `${seconds} сек`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      if (remainingSeconds === 0) {
        return `${minutes} мин`;
      }
      return `${minutes} мин ${remainingSeconds} сек`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (minutes === 0) {
        return `${hours} ч`;
      }
      return `${hours} ч ${minutes} мин`;
    }
  };

  // Проверяем, является ли курс новым (неопубликованным)
  const isNewCourse = courseId.toString().startsWith('new-');

  // Простые fallback значения для отсутствующих данных
  const displayData = courseData ? {
    title: courseData.name,
    description: courseData.description || "Описание курса",
    duration: formatDuration(courseData.duration),
    workoutsCount: courseData.exercise_count || 0,
    price: courseData.price || 0,
    subscribersCount: courseData.subscribers_count || 0,
    rating: courseData.rating || 0,
    muscleUsage: courseData.muscle_groups && courseData.muscle_groups.length > 0
      ? courseData.muscle_groups.map(group => ({
          name: group.name,
          color: getColorForMuscleGroup(group.id, theme),
          percent: group.percentage
        }))
      : [
          {
            name: "Общая нагрузка",
            color: theme.palette.highlight?.main ?? "#64b5f6",
            percent: 100,
          },
        ],
    trainer: {
      name: authorData ? `${authorData.first_name} ${authorData.last_name}`.trim() || "Автор курса" : "Автор курса",
      avatar: authorData?.avatar_url || "/coach-avatar.jpg",
      rating: trainerRating?.rating ?? ((courseData.rating && typeof courseData.rating === 'number') ? courseData.rating : 0),
      ratingCount: trainerRating?.rating_count ?? 0,
      description: authorData?.description || null
    },
  } : isNewCourse ? {
    title: "Новый курс",
    description: "Курс находится в разработке",
    duration: "Не указано",
    workoutsCount: 0,
    price: 0,
    subscribersCount: 0,
    rating: 0,
    muscleUsage: [
      {
        name: "Нет данных",
        color: theme.palette.textColors?.secondary ?? "#888",
        percent: 100,
      },
    ],
    trainer: {
      name: "Неизвестно",
      avatar: "/coach-avatar.jpg",
      rating: 0,
      description: null
    },
  } : null; // Для ошибок не формируем displayData

  // Обработчик клика по превью тренировки
  const handleWorkoutClick = (workout: any) => {
    if (workout.video_url) {
      // Переходим на страницу просмотра видео
      router.push(`/courses/${courseId}/workout?workoutId=${workout.course_workout_uuid}`);
    } else {
      router.push(`/courses/${courseId}/workout?workoutId=${workout.course_workout_uuid}`);
    }
  };

  return (
    <>
      {/* Панель поиска с кнопками */}
      {!settingsOpen && (
        <SearchBar 
          isSearchBarVisible={isSearchBarVisible} 
          isAtTop={isAtTop} 
          showBackButton={true}
          showProfileButton={false}
          showFilterButton={true}
          showSettingsButton={isOwner}
          showCreateButton={isOwner}
          onBackClick={handleGoBack}
          onSettingsClick={handleSettingsClick}
          onCreateClick={handleCreateWorkout}
          placeholder="Поиск тренировок"
        />
      )}
      
      {/* Если открыты настройки, показываем страницу настроек */}
      {settingsOpen ? (
        <CourseSettingsPage 
          formData={formData}
          onFormChange={handleFormChange}
          onSave={handleSettingsSave}
          onCancel={handleSettingsClose}
          onDelete={handleDeleteCourse}
          loading={settingsLoading}
          deleteLoading={deleteLoading}
          theme={theme}
          formatDuration={formatDuration}
        />
      ) : (
        <MainLayout>
          <Stack spacing={3} sx={{ pb: 4, px: 1, pt: 7 }}>
            {/* Состояние загрузки */}
            {loading && (
              <Paper
                elevation={0}
                sx={{
                  borderRadius: theme.shape.borderRadius,
                  backgroundColor: theme.palette.backgrounds?.paper,
                  p: { xs: 3, sm: 4 },
                  textAlign: 'center',
                }}
              >
                <Stack spacing={2} alignItems="center">
                  <CircularProgress size={40} />
                  <Typography variant="body1" color={theme.palette.textColors?.secondary}>
                    Загрузка курса...
                  </Typography>
                </Stack>
              </Paper>
            )}

            {/* Сообщение о скрытом курсе */}
            {!loading && errorType === 'hidden' && (
              <CourseErrorBlock type="hidden" onViewOtherCourses={handleViewOtherCourses} theme={theme} />
            )}

            {/* Сообщение о не найденном курсе */}
            {!loading && errorType === 'notFound' && (
              <CourseErrorBlock type="notFound" onViewOtherCourses={handleViewOtherCourses} theme={theme} />
            )}

            {/* Основной контент курса (показываем только если нет ошибок) */}
            {!loading && !errorType && displayData && (
              <>
                {/* Hero блок с основной информацией о курсе */}
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: theme.shape.borderRadius,
                    background: `linear-gradient(135deg, ${theme.palette.backgrounds?.paper} 0%, rgba(25,25,25,0.95) 100%)`,
                    p: { xs: 2, sm: 3 },
                    position: 'relative',
                    overflow: 'visible',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: { xs: '100%', sm: '40%' },
                      height: '100%',
                      background: `radial-gradient(circle at right, ${theme.palette.highlight?.main}22, transparent 70%)`,
                      pointerEvents: 'none',
                    }
                  }}
                >
                  <Stack spacing={2.5}>
                    {/* Заголовок и рейтинг курса */}
                    <Stack 
                      direction={{ xs: 'column', sm: 'row' }} 
                      justifyContent="space-between" 
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      spacing={1}
                    >
                      <Typography 
                        variant="h4" 
                        fontWeight="bold"
                        sx={{
                          fontSize: { xs: '1.5rem', sm: '2rem' },
                          background: `linear-gradient(135deg, ${theme.palette.textColors?.primary} 30%, ${theme.palette.highlight?.main} 90%)`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          wordBreak: 'break-word',
                          lineHeight: 1.2,
                          maxWidth: '100%',
                        }}
                      >
                        {displayData.title.length > 125 
                          ? `${displayData.title.substring(0, 125)}...` 
                          : displayData.title
                        }
                      </Typography>
                      
                      {/* Рейтинг курса */}
                      <Stack 
                        direction="row" 
                        alignItems="center" 
                        spacing={0.5}
                        sx={{
                          background: 'rgba(0,0,0,0.2)',
                          borderRadius: 20,
                          px: 1.5,
                          py: 0.5,
                        }}
                      >
                        <Rating 
                          value={displayData.rating} 
                          precision={0.25} 
                          readOnly 
                          size="small"
                          sx={{
                            '& .MuiRating-iconFilled': {
                              color: theme.palette.ratingColor?.main,
                            }
                          }}
                        />
                        <Typography 
                          variant="body2" 
                          fontWeight="medium"
                          color={theme.palette.textColors?.secondary}
                        >
                          {Number(displayData.rating).toFixed(2)}
                        </Typography>
                      </Stack>
                    </Stack>
                    
                    {/* Описание курса */}
                    <Box>
                      <Typography 
                        variant="body1" 
                        color={theme.palette.textColors?.secondary}
                        sx={{
                          fontSize: { xs: '0.9rem', sm: '1rem' },
                          maxWidth: '800px',
                          lineHeight: 1.6,
                          wordBreak: 'break-word',
                        }}
                      >
                        {isDescriptionExpanded 
                          ? displayData.description 
                          : displayData.description.length > 300 
                            ? `${displayData.description.substring(0, 300)}...` 
                            : displayData.description
                        }
                      </Typography>
                      
                      {/* Кнопка для раскрытия/сворачивания описания */}
                      {displayData.description && displayData.description.length > 300 && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                          <Button
                            onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                            sx={{
                              color: theme.palette.textColors?.secondary,
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              borderRadius: '20px',
                              px: 2,
                              py: 0.5,
                              fontSize: '0.75rem',
                              textTransform: 'none',
                              minHeight: 'auto',
                              opacity: 0.7,
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                opacity: 1,
                              },
                            }}
                          >
                            {isDescriptionExpanded ? 'Свернуть' : 'Развернуть'}
                          </Button>
                        </Box>
                      )}
                    </Box>
                    
                    {/* Блок с графиком мышечных групп */}
                    <Paper
                      elevation={1}
                      sx={{
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        borderRadius: '12px',
                        p: 2,
                        mt: 1,
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <Stack spacing={1.5}>
                        <Typography variant="subtitle2" fontWeight="medium" color={theme.palette.textColors?.secondary}>
                          Нагрузка на группы мышц
                        </Typography>
                        <MuscleUsageChart data={displayData.muscleUsage} />
                      </Stack>
                    </Paper>
                    
                    {/* Информация о курсе в карточках */}
                    <Stack 
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={2}
                      sx={{ mt: 1 }}
                    >
                      {/* Продолжительность */}
                      <Paper
                        elevation={0}
                        sx={{
                          p: 1.5,
                          borderRadius: '10px',
                          backgroundColor: 'rgba(0,0,0,0.15)',
                          flex: 1,
                          border: '1px solid rgba(255,255,255,0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                        }}
                      >
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <AccessTimeIcon color="action" />
                        </Box>
                        <Stack spacing={0.2}>
                          <Typography variant="caption" color={theme.palette.textColors?.secondary}>
                            Продолжительность
                          </Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {displayData.duration}
                          </Typography>
                        </Stack>
                      </Paper>
                      
                      {/* Количество тренировок */}
                      <Paper
                        elevation={0}
                        sx={{
                          p: 1.5,
                          borderRadius: '10px',
                          backgroundColor: 'rgba(0,0,0,0.15)',
                          flex: 1,
                          border: '1px solid rgba(255,255,255,0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                        }}
                      >
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <FitnessCenterIcon color="action" />
                        </Box>
                        <Stack spacing={0.2}>
                          <Typography variant="caption" color={theme.palette.textColors?.secondary}>
                            Тренировок
                          </Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {displayData.workoutsCount}
                          </Typography>
                        </Stack>
                      </Paper>
                      
                      {/* Количество подписчиков */}
                      <Paper
                        elevation={0}
                        sx={{
                          p: 1.5,
                          borderRadius: '10px',
                          backgroundColor: 'rgba(0,0,0,0.15)',
                          flex: 1,
                          border: '1px solid rgba(255,255,255,0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                        }}
                      >
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <PeopleIcon color="action" />
                        </Box>
                        <Stack spacing={0.2}>
                          <Typography variant="caption" color={theme.palette.textColors?.secondary}>
                            Подписчиков
                          </Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {formatSubscribersCount(displayData.subscribersCount)}
                          </Typography>
                        </Stack>
                      </Paper>
                    </Stack>
                    
                    {/* Кнопка подписки */}
                    {!isNewCourse && !isOwner && (
                      <>
                        {courseData?.has_subscription ? (
                          <>
                            {/* Бесплатная подписка (subscription_end_date = null) */}
                            {!courseData.subscription_end_date ? (
                              <Button
                                variant="outlined"
                                onClick={async () => {
                                  try {
                                    if (!courseData) return;
                                    
                                    setSubscribeLoading(true);
                                    
                                    // Отправляем запрос на отмену подписки
                                    const result = await profileApi.cancelSubscription(courseData.course_uuid);
                                    
                                    console.log('Подписка успешно отменена:', result);
                                    
                                    // Перезагружаем данные курса для обновления статуса подписки
                                    setTimeout(() => {
                                      window.location.reload();
                                    }, 2000);
                                    
                                  } catch (error: any) {
                                    console.error('Ошибка при отписке:', error);
                                    alert('Ошибка при отписке от курса');
                                  } finally {
                                    setSubscribeLoading(false);
                                  }
                                }}
                                disabled={subscribeLoading}
                                sx={{
                                  borderRadius: 25,
                                  py: 1.2,
                                  px: 3,
                                  mt: 1,
                                  fontWeight: 'bold',
                                  alignSelf: 'flex-start',
                                  textTransform: 'none',
                                  fontSize: '1rem',
                                  borderColor: theme.palette.error.main,
                                  color: theme.palette.error.main,
                                  position: 'relative',
                                  minWidth: '120px',
                                  transition: 'all 0.3s ease',
                                  '&:hover': {
                                    borderColor: theme.palette.error.dark,
                                    backgroundColor: `${theme.palette.error.main}10`,
                                  },
                                }}
                              >
                                <Box
                                  sx={{
                                    opacity: subscribeLoading ? 0 : 1,
                                    transition: 'opacity 0.3s ease',
                                    position: 'relative',
                                    zIndex: 1,
                                  }}
                                >
                                  Отписаться
                                </Box>
                                {subscribeLoading && (
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      top: '50%',
                                      left: '50%',
                                      transform: 'translate(-50%, -50%)',
                                      opacity: subscribeLoading ? 1 : 0,
                                      transition: 'opacity 0.3s ease 0.1s',
                                      zIndex: 2,
                                    }}
                                  >
                                    <CircularProgress size={24} color="inherit" />
                                  </Box>
                                )}
                              </Button>
                            ) : (
                              /* Платная подписка с датой окончания */
                              <Button
                                variant="outlined"
                                disabled
                                sx={{
                                  borderRadius: 25,
                                  py: 1.2,
                                  px: 3,
                                  mt: 1,
                                  fontWeight: 'bold',
                                  alignSelf: 'flex-start',
                                  textTransform: 'none',
                                  fontSize: '1rem',
                                  borderColor: 'rgba(255,255,255,0.3)',
                                  color: 'rgba(255,255,255,0.7)',
                                }}
                              >
                                Вы подписаны до {new Date(courseData.subscription_end_date).toLocaleDateString()}
                              </Button>
                            )}
                          </>
                        ) : (
                          <Button
                            variant="contained"
                            color="primary"
                            onClick={handleSubscribe}
                            disabled={subscribeLoading}
                            sx={{
                              borderRadius: 25,
                              py: 1.2,
                              px: 3,
                              mt: 1,
                              fontWeight: 'bold',
                              alignSelf: 'flex-start',
                              backgroundColor: theme.palette.highlight?.main,
                              boxShadow: `0 4px 12px ${theme.palette.highlight?.main}66`,
                              textTransform: 'none',
                              fontSize: '1rem',
                              position: 'relative',
                              minWidth: '200px',
                              transition: 'all 0.3s ease',
                              '&:hover': {
                                backgroundColor: theme.palette.highlight?.accent,
                                transform: 'translateY(-2px)',
                                boxShadow: `0 6px 16px ${theme.palette.highlight?.main}99`,
                              },
                            }}
                          >
                            <Box
                              sx={{
                                opacity: subscribeLoading ? 0 : 1,
                                transition: 'opacity 0.3s ease',
                                position: 'relative',
                                zIndex: 1,
                              }}
                            >
                              {displayData.price > 0 ? 
                                `Оформить подписку ${displayData.price} ₽/месяц` : 
                                'Подписаться бесплатно'
                              }
                            </Box>
                            {subscribeLoading && (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: '50%',
                                  left: '50%',
                                  transform: 'translate(-50%, -50%)',
                                  opacity: subscribeLoading ? 1 : 0,
                                  transition: 'opacity 0.3s ease 0.1s',
                                  zIndex: 2,
                                }}
                              >
                                <CircularProgress size={24} color="inherit" />
                              </Box>
                            )}
                          </Button>
                        )}
                      </>
                    )}
                    
                    {isNewCourse && (
                      <Paper
                        elevation={0}
                        sx={{
                          borderRadius: theme.shape.borderRadius,
                          backgroundColor: 'rgba(255, 165, 0, 0.1)',
                          border: '1px solid rgba(255, 165, 0, 0.3)',
                          p: 2,
                          mt: 1,
                        }}
                      >
                        <Typography 
                          variant="body2" 
                          color="orange"
                          fontWeight="medium"
                          sx={{ textAlign: 'center' }}
                        >
                          ⚠️ Курс находится в разработке и пока недоступен для подписки
                        </Typography>
                      </Paper>
                    )}
                  </Stack>
                </Paper>
                
                {/* Блок с информацией о тренере */}
                <Paper
                  elevation={0}
                  onClick={handleCoachClick}
                  sx={{
                    p: 2,
                    mb: 3,
                    borderRadius: theme.borderRadius.small,
                    bgcolor: theme.palette.backgrounds?.paper,
                    boxShadow: theme.customShadows.medium,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: theme.customShadows.strong,
                    },
                  }}
                >
                  <TrainerInfo
                    name={displayData.trainer.name}
                    avatarUrl={displayData.trainer.avatar}
                    rating={displayData.trainer.rating}
                    ratingCount={displayData.trainer.ratingCount}
                    description={displayData.trainer.description}
                    theme={theme}
                    size="large"
                    isLoading={authorLoading || trainerRatingLoading}
                  />
                </Paper>
                
                {/* Раздел с тренировками */}
                <Stack spacing={2}>
                  {/* Заголовок "Тренировки" */}
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box flex={1}>
                      <Divider />
                    </Box>
                    <Typography
                      variant="body2"
                      fontWeight="bold"
                      sx={{ fontSize: "1rem", color: theme.palette.textColors?.primary }}
                    >
                      Тренировки курса
                    </Typography>
                    <Box flex={1}>
                      <Divider />
                    </Box>
                  </Stack>
                  
                  {/* Список тренировок */}
                  <Stack spacing={2}>
                    {/* Загрузка тренировок */}
                    {workoutsLoading && (
                      <Paper
                        elevation={0}
                        sx={{
                          borderRadius: theme.shape.borderRadius,
                          backgroundColor: theme.palette.backgrounds?.paper,
                          p: 3,
                          textAlign: 'center',
                        }}
                      >
                        <Stack spacing={2} alignItems="center">
                          <CircularProgress size={40} />
                          <Typography variant="body1" color={theme.palette.textColors?.secondary}>
                            Загрузка тренировок...
                          </Typography>
                        </Stack>
                      </Paper>
                    )}

                    {/* Ошибка загрузки тренировок */}
                    {!workoutsLoading && workoutsError && (
                      <Paper
                        elevation={0}
                        sx={{
                          borderRadius: theme.shape.borderRadius,
                          backgroundColor: 'rgba(255, 69, 58, 0.1)',
                          border: '1px solid rgba(255, 69, 58, 0.3)',
                          p: 3,
                          textAlign: 'center',
                        }}
                      >
                        <Stack spacing={2} alignItems="center">
                          <LockIcon 
                            sx={{ 
                              fontSize: 50, 
                              color: 'rgba(255, 69, 58, 0.8)' 
                            }} 
                          />
                          <Typography 
                            variant="h6" 
                            fontWeight="medium"
                            color="rgba(255, 69, 58, 0.9)"
                          >
                            Доступ ограничен
                          </Typography>
                          <Typography 
                            variant="body2" 
                            color="rgba(255, 69, 58, 0.7)"
                            sx={{ maxWidth: '500px' }}
                          >
                            {workoutsError}
                          </Typography>
                        </Stack>
                      </Paper>
                    )}

                    {/* Успешно загруженные тренировки */}
                    {!workoutsLoading && !workoutsError && workouts.length > 0 && (
                      <DragDropContext onDragEnd={handleDragEnd}>
                        <Droppable 
                          droppableId="workouts" 
                          isDropDisabled={!isEditingOrder}
                          mode="standard"
                          renderClone={(provided, snapshot, rubric) => (
                            <WorkoutCard
                              workout={workouts[rubric.source.index]}
                              index={rubric.source.index}
                              isOwner={isOwner}
                              isEditingOrder={isEditingOrder}
                              formatDuration={formatDuration}
                              handleDragHandleClick={handleDragHandleClick}
                              provided={provided}
                              snapshot={snapshot}
                              courseId={courseId}
                              onClick={() => handleWorkoutClick(workouts[rubric.source.index])}
                            />
                          )}
                        >
                          {(provided) => (
                            <Stack 
                              spacing={1.5}
                              {...provided.droppableProps}
                              ref={provided.innerRef}
                            >
                              {workouts.map((workout, index) => (
                                <WorkoutCard
                                  key={workout.course_workout_uuid}
                                  workout={workout}
                                  index={index}
                                  isOwner={isOwner}
                                  isEditingOrder={isEditingOrder}
                                  formatDuration={formatDuration}
                                  handleDragHandleClick={handleDragHandleClick}
                                  courseId={courseId}
                                  onClick={() => handleWorkoutClick(workout)}
                                />
                              ))}
                              {provided.placeholder}
                            </Stack>
                          )}
                        </Droppable>
                      </DragDropContext>
                    )}

                    {/* Пустой список тренировок */}
                    {!workoutsLoading && !workoutsError && workouts.length === 0 && (
                    <Paper
                      elevation={0}
                      sx={{
                        borderRadius: theme.shape.borderRadius,
                        backgroundColor: theme.palette.backgrounds?.paper,
                        p: 4,
                        textAlign: 'center',
                        border: `2px dashed ${theme.palette.highlight?.main}40`,
                      }}
                    >
                      <Stack spacing={2} alignItems="center">
                        <FitnessCenterIcon 
                          sx={{ 
                            fontSize: 60, 
                            color: theme.palette.textColors?.secondary,
                            opacity: 0.5 
                          }} 
                        />
                        <Typography 
                          variant="h6" 
                          fontWeight="medium"
                          color={theme.palette.textColors?.secondary}
                        >
                            Курс пока не содержит тренировок
                        </Typography>
                        <Typography 
                          variant="body2" 
                          color={theme.palette.textColors?.secondary}
                          sx={{ opacity: 0.7 }}
                        >
                            Тренировки будут добавлены автором курса
                          </Typography>
                          {isOwner && (
                            <>
                              <Button
                                variant="outlined"
                                onClick={handleCreateWorkout}
                                sx={{
                                  mt: 2,
                                  borderColor: theme.palette.highlight?.main,
                                  color: theme.palette.highlight?.main,
                                  '&:hover': {
                                    backgroundColor: `${theme.palette.highlight?.main}20`,
                                    borderColor: theme.palette.highlight?.accent,
                                  }
                                }}
                              >
                                Создать первую тренировку
                              </Button>
                              <Typography 
                                variant="caption" 
                                color={theme.palette.textColors?.secondary}
                                sx={{ opacity: 0.5, mt: 1 }}
                              >
                                💡 После создания нескольких тренировок вы сможете изменять их порядок перетаскиванием за точки справа
                          </Typography>
                            </>
                          )}
                      </Stack>
                    </Paper>
                    )}
                  </Stack>
                </Stack>
              </>
            )}
          </Stack>
        </MainLayout>
      )}
    </>
  );
} 