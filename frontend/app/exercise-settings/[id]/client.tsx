"use client";

import React, { useState, useEffect } from 'react';
import { 
  useTheme, 
  Box, 
  TextField, 
  Button, 
  Stack, 
  IconButton, 
  Typography, 
  Divider,
  Paper,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@mui/material';
import { useRouter } from 'next/navigation';
import MainLayout from '@/app/components/layouts/MainLayout';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';

// Типы для упражнения
interface Exercise {
  id: number;
  name: string;
  description: string;
  gifUrl?: string;
}

interface ExerciseSettingsClientProps {
  id: string;
}

export default function ExerciseSettingsClient({ id }: ExerciseSettingsClientProps) {
  const theme = useTheme();
  const router = useRouter();
  const exerciseId = parseInt(id);
  
  // Состояние для данных упражнения
  const [exercise, setExercise] = useState<Exercise>({
    id: exerciseId,
    name: '',
    description: '',
    gifUrl: ''
  });
  
  // Состояние для файла
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  
  // Состояние для диалога подтверждения удаления
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Можно загрузить данные упражнения при монтировании компонента
  useEffect(() => {
    // В реальном приложении здесь будет запрос к API
    // Симулируем загрузку данных
    const mockExercises: Record<number, Exercise> = {
      101: { id: 101, name: 'Отжимания', description: 'Классические отжимания от пола', gifUrl: '' },
      102: { id: 102, name: 'Отжимания узким хватом', description: 'Отжимания с узкой постановкой рук', gifUrl: '' },
      501: { id: 501, name: 'Планка', description: 'Упражнение для укрепления кора', gifUrl: '' },
      502: { id: 502, name: 'Скручивания', description: 'Классические скручивания на пресс', gifUrl: '' },
      503: { id: 503, name: 'Обратные скручивания', description: 'Подъем ног при зафиксированной верхней части тела', gifUrl: '' },
      504: { id: 504, name: 'Твист', description: 'Скручивания корпуса с поворотом', gifUrl: '' },
    };
    
    if (mockExercises[exerciseId]) {
      setExercise(mockExercises[exerciseId]);
      if (mockExercises[exerciseId].gifUrl) {
        setPreviewUrl(mockExercises[exerciseId].gifUrl);
      }
    }
  }, [exerciseId]);
  
  // Обработчик для кнопки "назад"
  const handleBack = () => {
    router.back();
  };
  
  // Обработчик изменения полей формы
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setExercise(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Обработчик выбора файла
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      // Создаем предварительный URL для отображения
      const fileReader = new FileReader();
      fileReader.onload = () => {
        if (fileReader.result) {
          setPreviewUrl(fileReader.result as string);
        }
      };
      fileReader.readAsDataURL(file);
    }
  };
  
  // Обработчик сохранения упражнения
  const handleSave = () => {
    // В реальном приложении здесь будет отправка данных на сервер
    console.log('Сохраняем упражнение:', exercise);
    console.log('Файл:', selectedFile);
    
    // После успешного сохранения можно вернуться назад
    router.back();
  };
  
  // Обработчик открытия диалога подтверждения удаления
  const handleOpenDeleteDialog = () => {
    setDeleteDialogOpen(true);
  };
  
  // Обработчик закрытия диалога подтверждения удаления
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
  };
  
  // Обработчик удаления упражнения
  const handleDeleteExercise = () => {
    // В реальном приложении здесь будет запрос к API для удаления
    console.log(`Удаляем упражнение с id: ${exerciseId}`);
    
    // Закрываем диалог
    setDeleteDialogOpen(false);
    
    // Возвращаемся на страницу пула упражнений
    router.push('/exercise-pool');
  };

  return (
    <MainLayout>
      <Stack spacing={3}>
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
            Настройки упражнения
          </Box>
        </Box>
        
        <Divider sx={{ bgcolor: theme.palette.backgrounds?.paper }} />
        
        {/* Форма редактирования упражнения */}
        <Stack spacing={3} component="form">
          {/* Название упражнения */}
          <TextField
            fullWidth
            label="Название упражнения"
            name="name"
            value={exercise.name}
            onChange={handleChange}
            variant="outlined"
            InputLabelProps={{
              style: { color: theme.palette.textColors?.secondary }
            }}
            InputProps={{
              style: { color: theme.palette.textColors?.primary }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.23)',
                },
                '&:hover fieldset': {
                  borderColor: theme.palette.highlight?.main,
                },
                '&.Mui-focused fieldset': {
                  borderColor: theme.palette.highlight?.main,
                },
              },
            }}
          />
          
          {/* Описание упражнения */}
          <TextField
            fullWidth
            label="Описание упражнения"
            name="description"
            value={exercise.description}
            onChange={handleChange}
            variant="outlined"
            multiline
            rows={4}
            InputLabelProps={{
              style: { color: theme.palette.textColors?.secondary }
            }}
            InputProps={{
              style: { color: theme.palette.textColors?.primary }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.23)',
                },
                '&:hover fieldset': {
                  borderColor: theme.palette.highlight?.main,
                },
                '&.Mui-focused fieldset': {
                  borderColor: theme.palette.highlight?.main,
                },
              },
            }}
          />
          
          {/* Загрузка GIF */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 1,
              bgcolor: theme.palette.backgrounds?.paper,
              border: '1px dashed rgba(255, 255, 255, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="body1" sx={{ mb: 1, color: theme.palette.textColors?.primary }}>
              GIF-анимация упражнения
            </Typography>
            
            {previewUrl ? (
              <Box sx={{ width: '100%', textAlign: 'center', mb: 2 }}>
                <img 
                  src={previewUrl} 
                  alt="Превью GIF" 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '200px',
                    borderRadius: '8px'
                  }} 
                />
              </Box>
            ) : null}
            
            <Button
              component="label"
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              sx={{
                color: theme.palette.highlight?.main,
                borderColor: theme.palette.highlight?.main,
                '&:hover': {
                  borderColor: theme.palette.highlight?.accent,
                  bgcolor: 'rgba(255, 140, 0, 0.08)'
                },
                textTransform: 'none'
              }}
            >
              Загрузить GIF
              <input
                type="file"
                hidden
                accept="image/gif"
                onChange={handleFileChange}
              />
            </Button>
          </Paper>
        </Stack>
        
        {/* Кнопка сохранения */}
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          fullWidth
          onClick={handleSave}
          sx={{
            mt: 2,
            py: 1.5,
            bgcolor: theme.palette.highlight?.main,
            '&:hover': {
              bgcolor: theme.palette.highlight?.accent,
            },
            borderRadius: '24px',
            textTransform: 'none',
            fontWeight: 'bold',
            color: theme.palette.textColors?.primary
          }}
        >
          Сохранить упражнение
        </Button>
        
        {/* Кнопка удаления */}
        <Button
          variant="outlined"
          startIcon={<DeleteIcon />}
          onClick={handleOpenDeleteDialog}
          sx={{
            py: 1,
            borderColor: 'rgba(255, 0, 0, 0.5)',
            color: 'rgba(255, 0, 0, 0.7)',
            '&:hover': {
              borderColor: 'rgba(255, 0, 0, 0.8)',
              bgcolor: 'rgba(255, 0, 0, 0.08)'
            },
            borderRadius: '8px',
            textTransform: 'none',
            fontSize: '0.875rem'
          }}
        >
          Удалить упражнение
        </Button>
        
        {/* Диалог подтверждения удаления */}
        <Dialog
          open={deleteDialogOpen}
          onClose={handleCloseDeleteDialog}
          PaperProps={{
            sx: { 
              bgcolor: theme.palette.backgrounds?.paper,
              color: theme.palette.textColors?.primary
            }
          }}
        >
          <DialogTitle>Подтверждение удаления</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: theme.palette.textColors?.secondary }}>
              Вы уверены, что хотите удалить упражнение "{exercise.name}"? Это действие нельзя будет отменить.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={handleCloseDeleteDialog}
              sx={{ color: theme.palette.textColors?.secondary }}
            >
              Отмена
            </Button>
            <Button 
              onClick={handleDeleteExercise}
              sx={{ 
                color: 'rgba(255, 0, 0, 0.7)',
                '&:hover': {
                  bgcolor: 'rgba(255, 0, 0, 0.08)'
                }
              }}
              autoFocus
            >
              Удалить
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </MainLayout>
  );
} 