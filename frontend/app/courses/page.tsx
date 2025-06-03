"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "@mui/material/styles";
import { 
  Stack, 
  Box, 
  Divider, 
  Typography, 
  InputBase, 
  Button, 
  IconButton,
  Paper,
  CircularProgress
} from "@mui/material";
import { useRouter } from "next/navigation";
import SearchIcon from "@mui/icons-material/Search";
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import FilterListIcon from '@mui/icons-material/FilterList';
import PersonIcon from '@mui/icons-material/Person';

import MainLayout from "@/app/components/layouts/MainLayout";
import PurchasedCourseCard, {
  PurchasedCourseData,
} from "@/app/courses/components/PurchasedCourseCard";
import SearchBar from "@/app/components/shared/SearchBar";
import { useAuth } from "@/app/auth/hooks/useAuth";
import { coursesApi, CourseResponse, CourseFilterRequest, profileApi, muscleGroupsApi } from "@/app/services/api";
import { useAvatar } from "@/app/hooks/useAvatar";
import CourseFilters, { FilterOptions } from "./components/CourseFilters";

export default function CoursesPage() {
  const theme = useTheme();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  // Состояния для курсов
  const [subscriptionCourses, setSubscriptionCourses] = useState<PurchasedCourseData[]>([]);
  const [otherCourses, setOtherCourses] = useState<PurchasedCourseData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Состояние для поиска
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredSubscriptionCourses, setFilteredSubscriptionCourses] = useState<PurchasedCourseData[]>([]);
  const [filteredOtherCourses, setFilteredOtherCourses] = useState<PurchasedCourseData[]>([]);
  
  // Состояния для управления панелью поиска при скролле
  const [isSearchBarVisible, setIsSearchBarVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);
  const [scrollSpeed, setScrollSpeed] = useState(0);
  const [isAtTop, setIsAtTop] = useState(true);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollTimeRef = useRef(Date.now());
  const lastScrollPositionRef = useRef(0);
  
  // Состояния для фильтров
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterOptions>({
    durationRange: [0, 7200], // 0 сек - 2 часа
    selectedMuscleGroups: [],
    sortOrder: 'desc', // По умолчанию сначала длинные
    showHidden: false // По умолчанию не показывать скрытые курсы
  });
  
  // Состояние для хранения списка всех групп мышц
  const [muscleGroups, setMuscleGroups] = useState<{id: number, name: string}[]>([]);
  
  // Функция загрузки курсов
  const loadCourses = useCallback(async () => {
    if (authLoading) return;
    
    try {
      setLoading(true);
      
      // Определяем значение include_unpublished на основе activeFilters.showHidden
      const includeUnpublished = activeFilters.showHidden;
      
      // Запрос для курсов с активной подпиской
      const subscriptionsRequest: CourseFilterRequest = {
        filters: {
          current_subscribe: true,
          include_unpublished: includeUnpublished
        }
      };
      
      // Запрос для всех остальных курсов
      const otherCoursesRequest: CourseFilterRequest = {
        filters: {
          current_subscribe: false,
          include_unpublished: includeUnpublished
        }
      };
      
      // Получаем сначала курсы с подпиской
      const subscriptionCoursesData = await coursesApi.getCoursesWithFilters(subscriptionsRequest);
      console.log(`Получено ${subscriptionCoursesData.length} курсов с подпиской`);
      
      // Затем получаем остальные курсы
      const otherCoursesData = await coursesApi.getCoursesWithFilters(otherCoursesRequest);
      console.log(`Получено ${otherCoursesData.length} курсов без подписки`);
      
      // Собираем все уникальные ID тренеров
      const allCourses = [...subscriptionCoursesData, ...otherCoursesData];
      const trainerIds = [...new Set(allCourses.map(course => course.user_id))];
      
      // Загружаем информацию о тренерах и их аватарках
      const trainerProfiles: Record<number, { name: string, avatarUrl: string | null, id: number }> = {};
      
      for (const trainerId of trainerIds) {
        try {
          const profile = await profileApi.getUserProfile(trainerId.toString());
          
          // Формируем имя тренера
          let trainerName = 'Тренер';
          if (profile.first_name && profile.last_name) {
            trainerName = `${profile.first_name} ${profile.last_name}`;
          } else if (profile.first_name) {
            trainerName = profile.first_name;
          }
          
          // Загружаем аватарку, если она есть
          let avatarUrl = null;
          if (profile.avatar_url) {
            try {
              avatarUrl = await profileApi.getAvatar(profile.avatar_url);
            } catch (err) {
              console.error(`Ошибка при загрузке аватарки для тренера ${trainerId}:`, err);
            }
          }
          
          trainerProfiles[trainerId] = {
            name: trainerName,
            avatarUrl,
            id: parseInt(profile.user_id)
          };
        } catch (err) {
          console.error(`Ошибка при загрузке профиля тренера ${trainerId}:`, err);
          
          // Создаем запасной профиль
          trainerProfiles[trainerId] = {
            name: 'Тренер',
            avatarUrl: null,
            id: trainerId
          };
        }
      }
      
      // Преобразуем курсы с подписками в формат для отображения
      const subscriptionsForDisplay = subscriptionCoursesData.map(course => {
        const trainer = trainerProfiles[course.user_id] || { name: 'Тренер', avatarUrl: null, id: course.user_id };
        
        // Форматируем дату окончания подписки
        let subscriptionUntil = "";
        if (course.subscription_end_date) {
          const date = new Date(course.subscription_end_date);
          subscriptionUntil = date.toLocaleDateString('ru-RU');
        }
        
        // Преобразуем данные о группах мышц в формат для MuscleUsageChart
        const muscleUsageData = course.muscle_groups && course.muscle_groups.length > 0
          ? course.muscle_groups.map(group => {
              // Генерируем цвет для группы мышц
              const colors = [
                theme.palette.highlight?.main || '#64b5f6', // blue
                '#4CAF50', // green
                '#9C27B0', // purple
                '#F44336', // red
                '#FF9800', // orange
                '#2196F3'  // light blue
              ];
              
              // Используем ID группы мышц для определения цвета
              const colorIndex = (group.id - 1) % colors.length;
              const color = colors[colorIndex >= 0 ? colorIndex : 0];
              
              return {
                name: group.name,
                color: color,
                percent: Number(group.percentage) || 0
              };
            })
          : [];
        
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
          muscleUsage: muscleUsageData,
          completedLessons: 0,
          totalLessons: course.exercise_count,
          trainerName: trainer.name,
          trainerAvatarUrl: trainer.avatarUrl || undefined,
          trainerId: trainer.id,
          trainerRating: 0,
          courseRating: safeRating,
          price: course.price || 0,
          subscribersCount: course.subscribers_count,
          subscriptionUntil: subscriptionUntil,
          lastWorkout: "",
          is_published: course.is_published
        } as PurchasedCourseData;
      });
      
      // Преобразуем остальные курсы в формат для отображения
      const otherCoursesForDisplay = otherCoursesData.map(course => {
        const trainer = trainerProfiles[course.user_id] || { name: 'Тренер', avatarUrl: null, id: course.user_id };
        
        // Преобразуем данные о группах мышц в формат для MuscleUsageChart
        const muscleUsageData = course.muscle_groups && course.muscle_groups.length > 0
          ? course.muscle_groups.map(group => {
              // Генерируем цвет для группы мышц
              const colors = [
                theme.palette.highlight?.main || '#64b5f6', // blue
                '#4CAF50', // green
                '#9C27B0', // purple
                '#F44336', // red
                '#FF9800', // orange
                '#2196F3'  // light blue
              ];
              
              // Используем ID группы мышц для определения цвета
              const colorIndex = (group.id - 1) % colors.length;
              const color = colors[colorIndex >= 0 ? colorIndex : 0];
              
              return {
                name: group.name,
                color: color,
                percent: Number(group.percentage) || 0
              };
            })
          : [];
        
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
          muscleUsage: muscleUsageData,
          completedLessons: 0,
          totalLessons: course.exercise_count,
          trainerName: trainer.name,
          trainerAvatarUrl: trainer.avatarUrl || undefined,
          trainerId: trainer.id,
          trainerRating: 0,
          courseRating: safeRating,
          price: course.price || 0,
          subscribersCount: course.subscribers_count,
          subscriptionUntil: "",
          lastWorkout: "",
          is_published: course.is_published
        } as PurchasedCourseData;
      });
      
      // Обновляем состояние
      setSubscriptionCourses(subscriptionsForDisplay);
      setOtherCourses(otherCoursesForDisplay);
      
    } catch (error) {
      console.error('Ошибка при загрузке курсов:', error);
    } finally {
      setLoading(false);
    }
  }, [authLoading, activeFilters.showHidden, theme.palette.highlight?.main]);
  
  // Загрузка курсов при инициализации
  useEffect(() => {
    loadCourses();
  }, [loadCourses]);
  
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
  
  // Обработчик скролла
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const currentTime = Date.now();
      const timeDiff = Math.max(1, currentTime - lastScrollTimeRef.current);
      
      // Определяем направление скролла
      const direction = currentScrollY < lastScrollY ? 'up' : 'down';
      
      // Рассчитываем скорость скролла (пикселей в миллисекунду)
      const distance = Math.abs(currentScrollY - lastScrollPositionRef.current);
      const speed = distance / timeDiff;
      
      // Определяем, находимся ли мы вверху страницы
      const atTop = currentScrollY < 10;
      setIsAtTop(atTop);
      
      // Определяем видимость панели поиска
      if (atTop) {
        // Если мы вверху страницы, панель всегда видима
        setIsSearchBarVisible(true);
      } else if (direction === 'down' && distance > 30) {
        // Если быстро скроллим вниз и прошли значительное расстояние, скрываем панель
        setIsSearchBarVisible(false);
      } else if (direction === 'up') {
        // Если скроллим вверх, облегчаем условие появления панели
        // Практически любое движение вверх показывает панель
        setIsSearchBarVisible(true);
      }
      
      // Обновляем все состояния
      setLastScrollY(currentScrollY);
      setScrollDirection(direction as 'up' | 'down');
      setScrollSpeed(speed);
      
      // Обновляем рефы для следующего расчета
      lastScrollTimeRef.current = currentTime;
      lastScrollPositionRef.current = currentScrollY;
      
      // Сбрасываем timeout, если уже установлен
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Устанавливаем timeout для определения остановки скролла
      scrollTimeoutRef.current = setTimeout(() => {
        setScrollSpeed(0);
      }, 100);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [lastScrollY]); // Отслеживаем lastScrollY для более точного отслеживания изменений
  
  // Обработчик перехода в профиль
  const handleGoToProfile = () => {
    router.push('/profile');
  };

  // Обработчик перехода к курсу
  const handleCourseClick = (courseId: string | number) => {
    router.push(`/courses/${courseId}`);
  };

  // Обработчик кнопки назад
  const handleGoBack = () => {
    router.back();
  };

  // Создаем debounce функцию для отложенного поиска
  const debounce = (func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func(...args);
      }, delay);
    };
  };
  
  // Функция для фильтрации курсов на основе поискового запроса и фильтров
  const filterCourses = useCallback((query: string, filters: FilterOptions) => {
    console.log('Вызов filterCourses:', { query, filters });
    
    // Всегда сбрасываем фильтры к исходным курсам при пустом запросе и дефолтных фильтрах
    if (!query.trim() && 
        filters.durationRange[0] === 0 && 
        filters.durationRange[1] === 7200 && 
        filters.selectedMuscleGroups.length === 0) {
      console.log('Отображаем все курсы - нет активных фильтров');
      setFilteredSubscriptionCourses(subscriptionCourses);
      setFilteredOtherCourses(otherCourses);
      return;
    }
    
    // Начинаем с полного списка курсов
    let filteredSubs = [...subscriptionCourses];
    let filteredOthers = [...otherCourses];
    
    console.log('Исходное количество курсов:', 
                { subs: filteredSubs.length, others: filteredOthers.length });
    
    // Фильтрация по поисковому запросу
    if (query.trim()) {
      const normalizedQuery = query.toLowerCase().trim();
      
      filteredSubs = filteredSubs.filter(course => 
        course.title.toLowerCase().includes(normalizedQuery) || 
        course.description.toLowerCase().includes(normalizedQuery)
      );
      
      filteredOthers = filteredOthers.filter(course => 
        course.title.toLowerCase().includes(normalizedQuery) || 
        course.description.toLowerCase().includes(normalizedQuery)
      );
      
      console.log('После фильтрации по тексту:', 
                  { subs: filteredSubs.length, others: filteredOthers.length });
    }
    
    // Фильтрация по длительности
    if (filters.durationRange[0] > 0 || filters.durationRange[1] < 7200) {
      const formatDurationToSeconds = (duration: string): number => {
        // Пытаемся извлечь числа из строки формата "X ч Y мин Z сек"
        let totalSeconds = 0;
        
        const hoursMatch = duration.match(/(\d+)\s*ч/);
        if (hoursMatch) {
          totalSeconds += parseInt(hoursMatch[1]) * 3600;
        }
        
        const minutesMatch = duration.match(/(\d+)\s*мин/);
        if (minutesMatch) {
          totalSeconds += parseInt(minutesMatch[1]) * 60;
        }
        
        const secondsMatch = duration.match(/(\d+)\s*сек/);
        if (secondsMatch) {
          totalSeconds += parseInt(secondsMatch[1]);
        }
        
        return totalSeconds;
      };
      
      filteredSubs = filteredSubs.filter(course => {
        const durationInSeconds = formatDurationToSeconds(course.duration);
        return durationInSeconds >= filters.durationRange[0] && durationInSeconds <= filters.durationRange[1];
      });
      
      filteredOthers = filteredOthers.filter(course => {
        const durationInSeconds = formatDurationToSeconds(course.duration);
        return durationInSeconds >= filters.durationRange[0] && durationInSeconds <= filters.durationRange[1];
      });
    }
    
    // Фильтрация по группам мышц
    if (filters.selectedMuscleGroups.length > 0) {
      filteredSubs = filteredSubs.filter(course => {
        // Проверяем, что хотя бы одна группа мышц курса входит в выбранные
        return course.muscleUsage.some(muscleGroup => {
          // Находим ID группы мышц по названию, предполагая что в muscleUsage есть только name
          const matchingGroupId = filters.selectedMuscleGroups.find(id => 
            muscleGroup.name.toLowerCase().includes(
              // Найдем имя по ID в выбранных группах
              muscleGroups.find(group => group.id === id)?.name.toLowerCase() || ''
            )
          );
          return matchingGroupId !== undefined;
        });
      });
      
      filteredOthers = filteredOthers.filter(course => {
        return course.muscleUsage.some(muscleGroup => {
          const matchingGroupId = filters.selectedMuscleGroups.find(id => 
            muscleGroup.name.toLowerCase().includes(
              muscleGroups.find(group => group.id === id)?.name.toLowerCase() || ''
            )
          );
          return matchingGroupId !== undefined;
        });
      });
    }
    
    // Сортировка по длительности
    const sortByDuration = (a: PurchasedCourseData, b: PurchasedCourseData): number => {
      const formatDurationToSeconds = (duration: string): number => {
        let totalSeconds = 0;
        
        const hoursMatch = duration.match(/(\d+)\s*ч/);
        if (hoursMatch) {
          totalSeconds += parseInt(hoursMatch[1]) * 3600;
        }
        
        const minutesMatch = duration.match(/(\d+)\s*мин/);
        if (minutesMatch) {
          totalSeconds += parseInt(minutesMatch[1]) * 60;
        }
        
        const secondsMatch = duration.match(/(\d+)\s*сек/);
        if (secondsMatch) {
          totalSeconds += parseInt(secondsMatch[1]);
        }
        
        return totalSeconds;
      };
      
      const durationA = formatDurationToSeconds(a.duration);
      const durationB = formatDurationToSeconds(b.duration);
      
      // Сортировка в зависимости от выбранного порядка
      return filters.sortOrder === 'asc' 
        ? durationA - durationB // От короткого к длинному
        : durationB - durationA; // От длинного к короткому
    };
    
    // Применяем сортировку
    filteredSubs.sort(sortByDuration);
    filteredOthers.sort(sortByDuration);
    
    // Обновляем состояние отфильтрованных курсов
    setFilteredSubscriptionCourses(filteredSubs);
    setFilteredOtherCourses(filteredOthers);
  }, [subscriptionCourses, otherCourses]);
  
  // Загрузка списка групп мышц
  useEffect(() => {
    const loadMuscleGroups = async () => {
      try {
        const groups = await muscleGroupsApi.getAll();
        setMuscleGroups(groups);
      } catch (error) {
        console.error('Ошибка при загрузке групп мышц:', error);
      }
    };
    
    loadMuscleGroups();
  }, []);
  
  // Обработчик изменения поискового запроса
  const handleSearchChange = (value: string) => {
    console.log('handleSearchChange вызван с value:', value);
    
    // Если пустая строка, то немедленно сбрасываем на все курсы
    if (!value.trim()) {
      setSearchQuery('');
      
      // При пустом поиске сразу показываем все курсы
      const defaultFilterState = {
        durationRange: [0, 7200] as [number, number],
        selectedMuscleGroups: [],
        sortOrder: activeFilters.sortOrder, // Сохраняем текущую сортировку
        showHidden: false // По умолчанию не показывать скрытые курсы
      };
      
      // Если другие фильтры не применены, сразу сбрасываем к исходному состоянию
      if (activeFilters.selectedMuscleGroups.length === 0 && 
          activeFilters.durationRange[0] === 0 && 
          activeFilters.durationRange[1] === 7200) {
        
        console.log('Сброс поиска на все курсы (быстрый путь)');
        setFilteredSubscriptionCourses(subscriptionCourses);
        setFilteredOtherCourses(otherCourses);
      } else {
        // Если есть другие активные фильтры, применяем их без поискового запроса
        console.log('Сброс поиска с сохранением других фильтров');
        filterCourses('', activeFilters);
      }
    } else {
      // Для непустого поиска используем debounce
      setSearchQuery(value);
      debouncedFilterCourses(value, activeFilters);
    }
  };
  
  // Обработчик сброса поиска
  const handleResetSearch = () => {
    setSearchQuery('');
    filterCourses('', activeFilters);
  };
  
  // Обработчик сброса всех фильтров и поиска
  const handleResetAll = () => {
    const defaultFilters: FilterOptions = {
      durationRange: [0, 7200] as [number, number], 
      selectedMuscleGroups: [],
      sortOrder: 'desc',
      showHidden: false
    };
    
    setSearchQuery('');
    setActiveFilters(defaultFilters);
    filterCourses('', defaultFilters);
  };
  
  // Обработчик применения фильтров
  const handleApplyFilters = (filters: FilterOptions) => {
    setActiveFilters(filters);
    filterCourses(searchQuery, filters);
  };
  
  // Создаем debounced версию функции фильтрации
  const debouncedFilterCourses = useRef(
    debounce((query: string, filters: FilterOptions) => filterCourses(query, filters), 300)
  ).current;
  
  // Инициализация отфильтрованных курсов при загрузке всех курсов
  useEffect(() => {
    console.log('useEffect: изменились списки курсов или фильтры', {
      subsCount: subscriptionCourses.length,
      othersCount: otherCourses.length,
      hasSearch: Boolean(searchQuery),
      hasActiveFilters: activeFilters.selectedMuscleGroups.length > 0 || 
                        activeFilters.durationRange[0] > 0 || 
                        activeFilters.durationRange[1] < 7200
    });
    
    // Если курсы загрузились и нет активных фильтров, просто устанавливаем полные списки
    if ((subscriptionCourses.length > 0 || otherCourses.length > 0) &&
        !searchQuery && 
        activeFilters.selectedMuscleGroups.length === 0 && 
        activeFilters.durationRange[0] === 0 && 
        activeFilters.durationRange[1] === 7200) {
      
      console.log('Инициализация с полными списками курсов');
      setFilteredSubscriptionCourses(subscriptionCourses);
      setFilteredOtherCourses(otherCourses);
    } 
    // Если есть активные фильтры, применяем их
    else if (subscriptionCourses.length > 0 || otherCourses.length > 0) {
      console.log('Применяем фильтры к новым спискам курсов');
      filterCourses(searchQuery, activeFilters);
    }
  }, [subscriptionCourses, otherCourses, searchQuery, activeFilters, filterCourses]);
  
  // Обработчик кнопки открытия фильтров
  const handleFilterButtonClick = () => {
    setIsFiltersOpen(true);
  };

  return (
    <>
      {/* Используем компонент SearchBar */}
      <SearchBar 
        isSearchBarVisible={isSearchBarVisible} 
        isAtTop={isAtTop} 
        showBackButton={false}
        showProfileButton={true}
        onSearchChange={handleSearchChange}
        searchValue={searchQuery}
        placeholder="Поиск по названию и описанию"
        onFilterClick={handleFilterButtonClick}
      />
      
      {/* Компонент фильтров */}
      <CourseFilters 
        isOpen={isFiltersOpen} 
        onClose={() => setIsFiltersOpen(false)} 
        onApplyFilters={handleApplyFilters}
        initialFilters={activeFilters}
      />
      
      <MainLayout>
        <Stack spacing={2.5} sx={{ pb: 3, px: 1, pt: 7 }}> 
          {loading ? (
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
                  Загрузка курсов...
                </Typography>
              </Stack>
            </Paper>
          ) : (
            <>
              {/* Индикатор активного поиска или фильтров */}
              {(searchQuery || activeFilters.selectedMuscleGroups.length > 0 || activeFilters.durationRange[0] > 0 || activeFilters.durationRange[1] < 7200 || activeFilters.showHidden) ? (
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: theme.shape.borderRadius,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    p: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <Box>
                    <Typography variant="body2" color={theme.palette.textColors?.secondary}>
                      {searchQuery && `Поиск: "${searchQuery}"`} 
                      {searchQuery && (activeFilters.selectedMuscleGroups.length > 0 || activeFilters.durationRange[0] > 0 || activeFilters.durationRange[1] < 7200 || activeFilters.showHidden) && ' | '}
                      {activeFilters.selectedMuscleGroups.length > 0 && `Группы мышц: ${activeFilters.selectedMuscleGroups.length}`}
                      {activeFilters.selectedMuscleGroups.length > 0 && (activeFilters.durationRange[0] > 0 || activeFilters.durationRange[1] < 7200 || activeFilters.showHidden) && ' | '}
                      {(activeFilters.durationRange[0] > 0 || activeFilters.durationRange[1] < 7200) && 'Длительность: фильтр'}
                      {(activeFilters.durationRange[0] > 0 || activeFilters.durationRange[1] < 7200) && activeFilters.showHidden && ' | '}
                      {activeFilters.showHidden && 'Скрытые курсы'}
                    </Typography>
                    <Typography variant="caption" color={theme.palette.textColors?.secondary} sx={{ opacity: 0.7 }}>
                      Найдено: <strong>{filteredSubscriptionCourses.length + filteredOtherCourses.length}</strong> из {subscriptionCourses.length + otherCourses.length} курсов
                    </Typography>
                  </Box>
                  <Button 
                    size="small" 
                    variant="text"
                    onClick={handleResetAll}
                    sx={{ 
                      color: theme.palette.highlight?.main || '#FF8C00',
                      fontSize: '0.75rem',
                      ml: 1,
                    }}
                  >
                    Сбросить
                  </Button>
                </Paper>
              ) : (
                subscriptionCourses.length + otherCourses.length > 0 && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color={theme.palette.textColors?.secondary}>
                      Всего доступно: <strong>{subscriptionCourses.length + otherCourses.length}</strong> курсов
                    </Typography>
                  </Box>
                )
              )}
              
              {/* Заголовок "Подписки" */}
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box flex={1}>
                  <Divider />
                </Box>
                <Typography
                  variant="body2"
                  fontWeight="bold"
                  sx={{ fontSize: "1rem", color: theme.palette.textColors?.primary }}
                >
                  Подписки
                </Typography>
                <Box flex={1}>
                  <Divider />
                </Box>
              </Stack>

              {/* Список подписок на курсы */}
              <Stack spacing={1.5}>
                {filteredSubscriptionCourses.length > 0 ? (
                  filteredSubscriptionCourses.map((course, idx) => (
                    <PurchasedCourseCard 
                      key={idx} 
                      course={course} 
                      isSubscription={true} 
                      onClick={() => course.id && handleCourseClick(course.id)}
                    />
                  ))
                ) : (
                  <Paper
                    elevation={0}
                    sx={{
                      borderRadius: theme.shape.borderRadius,
                      backgroundColor: 'rgba(0, 0, 0, 0.1)',
                      p: 3,
                      textAlign: 'center',
                      border: '1px dashed rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <Stack spacing={1} alignItems="center">
                      <Typography variant="body1" color={theme.palette.textColors?.secondary}>
                        {searchQuery 
                          ? "По вашему запросу не найдено курсов с подпиской" 
                          : "У вас пока нет подписок на курсы"}
                      </Typography>
                      <Typography variant="caption" color={theme.palette.textColors?.secondary} sx={{ opacity: 0.7 }}>
                        {searchQuery 
                          ? "Попробуйте изменить запрос" 
                          : "Оформите подписку на интересный курс"}
                      </Typography>
                    </Stack>
                  </Paper>
                )}
              </Stack>

              {/* Заголовок "Другие курсы" */}
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box flex={1}>
                  <Divider />
                </Box>
                <Typography
                  variant="body2"
                  fontWeight="bold"
                  sx={{ fontSize: "1rem", color: theme.palette.textColors?.primary }}
                >
                  Другие курсы
                </Typography>
                <Box flex={1}>
                  <Divider />
                </Box>
              </Stack>

              {/* Список других курсов */}
              <Stack spacing={1.5}>
                {filteredOtherCourses.length > 0 ? (
                  filteredOtherCourses.map((course, idx) => (
                    <PurchasedCourseCard 
                      key={idx} 
                      course={course} 
                      isSubscription={false} 
                      onClick={() => course.id && handleCourseClick(course.id)}
                    />
                  ))
                ) : (
                  <Paper
                    elevation={0}
                    sx={{
                      borderRadius: theme.shape.borderRadius,
                      backgroundColor: 'rgba(0, 0, 0, 0.1)',
                      p: 3,
                      textAlign: 'center',
                      border: '1px dashed rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <Stack spacing={1} alignItems="center">
                      <Typography variant="body1" color={theme.palette.textColors?.secondary}>
                        {searchQuery 
                          ? "По вашему запросу не найдено других курсов" 
                          : "Других курсов пока нет"}
                      </Typography>
                      <Typography variant="caption" color={theme.palette.textColors?.secondary} sx={{ opacity: 0.7 }}>
                        {searchQuery 
                          ? "Попробуйте изменить запрос" 
                          : "Скоро здесь появятся новые курсы"}
                      </Typography>
                    </Stack>
                  </Paper>
                )}
              </Stack>
            </>
          )}
        </Stack>
      </MainLayout>
    </>
  );
} 