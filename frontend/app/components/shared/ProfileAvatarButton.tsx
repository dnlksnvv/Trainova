"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "@mui/material/styles";
import { useRouter } from "next/navigation";
import { 
  IconButton,
  Avatar,
  Skeleton
} from "@mui/material";
import PersonIcon from '@mui/icons-material/Person';
import { profileApi, ProfileResponse } from "../../services/api";
import { useAvatar } from "../../hooks/useAvatar";
import AvatarViewer from "./AvatarViewer";

interface ProfileAvatarButtonProps {
  onClick?: () => void;
  size?: number;
  enableFullscreen?: boolean;
}

const ProfileAvatarButton: React.FC<ProfileAvatarButtonProps> = ({ 
  onClick,
  size = 40,
  enableFullscreen = false
}) => {
  const theme = useTheme();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);
  
  const { avatarUrl, loading: avatarLoading } = useAvatar(profile?.avatar_url);
  
  // Размер аватарки должен быть меньше, чтобы обводка была видна
  const actualAvatarSize = size - 3; // 1.5px с каждой стороны для обводки

  // Загружаем профиль при монтировании компонента
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setProfileLoading(true);
        const profileData = await profileApi.getMyProfile();
        setProfile(profileData);
      } catch (error) {
        console.error('Ошибка при загрузке профиля:', error);
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfile();
  }, []);

  // Обработчик клика
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick();
    } else if (enableFullscreen && avatarUrl) {
      e.stopPropagation();
      setAvatarViewerOpen(true);
    } else if (profile) {
      router.push(`/courses/coach-profile/${profile.user_id}`);
    }
  };

  // Генерируем инициалы пользователя
  const getInitials = () => {
    if (!profile) return "U";
    
    if (profile.first_name && profile.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    } else if (profile.first_name) {
      return profile.first_name[0].toUpperCase();
    } else if (profile.email) {
      return profile.email[0].toUpperCase();
    }
    
    return "U";
  };

  if (profileLoading) {
    return (
      <Skeleton 
        variant="circular" 
        width={size} 
        height={size}
        sx={{
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
        }}
      />
    );
  }

  return (
    <>
      <IconButton
        onClick={handleClick}
        sx={{
          backgroundColor: theme.palette.highlight?.main,
          '&:hover': {
            backgroundColor: theme.palette.highlight?.accent,
          },
          width: size,
          height: size,
          padding: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {avatarUrl && !avatarLoading ? (
          <Avatar
            src={avatarUrl}
            alt="Профиль"
            sx={{
              width: actualAvatarSize,
              height: actualAvatarSize,
              color: theme.palette.textColors?.primary,
              backgroundColor: theme.palette.backgrounds?.default,
              boxShadow: `0 0 0 1.5px ${theme.palette.highlight?.main}`,
            }}
          />
        ) : (
          <Avatar
            sx={{
              width: actualAvatarSize,
              height: actualAvatarSize,
              color: theme.palette.textColors?.primary,
              backgroundColor: theme.palette.backgrounds?.default,
              fontSize: actualAvatarSize * 0.5,
              fontWeight: 'bold',
              boxShadow: `0 0 0 1.5px ${theme.palette.highlight?.main}`,
            }}
          >
            {profile ? getInitials() : <PersonIcon />}
          </Avatar>
        )}
      </IconButton>

      {/* Модальное окно для просмотра аватарки */}
      <AvatarViewer 
        avatarUrl={avatarUrl} 
        initials={getInitials()}
        isOpen={avatarViewerOpen}
        onClose={() => setAvatarViewerOpen(false)}
        size={250}
      />
    </>
  );
};

export default ProfileAvatarButton; 