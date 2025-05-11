"use client";

import { useState } from 'react';
import { useTheme, Card, CardContent, Typography, Stack, Box, IconButton, styled } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useRouter } from 'next/navigation';
import { useIsAdmin } from '@/app/hooks/useIsAdmin';
import { keyframes } from '@mui/system';
import WorkoutResumeDialog from './WorkoutResumeDialog';
import { workoutProgressApi } from '@/app/services/api';

export interface AppTrainingData {
  id: string | number;
  title: string;
  description?: string;
  duration: string;
  exercisesCount: number;
  lastWorkout: string;
  lastSessionTime?: string;
  totalWorkoutTime?: number;
  isInProgress?: boolean;
  last_session_uuid?: string;
}

export interface AppTrainingCardProps {
  training: AppTrainingData;
}

// Создаем анимацию пульсации для индикатора
const pulseAnimation = keyframes`
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.7);
  }
  
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 6px rgba(33, 150, 243, 0);
  }
  
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(33, 150, 243, 0);
  }
`;

// Стилизованная карточка тренировки
const StyledCard = styled(Card)(({ theme }) => ({
  borderRadius: '16px',
  boxShadow: 'none',
  position: 'relative',
  overflow: 'hidden',
  transition: 'transform 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-5px)',
  },
}));

// Стилизованный индикатор активной тренировки
const ActiveIndicator = styled(Box)(({ theme }) => ({
  display: 'inline-block',
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: theme.palette.info.main,
  marginLeft: '8px',
  animation: `${pulseAnimation} 1.5s infinite`
}));

