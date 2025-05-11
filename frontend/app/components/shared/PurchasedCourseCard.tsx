"use client";

import React from "react";
import {
  Card,
  CardActionArea,
  CardContent,
  Typography,
  Stack,
  Box,
  LinearProgress,
  Chip,
  Avatar,
  Rating,
  Divider,
  Button,
  useTheme,
} from "@mui/material";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";

import MuscleUsageChart from "./MuscleUsageChart";

interface MuscleUsage {
  name: string;
  color: string;
  percent: number;
}

export interface PurchasedCourseData {
  title: string;
  subscriptionUntil: string;
  description: string;
  duration: string;
  muscleUsage: MuscleUsage[];
  lastWorkout: string;
  completedLessons: number;
  totalLessons: number;
  trainerName: string;
  trainerRating: number; // 0..1
  courseRating: number;  // 0..1
}

interface PurchasedCourseCardProps {
  course: PurchasedCourseData;
}

export default function PurchasedCourseCard({ course }: PurchasedCourseCardProps) {
  const theme = useTheme();

  const {
    title,
    subscriptionUntil,
    description,
    duration,
    muscleUsage,
    lastWorkout,
    completedLessons,
    totalLessons,
    trainerName,
    trainerRating,
    courseRating,
  } = course;

  const progressValue = (completedLessons / totalLessons) * 100;

  // Фон карточки:
  // Тёмный режим: основа = paper (#3a3a3a) ~80%, остаток ~20% — ЧИСТЫЙ оранжевый (primary.main).
  // Светлый режим: от primary.main к secondary.main.
  const cardBackground =
    theme.palette.mode === "dark"
    ? `linear-gradient(45deg, ${theme.palette.backgrounds?.paper} 80%, ${theme.palette.highlight?.main} 100%)`
    : `linear-gradient(135deg, ${theme.palette.highlight?.main} 20%, ${theme.palette.highlight?.accent} 80%)`;

  // Добавляем обработчики для разделения событий
  const handleCardClick = () => {
    alert("Нажал на всю карточку!");
  };

  const handleTrainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    alert("Нажал на тренера!");
  };

  return (
    <Card
      sx={{
        borderRadius: theme.shape.borderRadius,
        boxShadow: 4,
        color: theme.palette.text.primary,
        position: "relative",
        background: cardBackground,
        "&:hover": {
          boxShadow: 8,
          transform: "scale(1.01)",
        },
        transition: "all 0.3s ease",
      }}
    >
      {/* Обертка для контента, которую можно кликнуть */}
      <Box onClick={handleCardClick} sx={{ cursor: 'pointer' }}>
        <CardContent sx={{ position: "relative", p: 2 }}>
          {/* Метка «Активно до...» */}
          <Typography
            variant="body2"
            sx={{
              position: "absolute",
              top: 8,
              right: 12,
              fontSize: "0.8rem",
              opacity: 0.9,
            }}
          >
            Активно до {subscriptionUntil}
          </Typography>

          {/* Название курса */}
          <Typography variant="subtitle1" fontWeight="bold">
            {title}
          </Typography>

          {/* Описание */}
          <Typography variant="body2" mb={1} fontSize="0.85rem">
            {description}
          </Typography>

          {/* Разделитель */}
          <Divider
            sx={{
              borderColor: theme.palette.divider,
              mb: 1,
            }}
          />

          {/* Левая / Правая часть */}
          <Stack direction="row" spacing={1}>
            {/* Левая часть */}
            <Box flex={1} minWidth={0}>
              {/* Длительность / Кол-во тренировок */}
              <Stack spacing={0.5} mb={1}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <CalendarMonthIcon sx={{ fontSize: 16 }} />
                  <Typography variant="body2" fontSize="0.85rem">
                    Продолжительность: {duration}
                  </Typography>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <FitnessCenterIcon sx={{ fontSize: 16 }} />
                  <Typography variant="body2" fontSize="0.85rem">
                    {totalLessons} тренировок
                  </Typography>
                </Stack>
              </Stack>

              {/* Последняя тренировка */}
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <PlayCircleIcon sx={{ fontSize: 16 }} />
                <Typography variant="body2" fontSize="0.85rem">
                  Последняя: {lastWorkout}
                </Typography>
              </Stack>

              {/* Рейтинг курса */}
              <Stack direction="row" alignItems="center" spacing={0.5} mt={1}>
                <Rating
                  name="courseRating"
                  value={courseRating * 5} // 0..5
                  max={5}
                  readOnly
                  precision={0.5}
                  sx={{
                    "& .MuiRating-iconEmpty": {
                      color: theme.palette.grey[500],
                    },
                  }}
                />
              </Stack>
            </Box>

            {/* Правая часть: график мышц + тренер */}
            <Box
              sx={{
                minWidth: 160,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 1,
              }}
            >
              {/* График мышц */}
              <MuscleUsageChart data={muscleUsage} />

              {/* Кнопка-тренер - заменяем на Box со стилизацией для избежания вложенных button */}
              <Box
                onClick={handleTrainerClick}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  color: theme.palette.text.primary,
                  backgroundColor: theme.palette.grey[600],
                  borderRadius: theme.shape.borderRadius,
                  p: 0.5,
                  cursor: 'pointer',
                  "&:hover": {
                    backgroundColor: theme.palette.grey[500],
                  },
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: theme.palette.grey[500],
                    width: 24,
                    height: 24,
                    fontSize: 12,
                  }}
                >
                  {trainerName.charAt(0)}
                </Avatar>
                <Stack spacing={0}>
                  <Typography variant="body2" fontSize="0.8rem" fontWeight="bold">
                    {trainerName}
                  </Typography>
                  <Rating
                    name="trainerRating"
                    value={trainerRating * 5}
                    max={5}
                    readOnly
                    size="small"
                    precision={0.5}
                    sx={{
                      "& .MuiRating-iconEmpty": {
                        color: theme.palette.grey[500],
                      },
                    }}
                  />
                </Stack>
              </Box>
            </Box>
          </Stack>

          {/* Прогресс (Пройдено X/Y) */}
          <Box mt={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Chip
                label={`Пройдено: ${completedLessons}/${totalLessons}`}
                variant="outlined"
                sx={{
                  color: theme.palette.text.primary,
                  borderColor: theme.palette.text.primary,
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  height: 20,
                }}
              />
              <Box sx={{ flex: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={progressValue}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: theme.palette.grey[600],
                    "& .MuiLinearProgress-bar": {
                      backgroundColor: theme.palette.text.primary,
                    },
                  }}
                />
              </Box>
            </Stack>
          </Box>
        </CardContent>
      </Box>
    </Card>
  );
}