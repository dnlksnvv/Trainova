"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, Typography, CircularProgress } from "@mui/material";
import MainLayout from "@/app/components/layouts/MainLayout";

export default function CoachProfileIndexPage() {
  const router = useRouter();

  useEffect(() => {
    // Перенаправляем на главную страницу, так как профиль без ID не должен быть доступен
    router.push('/courses');
  }, [router]);

  return (
    <MainLayout>
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '50vh',
          gap: 2 
        }}
      >
        <CircularProgress />
        <Typography>Перенаправление...</Typography>
      </Box>
    </MainLayout>
  );
} 