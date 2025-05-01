"use client";

import { useTheme, Card, CardContent, Typography, Stack, Box, IconButton, styled } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useRouter } from 'next/navigation';
import { useIsAdmin } from '@/app/hooks/useIsAdmin';

export interface AppTrainingData {
  id: string | number;
  title: string;
  description?: string;
  duration: string;
  exercisesCount: number;
  lastWorkout: string;
}

export interface AppTrainingCardProps {
  training: AppTrainingData;
}

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

export default function AppTrainingCard({ training }: AppTrainingCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const isAdmin = useIsAdmin();

  // Определение фона в зависимости от текущей темы
  const backgroundStyle = {
    backgroundColor: theme.palette.mode === 'dark' 
      ? theme.palette.backgrounds?.paper || '#121212'
      : theme.palette.backgrounds?.default || '#f5f5f5',
  };

  // Обработчик нажатия на кнопку настроек
  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Предотвращаем всплытие события, чтобы не срабатывал onCardClick
    router.push(`/training-settings/${training.id}`);
  };

  // Обработчик нажатия на кнопку запуска тренировки
  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Предотвращаем всплытие события, чтобы не срабатывал onCardClick
    router.push(`/workout-player/${training.id}`);
  };

  // Обработчик нажатия на карточку (переход на детальную страницу тренировки)
  const onCardClick = () => {
    router.push(`/workout-player/${training.id}`);
  };

  return (
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
                color: theme.palette.textColors?.primary,
                fontSize: '1.125rem',
                maxWidth: 'calc(100% - 84px)', // Учитываем ширину кнопок
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {training.title}
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
                  color: theme.palette.highlight?.main,
                  bgcolor: 'rgba(255, 140, 0, 0.1)',
                  ml: isAdmin ? 1 : 0,
                  '&:hover': { 
                    bgcolor: 'rgba(255, 140, 0, 0.2)',
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
              fontSize: '0.875rem'
            }}
          >
            <Typography variant="body2">
              {training.duration}
            </Typography>
            <Typography variant="body2">
              {training.exercisesCount} упр.
            </Typography>
            <Typography variant="body2">
              Последняя: {training.lastWorkout}
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </StyledCard>
  );
}