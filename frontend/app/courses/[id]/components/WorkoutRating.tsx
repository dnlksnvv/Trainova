import React, { useState, useEffect } from "react";
import { Rating, Tooltip, Typography, Stack } from "@mui/material";
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { workoutRatingsApi } from "@/app/services/api";

interface WorkoutRatingProps {
  workoutId: string;
  userId?: string | number | null;
  initialRating?: number | null;
  totalRatings?: number;
  theme: any;
}

const WorkoutRating: React.FC<WorkoutRatingProps> = ({
  workoutId,
  userId,
  initialRating,
  totalRatings = 0,
  theme
}) => {
  const [userRating, setUserRating] = useState<number | null>(null);
  const [showThankYou, setShowThankYou] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [averageRating, setAverageRating] = useState<number | null>(initialRating || null);
  const [ratingsCount, setRatingsCount] = useState<number>(totalRatings);

  // Загрузка оценки пользователя и статистики при монтировании компонента
  useEffect(() => {
    const loadRatingData = async () => {
      if (!workoutId) return;
      
      try {
        // Получаем токен для запроса
        const token = document.cookie
          .split('; ')
          .find(row => row.startsWith('access_token='))
          ?.split('=')[1];
        
        if (!token) {
          console.error('Токен авторизации не найден');
          return;
        }

        // Загружаем статистику оценок тренировки
        const statsData = await workoutRatingsApi.getWorkoutRatingStats(String(workoutId), token);
        if (statsData) {
          setAverageRating(statsData.average_rating);
          setRatingsCount(statsData.total_ratings);
        }
        
        // Если пользователь авторизован, загружаем его оценку
        if (userId) {
          const userRatingData = await workoutRatingsApi.getUserRating(String(workoutId), token);
          if (userRatingData && userRatingData.rating) {
            setUserRating(parseFloat(String(userRatingData.rating)));
          }
        }
      } catch (error) {
        console.error('Ошибка при загрузке данных оценок:', error);
      }
    };
    
    loadRatingData();
  }, [workoutId, userId]);

  // Обработчик изменения оценки
  const handleRatingChange = async (event: React.SyntheticEvent, newValue: number | null) => {
    if (newValue === null || !workoutId || !userId || isLoading) return;
    
    try {
      setIsLoading(true);
      setUserRating(newValue);
      
      // Получаем токен для запроса
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('access_token='))
        ?.split('=')[1];
      
      if (!token) {
        console.error('Токен авторизации не найден');
        setIsLoading(false);
        return;
      }
      
      // Отправляем запрос на сервер для сохранения оценки
      await workoutRatingsApi.rateWorkout(
        workoutId,
        newValue,
        token
      );
      
      // Показываем уведомление об успешной отправке
      setShowThankYou(true);
      
      // Скрываем сообщение "Спасибо за вашу оценку" через 2 секунды
      setTimeout(() => {
        setShowThankYou(false);
      }, 2000);
      
      // Обновляем статистику оценок после установки новой оценки
      const statsData = await workoutRatingsApi.getWorkoutRatingStats(String(workoutId), token);
      if (statsData) {
        setAverageRating(statsData.average_rating);
        setRatingsCount(statsData.total_ratings);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Ошибка при отправке оценки:', error);
      setIsLoading(false);
      alert('Не удалось сохранить вашу оценку. Пожалуйста, попробуйте еще раз.');
    }
  };

  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography 
        variant="body2" 
        color={theme.palette.textColors?.secondary}
      >
        Оценить:
      </Typography>
      
      <Tooltip 
        title="Спасибо за вашу оценку!"
        arrow
        placement="top"
        open={showThankYou}
      >
        <Rating
          value={userRating}
          onChange={handleRatingChange}
          precision={0.25}
          icon={<StarIcon fontSize="small" />}
          emptyIcon={<StarBorderIcon fontSize="small" />}
          sx={{ 
            '& .MuiRating-iconFilled': {
              color: theme.palette.ratingColor?.main
            },
            '& .MuiRating-iconEmpty': {
              color: theme.palette.textColors?.secondary
            }
          }}
          disabled={isLoading}
        />
      </Tooltip>
      
      {averageRating !== undefined && averageRating !== null && (
        <Typography 
          variant="body2" 
          color={theme.palette.textColors?.secondary}
          sx={{ ml: 0.5 }}
        >
          {averageRating} ({ratingsCount})
        </Typography>
      )}
    </Stack>
  );
};

export default WorkoutRating; 