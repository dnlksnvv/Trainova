"use client";

import React, { useState, useRef } from "react";
import { 
  Box, 
  Stack, 
  Typography, 
  useTheme, 
  Paper,
  CircularProgress
} from "@mui/material";
import { Draggable } from "@hello-pangea/dnd";
import StarIcon from '@mui/icons-material/Star';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import MuscleUsageChart from '../../components/MuscleUsageChart';
import { CourseWorkoutResponse } from '@/app/services/api';
import LockIcon from '@mui/icons-material/Lock';
import { useRouter } from 'next/navigation';

// Интерфейс для группы мышц с процентом нагрузки
interface MuscleGroupWithPercentage {
  id: number;
  name: string;
  description?: string;
  percentage: number;
}

// Расширяем тип CourseWorkoutResponse из API для включения muscle_groups
interface ExtendedCourseWorkoutResponse extends CourseWorkoutResponse {
  muscle_groups?: MuscleGroupWithPercentage[];
}

interface WorkoutCardProps {
  workout: ExtendedCourseWorkoutResponse;
  index: number;
  isOwner: boolean;
  isEditingOrder: boolean;
  formatDuration: (seconds: number | undefined | null) => string;
  handleDragHandleClick: (e: React.MouseEvent) => void;
  courseId?: string;
  onClick?: () => void;
}

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

