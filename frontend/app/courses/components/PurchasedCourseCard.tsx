"use client";

import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Stack,
  Box,
  LinearProgress,
  Chip,
  Avatar,
  Rating,
  useTheme,
  Divider,
  useMediaQuery,
  Paper,
} from "@mui/material";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import { useRouter } from "next/navigation";
import MuscleUsageChart, { MuscleUsageItem } from './MuscleUsageChart';
import Image from "next/image";
import PeopleIcon from "@mui/icons-material/People";


export interface PurchasedCourseData {
  id?: string | number; // ID курса для навигации
  title: string;
  subscriptionUntil: string;
  description: string;
  duration: string;
  muscleUsage: MuscleUsageItem[];
  lastWorkout: string;
  completedLessons: number;
  totalLessons: number;
  trainerName: string;
  trainerRating: number; 
  courseRating: number;  // 0-5
  price?: number; // Цена курса (опциональное поле)
  subscribersCount?: number; // Количество подписчиков
  isNew?: boolean; // Флаг для обозначения нового курса
  trainerAvatarUrl?: string; // URL аватарки тренера
  trainerId?: string | number; // ID тренера для перехода на его профиль
  is_published?: boolean; // Флаг публикации курса
}

interface PurchasedCourseCardProps {
  course: PurchasedCourseData;
  isSubscription?: boolean; // Параметр для различения курсов с подпиской и без
  onClick?: () => void; // Обработчик клика на карточку
}

