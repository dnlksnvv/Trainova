"use client";

import React from "react";
import { Box, Stack, Typography } from "@mui/material";

interface MuscleUsageItem {
  name: string;   
  color: string;   
  percent: number; 
}

interface MuscleUsageChartProps {
  data: MuscleUsageItem[];
}

export default function MuscleUsageChart({ data }: MuscleUsageChartProps) {
  return (
    <Box
      sx={{
        p: 1,                         // Уменьшаем отступы (было 2)
        borderRadius: 1,              // Чуть меньше скругление
        backgroundColor: "rgba(255, 255, 255, 0.2)",
      }}
    >
      {data.map((muscle) => (
        <Stack
          key={muscle.name}
          direction="row"
          alignItems="center"
          spacing={1}
          mb={0.5}                    // Уменьшаем вертикальный отступ
        >
          {/* Кружок с цветом */}
          <Box
            sx={{
              width: 10,              // Немного меньше кружок
              height: 10,
              borderRadius: "50%",
              backgroundColor: muscle.color,
            }}
          />
          {/* Название мышцы (мельче шрифт) */}
          <Typography
            variant="caption"         // Вместо body2 (меньше)
            sx={{ minWidth: "50px", flexShrink: 0 }}
          >
            {muscle.name}
          </Typography>

          {/* Полоска прогресса */}
          <Box
            sx={{
              flex: 1,
              backgroundColor: "#fff",
              height: 4,             // Уменьшаем высоту
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                width: `${muscle.percent}%`,
                backgroundColor: muscle.color,
                height: "100%",
              }}
            />
          </Box>
        </Stack>
      ))}
    </Box>
  );
}