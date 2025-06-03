"use client";

import React, { useState } from "react";
import { Box, Stack, Typography, useTheme, useMediaQuery } from "@mui/material";

export interface MuscleUsageItem {
  name: string;
  color: string;
  percent: number;
}

interface MuscleUsageChartProps {
  data: MuscleUsageItem[];
}

export default function MuscleUsageChart({ data }: MuscleUsageChartProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  // Создаем стили для сегментов полоски в зависимости от процентов
  const segments = data.map((item, index) => {
    let prevTotal = 0;
    for (let i = 0; i < index; i++) {
      prevTotal += data[i].percent;
    }
    
    return {
      backgroundColor: item.color,
      width: `${item.percent}%`,
      left: `${prevTotal}%`,
      position: 'absolute' as const,
      height: '100%',
      borderRadius: index === 0 
        ? `${theme.borderRadius.small}px 0 0 ${theme.borderRadius.small}px` 
        : index === data.length - 1 
        ? `0 ${theme.borderRadius.small}px ${theme.borderRadius.small}px 0` 
        : 'none',
      transition: 'transform 0.2s ease, filter 0.2s ease',
      filter: hoveredIndex === index ? 'brightness(1.2)' : 'brightness(1)',
      transform: hoveredIndex === index ? 'scaleY(1.1)' : 'scaleY(1)',
      transformOrigin: 'center bottom',
      cursor: 'pointer',
      zIndex: 1,
      '&::after': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '30%',
        background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0))',
        borderRadius: 'inherit'
      }
    };
  });

  return (
    <Stack spacing={1.2} width="100%" sx={{ position: 'relative', zIndex: 1 }}>
      {/* Полоска с цветовыми сегментами */}
      <Box sx={{ 
        position: 'relative', 
        height: isMobile ? 14 : 16, 
        width: '100%', 
        borderRadius: theme.borderRadius.small,
        overflow: 'hidden',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)',
        backgroundColor: 'rgba(0,0,0,0.1)',
        zIndex: 1,
      }}>
        {segments.map((style, idx) => (
          <Box 
            key={idx} 
            sx={style} 
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}
      </Box>
      
      {/* Легенда с кружками и названиями */}
      <Stack 
        direction="row" 
        justifyContent={data.length <= 3 ? "space-around" : "space-between"} 
        flexWrap="wrap"
        sx={{ px: 0.5, zIndex: 1 }}
      >
        {data.map((item, idx) => (
          <Stack 
            key={idx} 
            direction="row" 
            spacing={0.5} 
            alignItems="center" 
            sx={{ 
              my: 0.3,
              mx: 0.2,
              opacity: hoveredIndex === null || hoveredIndex === idx ? 1 : 0.6,
              transition: 'all 0.2s ease',
              cursor: 'pointer',
              minWidth: isMobile ? '28%' : '30%',
              flexGrow: isMobile ? 1 : 0,
            }}
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <Box 
              sx={{
                width: isMobile ? 6 : 8,
                height: isMobile ? 6 : 8,
                borderRadius: '50%',
                backgroundColor: item.color,
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: hoveredIndex === idx 
                  ? theme.customShadows.light
                  : 'none',
                transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                transform: hoveredIndex === idx ? 'scale(1.3)' : 'scale(1)',
                flexShrink: 0,
              }} 
            />
            <Typography 
              variant="caption" 
              fontSize={isMobile ? "0.65rem" : "0.7rem"} 
              color={theme.palette.textColors?.secondary}
              sx={{
                fontWeight: hoveredIndex === idx ? 'bold' : 'normal',
                transition: 'font-weight 0.2s ease',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.name.length > (isMobile ? 6 : 10) ? 
                item.name.substring(0, isMobile ? 5 : 9) + '...' : 
                item.name} {item.percent}%
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

