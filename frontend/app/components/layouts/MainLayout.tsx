"use client";

import React, { useEffect, useState } from "react";
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
import AnimatedLayout from "../shared/AnimatedLayout";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [navValue, setNavValue] = React.useState("home");
  const [logoutDialogOpen, setLogoutDialogOpen] = React.useState(false);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [currentPath, setCurrentPath] = useState("");
  
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const theme = useTheme();

  // Обновляем активную вкладку при изменении пути
  const updateActiveTab = (pathname: string) => {
    setCurrentPath(pathname);
    
    // Устанавливаем активный таб на основе текущего пути
    if (pathname === "/") {
      setNavValue("home");
    } else if (pathname === "/profile") {
      setNavValue("profile");
    } else if (pathname === "/trainings") {
      setNavValue("blockA");
    } else if (pathname === "/courses" || pathname.startsWith("/courses/")) {
      setNavValue("blockB");
    }
  };

  // Устанавливаем начальное значение после монтирования
  useEffect(() => {
    // Устанавливаем текущий путь
    const pathname = window.location.pathname;
    updateActiveTab(pathname);
    
    // Устанавливаем pageLoaded в true после первого рендера
    setTimeout(() => {
      setPageLoaded(true);
    }, 100);

    // Слушаем изменение пути для обновления активной вкладки
    const handleRouteChange = () => {
      const newPathname = window.location.pathname;
      updateActiveTab(newPathname);
    };

    // Добавляем обработчик для события popstate (когда пользователь использует кнопку назад/вперед)
    window.addEventListener('popstate', handleRouteChange);

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  // Если пользователь не авторизован и не в процессе загрузки, 
  // перенаправляем на страницу входа
  useEffect(() => {
    // Удаляем перенаправление для неавторизованных пользователей
    // Теперь они смогут видеть тестовые данные на защищенных страницах
  }, [loading, user, router]);

  const handleNavChange = (_event: React.SyntheticEvent, newValue: string) => {
    setNavValue(newValue);
    setPageLoaded(false);
    
    // Навигация в зависимости от выбранного пункта
    let targetPath = "/";
    if (newValue === "home") {
      targetPath = "/";
    } else if (newValue === "profile") {
      targetPath = "/profile";
    } else if (newValue === "blockA") {
      targetPath = "/trainings";
    } else if (newValue === "blockB") {
      targetPath = "/courses";
    }
    
    // Всегда выполняем переход, даже если мы уже на этой странице
    setCurrentPath(targetPath);
    router.push(targetPath);
    
    // После навигации устанавливаем задержку для имитации завершения загрузки
    setTimeout(() => {
      setPageLoaded(true);
    }, 300);
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

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        // Фон всего приложения
        bgcolor: theme.palette.backgrounds?.default, 
      }}
    >
      {/* Основная область (контент) с анимацией появления */}
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
        <AnimatedLayout>
          {children}
        </AnimatedLayout>
      </Container>

      {/* Нижняя навигация */}
      <Paper
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          // Фон нижней панели
          bgcolor: theme.palette.highlight?.main, 
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          paddingBottom: "0px", 
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          height: "70px",
        }}
        elevation={8}
      >
        <BottomNavigation
          showLabels={false}
          value={navValue}
          onChange={handleNavChange}
          sx={{
            color: theme.palette.textColors?.primary,
            bgcolor: theme.palette.highlight?.main,
            height: "100%", 
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            "& .MuiBottomNavigationAction-root": {
              marginTop: "-5px", 
              padding: "12px 0 16px", 
              height: "100%", 
            }
          }}
        >
          <BottomNavigationAction
            value="home"
            sx={{
              color: theme.palette.textColors?.primary,
              "&.Mui-selected": {
                color: theme.palette.textColors?.primary,
              },
            }}
            icon={
              <HomeIcon
                sx={{
                  color: navValue === "home" && pageLoaded 
                    ? theme.palette.textColors?.primary 
                    : theme.palette.backgrounds?.default, 
                  fontSize: "28px",
                  "&.Mui-selected": {
                    color: theme.palette.backgrounds?.default,
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
                  color: navValue === "blockA" && pageLoaded 
                    ? theme.palette.textColors?.primary 
                    : theme.palette.backgrounds?.default,
                  transform: 'scaleX(-1)', 
                  fontSize: "28px",
                  "&.Mui-selected": {
                    color: theme.palette.backgrounds?.default,
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
                  color: navValue === "blockB" && pageLoaded 
                    ? theme.palette.textColors?.primary 
                    : theme.palette.backgrounds?.default,
                  fontSize: "28px",
                  "&.Mui-selected": {
                    color: theme.palette.backgrounds?.default,
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
                  color: navValue === "profile" && pageLoaded 
                    ? theme.palette.textColors?.primary 
                    : theme.palette.backgrounds?.default,
                  fontSize: "28px",
                  "&.Mui-selected": {
                    color: theme.palette.backgrounds?.default,
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