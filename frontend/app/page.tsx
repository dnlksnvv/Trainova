"use client";

import React from "react";
import { useTheme } from "@mui/material/styles";
import { Stack, Box, Divider, Typography } from "@mui/material";

import MainLayout from "@/app/components/layouts/MainLayout";
import MyChart from "@/app/components/shared/MyChart";
import PurchasedCourseCard, {
  PurchasedCourseData,
} from "@/app/components/shared/PurchasedCourseCard";
import AppTrainingCard from "@/app/components/shared/AppTrainingCard";

export default function HomePage() {
  const theme = useTheme(); // <-- Достаём нашу тему

  // Пример данных для "Купленные курсы"
  // Вместо жёстких #FF8080 / #81c784 / #64b5f6 берём из theme.palette.muscleColors
  const purchasedCourses: PurchasedCourseData[] = [
    {
      title: "Недельный интенсив «Большая грудь»",
      subscriptionUntil: "03.05.2025",
      description: "Курс направлен на памп груди...",
      duration: "5 часов",
      muscleUsage: [
        {
          name: "Руки",
          color: theme.palette.muscleColors?.pink ?? "#FF8080",
          percent: 30,
        },
        {
          name: "Ноги",
          color: theme.palette.muscleColors?.green ?? "#81c784",
          percent: 20,
        },
        {
          name: "Грудь",
          color: theme.palette.muscleColors?.blue ?? "#64b5f6",
          percent: 50,
        },
      ],
      lastWorkout: "Вчера",
      completedLessons: 9,
      totalLessons: 13,
      trainerName: "Виктор Чак-Чак",
      trainerRating: 0.5, // 0..1 => 2.5 звезды
      courseRating: 0.3,  // 0..1 => 1.5 звезды
    },
    {
      title: "Недельный интенсив «Большая нога»",
      subscriptionUntil: "03.05.2025",
      description: "Курс направлен на памп левой ноги...",
      duration: "1 час",
      muscleUsage: [
        {
          name: "Ноги",
          color: theme.palette.muscleColors?.green ?? "#81c784",
          percent: 80,
        },
        {
          name: "Пресс",
          color: theme.palette.muscleColors?.blue ?? "#64b5f6",
          percent: 5,
        },
      ],
      lastWorkout: "Сегодня",
      completedLessons: 2,
      totalLessons: 5,
      trainerName: "Тамара Потеха",
      trainerRating: 1, // 1 => 5 звёзд
      courseRating: 0.6,
    },
  ];

  // Пример данных для "Тренировки от приложения"
  const appTrainings = [
    {
      id: 1,
      title: "Утренняя разминка",
      duration: "30 минут",
      exercisesCount: 8,
      lastWorkout: "Вчера",
    },
    {
      id: 2,
      title: "Тренировка 2",
      duration: "45 минут",
      exercisesCount: 12,
      lastWorkout: "3 дня назад",
    },
  ];

  return (
    <MainLayout>
      <Stack spacing={3}>
        {/* График (вес + тренировки) - теперь данные получаются через API */}
        <MyChart />

        {/* Заголовок "Купленные курсы" по центру */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box flex={1}>
            <Divider />
          </Box>
          <Typography
            variant="body2"
            fontWeight="bold"
            sx={{ fontSize: "1rem", color: theme.palette.textColors?.primary }}
          >
            Купленные курсы
          </Typography>
          <Box flex={1}>
            <Divider />
          </Box>
        </Stack>

        {/* Список купленных курсов */}
        <Stack spacing={2}>
          {purchasedCourses.map((course, idx) => (
            <PurchasedCourseCard key={idx} course={course} />
          ))}
        </Stack>

        {/* Заголовок "Тренировки от приложения" */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box flex={1}>
            <Divider />
          </Box>
          <Typography
            variant="body2"
            fontWeight="bold"
            sx={{ fontSize: "1rem", color: theme.palette.textColors?.primary }}
          >
            Тренировки от приложения
          </Typography>
          <Box flex={1}>
            <Divider />
          </Box>
        </Stack>

        {/* Список тренировок от приложения */}
        <Stack spacing={2}>
          {appTrainings.map((t, idx) => (
            <AppTrainingCard key={idx} training={t} />
          ))}
        </Stack>
      </Stack>
    </MainLayout>
  );
}