export default function PurchasedCourseCard({ course, isSubscription = true, onClick }: PurchasedCourseCardProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const router = useRouter();

  const {
    title,
    subscriptionUntil,
    description,
    duration,
    muscleUsage,
    lastWorkout,
    completedLessons,
    totalLessons,
    trainerName,
    courseRating,
    price
  } = course;

  const progressValue = (completedLessons / totalLessons) * 100;
  
  // Ограничиваем описание до 100 символов
  const shortDescription = description.length > 100 
    ? `${description.substring(0, 100)}...` 
    : description;

  // Ограничиваем название до 122 символов
  const shortTitle = title.length > 122 
    ? `${title.substring(0, 122)}...` 
    : title;

  // Функция для безопасного преобразования рейтинга
  const getSafeRating = (rating: any): number => {
    console.log('Исходный рейтинг:', { rating, type: typeof rating });
    
    if (typeof rating === 'number') {
      return rating;
    }
    if (typeof rating === 'string') {
      const parsed = parseFloat(rating);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  // Получаем безопасное значение рейтинга
  const safeRating = getSafeRating(courseRating);

  // Фон карточки в зависимости от типа (подписка или нет)
  const cardBackground = isSubscription
    ? `linear-gradient(45deg, ${theme.palette.backgrounds?.paper} 85%, ${theme.palette.highlight?.main} 100%)`
    : `linear-gradient(45deg, ${theme.palette.backgrounds?.paper} 85%, ${theme.palette.info?.main || '#2196f3'} 100%)`;

  // Добавляем обработчики для разделения событий
  const handleCardClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const handleTrainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Если есть ID тренера, переходим на его профиль, иначе на общую страницу тренеров
    if (course.trainerId) {
      router.push(`/courses/coach-profile/${course.trainerId}`);
    } else {
      router.push('/courses/coach-profile');
    }
  };

  return (
    <Card
      sx={{
        borderRadius: theme.shape.borderRadius,
        boxShadow: 2,
        color: theme.palette.textColors?.primary || theme.palette.text.primary,
        position: "relative",
        background: cardBackground,
        "&:hover": {
          boxShadow: 4,
          transform: "scale(1.01)",
        },
        transition: "all 0.3s ease",
        overflow: "hidden",
        isolation: "isolate", // Создает новый контекст наложения
      }}
    >
      <Box onClick={handleCardClick} sx={{ cursor: 'pointer' }}>
        <CardContent sx={{ 
          position: "relative", 
          p: isMobile ? 1.2 : 1.5,
          zIndex: 2, // Повышаем z-index 
        }}>
          {/* Верхняя часть с заголовком */}
          <Stack spacing={0.5}>
            {/* Название курса */}
            <Typography
              variant="h6"
              sx={{
                fontWeight: 'bold',
                fontSize: isMobile ? '1rem' : '1.125rem',
                width: '100%',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                wordBreak: 'break-word',
                maxWidth: '100%',
                lineHeight: 1.2,
              }}
            >
              {shortTitle}
            </Typography>
            
            {/* Рейтинг курса под названием */}
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Rating
                name="courseRatingHeader"
                value={getSafeRating(courseRating)}
                max={5}
                readOnly
                size="small"
                precision={0.25}
                sx={{
                  '& .MuiRating-iconFilled': {
                    color: theme.palette.ratingColor?.main,
                  },
                  '& .MuiRating-iconEmpty': {
                    color: 'rgba(255, 255, 255, 0.2)',
                  },
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  color: theme.palette.textColors?.secondary || 'rgba(255, 255, 255, 0.7)',
                  fontSize: '0.75rem',
                }}
              >
                {safeRating.toFixed(2)}
              </Typography>
              
              {/* Значок "Скрыто" для неопубликованных курсов */}
              {course.is_published === false && (
                <Chip
                  label="Скрыто"
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.7rem',
                    backgroundColor: 'rgba(158, 158, 158, 0.2)',
                    color: '#9E9E9E',
                    border: '1px solid rgba(158, 158, 158, 0.3)',
                    '& .MuiChip-label': {
                      px: 0.8
                    }
                  }}
                />
              )}
            </Stack>
          </Stack>
          
          {/* Описание курса для всех типов курсов */}
          <Typography
            variant="body2"
            sx={{
              fontSize: "0.875rem",
              color: theme.palette.textColors?.secondary || 'rgba(255, 255, 255, 0.7)',
              mt: 1,
              mb: 1,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.3
            }}
          >
            {shortDescription}
          </Typography>
          <Divider sx={{ my: 1, borderColor: 'rgba(255, 255, 255, 0.12)' }} />

          {/* Основная часть со статистикой - визуальный блок */}
          <Paper 
            elevation={0}
            sx={{
              backgroundColor: 'rgba(0, 0, 0, 0.15)',
              borderRadius: '8px',
              p: 1.2,
              mb: 1.5,
              border: '1px solid rgba(255, 255, 255, 0.05)',
              position: 'relative',
              zIndex: 2, // Повышаем z-index
            }}
          >
            <Stack 
              direction={{ xs: "column", sm: "row" }} 
              spacing={1.2} 
              justifyContent="space-between"
              alignItems={{ xs: "stretch", sm: "center" }}
            >
              {/* Левая часть - метрики */}
              <Box sx={{ width: { xs: '100%', sm: '60%' } }}>
                <Stack 
                  direction="row" 
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ width: '100%' }}
                >
                  {/* Длительность с иконкой часов */}
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flex: 1, justifyContent: 'center' }}>
                    <AccessTimeIcon sx={{ fontSize: 14, color: theme.palette.textColors?.secondary || 'rgba(255, 255, 255, 0.7)' }} />
                    <Typography variant="body2" fontSize="0.8rem" color={theme.palette.textColors?.secondary || 'rgba(255, 255, 255, 0.7)'}>
                      {duration}
                    </Typography>
                  </Stack>
                  
                  {/* Количество тренировок */}
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flex: 1, justifyContent: 'center' }}>
                    <FitnessCenterIcon sx={{ fontSize: 14, color: theme.palette.textColors?.secondary || 'rgba(255, 255, 255, 0.7)' }} />
                    <Typography variant="body2" fontSize="0.8rem" color={theme.palette.textColors?.secondary || 'rgba(255, 255, 255, 0.7)'}>
                      {totalLessons} {totalLessons === 1 ? 'тр.' : 'тр.'}
                    </Typography>
                  </Stack>
                  
                  {/* Цена курса - показывать только если не подписка */}
                  {!isSubscription && (
                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flex: 1, justifyContent: 'center' }}>
                      <Chip
                        label={(!price || price <= 0) ? "Free" : `${price} ₽`}
                        color="primary"
                        size="small"
                        sx={{
                          fontWeight: 'bold',
                          backgroundColor: (!price || price <= 0) 
                            ? theme.palette.success?.main || '#4CAF50'
                            : theme.palette.highlight?.main || '#FF8C00',
                          color: theme.palette.textColors?.primary,
                          height: 20,
                          fontSize: "0.7rem",
                          '& .MuiChip-label': {
                            px: 1
                          }
                        }}
                      />
                    </Stack>
                  )}
                  
                  {/* Показываем количество подписчиков, только если не подписка и есть данные о подписчиках */}
                  {!isSubscription && course.subscribersCount !== undefined && (
                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flex: 1, justifyContent: 'center' }}>
                      <PeopleIcon sx={{ fontSize: 14, color: theme.palette.textColors?.secondary || 'rgba(255, 255, 255, 0.7)' }} />
                      <Typography variant="body2" fontSize="0.8rem" color={theme.palette.textColors?.secondary || 'rgba(255, 255, 255, 0.7)'}>
                        {course.subscribersCount > 0 ? course.subscribersCount : 'Новый'}
                      </Typography>
                    </Stack>
                  )}
                  
                  {/* Дата последнего занятия - только для курсов с подпиской */}
                  {isSubscription && (
                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flex: 1, justifyContent: 'center' }}>
                      <PlayCircleIcon sx={{ fontSize: 14, color: theme.palette.textColors?.secondary || 'rgba(255, 255, 255, 0.7)' }} />
                      <Typography variant="body2" fontSize="0.8rem" color={theme.palette.textColors?.secondary || 'rgba(255, 255, 255, 0.7)'}>
                        {lastWorkout || 'Не начат'}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              </Box>
              
              {/* Только для мобильных устройств - горизонтальный разделитель */}
              <Box sx={{ display: { xs: 'block', sm: 'none' }, width: '100%' }}>
                <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
              </Box>
              
              {/* Только для десктопов - вертикальный разделитель */}
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Divider orientation="vertical" sx={{ height: 30, borderColor: 'rgba(255, 255, 255, 0.08)' }} />
              </Box>
              
              {/* Правая часть - тренер и рейтинг */}
              <Box sx={{ 
                width: { xs: '100%', sm: '40%' }, 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
              }}>
                {/* Информация о тренере */}
                <Box
                  onClick={handleTrainerClick}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    cursor: 'pointer',
                  }}
                >
                  <Avatar
                    sx={{
                      width: 20,
                      height: 20,
                      fontSize: 12,
                      bgcolor: isSubscription 
                        ? theme.palette.highlight?.main || '#FF8C00'
                        : theme.palette.info?.main || '#2196f3',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    src={course.trainerAvatarUrl || undefined}
                    alt={trainerName}
                  >
                    {trainerName.charAt(0)}
                  </Avatar>
                  <Typography variant="caption" fontWeight="bold">
                    {trainerName}
                  </Typography>
                </Box>
                
                {/* Рейтинг курса */}
                <Rating
                  name="courseRating"
                  value={getSafeRating(courseRating)}
                  max={5}
                  readOnly
                  size="small"
                  precision={0.25}
                  sx={{
                    "& .MuiRating-iconFilled": {
                      color: theme.palette.ratingColor?.main || '#FF8C00',
                    },
                    "& .MuiRating-iconEmpty": {
                      color: theme.palette.grey[500],
                    },
                  }}
                />
              </Box>
            </Stack>
          </Paper>
          
          {/* Разделитель перед графиком мышц */}
          <Divider sx={{ mb: 1.5, borderColor: 'rgba(255, 255, 255, 0.12)' }} />
          
          {/* Группы мышц - визуальное представление */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" sx={{ color: theme.palette.textColors?.secondary, mb: 0.5, display: 'block' }}>
              Группы мышц
            </Typography>
            <MuscleUsageChart data={muscleUsage} />
          </Box>
          
          {/* Прогресс (Пройдено X/Y) - только для курсов с подпиской */}
          {isSubscription && (
            <>
              <Divider sx={{ my: 1.5, borderColor: 'rgba(255, 255, 255, 0.12)' }} />
              <Box sx={{ position: 'relative' }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Chip
                    label={`${completedLessons}/${totalLessons}`}
                    variant="outlined"
                    size="small"
                    sx={{
                      color: theme.palette.textColors?.secondary || 'rgba(255, 255, 255, 0.7)',
                      borderColor: theme.palette.highlight?.main || '#FF8C00',
                      height: 20,
                      fontWeight: 600,
                      fontSize: "0.7rem",
                    }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={progressValue}
                      sx={{
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: theme.palette.grey[700],
                        "& .MuiLinearProgress-bar": {
                          backgroundColor: theme.palette.highlight?.main || '#FF8C00',
                        },
                      }}
                    />
                  </Box>
                </Stack>
                
                {/* Информация о дате активности с абсолютным позиционированием */}
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "0.7rem",
                    color: theme.palette.textColors?.secondary || 'rgba(255, 255, 255, 0.7)',
                    position: 'absolute',
                    right: 0,
                    bottom: -18, // Размещаем ниже прогресс-бара без добавления отступа
                    zIndex: 2,
                  }}
                >
                  Активно до {subscriptionUntil}
                </Typography>
              </Box>
            </>
          )}
        </CardContent>
      </Box>
    </Card>
  );
}