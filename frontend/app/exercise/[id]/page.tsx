"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  useTheme, 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Stack, 
  Divider, 
  IconButton, 
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Snackbar,
  Alert,
  Paper,
  styled
} from '@mui/material';
import { useRouter } from 'next/navigation';
import MainLayout from '@/app/components/layouts/MainLayout';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import UploadIcon from '@mui/icons-material/Upload';
import ClearIcon from '@mui/icons-material/Clear';
import { exercisesApi, muscleGroupsApi, Exercise, ExerciseUpdate, MuscleGroup, MuscleGroupEnum } from '@/app/services/api';
import { useAuth } from '@/app/hooks/useAuth';
import AdminGuard from '@/app/components/auth/AdminGuard';

interface PageProps {
  params: {
    id: string;
  };
}

// Styled component для загрузки файла
const UploadInput = styled('input')({
  display: 'none',
});

export default function ExerciseDetailPage({ params }: PageProps) {
  const theme = useTheme();
  const router = useRouter();
  const { isAdmin } = useAuth();
  
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Состояние для уведомлений
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  
  // Состояние формы
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroupEnum>(MuscleGroupEnum.OTHER);
  const [muscleGroupId, setMuscleGroupId] = useState<number | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  
  // Ref для input file
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Загрузка данных при монтировании компонента
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      
      try {
        const exerciseId = params.id;
        if (!exerciseId) {
          throw new Error('Некорректный ID упражнения');
        }
        
        // Параллельная загрузка упражнения и групп мышц
        const [exerciseData, muscleGroupsData] = await Promise.all([
          exercisesApi.getById(exerciseId),
          muscleGroupsApi.getAll()
        ]);
        
        setExercise(exerciseData);
        setMuscleGroups(muscleGroupsData);
        
        // Заполняем форму данными упражнения
        setName(exerciseData.title || '');
        setDescription(exerciseData.description || '');
        setMuscleGroupId(exerciseData.muscle_group_id || null);
        
        // Устанавливаем URL для GIF, если он есть
        if (exerciseData.gif_uuid) {
          setGifUrl(exercisesApi.getGifUrl(exerciseData.gif_uuid));
        }
      } catch (err: any) {
        console.error('Ошибка при загрузке данных:', err);
        setError(err.message || 'Ошибка при загрузке данных');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [params.id]);

  // Функция для показа уведомления
  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };
  
  // Обработчик для закрытия уведомления
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };
  
  // Обработчик для кнопки "назад"
  const handleBack = () => {
    router.push('/exercise-pool');
  };
  
  // Обработчик для загрузки GIF
  const handleUploadGif = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !exercise) {
      return;
    }
    
    const file = files[0];
    
    // Проверяем, что файл - GIF
    if (!file.type.startsWith('image/gif')) {
      showSnackbar('Пожалуйста, выберите GIF-файл', 'error');
      return;
    }
    
    setUploading(true);
    setError('');
    
    try {
      console.log('Загрузка GIF для упражнения:', exercise.exercise_id);
      const updatedExercise = await exercisesApi.uploadGif(exercise.exercise_id, file);
      console.log('Упражнение обновлено с GIF:', updatedExercise);
      
      // Обновляем локальное состояние полностью
      setExercise(updatedExercise);
      
      // Обновляем URL для GIF
      if (updatedExercise.gif_uuid) {
        const newGifUrl = exercisesApi.getGifUrl(updatedExercise.gif_uuid);
        setGifUrl(newGifUrl);
        console.log('Установлен новый URL для GIF:', newGifUrl);
      }
      
      showSnackbar('GIF-анимация успешно загружена');
    } catch (err: any) {
      console.error('Ошибка при загрузке GIF:', err);
      setError(err.message || 'Ошибка при загрузке GIF');
      showSnackbar(err.message || 'Ошибка при загрузке GIF', 'error');
    } finally {
      setUploading(false);
      // Сбрасываем input file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Обработчик для удаления GIF
  const handleDeleteGif = async () => {
    if (!exercise || !exercise.gif_uuid) {
      return;
    }
    
    setUploading(true);
    setError('');
    
    try {
      console.log('Удаление GIF для упражнения:', exercise.exercise_id);
      // Удаляем GIF
      const updatedExercise = await exercisesApi.deleteGif(exercise.exercise_id);
      console.log('Упражнение обновлено после удаления GIF:', updatedExercise);
      
      // Обновляем локальное состояние полностью
      setExercise(updatedExercise);
      setGifUrl(null);
      
      showSnackbar('GIF-анимация успешно удалена');
    } catch (err: any) {
      console.error('Ошибка при удалении GIF:', err);
      setError(err.message || 'Ошибка при удалении GIF');
      showSnackbar(err.message || 'Ошибка при удалении GIF', 'error');
    } finally {
      setUploading(false);
    }
  };
  
  // Обработчик для сохранения изменений
  const handleSave = async () => {
    if (!exercise) return;
    
    if (!isAdmin) {
      showSnackbar('У вас нет прав для редактирования упражнений', 'error');
      return;
    }
    
    if (!name.trim()) {
      setError('Название упражнения обязательно');
      return;
    }
    
    if (!description.trim()) {
      setError('Описание упражнения обязательно');
      return;
    }
    
    if (muscleGroupId === null || muscleGroupId === undefined) {
      setError('Необходимо выбрать группу мышц из каталога');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      // Подготавливаем данные для обновления
      const updateData: ExerciseUpdate = {
        title: name.trim(),
        description: description.trim(),
        muscle_group_id: muscleGroupId,
      };
      
      // Явно добавляем gif_uuid в данные обновления, даже если он null
      // Это важно, чтобы серверная часть знала, нужно ли сохранять или удалять GIF
      updateData.gif_uuid = exercise.gif_uuid;
      
      console.log('Обновление упражнения:', {
        exercise_id: exercise.exercise_id,
        updateData,
        gifUrl: gifUrl
      });
      
      const updatedExercise = await exercisesApi.update(exercise.exercise_id, updateData);
      console.log('Упражнение обновлено:', updatedExercise);
      
      // Показываем сообщение об успешном сохранении
      showSnackbar('Упражнение успешно обновлено');
      
      // Обновляем данные в состоянии компонента
      setExercise(updatedExercise);
      
      // Возвращаемся к списку упражнений
      setTimeout(() => {
        router.push('/exercise-pool');
      }, 1500);
    } catch (err: any) {
      console.error('Ошибка при сохранении упражнения:', err);
      setError(err.message || 'Ошибка при сохранении упражнения');
    } finally {
      setSaving(false);
    }
  };
  
  // Обработчик для удаления упражнения
  const handleDelete = async () => {
    if (!exercise) return;
    
    if (!isAdmin) {
      showSnackbar('У вас нет прав для удаления упражнений', 'error');
      return;
    }
    
    if (!confirm('Вы действительно хотите удалить упражнение?')) {
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      await exercisesApi.delete(exercise.exercise_id);
      
      // Показываем сообщение об успешном удалении
      showSnackbar('Упражнение успешно удалено');
      
      // Возвращаемся к списку упражнений
      setTimeout(() => {
        router.push('/exercise-pool');
      }, 1500);
    } catch (err: any) {
      console.error('Ошибка при удалении упражнения:', err);
      setError(err.message || 'Ошибка при удалении упражнения');
    } finally {
      setSaving(false);
    }
  };

  // Отображение формы для редактирования
  const renderEditForm = () => {
    if (loading) {
      return (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '300px' 
        }}>
          <CircularProgress sx={{ color: theme.palette.highlight?.main }} />
        </Box>
      );
    }

    if (!isAdmin) {
      // Для обычных пользователей показываем информацию без возможности редактирования
      return (
        <Box sx={{ p: 2 }}>
          <Stack spacing={3}>
            <Typography variant="h6" sx={{ color: theme.palette.textColors?.primary }}>
              {name}
            </Typography>
            
            <Typography 
              variant="body1" 
              sx={{ 
                color: theme.palette.textColors?.secondary,
                whiteSpace: 'pre-wrap'
              }}
            >
              {description}
            </Typography>
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ color: theme.palette.textColors?.secondary }}>
                Группа мышц: {muscleGroups.find(g => g.id === muscleGroupId)?.name || 
                  muscleGroup.charAt(0).toUpperCase() + muscleGroup.slice(1)}
              </Typography>
            </Box>
            
            {/* Отображение GIF если есть */}
            {gifUrl && (
              <Paper 
                elevation={2} 
                sx={{ 
                  p: 2, 
                  mt: 2, 
                  borderRadius: 2,
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  maxWidth: 'fit-content'
                }}
              >
                <Typography variant="subtitle2" sx={{ mb: 1, color: theme.palette.textColors?.secondary }}>
                  Анимация упражнения:
                </Typography>
                <Box 
                  component="img" 
                  src={gifUrl} 
                  alt={`Анимация ${name}`}
                  sx={{ 
                    maxWidth: '100%', 
                    height: 'auto',
                    borderRadius: 1,
                    maxHeight: '300px'
                  }}
                />
              </Paper>
            )}
          </Stack>
        </Box>
      );
    }

    // Для администраторов показываем форму редактирования
    return (
      <Box sx={{ p: 2 }}>
        <Stack spacing={3}>
          <TextField
            label="Название упражнения"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            variant="outlined"
            required
            sx={{ 
              '& .MuiOutlinedInput-root': {
                color: theme.palette.textColors?.primary,
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                },
                '&:hover fieldset': {
                  borderColor: theme.palette.highlight?.main,
                },
                '&.Mui-focused fieldset': {
                  borderColor: theme.palette.highlight?.main,
                },
              },
              '& .MuiInputLabel-root': {
                color: theme.palette.textColors?.secondary,
              },
            }}
          />
          
          <TextField
            label="Описание"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            required
            sx={{ 
              '& .MuiOutlinedInput-root': {
                color: theme.palette.textColors?.primary,
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                },
                '&:hover fieldset': {
                  borderColor: theme.palette.highlight?.main,
                },
                '&.Mui-focused fieldset': {
                  borderColor: theme.palette.highlight?.main,
                },
              },
              '& .MuiInputLabel-root': {
                color: theme.palette.textColors?.secondary,
              },
            }}
          />
          
          <FormControl 
            fullWidth 
            variant="outlined"
            required
            sx={{ 
              '& .MuiOutlinedInput-root': {
                color: theme.palette.textColors?.primary,
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                },
                '&:hover fieldset': {
                  borderColor: theme.palette.highlight?.main,
                },
                '&.Mui-focused fieldset': {
                  borderColor: theme.palette.highlight?.main,
                },
              },
              '& .MuiInputLabel-root': {
                color: theme.palette.textColors?.secondary,
              },
            }}
          >
            <InputLabel id="muscle-group-id-label">Группа мышц</InputLabel>
            <Select
              labelId="muscle-group-id-label"
              value={muscleGroupId === null ? '' : muscleGroupId}
              onChange={(e) => {
                const value = e.target.value;
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
              }}
              label="Группа мышц"
              required
            >
              <MenuItem value="">
                <em>Выберите группу мышц</em>
              </MenuItem>
              {muscleGroups.map((group) => (
                <MenuItem key={group.id} value={group.id}>
                  {group.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {/* Компонент для загрузки и отображения GIF */}
          <Paper
            elevation={2}
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'rgba(255, 255, 255, 0.05)',
            }}
          >
            <Typography variant="subtitle1" sx={{ mb: 2, color: theme.palette.textColors?.primary }}>
              GIF-анимация упражнения
            </Typography>
            
            {gifUrl ? (
              <Box sx={{ mb: 2 }}>
                <Box 
                  component="img" 
                  src={gifUrl} 
                  alt={`Анимация ${name}`}
                  sx={{ 
                    maxWidth: '100%', 
                    height: 'auto',
                    borderRadius: 1,
                    maxHeight: '300px',
                    mb: 2
                  }}
                />
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleDeleteGif}
                  disabled={uploading}
                  startIcon={<DeleteIcon />}
                  sx={{
                    textTransform: 'none',
                    borderRadius: '20px',
                  }}
                >
                  Удалить GIF
                </Button>
              </Box>
            ) : (
              <Box>
                <UploadInput
                  accept="image/gif"
                  id="gif-upload-input"
                  type="file"
                  ref={fileInputRef}
                  onChange={handleUploadGif}
                />
                <label htmlFor="gif-upload-input">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<UploadIcon />}
                    disabled={uploading}
                    sx={{
                      textTransform: 'none',
                      borderRadius: '20px',
                      borderColor: theme.palette.highlight?.main,
                      color: theme.palette.highlight?.main,
                      '&:hover': {
                        borderColor: theme.palette.highlight?.accent,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      },
                    }}
                  >
                    {uploading ? 'Загрузка...' : 'Загрузить GIF'}
                  </Button>
                </label>
                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: theme.palette.textColors?.secondary }}>
                  Загрузите GIF-анимацию для наглядной демонстрации упражнения
                </Typography>
              </Box>
            )}
          </Paper>
          
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            mt: 4,
            pt: 2,
            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDelete}
              disabled={saving || uploading}
              sx={{
                borderRadius: '20px',
                textTransform: 'none',
              }}
            >
              Удалить
            </Button>
            
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving || uploading}
              sx={{
                bgcolor: theme.palette.highlight?.main,
                '&:hover': {
                  bgcolor: theme.palette.highlight?.accent,
                },
                textTransform: 'none',
                borderRadius: '20px',
              }}
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </Box>
        </Stack>
      </Box>
    );
  };
  
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
            {loading ? 'Загрузка упражнения...' : `Упражнение: ${exercise?.title || ''}`}
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
        
        {/* Содержимое формы */}
        {renderEditForm()}
        
        {/* Уведомления */}
        <Snackbar 
          open={snackbarOpen} 
          autoHideDuration={6000} 
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            onClose={handleSnackbarClose} 
            severity={snackbarSeverity} 
            sx={{ width: '100%', borderRadius: '20px' }}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </Stack>
    </MainLayout>
  );
} 