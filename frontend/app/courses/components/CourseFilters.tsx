"use client";

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Slider, 
  Chip, 
  Button, 
  Stack,
  Divider,
  IconButton,
  useTheme
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { MuscleGroup, muscleGroupsApi } from '@/app/services/api';

// Интерфейс для опций фильтра
export interface FilterOptions {
  durationRange: [number, number]; // Минимальная и максимальная длительность в секундах
  selectedMuscleGroups: number[]; // ID выбранных групп мышц
  sortOrder: 'asc' | 'desc'; // Порядок сортировки по длительности
}

interface CourseFiltersProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: FilterOptions) => void;
  initialFilters?: FilterOptions;
}

const MAX_DURATION = 7200; // 2 часа в секундах как максимальное значение

const CourseFilters: React.FC<CourseFiltersProps> = ({
  isOpen,
  onClose,
  onApplyFilters,
  initialFilters
}) => {
  const theme = useTheme();
  
  // Состояния для фильтров
  const [durationRange, setDurationRange] = useState<[number, number]>(
    initialFilters?.durationRange || [0, MAX_DURATION]
  );
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<number[]>(
    initialFilters?.selectedMuscleGroups || []
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    initialFilters?.sortOrder || 'desc'
  );
  
  // Состояние для списка всех групп мышц
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Загрузка групп мышц при первой отрисовке
  useEffect(() => {
    const loadMuscleGroups = async () => {
      try {
        setLoading(true);
        const groups = await muscleGroupsApi.getAll();
        setMuscleGroups(groups);
      } catch (error) {
        console.error('Ошибка при загрузке групп мышц:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (isOpen) {
      loadMuscleGroups();
    }
  }, [isOpen]);
  
  // Обработчик изменения слайдера длительности
  const handleDurationChange = (event: Event, newValue: number | number[]) => {
    setDurationRange(newValue as [number, number]);
  };
  
  // Обработчик выбора группы мышц
  const handleMuscleGroupToggle = (muscleGroupId: number) => {
    setSelectedMuscleGroups(prev => {
      if (prev.includes(muscleGroupId)) {
        return prev.filter(id => id !== muscleGroupId);
      } else {
        return [...prev, muscleGroupId];
      }
    });
  };
  
  // Обработчик изменения порядка сортировки
  const handleSortOrderToggle = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };
  
  // Функция для сброса всех фильтров
  const handleResetFilters = () => {
    const defaultRange: [number, number] = [0, MAX_DURATION];
    setDurationRange(defaultRange);
    setSelectedMuscleGroups([]);
    setSortOrder('desc');
    
    // Также можно сразу применить сброшенные фильтры
    onApplyFilters({
      durationRange: defaultRange,
      selectedMuscleGroups: [],
      sortOrder: 'desc'
    });
    onClose();
  };
  
  // Функция для применения фильтров
  const handleApplyFilters = () => {
    onApplyFilters({
      durationRange,
      selectedMuscleGroups,
      sortOrder
    });
    onClose();
  };
  
  // Функция для форматирования времени в читаемый вид
  const formatDuration = (seconds: number) => {
    if (seconds === 0) return '0 мин';
    if (seconds === MAX_DURATION) return '2+ ч';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours} ч ${minutes > 0 ? `${minutes} мин` : ''}`;
    }
    return `${minutes} мин`;
  };
  
  if (!isOpen) return null;
  
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1400,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        pt: 8,
        pb: 4,
        px: 2,
        overflow: 'auto',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          width: '100%',
          maxWidth: 500,
          maxHeight: '90vh',
          overflow: 'auto',
          borderRadius: theme.shape.borderRadius,
          backgroundColor: theme.palette.backgrounds?.paper || theme.palette.background.paper,
          p: 3,
        }}
      >
        {/* Заголовок и кнопка закрытия */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight="bold">
            Фильтры
          </Typography>
          <Box>
            <IconButton 
              size="small" 
              onClick={handleResetFilters}
              sx={{ mr: 1, color: theme.palette.textColors?.secondary }}
            >
              <RestartAltIcon />
            </IconButton>
            <IconButton 
              size="small" 
              onClick={onClose}
              sx={{ color: theme.palette.textColors?.secondary }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Stack>
        
        {/* Фильтр по длительности */}
        <Typography variant="subtitle1" fontWeight="bold" mt={3} mb={1}>
          Длительность
        </Typography>
        <Box px={1} mb={3}>
          <Slider
            value={durationRange}
            onChange={handleDurationChange}
            valueLabelDisplay="auto"
            valueLabelFormat={formatDuration}
            min={0}
            max={MAX_DURATION}
            step={300} // 5 минут шаг
            sx={{
              '& .MuiSlider-thumb': {
                backgroundColor: theme.palette.highlight?.main,
              },
              '& .MuiSlider-track': {
                backgroundColor: theme.palette.highlight?.main,
              },
              '& .MuiSlider-rail': {
                backgroundColor: theme.palette.action?.disabled,
              },
            }}
          />
          <Stack direction="row" justifyContent="space-between" mt={1}>
            <Typography variant="caption" color={theme.palette.textColors?.secondary}>
              {formatDuration(durationRange[0])}
            </Typography>
            <Typography variant="caption" color={theme.palette.textColors?.secondary}>
              {formatDuration(durationRange[1])}
            </Typography>
          </Stack>
        </Box>
        
        {/* Кнопки для сортировки по длительности */}
        <Stack direction="row" spacing={1} mb={3}>
          <Button
            variant={sortOrder === 'asc' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setSortOrder('asc')}
            sx={{
              borderColor: theme.palette.highlight?.main,
              backgroundColor: sortOrder === 'asc' ? theme.palette.highlight?.main : 'transparent',
              color: sortOrder === 'asc' ? theme.palette.textColors?.primary : theme.palette.textColors?.secondary,
              '&:hover': {
                backgroundColor: sortOrder === 'asc' ? theme.palette.highlight?.main : 'rgba(255, 255, 255, 0.05)',
              },
            }}
          >
            Сначала короткие
          </Button>
          <Button
            variant={sortOrder === 'desc' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setSortOrder('desc')}
            sx={{
              borderColor: theme.palette.highlight?.main,
              backgroundColor: sortOrder === 'desc' ? theme.palette.highlight?.main : 'transparent',
              color: sortOrder === 'desc' ? theme.palette.textColors?.primary : theme.palette.textColors?.secondary,
              '&:hover': {
                backgroundColor: sortOrder === 'desc' ? theme.palette.highlight?.main : 'rgba(255, 255, 255, 0.05)',
              },
            }}
          >
            Сначала длинные
          </Button>
        </Stack>
        
        <Divider sx={{ my: 2 }} />
        
        {/* Фильтр по группам мышц */}
        <Typography variant="subtitle1" fontWeight="bold" mb={2}>
          Группы мышц
        </Typography>
        
        {loading ? (
          <Typography variant="body2" color={theme.palette.textColors?.secondary}>
            Загрузка групп мышц...
          </Typography>
        ) : (
          <Stack direction="row" flexWrap="wrap" gap={1} mb={3}>
            {muscleGroups.map((group) => (
              <Chip
                key={group.id}
                label={group.name}
                onClick={() => handleMuscleGroupToggle(group.id)}
                color={selectedMuscleGroups.includes(group.id) ? 'primary' : 'default'}
                variant={selectedMuscleGroups.includes(group.id) ? 'filled' : 'outlined'}
                sx={{
                  borderColor: theme.palette.highlight?.main,
                  backgroundColor: selectedMuscleGroups.includes(group.id) 
                    ? theme.palette.highlight?.main 
                    : 'transparent',
                  color: selectedMuscleGroups.includes(group.id)
                    ? theme.palette.textColors?.primary
                    : theme.palette.textColors?.secondary,
                  '&:hover': {
                    backgroundColor: selectedMuscleGroups.includes(group.id)
                      ? theme.palette.highlight?.main
                      : 'rgba(255, 255, 255, 0.05)',
                  },
                }}
              />
            ))}
          </Stack>
        )}
        
        <Divider sx={{ my: 2 }} />
        
        {/* Кнопки для применения фильтров */}
        <Stack direction="row" spacing={2} mt={3}>
          <Button
            variant="outlined"
            fullWidth
            onClick={onClose}
            sx={{
              borderColor: theme.palette.divider,
              color: theme.palette.textColors?.secondary,
            }}
          >
            Отмена
          </Button>
          <Button
            variant="contained"
            fullWidth
            onClick={handleApplyFilters}
            sx={{
              backgroundColor: theme.palette.highlight?.main,
              color: theme.palette.textColors?.primary,
              '&:hover': {
                backgroundColor: theme.palette.highlight?.accent,
              },
            }}
          >
            Применить
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default CourseFilters; 