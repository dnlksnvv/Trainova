"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "@mui/material/styles";
import { 
  Stack, 
  Box, 
  Divider, 
  Typography,
  useMediaQuery,
  Button
} from "@mui/material";
import { useRouter, useParams } from "next/navigation";
import EditIcon from '@mui/icons-material/Edit';

import MainLayout from "@/app/components/layouts/MainLayout";
import PurchasedCourseCard, {
  PurchasedCourseData,
} from "@/app/courses/components/PurchasedCourseCard";
import SearchBar from "@/app/components/shared/SearchBar";
import ProfileCard from "@/app/components/shared/ProfileCard";
import { profileApi, PublicProfileResponse, coursesApi, CourseCreate, CourseResponse, CourseFilterRequest } from "@/app/services/api";
import { useAvatar } from "@/app/hooks/useAvatar";
import { useAuth } from "@/app/auth/hooks/useAuth";
import MuscleUsageChart, { MuscleUsageItem } from '../../components/MuscleUsageChart';

// Добавляем определение типа для muscle_groups в API-ответе курса
interface MuscleGroup {
  id: number;
  name: string;
  description?: string;
  percentage: number;
}

// Расширяем тип CourseResponse для использования внутри компонента
interface ExtendedCourseResponse extends CourseResponse {
  muscle_groups?: MuscleGroup[];
}