export default function AppTrainingCard({ training }: AppTrainingCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const isInProgress = training.isInProgress || false;
  const [showResumeDialog, setShowResumeDialog] = useState(false);

  // Определение фона в зависимости от статуса тренировки
  const backgroundStyle = {
    backgroundColor: theme.palette.mode === 'dark' 
      ? theme.palette.backgrounds?.paper || '#121212'
      : theme.palette.backgrounds?.default || '#f5f5f5',
    // Добавляем легкую подсветку для незавершенных тренировок
    border: isInProgress ? `1px solid ${theme.palette.info.main}` : 'none',
    boxShadow: isInProgress ? `0 0 8px 1px ${theme.palette.info.main}30` : 'none'
  };

  // Обработчик нажатия на кнопку настроек
  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Предотвращаем всплытие события, чтобы не срабатывал onCardClick
    router.push(`/training-settings/${training.id}`);
  };

  // Обработчик нажатия на кнопку запуска тренировки
  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Предотвращаем всплытие события
    
    if (isInProgress) {
      // Если тренировка в процессе, показываем диалог
      setShowResumeDialog(true);
    } else {
      // Иначе просто переходим на страницу тренировки
      router.push(`/workout-player/${training.id}`);
    }
  };

  // Обработчик нажатия на карточку
  const onCardClick = () => {
    if (isInProgress) {
      // Если тренировка в процессе, показываем диалог
      setShowResumeDialog(true);
    } else {
      // Иначе просто переходим на страницу тренировки
      router.push(`/workout-player/${training.id}`);
    }
  };

  // Обработчики действий в диалоговом окне
  const handleContinueWorkout = () => {
    setShowResumeDialog(false);
    // Переходим на страницу тренировки с параметром для продолжения
    router.push(`/workout-player/${training.id}?resume=true`);
  };

  const handleRestartWorkout = async () => {
    setShowResumeDialog(false);
    try {
      // Сначала завершаем предыдущую сессию
      // Получаем session_uuid из последней сессии, сохраненной на бэкенде
      const sessionUuid = training.last_session_uuid || "";
      
      if (sessionUuid) {
        console.log('Завершаем текущую тренировку перед запуском новой');
        // Отправляем запрос на завершение предыдущей сессии
        await workoutProgressApi.saveProgress({
          workout_uuid: String(training.id),
          workout_session_uuid: sessionUuid,
          status: "ended",
          datetime_end: new Date().toISOString()
        });
        console.log('Текущая тренировка успешно завершена');
      } else {
        console.error('UUID сессии не найден при перезапуске тренировки');
      }
      
      // Переходим на страницу тренировки с параметром restart
      router.push(`/workout-player/${training.id}?restart=true`);
    } catch (error) {
      console.error('Ошибка при перезапуске тренировки:', error);
      // Всё равно пытаемся перейти на страницу тренировки
      router.push(`/workout-player/${training.id}?restart=true`);
    }
  };

  const handleCompleteWorkout = async () => {
    setShowResumeDialog(false);
    try {
      // Получаем session_uuid из последней сессии, сохраненной на бэкенде
      const sessionUuid = training.last_session_uuid || "";
      
      if (sessionUuid) {
        console.log('Завершаем текущую тренировку');
        // Запрос для завершения тренировки с обязательным session_uuid
        await workoutProgressApi.saveProgress({
          workout_uuid: String(training.id),
          workout_session_uuid: sessionUuid,
          status: "ended",
          datetime_end: new Date().toISOString()
        });
        console.log('Тренировка успешно завершена');
        
        // Обновляем текущую страницу, чтобы увидеть изменения
        window.location.reload();
      } else {
        console.error('UUID сессии не найден при завершении тренировки');
        alert('Не удалось завершить тренировку: UUID сессии не найден');
        window.location.reload();
      }
    } catch (error) {
      console.error('Ошибка при завершении тренировки:', error);
      alert('Произошла ошибка при завершении тренировки');
      // Обновляем страницу в любом случае
      window.location.reload();
    }
  };

  return (
    <>
      <StyledCard 
        onClick={onCardClick}
        sx={{ 
          ...backgroundStyle,
          cursor: 'pointer'
        }}
      >
        <CardContent>
          <Stack spacing={1}>
            {/* Заголовок и кнопки управления */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center'
            }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 'bold',
                  color: isInProgress ? theme.palette.info.main : theme.palette.textColors?.primary,
                  fontSize: '1.125rem',
                  maxWidth: 'calc(100% - 100px)', // Увеличиваем отступ, чтобы не перекрывало свечение
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {training.title}
                {isInProgress && <ActiveIndicator sx={{ ml: 2 }} />} {/* Индикатор только для незавершенных тренировок */}
              </Typography>
              <Box>
                {/* Отображаем кнопку настроек только для админов */}
                {isAdmin && (
                  <IconButton 
                    onClick={handleSettingsClick} 
                    size="small" 
                    sx={{ 
                      color: theme.palette.textColors?.secondary,
                      '&:hover': { color: theme.palette.highlight?.main }
                    }}
                  >
                    <SettingsIcon />
                  </IconButton>
                )}
                <IconButton 
                  onClick={handlePlayClick} 
                  size="small" 
                  sx={{ 
                    color: isInProgress ? theme.palette.info.main : theme.palette.highlight?.main,
                    bgcolor: isInProgress ? 'rgba(33, 150, 243, 0.1)' : 'rgba(255, 140, 0, 0.1)',
                    ml: isAdmin ? 1 : 0,
                    '&:hover': { 
                      bgcolor: isInProgress ? 'rgba(33, 150, 243, 0.2)' : 'rgba(255, 140, 0, 0.2)',
                    }
                  }}
                >
                  <PlayArrowIcon />
                </IconButton>
              </Box>
            </Box>

            {/* Описание тренировки */}
            {training.description && (
              <Typography 
                variant="body2" 
                sx={{ 
                  color: theme.palette.textColors?.secondary,
                  display: '-webkit-box',
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  mt: 0.5
                }}
              >
                {training.description}
              </Typography>
            )}

            {/* Информация о тренировке */}
            <Stack 
              direction="row" 
              spacing={2} 
              sx={{ 
                mt: 1,
                color: theme.palette.textColors?.secondary,
                fontSize: '0.875rem',
                flexWrap: 'wrap'
              }}
            >
              <Typography variant="body2">
                {training.duration}
              </Typography>
              <Typography variant="body2">
                {training.exercisesCount} упр.
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  display: 'flex',
                  alignItems: 'center',
                  color: (training.lastWorkout === "Новая" || isInProgress) 
                    ? theme.palette.info.main 
                    : theme.palette.textColors?.secondary
                }}
              >
                {isInProgress ? (
                  <Box 
                    component="span" 
                    sx={{ 
                      display: 'inline-block',
                      bgcolor: 'rgba(33, 150, 243, 0.1)',
                      px: 1,
                      py: 0.25,
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 'medium'
                    }}
                  >
                    Сейчас
                  </Box>
                ) : training.lastWorkout === "Новая" ? (
                  <Box 
                    component="span" 
                    sx={{ 
                      display: 'inline-block',
                      bgcolor: 'rgba(33, 150, 243, 0.1)',
                      px: 1,
                      py: 0.25,
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 'medium'
                    }}
                  >
                    {training.lastWorkout}
                  </Box>
                ) : (
                  <>
                    {training.lastWorkout}{training.lastSessionTime && ` в ${training.lastSessionTime}`}
                  </>
                )}
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </StyledCard>

      {/* Диалоговое окно для незавершенной тренировки */}
      <WorkoutResumeDialog
        open={showResumeDialog}
        onClose={() => setShowResumeDialog(false)}
        workoutId={String(training.id)}
        workoutName={training.title}
        workoutSessionId={training.last_session_uuid}
        onContinue={handleContinueWorkout}
        onRestart={handleRestartWorkout}
        onComplete={handleCompleteWorkout}
      />
    </>
  );
}