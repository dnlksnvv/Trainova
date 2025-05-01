"use client";

import React, { useEffect } from "react";
import {
  Box,
  Container,
  Paper,
  BottomNavigation,
  BottomNavigationAction,
  useTheme,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import AppsIcon from "@mui/icons-material/Apps";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import PersonIcon from "@mui/icons-material/Person";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/auth/hooks/useAuth";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [navValue, setNavValue] = React.useState("home");
  const [logoutDialogOpen, setLogoutDialogOpen] = React.useState(false);
  
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const theme = useTheme();

  // Если пользователь не авторизован и не в процессе загрузки, 
  // перенаправляем на страницу входа
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  const handleNavChange = (_event: React.SyntheticEvent, newValue: string) => {
    setNavValue(newValue);
    
    // Навигация в зависимости от выбранного пункта
    if (newValue === "home") {
      router.push("/");
    } else if (newValue === "profile") {
      router.push("/profile");
    } else if (newValue === "blockA") {
      router.push("/trainings");
    }
    // Добавьте другие маршруты при необходимости
  };

  const handleLogout = async () => {
    try {
      await logout();
      setLogoutDialogOpen(false);
      router.push('/auth/login');
    } catch (error) {
      console.error("Ошибка при выходе:", error);
    }
  };

  // Отображаем индикатор загрузки, пока проверяем авторизацию
  if (loading) {
    return (
      <Box 
        sx={{ 
          display: "flex", 
          justifyContent: "center", 
          alignItems: "center", 
          height: "100vh",
          bgcolor: theme.palette.backgrounds?.default,
        }}
      >
        <CircularProgress sx={{ color: theme.palette.highlight?.main }} />
      </Box>
    );
  }

  // Если пользователь не авторизован, не отображаем содержимое
  if (!user) {
    return null;
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        // Фон всего приложения
        bgcolor: theme.palette.backgrounds?.default, // "#2b2b2b"
      }}
    >
      {/* Основная область (контент) */}
      <Container
        maxWidth={false}
        sx={{
          flex: 1,
          pt: 2,
          pb: 9, // Увеличенный отступ снизу, чтобы контент не скрывался под навигацией
          maxWidth: "1000px",
          margin: "0 auto",
        }}
      >
        {children}
      </Container>

      {/* Нижняя навигация */}
      <Paper
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          // Фон нижней панели
          bgcolor: theme.palette.backgrounds?.paper, // "#3a3a3a"
        }}
        elevation={8}
      >
        <BottomNavigation
          showLabels={false}
          value={navValue}
          onChange={handleNavChange}
          sx={{
            // Цвет текста пунктов
            color: theme.palette.textColors?.primary,
          }}
        >
          <BottomNavigationAction
            value="home"
            sx={{
              // Цвет подписи
              color: theme.palette.textColors?.primary,
              "&.Mui-selected": {
                color: theme.palette.textColors?.primary,
              },
            }}
            icon={
              <HomeIcon
                sx={{
                  // Цвет иконки
                  color: theme.palette.highlight?.main, // "#FF8C00"
                  "&.Mui-selected": {
                    color: theme.palette.highlight?.main,
                  },
                }}
              />
            }
          />
          <BottomNavigationAction
            value="blockA"
            sx={{
              color: theme.palette.textColors?.primary,
              "&.Mui-selected": {
                color: theme.palette.textColors?.primary,
              },
            }}
            icon={
              <FitnessCenterIcon
                sx={{
                  color: theme.palette.highlight?.main,
                  "&.Mui-selected": {
                    color: theme.palette.highlight?.main,
                  },
                }}
              />
            }
          />
          <BottomNavigationAction
            value="blockB"
            sx={{
              color: theme.palette.textColors?.primary,
              "&.Mui-selected": {
                color: theme.palette.textColors?.primary,
              },
            }}
            icon={
              <AppsIcon
                sx={{
                  color: theme.palette.highlight?.main,
                  "&.Mui-selected": {
                    color: theme.palette.highlight?.main,
                  },
                }}
              />
            }
          />
          <BottomNavigationAction
            value="profile"
            sx={{
              color: theme.palette.textColors?.primary,
              "&.Mui-selected": {
                color: theme.palette.textColors?.primary,
              },
            }}
            icon={
              <PersonIcon
                sx={{
                  color: theme.palette.highlight?.main,
                  "&.Mui-selected": {
                    color: theme.palette.highlight?.main,
                  },
                }}
              />
            }
            onClick={() => {
              if (navValue === "profile") {
                setLogoutDialogOpen(true);
              }
            }}
          />
        </BottomNavigation>
      </Paper>

      {/* Диалог подтверждения выхода */}
      <Dialog
        open={logoutDialogOpen}
        onClose={() => setLogoutDialogOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: theme.palette.backgrounds?.paper,
            color: theme.palette.textColors?.primary,
          }
        }}
      >
        <DialogTitle>Выход из системы</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: theme.palette.textColors?.secondary }}>
            Вы уверены, что хотите выйти из аккаунта?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setLogoutDialogOpen(false)}
            sx={{ color: theme.palette.textColors?.secondary }}
          >
            Отмена
          </Button>
          <Button 
            onClick={handleLogout} 
            sx={{ 
              color: theme.palette.highlight?.main,
              "&:hover": {
                bgcolor: "transparent",
                color: theme.palette.highlight?.accent,
              },
            }}
            autoFocus
          >
            Выйти
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}