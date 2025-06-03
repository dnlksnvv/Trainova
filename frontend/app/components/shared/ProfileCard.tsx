"use client";

import React, { useState } from "react";
import {
  Box,
  Stack,
  Avatar,
  Typography,
  Paper,
  Rating,
  IconButton,
  Button,
  CircularProgress,
  Skeleton,
  useMediaQuery,
  useTheme
} from "@mui/material";
import PeopleIcon from '@mui/icons-material/People';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import EditIcon from '@mui/icons-material/Edit';
import AvatarViewer from "./AvatarViewer";

export interface ProfileData {
  name: string;
  email?: string;
  description?: string;
  avatar?: string;
  rating?: number;
  subscribersCount?: number;
  experience?: number;
}

interface ProfileCardProps {
  profile: ProfileData;
  avatarUrl?: string | null;
  loading?: boolean;
  avatarLoading?: boolean;
  onEditClick?: () => void;
  onAvatarClick?: () => void;
}

export default function ProfileCard({
  profile,
  avatarUrl,
  loading = false,
  avatarLoading = false,
  onEditClick,
  onAvatarClick
}: ProfileCardProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);

  // Функция для форматирования числа подписчиков
  const formatSubscribersCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  // Получаем первую букву имени для аватара
  const avatarLetter = profile.name ? profile.name.charAt(0).toUpperCase() : "U";

  // Обработчик клика по аватарке
  const handleAvatarClick = (e: React.MouseEvent) => {
    if (avatarUrl) {
      e.stopPropagation();
      setAvatarViewerOpen(true);
    } else if (onAvatarClick) {
      onAvatarClick();
    }
  };

  return (
    <>
      <Box
        sx={{
          borderRadius: 4,
          backgroundColor: theme.palette.backgrounds?.paper,
          p: 3,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Stack spacing={2}>
          {/* Основная информация профиля */}
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={3} 
            alignItems="center"
          >
            {/* Аватар */}
            <Box sx={{ position: 'relative' }}>
              {loading ? (
                <Skeleton variant="circular" width={isMobile ? 80 : 120} height={isMobile ? 80 : 120} />
              ) : (
                <>
                  <Avatar
                    src={avatarUrl || undefined}
                    alt={profile.name}
                    onClick={handleAvatarClick}
                    sx={{
                      width: isMobile ? 80 : 120,
                      height: isMobile ? 80 : 120,
                      bgcolor: theme.palette.highlight?.main,
                      fontSize: isMobile ? "1.5rem" : "2rem",
                      border: `3px solid ${theme.palette.highlight?.main}`,
                      cursor: avatarUrl ? 'pointer' : onAvatarClick ? 'pointer' : 'default',
                      '&:hover': {
                        transform: (avatarUrl || onAvatarClick) ? 'scale(1.03)' : 'none',
                        boxShadow: (avatarUrl || onAvatarClick) ? '0 0 0 3px rgba(255, 140, 0, 0.3)' : 'none',
                      },
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {avatarLoading ? (
                      <CircularProgress size={isMobile ? 20 : 30} />
                    ) : (
                      avatarLetter
                    )}
                  </Avatar>
                  {/* Кнопка редактирования аватара */}
                  {onAvatarClick && (
                    <IconButton
                      sx={{
                        position: 'absolute',
                        bottom: -5,
                        right: -5,
                        bgcolor: theme.palette.highlight?.main,
                        color: theme.palette.textColors?.primary,
                        width: 32,
                        height: 32,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        '&:hover': {
                          bgcolor: theme.palette.highlight?.accent,
                          transform: 'scale(1.1)',
                        },
                        transition: 'all 0.2s ease'
                      }}
                      onClick={onAvatarClick}
                    >
                      <PhotoCameraIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  )}
                </>
              )}
            </Box>
            
            {/* Информация о профиле */}
            <Stack spacing={1} flex={1} alignItems={{ xs: 'center', sm: 'flex-start' }}>
              {loading ? (
                <>
                  <Skeleton variant="text" width="60%" height={36} />
                  <Skeleton variant="text" width="40%" height={24} />
                  {profile.description && <Skeleton variant="text" width="80%" height={20} />}
                </>
              ) : (
                <>
                  <Typography 
                    variant={isMobile ? "h5" : "h4"} 
                    fontWeight="bold"
                    sx={{ 
                      color: theme.palette.textColors?.primary,
                      textAlign: { xs: 'center', sm: 'left' },
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      hyphens: 'auto',
                      maxWidth: '100%'
                    }}
                  >
                    {profile.name}
                  </Typography>
                  
                  {/* Email */}
                  {profile.email && (
                    <Typography
                      variant="body1"
                      sx={{ 
                        color: theme.palette.textColors?.secondary,
                        textAlign: { xs: 'center', sm: 'left' },
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word',
                        maxWidth: '100%'
                      }}
                    >
                      {profile.email}
                    </Typography>
                  )}
                  
                  {/* Рейтинг и подписчики - отображаются всегда, если есть данные */}
                  {(profile.rating !== undefined || profile.subscribersCount !== undefined) && (
                    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" justifyContent={{ xs: 'center', sm: 'flex-start' }}>
                      {/* Рейтинг */}
                      {profile.rating !== undefined && (
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Rating 
                            value={profile.rating} 
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
                            color={theme.palette.textColors?.secondary}
                            sx={{ fontWeight: 'medium' }}
                          >
                            {profile.rating.toFixed(2)}
                          </Typography>
                        </Stack>
                      )}
                      
                      {/* Количество подписчиков */}
                      {profile.subscribersCount !== undefined && (
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <PeopleIcon 
                            sx={{ 
                              fontSize: 16, 
                              color: theme.palette.textColors?.secondary 
                            }} 
                          />
                          <Typography 
                            variant="body2" 
                            color={theme.palette.textColors?.secondary}
                            sx={{ fontWeight: 'medium' }}
                          >
                            {formatSubscribersCount(profile.subscribersCount)} подписчиков
                          </Typography>
                        </Stack>
                      )}
                    </Stack>
                  )}
                </>
              )}
            </Stack>
            
            {/* Кнопка редактирования */}
            {onEditClick && (
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={onEditClick}
                disabled={loading}
                sx={{
                  bgcolor: theme.palette.highlight?.main,
                  color: theme.palette.textColors?.primary,
                  borderRadius: 25,
                  px: 3,
                  py: 1.5,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  '&:hover': {
                    bgcolor: theme.palette.highlight?.accent,
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                Редактировать
              </Button>
            )}
          </Stack>

          {/* Описание профиля */}
          {profile.description && !loading && (
            <Paper
              elevation={0}
              sx={{
                backgroundColor: theme.palette.backgrounds?.default,
                p: 2,
                borderRadius: 3,
                borderLeft: `3px solid ${theme.palette.highlight?.main}`,
              }}
            >
              <Typography 
                variant="body1" 
                color={theme.palette.textColors?.secondary}
                sx={{
                  textAlign: { xs: 'center', sm: 'left' },
                  fontStyle: 'italic',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  whiteSpace: 'pre-wrap',
                  maxWidth: '100%'
                }}
              >
                {profile.description}
              </Typography>
            </Paper>
          )}
        </Stack>
      </Box>

      {/* Модальное окно для просмотра аватарки */}
      <AvatarViewer 
        avatarUrl={avatarUrl} 
        initials={avatarLetter}
        isOpen={avatarViewerOpen}
        onClose={() => setAvatarViewerOpen(false)}
        size={350}
      />
    </>
  );
} 