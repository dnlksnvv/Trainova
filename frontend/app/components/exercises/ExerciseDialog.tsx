"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField,
  Typography,
  Box,
  useTheme,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import { Exercise, ExerciseCreate, ExerciseUpdate, MuscleGroup, MuscleGroupEnum, exercisesApi, muscleGroupsApi } from '@/app/services/api';
import { GifUploader } from '@/app/components/exercises/GifUploader';

interface ExerciseDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: ExerciseCreate | ExerciseUpdate) => Promise<void>;
  onDelete?: () => Promise<void>;
  exercise?: Exercise | null;
  muscleGroups: MuscleGroup[];
  isCreate?: boolean;
}

export default function ExerciseDialog({
  open,
  onClose,
  onSave,
  onDelete,
  exercise,
  muscleGroups,
  isCreate = false
}: ExerciseDialogProps) {
  const theme = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [muscleGroupId, setMuscleGroupId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gifUuid, setGifUuid] = useState<string | null>(null);
  const [selectedGifFile, setSelectedGifFile] = useState<File | null>(null);
  
  // Загрузка групп мышц
  const fetchMuscleGroups = useCallback(async () => {
    try {
      if (muscleGroups.length === 0) {
        const response = await muscleGroupsApi.getAll();
        if (response) {
          // Убираем setMuscleGroups, так как muscleGroups теперь приходят из props
          // setMuscleGroups(response);
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке групп мышц:', error);
      setError('Не удалось загрузить группы мышц');
    }
  }, [muscleGroups]);

  // Вызываем fetchMuscleGroups при монтировании компонента
  useEffect(() => {
    fetchMuscleGroups();
  }, [fetchMuscleGroups]);

  // Инициализация формы при открытии диалога
  useEffect(() => {
    if (open) {
      if (exercise && !isCreate) {
        setTitle(exercise.title || '');
        setDescription(exercise.description || '');
        setMuscleGroupId(exercise.muscle_group_id || null);
        setGifUuid(exercise.gif_uuid || null);
      } else {
        resetForm();
      }
    }
  }, [open, exercise, isCreate]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setMuscleGroupId(null);
    setGifUuid(null);
    setSelectedGifFile(null);
    setError('');
  };

  const handleSave = async () => {
    // Валидация полей
    let hasError = false;
    
    if (!title.trim()) {
      setError('Название упражнения обязательно');
      hasError = true;
    }
    
    if (!description.trim()) {
      setError('Описание упражнения обязательно');
      hasError = true;
    }
    
    if (muscleGroupId === null) {
      setError('Необходимо выбрать группу мышц из каталога');
      hasError = true;
    }
    
    if (hasError) return;

    setLoading(true);
    setError('');

    try {
      // Создаем объект данных для сохранения
      const data: ExerciseCreate | ExerciseUpdate = {
        title,
        description,
        muscle_group_id: muscleGroupId,
        gif_uuid: gifUuid || undefined
      };
      
      if (isCreate && selectedGifFile) {
        // Если создаем новое упражнение и есть GIF, используем метод с загрузкой GIF
        const createData = {
          title: title,
          description: description,
          muscle_group_id: muscleGroupId
        };
        
        const newExercise = await exercisesApi.createExerciseWithGif(createData, selectedGifFile);
        await onSave({...data, gif_uuid: newExercise.gif_uuid});
      } else {
        // Если редактируем, явно передаем gifUuid в data
        // Если gifUuid был очищен, переведем его в null для обновления в базе
        if (!isCreate && gifUuid === undefined) {
          const updateData: ExerciseUpdate = { ...data as ExerciseUpdate, gif_uuid: null };
          await onSave(updateData);
        } else {
          await onSave(data);
        }
      }
      
      resetForm();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при сохранении');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    
    setLoading(true);
    setError('');

    try {
      await onDelete();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при удалении');
    } finally {
      setLoading(false);
    }
  };

  const handleMuscleGroupIdChange = (event: SelectChangeEvent<string | number>) => {
    const value = event.target.value;
    
    // Правильная обработка разных типов значений
    let numericValue: number | null = null;
    
    if (value === '') {
      numericValue = null;
    } else if (typeof value === 'number') {
      numericValue = value;
    } else if (typeof value === 'string') {
      // Преобразуем строку в число
      numericValue = parseInt(value, 10);
      // Проверяем, что получилось валидное число
      if (isNaN(numericValue)) {
        numericValue = null;
      }
    }
    
    setMuscleGroupId(numericValue);
  };
  
  // Обработчик изменений в GIF
  const handleGifChange = (file: File | null, newGifUuid?: string) => {
    setSelectedGifFile(file);
    if (newGifUuid !== undefined) {
      setGifUuid(newGifUuid);
    }
  };
  
  // Обработчик ошибок GIF
  const handleGifError = (errorMessage: string) => {
    setError(errorMessage);
  };

  return (
    <Dialog
      open={open}
      onClose={!loading ? onClose : undefined}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          backgroundColor: theme.palette.backgrounds?.default,
          color: theme.palette.textColors?.primary,
          borderRadius: 2,
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        pb: 2
      }}>
        <Typography variant="h6">
          {isCreate ? 'Создание упражнения' : 'Редактирование упражнения'}
        </Typography>
        <IconButton 
          edge="end" 
          onClick={onClose}
          aria-label="close"
          sx={{ color: theme.palette.textColors?.secondary }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 2, mt: 1 }}>
        {error && (
          <Typography color="error" variant="body2" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {/* Название */}
          <TextField
            label="Название"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={error.includes('Название')}
            required
            sx={{
              '& .MuiOutlinedInput-root': {
                color: theme.palette.textColors?.primary,
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
              },
              '& .MuiInputLabel-root': {
                color: theme.palette.textColors?.secondary,
              }
            }}
          />
          
          {/* Описание */}
          <TextField
            label="Описание"
            fullWidth
            multiline
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={error.includes('Описание')}
            required
            sx={{
              '& .MuiOutlinedInput-root': {
                color: theme.palette.textColors?.primary,
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
              },
              '& .MuiInputLabel-root': {
                color: theme.palette.textColors?.secondary,
              }
            }}
          />
          
          {/* Группа мышц */}
          <FormControl 
            fullWidth
            required
            error={error.includes('мышц')}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: theme.palette.textColors?.primary,
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
              },
              '& .MuiInputLabel-root': {
                color: theme.palette.textColors?.secondary,
              }
            }}
          >
            <InputLabel id="muscle-group-label">Группа мышц</InputLabel>
            <Select
              labelId="muscle-group-label"
              value={muscleGroupId === null ? '' : muscleGroupId}
              onChange={handleMuscleGroupIdChange}
              label="Группа мышц"
            >
              {muscleGroups.map((group) => (
                <MenuItem key={group.id} value={group.id}>
                  {group.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {/* GIF-анимация */}
          <GifUploader 
            gifUuid={gifUuid || undefined}
            exerciseId={exercise?.exercise_id}
            isCreate={isCreate}
            onGifChange={handleGifChange}
            onError={handleGifError}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        {!isCreate && onDelete && (
          <Button 
            onClick={handleDelete}
            color="error"
            disabled={loading}
            startIcon={<DeleteIcon />}
            sx={{
              mr: 'auto',
              textTransform: 'none',
              borderRadius: '20px',
            }}
          >
            Удалить
          </Button>
        )}
        <Button 
          onClick={onClose}
          sx={{
            color: theme.palette.textColors?.secondary,
            borderRadius: '20px',
            textTransform: 'none',
          }}
          disabled={loading}
        >
          Отменить
        </Button>
        <Button 
          onClick={handleSave}
          variant="contained"
          sx={{
            bgcolor: theme.palette.highlight?.main,
            '&:hover': {
              bgcolor: theme.palette.highlight?.accent,
            },
            borderRadius: '20px',
            textTransform: 'none',
          }}
          disabled={loading}
        >
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <CircularProgress size={16} sx={{ mr: 1, color: 'white' }} />
              Сохранение...
            </Box>
          ) : (
            'Сохранить'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
} 