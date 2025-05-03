"use client";

import React, { useState, useEffect } from 'react';
import { 
  useTheme, 
  Box, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemText,
  Collapse,
  IconButton,
  Button,
  Stack,
  Divider,
  Snackbar,
  Alert
} from '@mui/material';
import { useRouter } from 'next/navigation';
import MainLayout from '@/app/components/layouts/MainLayout';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AddIcon from '@mui/icons-material/Add';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EditIcon from '@mui/icons-material/Edit';
import MuscleGroupDialog from '@/app/components/muscle-groups/MuscleGroupDialog';
import ExerciseDialog from '@/app/components/exercises/ExerciseDialog';
import AdminGuard from '@/app/components/auth/AdminGuard';
import { useAuth } from '@/app/hooks/useAuth';
import { muscleGroupsApi, exercisesApi, MuscleGroup, MuscleGroupCreate, MuscleGroupUpdate, Exercise, ExerciseCreate, ExerciseUpdate, MuscleGroupEnum } from '../services/api';
import { useIsAdmin } from '@/app/hooks/useIsAdmin';

// Расширение типа MuscleGroup для работы с упражнениями на фронтенде
interface MuscleGroupWithExercises extends MuscleGroup {
  exercises: Exercise[];
}

export default function ExercisePoolPage() {
  const theme = useTheme();
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroupWithExercises[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Состояние для отслеживания открытых групп
  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>({});
  
  // Состояние для модального окна группы мышц
  const [muscleGroupDialogOpen, setMuscleGroupDialogOpen] = useState(false);
  const [editingMuscleGroup, setEditingMuscleGroup] = useState<MuscleGroup | null>(null);
  const [isCreatingMuscleGroup, setIsCreatingMuscleGroup] = useState(false);
  
  // Состояние для модального окна упражнения
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [isCreatingExercise, setIsCreatingExercise] = useState(false);
  const [selectedMuscleGroupId, setSelectedMuscleGroupId] = useState<number | null>(null);
  
  // Состояние для уведомлений
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('info');
  
  // Загрузка групп мышц при монтировании компонента
  useEffect(() => {
    fetchMuscleGroups();
  }, []);
  
  // Перенаправляем не-админов на главную страницу
  useEffect(() => {
    if (!isAdmin) {
      router.push('/');
    }
  }, [isAdmin, router]);
  
  // Функция для загрузки групп мышц с сервера
  const fetchMuscleGroups = async () => {
    setLoading(true);
    setError('');
    try {
      const groups = await muscleGroupsApi.getAll();
      
      // Преобразуем группы в формат с упражнениями
      const groupsWithExercises = await Promise.all(
        groups.map(async (group) => {
          try {
            const exercises = await muscleGroupsApi.getExercises(group.id);
            return { ...group, exercises: exercises || [] };
          } catch (err) {
            console.error(`Ошибка при загрузке упражнений для группы ${group.id}:`, err);
            return { ...group, exercises: [] };
          }
        })
      );
      
      setMuscleGroups(groupsWithExercises);
    } catch (err: any) {
      console.error('Ошибка при загрузке групп мышц:', err);
      setError(err.message || 'Ошибка при загрузке групп мышц');
    } finally {
      setLoading(false);
    }
  };
  
  // Функция для добавления нового упражнения
  const handleAddExercise = () => {
    if (!isAdmin) {
      setSnackbarMessage('Только администраторы могут добавлять упражнения');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
      return;
    }
    
    // Переход на страницу создания нового упражнения
    router.push('/exercise/new');
  };

  const handleCloseSnackbar = () => {
    setOpenSnackbar(false);
  };
  
  // Функция для показа уведомления
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setOpenSnackbar(true);
  };
  
  // Обработчик для закрытия уведомления
  const handleSnackbarClose = () => {
    setOpenSnackbar(false);
  };
  
  // Обработчик для открытия/закрытия группы мышц
  const handleToggleGroup = (groupId: number) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };
  
  // Обработчик для кнопки "назад"
  const handleBack = () => {
    router.push('/trainings');
  };
  
  // Обработчик для перехода к настройкам упражнения
  const handleExerciseSettings = (exercise: Exercise) => {
    // При создании или в модальном окне
    if (isCreatingExercise || exerciseDialogOpen) {
      setEditingExercise(exercise);
      setIsCreatingExercise(false);
      setExerciseDialogOpen(true);
    } else {
      // Переход на страницу редактирования упражнения
      router.push(`/exercise/${exercise.exercise_id}`);
    }
  };
  
  // Обработчик для добавления нового упражнения в группу
  const handleAddExerciseToGroup = (groupId: number) => {
    if (!isAdmin) {
      showSnackbar('У вас нет прав для добавления упражнений', 'error');
      return;
    }
    
    setSelectedMuscleGroupId(groupId);
    setEditingExercise(null);
    setIsCreatingExercise(true);
    setExerciseDialogOpen(true);
  };
  
  // Обработчик для открытия модального окна добавления группы мышц
  const handleAddMuscleGroup = () => {
    if (!isAdmin) {
      showSnackbar('У вас нет прав для добавления групп мышц', 'error');
      return;
    }
    
    setIsCreatingMuscleGroup(true);
    setEditingMuscleGroup(null);
    setMuscleGroupDialogOpen(true);
  };
  
  // Обработчик для открытия модального окна редактирования группы мышц
  const handleEditMuscleGroup = (group: MuscleGroup, e: React.MouseEvent) => {
    e.stopPropagation(); // Предотвращаем открытие/закрытие группы
    
    if (!isAdmin) {
      showSnackbar('У вас нет прав для редактирования групп мышц', 'error');
      return;
    }
    
    setIsCreatingMuscleGroup(false);
    setEditingMuscleGroup(group);
    setMuscleGroupDialogOpen(true);
  };
  
  // Обработчик для сохранения группы мышц (создание или обновление)
  const handleSaveMuscleGroup = async (data: MuscleGroupCreate | MuscleGroupUpdate) => {
    try {
      if (isCreatingMuscleGroup) {
        // Создание новой группы
        const newGroup = await muscleGroupsApi.create(data as MuscleGroupCreate);
        setMuscleGroups(prev => [...prev, { ...newGroup, exercises: [] }]);
        showSnackbar('Группа мышц успешно создана');
      } else if (editingMuscleGroup) {
        if (!editingMuscleGroup.id) {
          throw new Error('ID группы мышц не определен');
        }
        
        // Обновление существующей группы
        const updatedGroup = await muscleGroupsApi.update(editingMuscleGroup.id, data);
        setMuscleGroups(prev => 
          prev.map(group => 
            group.id === editingMuscleGroup.id 
              ? { ...updatedGroup, exercises: group.exercises } 
              : group
          )
        );
        showSnackbar('Группа мышц успешно обновлена');
      }
    } catch (err: any) {
      console.error('Ошибка при сохранении группы мышц:', err);
      showSnackbar(err.message || 'Ошибка при сохранении группы мышц', 'error');
      throw err;
    }
  };
  
  // Обработчик для удаления группы мышц
  const handleDeleteMuscleGroup = async () => {
    if (!editingMuscleGroup) return;
    
    try {
      await muscleGroupsApi.delete(editingMuscleGroup.id);
      setMuscleGroups(prev => prev.filter(group => group.id !== editingMuscleGroup.id));
      showSnackbar('Группа мышц успешно удалена');
    } catch (err: any) {
      console.error('Ошибка при удалении группы мышц:', err);
      showSnackbar(err.message || 'Ошибка при удалении группы мышц', 'error');
      throw err;
    }
  };

  // Обработчик для сохранения упражнения (создание или обновление)
  const handleSaveExercise = async (data: ExerciseCreate | ExerciseUpdate) => {
    try {
      if (isCreatingExercise) {

        if (selectedMuscleGroupId) {
          const selectedGroup = muscleGroups.find(g => g.id === selectedMuscleGroupId);
          if (selectedGroup) {
            (data as ExerciseCreate).muscle_group_id = selectedMuscleGroupId;
          }
        }
        
        const newExercise = await exercisesApi.create(data as ExerciseCreate);
        
        // Обновляем список групп мышц с новым упражнением
        setMuscleGroups(prev => 
          prev.map(group => {
            if (group.id === newExercise.muscle_group_id) {
              return {
                ...group,
                exercises: [...group.exercises, newExercise]
              };
            }
            return group;
          })
        );
        
        // Открываем группу, в которую добавлено упражнение
        if (newExercise.muscle_group_id) {
          setOpenGroups(prev => ({
            ...prev,
            [newExercise.muscle_group_id]: true
          }));
        }
        
        showSnackbar('Упражнение успешно создано');
      } else if (editingExercise) {
        // Обновление существующего упражнения
        const updatedExercise = await exercisesApi.update(
          editingExercise.exercise_id,
          data as ExerciseUpdate
        );
        
        // Проверяем, изменилась ли группа мышц
        const oldGroupId = editingExercise.muscle_group_id;
        const newGroupId = updatedExercise.muscle_group_id;
        
        if (oldGroupId !== newGroupId) {
          // Перемещаем упражнение из одной группы в другую
          setMuscleGroups(prev => 
            prev.map(group => {
              if (group.id === oldGroupId) {
                // Удаляем из старой группы
                return {
                  ...group,
                  exercises: group.exercises.filter(ex => 
                    ex.exercise_id !== updatedExercise.exercise_id
                  )
                };
              } else if (group.id === newGroupId) {
                // Добавляем в новую группу
                return {
                  ...group,
                  exercises: [...group.exercises, updatedExercise]
                };
              }
              return group;
            })
          );
          
          // Открываем новую группу
          if (newGroupId) {
            setOpenGroups(prev => ({
              ...prev,
              [newGroupId]: true
            }));
          }
        } else {
          // Обновляем упражнение в текущей группе
          setMuscleGroups(prev => 
            prev.map(group => {
              if (group.id === updatedExercise.muscle_group_id) {
                return {
                  ...group,
                  exercises: group.exercises.map(ex => 
                    ex.exercise_id === updatedExercise.exercise_id ? updatedExercise : ex
                  )
                };
              }
              return group;
            })
          );
        }
        
        showSnackbar('Упражнение успешно обновлено');
      }
    } catch (err: any) {
      console.error('Ошибка при сохранении упражнения:', err);
      showSnackbar(err.message || 'Ошибка при сохранении упражнения', 'error');
      throw err;
    }
  };
  
  // Обработчик для удаления упражнения
  const handleDeleteExercise = async () => {
    if (!editingExercise) return;
    
    try {
      await exercisesApi.delete(editingExercise.exercise_id);
      
      // Удаляем упражнение из списка
      setMuscleGroups(prev => 
        prev.map(group => {
          if (group.id === editingExercise.muscle_group_id) {
            return {
              ...group,
              exercises: group.exercises.filter(ex => ex.exercise_id !== editingExercise.exercise_id)
            };
          }
          return group;
        })
      );
      
      showSnackbar('Упражнение успешно удалено');
    } catch (err: any) {
      console.error('Ошибка при удалении упражнения:', err);
      showSnackbar(err.message || 'Ошибка при удалении упражнения', 'error');
      throw err;
    }
  };

  // Отображение компонентов для редактирования только администраторам
  const renderAdminControls = (group: MuscleGroupWithExercises) => {
    if (!isAdmin) return null;

    return (
      <Box>
        <IconButton 
          edge="end" 
          onClick={(e) => handleEditMuscleGroup(group, e)}
          sx={{ color: theme.palette.textColors?.secondary, mr: 1 }}
        >
          <EditIcon />
        </IconButton>
        <IconButton 
          edge="end" 
          onClick={() => handleToggleGroup(group.id)}
          sx={{ color: theme.palette.highlight?.main }}
        >
          {openGroups[group.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
    );
  };

  // Не рендерим компонент, если пользователь не админ
  if (!isAdmin) {
    return null;
  }

  return (
    <MainLayout>
      <Stack spacing={2}>
        {/* Заголовок с кнопкой назад */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          mb: 1 
        }}>
          <IconButton 
            onClick={handleBack}
            sx={{ color: theme.palette.textColors?.primary }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ 
            flexGrow: 1, 
            textAlign: 'center', 
            fontWeight: 'bold',
            color: theme.palette.textColors?.primary,
            fontSize: '1.2rem',
            mr: 4
          }}>
            Пул упражнений
          </Box>
        </Box>
        
        <Divider sx={{ bgcolor: theme.palette.backgrounds?.paper }} />
        
        {/* Сообщение об ошибке, если есть */}
        {error && (
          <Box sx={{ 
            backgroundColor: 'rgba(255, 0, 0, 0.1)', 
            color: '#ff6b6b', 
            p: 2, 
            borderRadius: 1,
            mb: 2
          }}>
            {error}
          </Box>
        )}
        
        {/* Список групп мышц */}
        <List sx={{ width: '100%', p: 0 }}>
          {loading ? (
            <Box sx={{ textAlign: 'center', color: theme.palette.textColors?.secondary, py: 4 }}>
              Загрузка групп мышц...
            </Box>
          ) : muscleGroups.length === 0 ? (
            <Box sx={{ textAlign: 'center', color: theme.palette.textColors?.secondary, py: 4 }}>
              Нет доступных групп мышц. Добавьте первую группу!
            </Box>
          ) : (
            muscleGroups.map((group) => (
              <React.Fragment key={group.id}>
                {/* Заголовок группы мышц */}
                <ListItem 
                  disablePadding
                  secondaryAction={renderAdminControls(group)}
                  sx={{ 
                    bgcolor: theme.palette.backgrounds?.paper,
                    borderRadius: 1,
                    mb: 1
                  }}
                >
                  <ListItemButton onClick={() => handleToggleGroup(group.id)}>
                    <ListItemText 
                      primary={group.name} 
                      sx={{ 
                        color: theme.palette.textColors?.primary,
                        '& .MuiListItemText-primary': {
                          fontWeight: 'bold'
                        }
                      }} 
                    />
                  </ListItemButton>
                </ListItem>
                
                {/* Список упражнений в группе */}
                <Collapse in={openGroups[group.id]} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding sx={{ mb: 2 }}>
                    {group.exercises.length === 0 ? (
                      <Box sx={{ 
                        textAlign: 'center', 
                        color: theme.palette.textColors?.secondary, 
                        py: 1,
                        fontSize: '0.9rem'
                      }}>
                        Нет упражнений в этой группе
                      </Box>
                    ) : (
                      group.exercises.map((exercise) => (
                        <ListItem 
                          key={exercise.exercise_id}
                          disablePadding
                          sx={{ pl: 2 }}
                        >
                          <ListItemButton 
                            onClick={() => router.push(`/exercise/${exercise.exercise_id}`)}
                            sx={{ 
                              pl: 2,
                              borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                              ml: 2,
                              borderRadius: 1,
                              mb: 0.5,
                              bgcolor: 'rgba(255, 255, 255, 0.03)',
                              display: 'flex',
                              justifyContent: 'space-between'
                            }}
                          >
                            <ListItemText 
                              primary={exercise.title} 
                              sx={{ 
                                color: theme.palette.textColors?.primary 
                              }} 
                            />
                            <ChevronRightIcon 
                              sx={{ 
                                color: theme.palette.textColors?.secondary,
                                fontSize: '1.2rem'
                              }} 
                            />
                          </ListItemButton>
                        </ListItem>
                      ))
                    )}
                    
                    {/* Кнопка добавления упражнения (только для админов) */}
                    {isAdmin && (
                      <ListItem 
                        disablePadding
                        sx={{ pl: 4 }}
                      >
                        <Button
                          startIcon={<AddIcon />}
                          onClick={() => handleAddExerciseToGroup(group.id)}
                          sx={{
                            color: theme.palette.highlight?.main,
                            textTransform: 'none',
                            fontWeight: 'normal',
                            mt: 1,
                            '&:hover': {
                              bgcolor: 'rgba(255, 255, 255, 0.05)'
                            }
                          }}
                        >
                          Добавить упражнение
                        </Button>
                      </ListItem>
                    )}
                  </List>
                </Collapse>
              </React.Fragment>
            ))
          )}
        </List>
        
        {/* Кнопка добавления группы мышц (только для админов) */}
        {isAdmin && (
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            onClick={handleAddMuscleGroup}
            sx={{
              color: theme.palette.highlight?.main,
              borderColor: theme.palette.highlight?.main,
              textTransform: 'none',
              borderRadius: '20px',
              alignSelf: 'center',
              mt: 2,
              '&:hover': {
                borderColor: theme.palette.highlight?.accent,
                bgcolor: 'rgba(255, 255, 255, 0.05)'
              }
            }}
          >
            Добавить группу мышц
          </Button>
        )}
      </Stack>
      
      {/* Диалог для группы мышц */}
      <MuscleGroupDialog 
        open={muscleGroupDialogOpen}
        onClose={() => setMuscleGroupDialogOpen(false)}
        onSave={handleSaveMuscleGroup}
        onDelete={handleDeleteMuscleGroup}
        muscleGroup={editingMuscleGroup}
        isCreate={isCreatingMuscleGroup}
      />
      
      {/* Диалог для упражнений */}
      <ExerciseDialog
        open={exerciseDialogOpen}
        onClose={() => setExerciseDialogOpen(false)}
        onSave={handleSaveExercise}
        onDelete={handleDeleteExercise}
        exercise={editingExercise}
        muscleGroups={muscleGroups}
        isCreate={isCreatingExercise}
      />
      
      {/* Уведомления */}
      <Snackbar 
        open={openSnackbar} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbarSeverity} 
          sx={{ width: '100%', borderRadius: '20px' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </MainLayout>
  );
} 