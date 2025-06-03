import React from 'react';
import { Paper, Stack, Box, Typography, Button } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';

interface WorkoutErrorBlockProps {
  type: 'forbidden' | 'notFound';
  onViewOtherCourses: () => void;
  onBackToCourse: () => void;
  theme: any;
}

export const WorkoutErrorBlock: React.FC<WorkoutErrorBlockProps> = ({ 
  type, 
  onViewOtherCourses, 
  onBackToCourse, 
  theme 
}) => {
  const config = {
    forbidden: {
      title: "Урок закрыт",
      description: "Для доступа к данной тренировке необходима активная подписка на курс. Приобретите подписку, чтобы получить полный доступ ко всем урокам.",
    },
    notFound: {
      title: "Урок не найден",
      description: "Урок с указанным идентификатором не существует или был удален.",
    }
  };

  const currentConfig = config[type];

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: theme.shape.borderRadius,
        background: `linear-gradient(135deg, rgba(255, 107, 107, 0.1) 0%, rgba(255, 107, 107, 0.05) 100%)`,
        border: '2px solid rgba(255, 107, 107, 0.3)',
        p: { xs: 3, sm: 4 },
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          right: 0,
          width: { xs: '100%', sm: '40%' },
          height: '100%',
          background: `radial-gradient(circle at right, rgba(255, 107, 107, 0.1), transparent 70%)`,
          pointerEvents: 'none',
        }
      }}
    >
      <Stack spacing={3} alignItems="center">
        {/* Иконка */}
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 107, 107, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem',
            border: '2px solid rgba(255, 107, 107, 0.3)',
          }}
        >
          <LockIcon sx={{ fontSize: '2.5rem', color: '#ff6b6b' }} />
        </Box>
        
        {/* Заголовок */}
        <Typography 
          variant="h4" 
          fontWeight="bold"
          sx={{
            fontSize: { xs: '1.5rem', sm: '2rem' },
            color: '#ff6b6b',
            mb: 1
          }}
        >
          {currentConfig.title}
        </Typography>
        
        {/* Описание */}
        <Typography 
          variant="body1" 
          color={theme.palette.textColors?.secondary}
          sx={{
            fontSize: { xs: '0.9rem', sm: '1rem' },
            maxWidth: '600px',
            lineHeight: 1.6,
          }}
        >
          {currentConfig.description}
        </Typography>
        
        {/* Кнопки */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
          <Button
            variant="outlined"
            onClick={onBackToCourse}
            sx={{
              borderRadius: 25,
              py: 1.5,
              px: 4,
              fontWeight: 'bold',
              textTransform: 'none',
              fontSize: '1rem',
              borderColor: theme.palette.highlight?.main,
              color: theme.palette.highlight?.main,
              '&:hover': {
                borderColor: theme.palette.highlight?.accent,
                backgroundColor: `${theme.palette.highlight?.main}10`,
                transform: 'translateY(-2px)',
              },
              transition: 'all 0.2s ease',
            }}
          >
            Вернуться к курсу
          </Button>
          
          <Button
            variant="contained"
            onClick={onViewOtherCourses}
            sx={{
              borderRadius: 25,
              py: 1.5,
              px: 4,
              fontWeight: 'bold',
              textTransform: 'none',
              fontSize: '1rem',
              backgroundColor: theme.palette.highlight?.main,
              boxShadow: `0 4px 12px ${theme.palette.highlight?.main}66`,
              '&:hover': {
                backgroundColor: theme.palette.highlight?.accent,
                transform: 'translateY(-2px)',
                boxShadow: `0 6px 16px ${theme.palette.highlight?.main}99`,
              },
              transition: 'all 0.2s ease',
            }}
          >
            Смотреть другие курсы
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}; 