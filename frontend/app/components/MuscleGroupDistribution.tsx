"use client";

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Slider, 
  Chip,
  Stack,
  Paper,
  Tooltip,
  useTheme
} from '@mui/material';
import { MuscleGroup } from '@/app/services/api';
import InfoIcon from '@mui/icons-material/Info';

interface MuscleGroupWithPercentage extends MuscleGroup {
  percentage: number;
}

interface MuscleGroupDistributionProps {
  muscleGroups: MuscleGroup[];
  onDistributionChange?: (groups: MuscleGroupWithPercentage[]) => void;
}

const MuscleGroupDistribution: React.FC<MuscleGroupDistributionProps> = ({ 
  muscleGroups,
  onDistributionChange
}) => {
  const theme = useTheme();
  
  // Состояние для групп мышц с процентами
  const [groupsWithPercentage, setGroupsWithPercentage] = useState<MuscleGroupWithPercentage[]>([]);
  
  // Инициализация при изменении списка групп мышц
  useEffect(() => {
    if (!muscleGroups || muscleGroups.length === 0) {
      setGroupsWithPercentage([]);
      return;
    }
    
    // Проверяем, есть ли у групп мышц уже установленные проценты
    const hasPercentages = muscleGroups.some((group) => 
      (group as MuscleGroupWithPercentage).percentage !== undefined
    );
    
    if (hasPercentages) {
      // Если у групп уже есть проценты, используем их
      const groupsWithExistingPercentages = muscleGroups.map(group => ({
        ...group,
        percentage: (group as MuscleGroupWithPercentage).percentage || 0
      })) as MuscleGroupWithPercentage[];
      
      setGroupsWithPercentage(groupsWithExistingPercentages);
      
      // Уведомляем родительский компонент об изменении распределения
      if (onDistributionChange) {
        onDistributionChange(groupsWithExistingPercentages);
      }
    } else {
      // Вычисляем равномерное распределение процентов только если проценты не заданы
      const equalPercentage = 100 / muscleGroups.length;
      
      // Создаем новый массив групп с процентами
      const newGroupsWithPercentage = muscleGroups.map(group => ({
        ...group,
        percentage: Math.round(equalPercentage)
      }));
      
      // Корректируем общую сумму до 100%
      let totalPercentage = newGroupsWithPercentage.reduce((sum, group) => sum + group.percentage, 0);
      
      if (totalPercentage !== 100 && newGroupsWithPercentage.length > 0) {
        const diff = 100 - totalPercentage;
        newGroupsWithPercentage[0].percentage += diff;
      }
      
      setGroupsWithPercentage(newGroupsWithPercentage);
      
      // Уведомляем родительский компонент об изменении распределения
      if (onDistributionChange) {
        onDistributionChange(newGroupsWithPercentage);
      }
    }
  }, [muscleGroups, onDistributionChange]);
  
  // Оптимизируем обработчик слайдера, чтобы предотвратить излишние обновления состояния
  const handleSliderChange = React.useCallback((index: number, newValue: number) => {
    if (groupsWithPercentage.length <= 1) return;
    
    const oldValue = groupsWithPercentage[index].percentage;
    const diff = newValue - oldValue;
    
    if (diff === 0) return;
    
    // Создаем копию массива групп
    const newGroups = [...groupsWithPercentage];
    
    // Изменяем значение для текущей группы
    newGroups[index].percentage = newValue;
    
    // Получаем остальные группы (исключая текущую)
    const otherGroups = newGroups.filter((_, i) => i !== index);
    const totalOtherPercentage = otherGroups.reduce((sum, group) => sum + group.percentage, 0);
    
    // Если нужно распределить изменение между другими группами
    if (diff !== 0 && otherGroups.length > 0) {
      if (totalOtherPercentage === 0) {
        // Если у всех остальных групп 0%, распределяем остаток поровну
        const remainingPercentage = 100 - newValue;
        const perGroup = Math.floor(remainingPercentage / otherGroups.length);
        const remainder = remainingPercentage % otherGroups.length;
        
        otherGroups.forEach((group, i) => {
          const otherIndex = newGroups.findIndex(g => g.id === group.id);
          if (otherIndex !== -1) {
            newGroups[otherIndex].percentage = perGroup + (i < remainder ? 1 : 0);
          }
        });
      } else {
        // Распределяем разницу пропорционально текущим значениям
        otherGroups.forEach((group) => {
          const otherIndex = newGroups.findIndex(g => g.id === group.id);
          if (otherIndex !== -1 && group.percentage > 0) {
            const proportion = group.percentage / totalOtherPercentage;
            const adjustment = Math.round(-diff * proportion);
            newGroups[otherIndex].percentage = Math.max(0, newGroups[otherIndex].percentage + adjustment);
          }
        });
      }
    }
    
    // Финальная корректировка до 100%
    let total = newGroups.reduce((sum, group) => sum + group.percentage, 0);
    if (total !== 100) {
      const diff = 100 - total;
      // Находим группу с наибольшим процентом (исключая текущую) для корректировки
      const groupsForAdjustment = newGroups.filter((_, i) => i !== index && newGroups[i].percentage > 0);
      if (groupsForAdjustment.length > 0) {
        const maxGroup = groupsForAdjustment.reduce((max, group) => 
          group.percentage > max.percentage ? group : max
        );
        const maxIndex = newGroups.findIndex(g => g.id === maxGroup.id);
        if (maxIndex !== -1) {
          newGroups[maxIndex].percentage = Math.max(0, newGroups[maxIndex].percentage + diff);
        }
      } else if (newGroups.length > 1) {
        // Если нет других групп с положительным процентом, корректируем первую доступную
        const adjustIndex = newGroups.findIndex((_, i) => i !== index);
        if (adjustIndex !== -1) {
          newGroups[adjustIndex].percentage = Math.max(0, newGroups[adjustIndex].percentage + diff);
        }
      }
    }
    
    setGroupsWithPercentage(newGroups);
    
    // Уведомляем родительский компонент об изменении
    if (onDistributionChange) {
      onDistributionChange(newGroups);
    }
  }, [groupsWithPercentage, onDistributionChange]);
  
  // Если нет групп мышц, не отображаем компонент
  if (!muscleGroups || muscleGroups.length === 0) {
    return null;
  }
  
  // Мемоизируем список слайдеров для предотвращения излишних перерендеров
  const slidersList = React.useMemo(() => (
    <Stack spacing={2}>
      {groupsWithPercentage.map((group, index) => (
        <Box key={group.id} sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Chip
                label={group.name}
                sx={{ 
                  bgcolor: theme.palette.highlight?.main, 
                  color: theme.palette.textColors?.primary,
                  fontWeight: 'medium'
                }}
              />
              {group.description && (
                <Tooltip title={group.description} arrow placement="top">
                  <InfoIcon 
                    fontSize="small" 
                    sx={{ 
                      ml: 1, 
                      color: theme.palette.textColors?.secondary,
                      cursor: 'help' 
                    }} 
                  />
                </Tooltip>
              )}
            </Box>
            <Typography sx={{ color: theme.palette.textColors?.primary }}>
              {group.percentage}%
            </Typography>
          </Box>
          
          <Slider
            value={group.percentage}
            min={0}
            max={100}
            onChange={(_, value) => handleSliderChange(index, value as number)}
            sx={{
              color: theme.palette.highlight?.main,
              '& .MuiSlider-thumb': {
                width: 16,
                height: 16,
                '&:hover, &.Mui-focusVisible': {
                  boxShadow: `0px 0px 0px 8px ${theme.palette.highlight?.main}20`
                }
              },
              '& .MuiSlider-rail': {
                backgroundColor: theme.palette.backgrounds?.paper + '90',
              }
            }}
          />
        </Box>
      ))}
    </Stack>
  ), [groupsWithPercentage, handleSliderChange, theme]);
  
  // Мемоизируем визуальное отображение распределения
  const distributionDisplay = React.useMemo(() => (
    <Box sx={{ mb: 3, height: 20, display: 'flex', borderRadius: 10, overflow: 'hidden' }}>
      {groupsWithPercentage.map((group, index) => {
        // Генерируем цвет для группы мышц
        const colors = [
          theme.palette.highlight?.main,
          '#4CAF50', // green
          '#2196F3', // blue
          '#9C27B0', // purple
          '#F44336', // red
          '#FF9800'  // orange
        ];
        
        const color = colors[index % colors.length];
        
        return (
          <Box 
            key={group.id} 
            sx={{ 
              width: `${group.percentage}%`, 
              height: '100%', 
              bgcolor: color,
              transition: 'width 0.3s ease-in-out'
            }}
          />
        );
      })}
    </Box>
  ), [groupsWithPercentage, theme]);
  
  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: theme.palette.backgrounds?.paper,
        borderRadius: theme.borderRadius.small,
        mb: 3,
        mt: 2
      }}
    >
      <Typography variant="h6" fontWeight="medium" sx={{ mb: 2, color: theme.palette.textColors?.primary }}>
        Распределение нагрузки
      </Typography>
      
      {/* Индикатор текущей суммы процентов */}
      {(() => {
        // Фильтруем только задействованные группы (с процентом > 0)
        const activeGroups = groupsWithPercentage.filter(group => group.percentage > 0);
        
        // Если нет задействованных групп, не показываем индикатор
        if (activeGroups.length === 0) return null;
        
        const totalPercentage = activeGroups.reduce((sum, group) => sum + group.percentage, 0);
        const isValid = totalPercentage === 100;
        
        // Показываем индикатор только если распределение некорректно
        if (isValid) return null;
        
        return (
          <Box sx={{ mb: 2, p: 1.5, borderRadius: 1, bgcolor: theme.palette.error?.light || '#ffebee' }}>
            <Typography 
              variant="body2" 
              sx={{ 
                color: theme.palette.error?.dark || '#c62828',
                fontWeight: 'medium',
                textAlign: 'center'
              }}
            >
              ⚠ Сумма должна равняться 100%. Текущая сумма: {totalPercentage}%
            </Typography>
          </Box>
        );
      })()}
      
      {/* Визуальное отображение распределения */}
      {distributionDisplay}
      
      {/* Слайдеры для каждой группы мышц */}
      {slidersList}
    </Paper>
  );
};

export default MuscleGroupDistribution; 