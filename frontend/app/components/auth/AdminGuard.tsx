"use client";

import React, { ReactNode } from 'react';
import { useAuth } from '@/app/hooks/useAuth';
import { Box, Typography, CircularProgress } from '@mui/material';
import { useTheme } from '@mui/material';

interface AdminGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export default function AdminGuard({ children, fallback }: AdminGuardProps) {
  const { isAdmin, loading } = useAuth();
  const theme = useTheme();

  if (loading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          minHeight: '200px'
        }}
      >
        <CircularProgress sx={{ color: theme.palette.highlight?.main }} />
      </Box>
    );
  }

  // Если пользователь не админ, показываем сообщение или fallback
  if (!isAdmin) {
    return (
      fallback || (
        <Box sx={{ 
          padding: 3, 
          textAlign: 'center',
          color: theme.palette.textColors?.primary 
        }}>
          <Typography variant="h6">
            Доступ запрещен
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            Этот раздел доступен только администраторам
          </Typography>
        </Box>
      )
    );
  }

  // Если пользователь админ, отображаем содержимое
  return <>{children}</>;
} 