export default function CoachProfilePage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;
  const { user, loading: authLoading } = useAuth(); // Получаем данные текущего пользователя и состояние загрузки
  
  // Состояния для профиля
  const [profileUser, setProfileUser] = useState<PublicProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Состояние для управления курсами
  const [courses, setCourses] = useState<PurchasedCourseData[]>([]);

  // Состояния для управления панелью поиска при скролле
  const [isSearchBarVisible, setIsSearchBarVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isAtTop, setIsAtTop] = useState(true);

  const { avatarUrl, loading: avatarLoading } = useAvatar(profileUser?.avatar_url);
  
  // Проверяем, является ли текущий пользователь владельцем профиля
  const isOwner = React.useMemo(() => {
    // Если данные авторизации еще загружаются, пользователь не владелец
    if (authLoading) {
      return false;
    }
    
    // Если пользователь не авторизован, он не владелец
    if (!user) {
      return false;
    }
    
    // Если нет profileId, он не владелец
    if (!profileId) {
      return false;
    }
    
    // Сравниваем ID пользователя с ID профиля (оба приводим к строке)
    const userIdStr = String(user.user_id);
    const profileIdStr = String(profileId);
    
    return userIdStr === profileIdStr;
  }, [user, profileId, authLoading]);
  
  // Загрузка данных профиля
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        
        // Загружаем только профиль по ID
        const profileData = await profileApi.getUserProfile(profileId);
        setProfileUser(profileData);
        
      } catch (error) {
        console.error('Ошибка при загрузке профиля:', error);
      } finally {
        setLoading(false);
      }
    };

    if (profileId) {
      loadProfile();
    }
  }, [profileId]);

  // Инициализация курсов при загрузке компонента
  useEffect(() => {
    const loadUserCourses = async () => {
      if (!profileId) return;

      try {
        // Создаем фильтр для получения курсов конкретного пользователя
        const filterRequest: CourseFilterRequest = {
          filters: {
            user_ids: [parseInt(profileId)],
            include_unpublished: isOwner || (user?.role_id === 1) // Для владельца и админов показываем все курсы, для остальных только опубликованные
          }
        };
        
        // Загружаем курсы пользователя из API с новой фильтрацией
        const userCoursesResponse = await coursesApi.getCoursesWithFilters(filterRequest);

        // Приводим к расширенному типу, который включает muscle_groups
        const userCourses = userCoursesResponse as unknown as ExtendedCourseResponse[];

        // Преобразуем курсы из API в формат для отображения
        const displayName = getDisplayName();
        const coursesForDisplay: PurchasedCourseData[] = userCourses.map((course) => {
          // Преобразуем данные о нагруженности групп мышц из API в формат для MuscleUsageChart
          const muscleGroups = course.muscle_groups || [];
          const muscleUsage: MuscleUsageItem[] = muscleGroups.map((group: MuscleGroup) => ({
            name: group.name,
            color: getMuscleGroupColor(group.id, theme), // Функция для получения цвета группы мышц
            percent: Number(group.percentage)
          }));

          // Безопасное преобразование рейтинга
          const safeRating = (() => {
            if (typeof course.rating === 'number') {
              return course.rating;
            }
            if (typeof course.rating === 'string') {
              const parsed = parseFloat(course.rating);
              return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
          })();

          return {
            id: course.course_uuid,
            title: course.name,
            description: course.description || "",
            duration: formatDuration(course.duration),
            muscleUsage: muscleUsage, // Используем преобразованные данные
            completedLessons: 0, // Реальные данные должны приходить с API
            totalLessons: course.exercise_count,
            trainerName: displayName,
            trainerAvatarUrl: avatarUrl || undefined,
            trainerId: profileId,
            courseRating: safeRating,
            price: course.price || 0,
            subscribersCount: course.subscribers_count,
            subscriptionUntil: "",
            lastWorkout: "",
            trainerRating: 0,
            isNew: false,
            is_published: course.is_published
          };
        });

        setCourses(coursesForDisplay);

      } catch (error) {
        console.error('Ошибка при загрузке курсов:', error);
        setCourses([]); // Пустой массив вместо fallback-данных
      }
    };

    if (profileId && profileUser) {
      loadUserCourses();
    }
  }, [profileId, profileUser, theme.palette.muscleColors, avatarUrl, isOwner, user]);
  
  // Добавляем состояние для хранения рейтинга тренера
  const [trainerRating, setTrainerRating] = useState<number>(0);
  const [trainerRatingCount, setTrainerRatingCount] = useState<number>(0);
  const [subscribersCount, setSubscribersCount] = useState<number>(0);

  // Загрузка рейтинга тренера
  useEffect(() => {
    const loadTrainerRating = async () => {
      if (!profileId) return;
      
      try {
        console.log(`Загрузка рейтинга для тренера с ID: ${profileId}`);
        const ratingData = await profileApi.getUserRating(profileId);
        console.log(`Получен рейтинг тренера:`, ratingData);
        
        setTrainerRating(ratingData.rating || 0);
        setTrainerRatingCount(ratingData.rating_count || 0);
        setSubscribersCount(ratingData.subscribers_count || 0);
      } catch (error) {
        console.error('Ошибка при загрузке рейтинга тренера:', error);
        setTrainerRating(0);
        setTrainerRatingCount(0);
        setSubscribersCount(0);
      }
    };
    
    loadTrainerRating();
  }, [profileId]);

  // Обработчик скролла
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Определяем, находимся ли мы вверху страницы
      const atTop = currentScrollY < 10;
      setIsAtTop(atTop);
      
      // Определяем направление скролла (вверх или вниз)
      const direction = currentScrollY < lastScrollY ? 'up' : 'down';
      
      // Мгновенно показываем панель при скролле вверх или на верхней части страницы
      if (direction === 'up' || atTop) {
        setIsSearchBarVisible(true);
      } 
      // Быстро скрываем панель при скролле вниз
      else if (direction === 'down' && !atTop) {
        setIsSearchBarVisible(false);
      }
      
      // Сохраняем текущую позицию для следующего расчета
      setLastScrollY(currentScrollY);
    };
    
    // Используем { passive: true } для лучшей производительности
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [lastScrollY]);

  // Функция для возврата назад
  const handleGoBack = () => {
    // Всегда перенаправляем на страницу курсов
    router.push('/courses');
  };

  // Функция для создания нового курса (только для владельца)
  const handleCreateCourse = () => {
    if (!isOwner) return;
    
    // Перенаправляем на страницу создания курса, передавая ID тренера
    router.push(`/courses/create?coachId=${profileId}`);
  };

  // Функция для перехода к странице курса
  const handleCourseClick = (courseId: string | number) => {
    router.push(`/courses/${courseId}`);
  };

  // Функция для редактирования профиля (только для владельца)
  const handleEditProfile = () => {
    if (!isOwner) return;
    router.push('/profile');
  };

  // Генерируем отображаемое имя
  const getDisplayName = () => {
    if (!profileUser) return "Пользователь";
    
    if (profileUser.first_name && profileUser.last_name) {
      return `${profileUser.first_name} ${profileUser.last_name}`;
    } else if (profileUser.first_name) {
      return profileUser.first_name;
    } else {
      return "Пользователь";
    }
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

  // Функция для получения цвета группы мышц по её ID
  function getMuscleGroupColor(muscleGroupId: number, theme: any): string {
    // Массив цветов для групп мышц
    const colors = [
      theme.palette.muscleColors?.blue || '#64b5f6', // Синий
      theme.palette.muscleColors?.green || '#81c784', // Зеленый
      theme.palette.muscleColors?.pink || '#FF8080', // Розовый
      theme.palette.muscleColors?.purple || '#9575cd', // Фиолетовый
      theme.palette.muscleColors?.orange || '#ffb74d', // Оранжевый
      theme.palette.muscleColors?.red || '#e57373', // Красный
      theme.palette.muscleColors?.yellow || '#fff176', // Желтый
      theme.palette.muscleColors?.teal || '#4db6ac', // Бирюзовый
    ];
    
    // Используем ID группы мышц как индекс в массиве цветов (с циклическим повторением)
    return colors[(muscleGroupId - 1) % colors.length];
  }

  if (loading) {
    return (
      <MainLayout>
        <Box sx={{ pt: 8, px: 2 }}>
          <Typography>Загрузка...</Typography>
        </Box>
      </MainLayout>
    );
  }

  return (
    <>
      {/* Используем компонент SearchBar с кнопкой назад */}
      <SearchBar 
        isSearchBarVisible={isSearchBarVisible} 
        isAtTop={isAtTop} 
        onBackClick={handleGoBack}
        onCreateClick={isOwner ? handleCreateCourse : undefined}
        showBackButton={true}
        showProfileButton={false}
        showCreateButton={!!isOwner}
        placeholder="Поиск курсов тренера"
      />
      
      <MainLayout>
        <Stack spacing={2.5} sx={{ pb: 3, px: 1, pt: 7 }}> 
          {/* Профиль тренера */}
          <ProfileCard
            profile={{
              name: getDisplayName(),
              description: profileUser?.description || undefined,
              rating: trainerRating,
              subscribersCount: subscribersCount,
              experience: 0
            }}
            avatarUrl={avatarUrl}
            loading={loading}
            avatarLoading={avatarLoading}
            onEditClick={isOwner ? handleEditProfile : undefined}
            onAvatarClick={isOwner ? handleEditProfile : undefined}
          />

          {/* Заголовок "Курсы" */}
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box flex={1}>
              <Divider />
            </Box>
            <Typography
              variant="body2"
              fontWeight="bold"
              sx={{ fontSize: "1rem", color: theme.palette.textColors?.primary }}
            >
              Курсы
            </Typography>
            <Box flex={1}>
              <Divider />
            </Box>
          </Stack>

          {/* Список курсов тренера */}
          <Stack spacing={1.5}>
            {courses.length > 0 ? (
              courses.map((course, idx) => (
                <PurchasedCourseCard 
                  key={course.id || idx} 
                  course={course} 
                  isSubscription={false}
                  onClick={() => course.id && handleCourseClick(course.id)}
                />
              ))
            ) : (
              <Box 
                sx={{ 
                  textAlign: 'center', 
                  py: 4,
                  px: 2,
                  backgroundColor: theme.palette.background?.paper || '#f5f5f5',
                  borderRadius: 2,
                  border: `1px solid ${theme.palette.divider || '#e0e0e0'}`
                }}
              >
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: theme.palette.textColors?.secondary || '#666',
                    mb: 1,
                    fontWeight: 500
                  }}
                >
                  {isOwner ? 'У вас пока нет курсов' : 'У этого тренера пока нет курсов'}
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: theme.palette.textColors?.secondary || '#999',
                    mb: isOwner ? 2 : 0
                  }}
                >
                  {isOwner 
                    ? 'Создайте свой первый курс, нажав на кнопку "+" в верхней части экрана'
                    : 'Проверьте позже, возможно появятся новые курсы'
                  }
                </Typography>
                {isOwner && (
                  <Button
                    variant="contained"
                    onClick={handleCreateCourse}
                    sx={{
                      mt: 1,
                      backgroundColor: theme.palette.primary?.main || '#1976d2',
                      '&:hover': {
                        backgroundColor: theme.palette.primary?.dark || '#1565c0'
                      }
                    }}
                  >
                    Создать первый курс
                  </Button>
                )}
              </Box>
            )}
          </Stack>
        </Stack>
      </MainLayout>
    </>
  );
} 