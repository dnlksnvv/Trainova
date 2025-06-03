import React, { useEffect } from "react";
import { Stack, Avatar, Typography, Rating, Box, CircularProgress } from "@mui/material";
import { useAvatar } from "@/app/hooks/useAvatar";

interface TrainerInfoProps {
  name: string;
  avatarUrl?: string | null;
  rating: number;
  ratingCount?: number;
  description?: string | null;
  isLoading?: boolean;
  isAvatarLoading?: boolean;
  theme: any;
  size?: 'small' | 'medium' | 'large';
}

const TrainerInfo: React.FC<TrainerInfoProps> = ({
  name,
  avatarUrl,
  rating,
  ratingCount = 0,
  description,
  isLoading = false,
  isAvatarLoading = false,
  theme,
  size = 'medium',
}) => {
  // Получаем аватар с помощью хука useAvatar
  const { avatarUrl: resolvedAvatarUrl, loading: avatarLoading } = useAvatar(avatarUrl);
  
  // Определяем размеры аватара в зависимости от размера компонента
  const avatarSizes = {
    small: { xs: 40, sm: 48 },
    medium: { xs: 48, sm: 56 },
    large: { xs: 60, sm: 70 }
  };
  
  const isLoaded = !isLoading && !(isAvatarLoading || avatarLoading);
  
  // Логирование значений рейтинга для отладки
  useEffect(() => {
    console.log(`TrainerInfo: имя=${name}, рейтинг=${rating}, количество=${ratingCount}`);
  }, [name, rating, ratingCount]);
  
  // Форматирование рейтинга для отображения
  const formattedRating = Number(rating).toFixed(2);
  
  return (
    <Stack direction="row" spacing={2} alignItems="flex-start">
      {/* Аватар */}
      {isAvatarLoading || avatarLoading ? (
        <CircularProgress size={avatarSizes[size].sm} />
      ) : (
        <Avatar
          src={resolvedAvatarUrl || undefined}
          alt={name}
          sx={{
            width: avatarSizes[size],
            height: avatarSizes[size],
            border: size === 'large' ? `3px solid ${theme.palette.highlight?.main}` : 'none',
            boxShadow: size === 'large' ? '0 3px 10px rgba(0,0,0,0.2)' : 'none',
            bgcolor: theme.palette.highlight?.main
          }}
        >
          {name.charAt(0)}
        </Avatar>
      )}
      
      {/* Информация о тренере */}
      <Stack spacing={0.5} sx={{ flex: 1 }}>
        {isLoading ? (
          <>
            <Box sx={{ width: '60%' }}>
              <CircularProgress size={16} />
            </Box>
            <Box sx={{ width: '40%' }}>
              <CircularProgress size={12} />
            </Box>
          </>
        ) : (
          <>
            <Typography 
              variant="subtitle1" 
              fontWeight="bold"
              sx={{ 
                fontSize: { 
                  xs: size === 'small' ? '0.9rem' : '1rem', 
                  sm: size === 'small' ? '1rem' : '1.1rem' 
                } 
              }}
            >
              {name}
            </Typography>
            
            {/* Рейтинг */}
            {isLoaded && (
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Rating 
                  value={rating} 
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
                  sx={{ 
                    color: theme.palette.textColors?.secondary,
                    fontWeight: 'medium',
                    fontSize: { xs: '0.85rem', sm: '0.9rem' }
                  }}
                >
                  <Box component="span" sx={{ color: theme.palette.textColors?.secondary, fontWeight: 'bold' }}>
                    {formattedRating}
                  </Box>
                  {ratingCount > 0 && ` (${ratingCount})`}
                </Typography>
              </Stack>
            )}
            
            {/* Описание тренера */}
            {description && (
              <Typography 
                variant="body2" 
                color={theme.palette.textColors?.secondary}
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 1, // Ограничиваем до 1 строки
                  WebkitBoxOrient: 'vertical',
                  wordBreak: 'break-word',
                  maxWidth: '100%', // Не позволяем выходить за границы родительского элемента
                  lineHeight: 1.4
                }}
              >
                {description}
              </Typography>
            )}
          </>
        )}
      </Stack>
    </Stack>
  );
};

export default TrainerInfo; 