export default function WorkoutCard({
  workout,
  index,
  isOwner,
  isEditingOrder,
  formatDuration,
  handleDragHandleClick,
  courseId,
  onClick
}: WorkoutCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const [isHolding, setIsHolding] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleDragHandleMouseDown = (e: React.MouseEvent) => {
    if (!isEditingOrder) {
      e.stopPropagation();
      setIsHolding(true);
      longPressTimerRef.current = setTimeout(() => {
        handleDragHandleClick(e);
        setIsHolding(false);
      }, 500); // Задержка в 500 мс (полсекунды)
    }
  };

  const handleDragHandleMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      setIsHolding(false);
    }
  };

  // Обработчик клика по карточке
  const handleCardClick = () => {
    if (isEditingOrder) return; // Не реагируем, если в режиме редактирования порядка
    
    // Проверяем, доступен ли урок для просмотра
    if (!workout.is_visible) {
      // Если урок заблокирован, не выполняем переход
      console.log('Урок заблокирован, переход отклонен');
      return;
    }
    
    if (onClick) {
      // Используем переданный обработчик клика
      onClick();
    } else if (courseId && workout.course_workout_uuid) {
      // Если обработчик не передан, но есть courseId, выполняем навигацию
      router.push(`/courses/${courseId}/workout?workoutId=${workout.course_workout_uuid}`);
    }
  };

  return (
    <Draggable
      key={workout.course_workout_uuid}
      draggableId={workout.course_workout_uuid}
      index={index}
      isDragDisabled={!isEditingOrder}
    >
      {(provided, snapshot) => (
        <Paper
          ref={provided.innerRef}
          {...provided.draggableProps}
          elevation={1}
          onClick={handleCardClick}
          sx={{
            borderRadius: theme.borderRadius.small,
            p: 2,
            backgroundColor: snapshot.isDragging 
              ? 'rgba(100, 181, 246, 0.1)' 
              : theme.palette.backgrounds?.paper,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            position: 'relative',
            border: `1px solid ${workout.is_published ? 
              'rgba(0, 255, 0, 0.1)' : 
              'rgba(255, 255, 255, 0.05)'
            }`,
            '&:hover': {
              transform: isEditingOrder || !workout.is_visible ? 'none' : 'translateY(-2px)',
              boxShadow: isEditingOrder || !workout.is_visible ? 'none' : theme.customShadows.medium,
            },
            overflow: 'hidden',
            cursor: isEditingOrder ? 'default' : (!workout.is_visible ? 'not-allowed' : 'pointer'),
            ...(snapshot.isDragging && {
              boxShadow: theme.customShadows.strong,
              transform: 'rotate(1deg)',
            })
          }}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={2} alignItems="center">
              {/* Номер тренировки в кружке */}
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundColor: workout.is_published 
                    ? theme.palette.highlight?.main 
                    : 'rgba(128, 128, 128, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: theme.customShadows.medium,
                  flexShrink: 0,
                  color: theme.palette.textColors?.primary,
                  fontWeight: 'bold',
                }}
              >
                <Typography 
                  variant="subtitle2" 
                  fontWeight="bold"
                  sx={{
                    color: theme.palette.textColors?.primary
                  }}
                >
                  {index + 1}
                </Typography>
              </Box>
              
              {/* Название и статусы тренировки */}
              <Stack spacing={0.5} sx={{ flex: 1, overflow: 'hidden' }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography 
                    variant="subtitle1" 
                    fontWeight="bold"
                    sx={{ 
                      whiteSpace: 'nowrap', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis',
                      flex: 1
                    }}
                  >
                    {workout.name}
                  </Typography>
                  
                  {/* Статусы тренировки */}
                  <Stack direction="row" spacing={0.5}>
                    {!workout.is_published && (
                      <Box
                        sx={{
                          px: 1,
                          py: 0.25,
                          backgroundColor: 'rgba(128, 128, 128, 0.2)',
                          borderRadius: theme.borderRadius.small,
                          fontSize: '0.7rem',
                          color: theme.palette.textColors?.secondary,
                        }}
                      >
                        Скрыто
                      </Box>
                    )}
                    {!workout.is_free && workout.is_paid && (
                      <Box
                        sx={{
                          px: 1,
                          py: 0.25,
                          backgroundColor: 'rgba(100, 181, 246, 0.2)',
                          borderRadius: theme.borderRadius.small,
                          fontSize: '0.7rem',
                          fontWeight: 'medium',
                          color: 'rgba(100, 181, 246, 0.9)',
                        }}
                      >
                        В подписке
                      </Box>
                    )}
                  </Stack>
                </Stack>

                {/* Описание тренировки */}
                {workout.description && (
                  <Typography 
                    variant="body2" 
                    color={theme.palette.textColors?.secondary}
                    sx={{ 
                      fontSize: '0.85rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {workout.description}
                  </Typography>
                )}
              </Stack>
              
              {/* Длительность в Chip */}
              {workout.duration && (
                <Box
                  sx={{
                    px: 1.5,
                    py: 0.5,
                    backgroundColor: 'rgba(0,0,0,0.1)',
                    borderRadius: theme.borderRadius.small,
                    fontSize: '0.75rem',
                    fontWeight: 'medium',
                    color: theme.palette.textColors?.secondary,
                    flexShrink: 0,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {formatDuration(workout.duration)}
                </Box>
              )}
              
              {/* Drag handle только для владельца */}
              {isOwner && (
                <Box
                  {...(isEditingOrder ? provided.dragHandleProps : {})}
                  onMouseDown={!isEditingOrder ? handleDragHandleMouseDown : undefined}
                  onMouseUp={!isEditingOrder ? handleDragHandleMouseUp : undefined}
                  onMouseLeave={!isEditingOrder ? handleDragHandleMouseUp : undefined}
                  onTouchStart={!isEditingOrder ? (e) => {
                    setIsHolding(true);
                    longPressTimerRef.current = setTimeout(() => {
                      handleDragHandleClick(e as unknown as React.MouseEvent);
                      setIsHolding(false);
                    }, 500);
                  } : undefined}
                  onTouchEnd={!isEditingOrder ? handleDragHandleMouseUp : undefined}
                  onTouchCancel={!isEditingOrder ? handleDragHandleMouseUp : undefined}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 36,
                    color: isEditingOrder 
                      ? theme.palette.highlight?.main 
                      : isHolding
                        ? theme.palette.highlight?.accent
                        : theme.palette.textColors?.secondary,
                    cursor: isEditingOrder ? 'grab' : 'pointer',
                    opacity: isEditingOrder || isHolding ? 1 : 0.4,
                    transition: isHolding ? 'none' : 'all 0.2s ease',
                    transform: isHolding ? 'scale(1.2)' : 'none',
                    '&:hover': {
                      opacity: 1,
                      color: theme.palette.highlight?.main,
                      transform: isEditingOrder 
                        ? 'none' 
                        : isHolding ? 'scale(1.2)' : 'scale(1.1)',
                    },
                    '&:active': {
                      cursor: isEditingOrder ? 'grabbing' : 'pointer',
                    }
                  }}
                  title={isEditingOrder ? 'Перетащите для изменения порядка' : 'Удерживайте для изменения порядка тренировок'}
                >
                  <DragIndicatorIcon fontSize="small" />
                </Box>
              )}
            </Stack>
            
            {/* График мышечных групп */}
            <Box>
              <MuscleUsageChart data={
                workout.muscle_groups && workout.muscle_groups.length > 0 
                  ? workout.muscle_groups.map((group: MuscleGroupWithPercentage) => ({
                      name: group.name,
                      color: getColorForMuscleGroup(group.id, theme),
                      percent: group.percentage
                    }))
                  : [
                      {
                        name: "Общая нагрузка",
                        color: theme.palette.highlight?.main ?? "#64b5f6",
                        percent: 100,
                      }
                    ]
              } />
            </Box>
            
            {/* Предупреждение для тренировок с ограниченным доступом */}
            {!workout.is_visible && (
              <Box
                sx={{
                  backgroundColor: 'rgba(244, 67, 54, 0.05)',
                  border: '1px dashed rgba(244, 67, 54, 0.3)',
                  borderRadius: theme.borderRadius.small,
                  p: 1,
                  mt: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <LockIcon fontSize="small" sx={{ color: 'rgba(244, 67, 54, 0.7)' }} />
                <Typography variant="caption" sx={{ color: 'rgba(244, 67, 54, 0.7)' }}>
                  Полный контент доступен в подписке
                </Typography>
              </Box>
            )}
            
            {/* Метаданные тренировки */}
            <Stack 
              direction="row" 
              justifyContent="space-between" 
              alignItems="center"
              sx={{ mt: 0.5 }}
            >
              {/* Рейтинг */}
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <StarIcon 
                  sx={{ 
                    fontSize: 14, 
                    color: theme.palette.ratingColor?.main
                  }} 
                />
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: theme.palette.textColors?.secondary,
                    fontWeight: 'medium'
                  }}
                >
                  {workout.rating ? parseFloat(String(workout.rating)).toFixed(2) : '0.00'}
                </Typography>
              </Stack>
              
              {/* Просмотры - заглушка */}
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <VisibilityIcon 
                  sx={{ 
                    fontSize: 14, 
                    color: theme.palette.textColors?.secondary 
                  }} 
                />
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: theme.palette.textColors?.secondary,
                  }}
                >
                  0
                </Typography>
              </Stack>
              
              {/* Комментарии - заглушка */}
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <ChatBubbleOutlineIcon 
                  sx={{ 
                    fontSize: 14, 
                    color: theme.palette.textColors?.secondary 
                  }} 
                />
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: theme.palette.textColors?.secondary,
                  }}
                >
                  0
                </Typography>
              </Stack>
            </Stack>
          </Stack>
        </Paper>
      )}
    </Draggable>
  );
} 