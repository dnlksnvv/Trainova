"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "@mui/material/styles";
import { Box, Typography, Button, Stack } from "@mui/material";
import { useRouter } from "next/navigation";
import Image from "next/image";
import InstallPWA from "@/app/components/InstallPWA";

export default function WelcomePage() {
  const theme = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Быстрая инициализация без проверки авторизации
  useEffect(() => {
    // Просто инициализируем страницу без перенаправлений
    setLoading(false);
  }, []);

  // Обработчик нажатия на кнопку "Начать"
  const handleStart = () => {
    router.push('/auth');
  };

  // Если загрузка, не показываем контент
  if (loading) {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: theme.palette.backgrounds?.default,
        padding: 2,
        textAlign: 'center'
      }}
    >
      <Box sx={{ flex: 1 }} />
      
      <Stack spacing={4} alignItems="center" sx={{ width: '100%', maxWidth: 400 }}>
        {/* Логотип */}
        <Box
          sx={{
            position: 'relative',
            width: { xs: '80vw', sm: '60vw', md: '40vw', lg: '30vw' },
            height: 'auto',
            maxWidth: 400,
            maxHeight: 400,
            display: 'flex',
            justifyContent: 'center'
          }}
        >
          <Image 
            src="/icons/logo.png"
            alt="Trainova Logo"
            priority
            width={512}
            height={512}
            style={{ width: '100%', height: 'auto' }}
          />
        </Box>
        
        {/* Приветственный текст */}
        <Box>
          <Typography
            variant="h5"
            fontWeight="bold"
            sx={{
              fontSize: "1.5rem",
              color: theme.palette.textColors?.primary,
              marginBottom: 1
            }}
          >
            Добро пожаловать в
          </Typography>
          <Typography
            variant="h4"
            fontWeight="bold"
            sx={{
              fontSize: "2rem",
              color: theme.palette.highlight?.main
            }}
          >
            Trainova!
          </Typography>
        </Box>
      </Stack>
      
      <Box sx={{ flex: 1 }} />
      
      {/* Кнопка "Начать" */}
      <Box sx={{ width: '100%', maxWidth: 400, mb: 4 }}>
        <Button
          variant="contained"
          fullWidth
          onClick={handleStart}
          sx={{
            borderRadius: theme.borderRadius.medium,
            backgroundColor: theme.palette.highlight?.main,
            '&:hover': {
              backgroundColor: theme.palette.highlight?.accent,
            },
            py: 1.5,
            fontSize: '1.1rem',
            textTransform: 'none',
            boxShadow: theme.customShadows.medium
          }}
        >
          Начать
        </Button>
      </Box>
      
      {/* Уведомление об установке приложения */}
      <InstallPWA location="welcome" />
    </Box>
  );
} 