import React from 'react';
import { Paper, Stack, Box, Typography, Button } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';

interface CourseErrorBlockProps {
  type: 'hidden' | 'notFound';
  onViewOtherCourses: () => void;
  theme: any;
}

export const CourseErrorBlock: React.FC<CourseErrorBlockProps> = ({ type, onViewOtherCourses, theme }) => {
  const config = {
    hidden: {
      title: "Курс скрыт",
      description: "Этот курс недоступен для просмотра. Возможно, он еще не опубликован или доступен только автору.",
    },
    notFound: {
      title: "Курс не найден",
      description: "Курс с указанным идентификатором не существует или был удален.",
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
        
        {/* Кнопка для перехода к другим курсам */}
        <Button
          variant="contained"
          onClick={onViewOtherCourses}
          sx={{
            borderRadius: 25,
            py: 1.5,
            px: 4,
            mt: 2,
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
    </Paper>
  );
}; 