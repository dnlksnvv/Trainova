"use client";

import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  AppBar, 
  Toolbar, 
  IconButton, 
  Typography, 
  List, 
  ListItem, 
  ListItemText, 
  Divider, 
  Box, 
  CircularProgress,
  Paper,
  Button,
  Chip,
  Stack
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import { muscleGroupsApi, MuscleGroup, API_URL, WORKOUT_API_PREFIX } from '@/app/services/api';
import SearchBar from '@/app/components/shared/SearchBar';
import MuscleGroupDistribution from '@/app/components/MuscleGroupDistribution';

// Расширяем MuscleGroup для хранения процентного соотношения
interface MuscleGroupWithPercentage extends MuscleGroup {
  percentage: number;
}

interface MuscleGroupSelectorProps {
  selectedGroups: MuscleGroup[];
  onGroupsChange: (groups: MuscleGroup[]) => void;
  onDistributionChange?: (groups: MuscleGroupWithPercentage[]) => void;
}

const MuscleGroupSelector: React.FC<MuscleGroupSelectorProps> = ({ 
  selectedGroups, 
  onGroupsChange,
  onDistributionChange
}) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<MuscleGroup | null>(null);
  
  // Состояние для групп с процентами
  const [groupsWithPercentage, setGroupsWithPercentage] = useState<MuscleGroupWithPercentage[]>([]);
  
  // Загружаем группы мышц при открытии диалога
  useEffect(() => {
    if (open) {
      loadMuscleGroups();
    }
  }, [open]);
  
  // Обновляем процентное соотношение при изменении выбранных групп
  useEffect(() => {
    // Преобразуем выбранные группы в группы с процентами
    if (!selectedGroups || selectedGroups.length === 0) {
      setGroupsWithPercentage([]);
      return;
    }
    
    // Проверяем, есть ли у групп уже установленные проценты
    const hasPercentages = selectedGroups.some((group) => 
      (group as MuscleGroupWithPercentage).percentage !== undefined
    );
    
    if (hasPercentages) {
      // Если у групп уже есть проценты, нужно проверить - добавилась ли новая группа
      const existingGroupsWithPercentages = selectedGroups.filter(group => 
        (group as MuscleGroupWithPercentage).percentage !== undefined
      ) as MuscleGroupWithPercentage[];
      
      const newGroupsWithoutPercentages = selectedGroups.filter(group => 
        (group as MuscleGroupWithPercentage).percentage === undefined
      );
      
      if (newGroupsWithoutPercentages.length > 0) {
        // Есть новые группы без процентов - добавляем их с 0%
        const newGroupsWithZeroPercentage = newGroupsWithoutPercentages.map(group => ({
          ...group,
          percentage: 0
        })) as MuscleGroupWithPercentage[];
        
        const allGroups = [...existingGroupsWithPercentages, ...newGroupsWithZeroPercentage];
        setGroupsWithPercentage(allGroups);
        
        // Уведомляем родительский компонент об изменении распределения
        if (onDistributionChange) {
          onDistributionChange(allGroups);
        }
      } else {
        // Все группы уже имеют проценты
        const groupsWithExistingPercentages = selectedGroups as MuscleGroupWithPercentage[];
        
        // Проверяем, что сумма равна 100%
        const total = groupsWithExistingPercentages.reduce((sum, group) => sum + (group.percentage || 0), 0);
        
        // Если сумма не равна 100%, корректируем
        if (total !== 100 && groupsWithExistingPercentages.length > 0) {
          // Создаем копию массива, чтобы не изменять исходный
          const correctedGroups = [...groupsWithExistingPercentages];
          correctedGroups[0].percentage += (100 - total);
          setGroupsWithPercentage(correctedGroups);
          
          // Уведомляем родительский компонент об изменении распределения
          if (onDistributionChange) {
            onDistributionChange(correctedGroups);
          }
        } else {
          // Если сумма равна 100%, просто используем группы как есть
          setGroupsWithPercentage(groupsWithExistingPercentages);
          
          // Уведомляем родительский компонент об изменении распределения
          if (onDistributionChange) {
            onDistributionChange(groupsWithExistingPercentages);
          }
        }
      }
    } else {
      // Ни у одной группы нет процентов - распределяем поровну
      const equalPercentage = 100 / selectedGroups.length;
      const withPercentages = selectedGroups.map(group => ({
        ...group,
        percentage: Math.round(equalPercentage)
      }));
      
      // Корректируем, чтобы сумма была ровно 100%
      let total = withPercentages.reduce((sum, group) => sum + group.percentage, 0);
      if (total !== 100 && withPercentages.length > 0) {
        withPercentages[0].percentage += (100 - total);
      }
      
      setGroupsWithPercentage(withPercentages);
      
      // Уведомляем родительский компонент об изменении распределения
      if (onDistributionChange) {
        onDistributionChange(withPercentages);
      }
    }
  }, [selectedGroups, onDistributionChange]);
  
  // Обработчик изменения распределения процентов
  const handleDistributionChange = React.useCallback((newDistribution: MuscleGroupWithPercentage[]) => {
    setGroupsWithPercentage(newDistribution);
    
    // Уведомляем родительский компонент об изменении распределения
    if (onDistributionChange) {
      onDistributionChange(newDistribution);
    }
  }, [onDistributionChange]);
  
  // Функция загрузки групп мышц
  const loadMuscleGroups = async () => {
    try {
      setLoading(true);
      // Пробуем получить данные через API
      try {
        console.log('Запрос групп мышц...');
        console.log('URL запроса:', `${API_URL}${WORKOUT_API_PREFIX}/muscle-groups`);
        
        const response = await muscleGroupsApi.getAll();
        console.log('Получен ответ от API:', JSON.stringify(response));
        
        // Проверяем, есть ли поле items в ответе
        if (response && 'items' in response && Array.isArray(response.items)) {
          console.log('Используем items из ответа:', response.items);
          setMuscleGroups(response.items);
        } else if (Array.isArray(response)) {
          // Если ответ - это массив, используем его напрямую
          console.log('Используем массив из ответа:', response);
          setMuscleGroups(response);
        } else {
          console.warn('Неизвестный формат ответа:', response);
          // Используем жестко заданные группы
          const hardcodedGroups = [
            {
              "id": 2,
              "name": "12",
              "description": "123",
              "created_at": "2025-05-05T22:04:15.178735Z",
              "updated_at": "2025-05-05T22:04:15.178735Z"
            },
            {
              "id": 1,
              "name": "123123",
              "description": "",
              "created_at": "2025-05-05T21:25:38.626840Z",
              "updated_at": "2025-05-05T21:25:38.626840Z"
            }
          ];
          
          console.log('Используем жестко заданные группы:', hardcodedGroups);
          setMuscleGroups(hardcodedGroups);
        }
      } catch (apiError) {
        console.error('Ошибка API при загрузке групп мышц:', apiError);
        
        // Если API не работает, используем данные из запроса напрямую
        const hardcodedGroups = [
          {
            "id": 2,
            "name": "12",
            "description": "123",
            "created_at": "2025-05-05T22:04:15.178735Z",
            "updated_at": "2025-05-05T22:04:15.178735Z"
          },
          {
            "id": 1,
            "name": "123123",
            "description": "",
            "created_at": "2025-05-05T21:25:38.626840Z",
            "updated_at": "2025-05-05T21:25:38.626840Z"
          }
        ];
        
        console.log('Используем жестко заданные группы из-за ошибки:', hardcodedGroups);
        setMuscleGroups(hardcodedGroups);
      }
    } catch (error) {
      console.error('Общая ошибка при загрузке групп мышц:', error);
      setMuscleGroups([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Фильтрация групп мышц по поисковому запросу
  const filteredGroups = React.useMemo(() => {
    if (!muscleGroups) return [];
    
    // Фильтруем уже выбранные группы мышц
    const availableGroups = muscleGroups.filter(group => 
      !selectedGroups?.some(selected => selected.id === group.id)
    );

    if (!searchTerm) return availableGroups;

    const lowerSearchTerm = searchTerm.toLowerCase();
    
    // Группы, у которых совпадения в названии
    const nameMatches = availableGroups.filter(group =>
      group.name.toLowerCase().includes(lowerSearchTerm)
    );
    
    // Группы, у которых совпадения только в описании
    const descriptionMatches = availableGroups.filter(group =>
      group.description?.toLowerCase().includes(lowerSearchTerm) &&
      !group.name.toLowerCase().includes(lowerSearchTerm)
    );
    
    // Объединяем результаты: сначала совпадения в названии, затем в описании
    return [...nameMatches, ...descriptionMatches];
  }, [muscleGroups, selectedGroups, searchTerm]);
  
  // Логирование для отладки
  useEffect(() => {
    console.log('Текущие группы мышц:', muscleGroups);
    console.log('Отфильтрованные группы:', filteredGroups);
  }, [muscleGroups, filteredGroups]);
  
  // Логирование перед рендером
  console.log("Рендер списка групп:", filteredGroups);
  
  // Дополнительное логирование для отладки
  console.log("API_URL:", `${API_URL}${WORKOUT_API_PREFIX}/muscle-groups`);
  
  // Обработчик открытия диалога
  const handleOpen = React.useCallback(() => {
    setOpen(true);
  }, []);
  
  // Закрытие диалога
  const handleClose = React.useCallback(() => {
    setOpen(false);
    setSelectedGroup(null);
    setSearchTerm('');
  }, []);
  
  // Выбор группы мышц для просмотра деталей
  const handleGroupSelect = React.useCallback((group: MuscleGroup) => {
    setSelectedGroup(group);
  }, []);
  
  // Возврат к списку групп
  const handleBackToList = React.useCallback(() => {
    setSelectedGroup(null);
  }, []);
  
  // Добавление группы мышц в выбранные
  const handleAddGroup = React.useCallback((group: MuscleGroup) => {
    // Проверяем, не выбрана ли уже эта группа
    if (!selectedGroups?.some(g => g.id === group.id)) {
      const newSelectedGroups = [...(selectedGroups || []), group];
      onGroupsChange(newSelectedGroups);
    }
    handleClose();
  }, [selectedGroups, onGroupsChange, handleClose]);
  
  // Удаление группы мышц из выбранных
  const handleRemoveGroup = React.useCallback((groupId: number) => {
    if (!selectedGroups) return;
    const newSelectedGroups = selectedGroups.filter(g => g.id !== groupId);
    onGroupsChange(newSelectedGroups);
  }, [selectedGroups, onGroupsChange]);

  // Обработчик изменения поискового запроса
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };
  
  // Мемоизируем компонент списка групп для поиска
  const searchGroupsList = React.useMemo(() => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', bgcolor: theme.palette.backgrounds?.default }}>
          <CircularProgress sx={{ color: theme.palette.highlight?.main }} />
        </Box>
      );
    }
    
    if (selectedGroup) {
      return null;
    }
    
    return (
      <Box sx={{ bgcolor: theme.palette.backgrounds?.default, minHeight: '100vh' }}>
        <Box sx={{ p: 2 }}>
          {filteredGroups && filteredGroups.length > 0 ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1 }}>
              {filteredGroups.map((group) => (
                <Box 
                  key={group.id}
                  onClick={() => handleGroupSelect(group)}
                  sx={{
                    bgcolor: theme.palette.backgrounds?.paper,
                    borderRadius: '12px',
                    p: 2,
                    cursor: 'pointer',
                    width: 'calc(50% - 12px)',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                      bgcolor: theme.palette.backgrounds?.paper + 'CC'
                    }
                  }}
                >
                  <Typography 
                    sx={{ 
                      color: theme.palette.textColors?.primary,
                      fontWeight: 'bold',
                      fontSize: '1rem',
                      mb: 0.5
                    }}
                  >
                    {group.name}
                  </Typography>
                  
                  {group.description && (
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: theme.palette.textColors?.secondary,
                        fontSize: '0.875rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}
                    >
                      {group.description.length > 70 
                        ? `${group.description.substring(0, 70)}...` 
                        : group.description}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ 
              p: 4, 
              textAlign: 'center', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              justifyContent: 'center',
              height: '50vh'
            }}>
              <Typography 
                sx={{ 
                  color: theme.palette.textColors?.secondary,
                  mb: 2,
                  fontSize: '1rem'
                }}
              >
                {searchTerm 
                  ? `Группы мышц не найдены по запросу "${searchTerm}"` 
                  : muscleGroups?.length 
                    ? 'Нет доступных групп мышц' 
                    : 'Ошибка загрузки групп мышц. Попробуйте позже.'}
              </Typography>
              
              {searchTerm && (
                <Button
                  variant="outlined"
                  onClick={() => setSearchTerm('')}
                  sx={{ 
                    borderColor: theme.palette.highlight?.main,
                    color: theme.palette.highlight?.main,
                    mt: 2,
                    '&:hover': {
                      borderColor: theme.palette.highlight?.accent,
                      bgcolor: 'rgba(255, 140, 0, 0.1)'
                    }
                  }}
                >
                  Очистить поиск
                </Button>
              )}
            </Box>
          )}
        </Box>
      </Box>
    );
  }, [
    loading, 
    selectedGroup, 
    filteredGroups, 
    theme, 
    handleGroupSelect, 
    searchTerm, 
    muscleGroups, 
    setSearchTerm
  ]);

  // Мемоизируем детальное представление группы мышц
  const groupDetailView = React.useMemo(() => {
    if (!selectedGroup) return null;
    
    return (
      <Box sx={{ p: 3, bgcolor: theme.palette.backgrounds?.default, minHeight: '100vh' }}>
        <Typography 
          variant="h5" 
          sx={{ 
            color: theme.palette.textColors?.primary,
            fontWeight: 'bold',
            mb: 1.5,
            mt: 2
          }}
        >
          {selectedGroup.name}
        </Typography>
        
        <Box 
          sx={{ 
            p: 2.5, 
            bgcolor: theme.palette.backgrounds?.paper, 
            borderRadius: theme.borderRadius.small,
            mb: 3
          }}
        >
          <Typography 
            variant="h6" 
            gutterBottom 
            sx={{ 
              color: theme.palette.textColors?.primary,
              fontWeight: 'medium',
              mb: 1
            }}
          >
            Описание
          </Typography>
          
          {selectedGroup.description ? (
            <Typography 
              variant="body1" 
              sx={{ 
                color: theme.palette.textColors?.secondary,
                lineHeight: 1.6
              }}
            >
              {selectedGroup.description}
            </Typography>
          ) : (
            <Typography 
              variant="body1" 
              sx={{ 
                color: theme.palette.textColors?.secondary,
                fontStyle: 'italic'
              }}
            >
              Описание отсутствует
            </Typography>
          )}
        </Box>
        
        <Button
          variant="contained"
          onClick={() => handleAddGroup(selectedGroup)}
          sx={{ 
            bgcolor: theme.palette.highlight?.main,
            color: theme.palette.textColors?.primary,
            fontWeight: 'medium',
            px: 3,
            py: 1.5,
            borderRadius: '12px',
            width: '100%',
            mt: 2,
            '&:hover': {
              bgcolor: theme.palette.highlight?.accent
            }
          }}
        >
          Добавить группу
        </Button>
      </Box>
    );
  }, [selectedGroup, theme, handleAddGroup]);
  
  return (
    <>
      <Paper 
        sx={{ 
          p: 2, 
          mb: 3, 
          borderRadius: theme.borderRadius.small,
          bgcolor: theme.palette.backgrounds?.paper,
          boxShadow: theme.customShadows.light
        }}
      >
        <Typography variant="h6" fontWeight="medium" sx={{ mb: 2, color: theme.palette.textColors?.primary }}>
          Группы мышц
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          {selectedGroups && selectedGroups.length > 0 ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {selectedGroups.map(group => (
                <Chip
                  key={group.id}
                  label={group.name}
                  onDelete={() => handleRemoveGroup(group.id)}
                  sx={{ 
                    bgcolor: theme.palette.highlight?.main, 
                    color: theme.palette.textColors?.primary,
                    mb: 1,
                    borderRadius: '16px',
                    fontWeight: 'medium',
                    py: 0.5,
                    '& .MuiChip-deleteIcon': {
                      color: theme.palette.textColors?.primary,
                      opacity: 0.8,
                      '&:hover': {
                        opacity: 1,
                        color: theme.palette.textColors?.primary
                      }
                    }
                  }}
                />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" sx={{ color: theme.palette.textColors?.secondary, mb: 2 }}>
              Выберите группы мышц для тренировки
            </Typography>
          )}
        </Box>
        
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpen}
          sx={{ 
            borderRadius: '12px',
            bgcolor: theme.palette.highlight?.main,
            color: theme.palette.textColors?.primary,
            width: '100%',
            py: 1,
            '&:hover': {
              bgcolor: theme.palette.highlight?.accent
            }
          }}
        >
          Добавить группу мышц
        </Button>
      </Paper>
      
      {/* Добавляем компонент распределения процентов, если есть выбранные группы */}
      {selectedGroups && selectedGroups.length > 0 && (
        <MuscleGroupDistribution 
          muscleGroups={selectedGroups} 
          onDistributionChange={handleDistributionChange}
        />
      )}
      
      <Dialog
        fullScreen
        open={open}
        onClose={handleClose}
        sx={{
          '& .MuiDialog-paper': {
            bgcolor: theme.palette.backgrounds?.default
          }
        }}
      >
        <AppBar position="sticky" color="inherit" elevation={0} sx={{ bgcolor: theme.palette.backgrounds?.default }}>
          <Toolbar sx={{ p: 0 }}>
            {!selectedGroup ? (
              <Box sx={{ width: '100%' }}>
                <SearchBar
                  isSearchBarVisible={true}
                  isAtTop={true}
                  showBackButton={true}
                  showProfileButton={false}
                  showFilterButton={false}
                  showSettingsButton={false}
                  showCreateButton={false}
                  placeholder="Поиск групп мышц..."
                  onBackClick={handleClose}
                  onSearchChange={setSearchTerm}
                  searchValue={searchTerm}
                />
              </Box>
            ) : (
              <Box sx={{ width: '100%' }}>
                <SearchBar
                  isSearchBarVisible={true}
                  isAtTop={true}
                  showBackButton={true}
                  showProfileButton={false}
                  showFilterButton={false}
                  showSettingsButton={false}
                  showCreateButton={false}
                  showSearchField={false}
                  title={selectedGroup.name}
                  onBackClick={handleBackToList}
                />
              </Box>
            )}
          </Toolbar>
        </AppBar>
        
        {searchGroupsList}
        
        {groupDetailView}
      </Dialog>
    </>
  );
};

export default MuscleGroupSelector; 