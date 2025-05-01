"use client";

import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  IconButton, 
  CircularProgress,
  styled,
  useTheme
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadIcon from '@mui/icons-material/Upload';
import { exercisesApi } from '@/app/services/api';

// Стилизованный input для загрузки файлов
const UploadInput = styled('input')({
  display: 'none',
});

interface GifUploaderProps {
  gifUuid?: string;
  exerciseId?: string;
  isCreate?: boolean;
  onGifChange: (file: File | null, newGifUuid?: string) => void;
  onError: (message: string) => void;
}

export const GifUploader: React.FC<GifUploaderProps> = ({
  gifUuid,
  exerciseId,
  isCreate = false,
  onGifChange,
  onError
}) => {
  const theme = useTheme();
  const [uploading, setUploading] = useState(false);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Обновление URL гифа при изменении UUID
  useEffect(() => {
    if (gifUuid) {
      setGifUrl(exercisesApi.getGifUrl(gifUuid));
    } else {
      setGifUrl(null);
    }
  }, [gifUuid]);

  // Обработчик загрузки GIF-файла
  const handleUploadGif = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }
    
    const file = files[0];
    
    // Проверяем, что файл - GIF
    if (!file.type.startsWith('image/gif')) {
      onError('Пожалуйста, выберите GIF-файл');
      return;
    }
    
    // Если мы в режиме создания, просто передаем файл родителю
    if (isCreate) {
      onGifChange(file);
      
      // Создаем временный URL для предпросмотра
      const tempUrl = URL.createObjectURL(file);
      setGifUrl(tempUrl);
      return;
    }
    
    // Если режим редактирования и есть ID упражнения
    if (!isCreate && exerciseId) {
      setUploading(true);
      
      try {
        const updatedExercise = await exercisesApi.uploadGif(exerciseId, file);
        
        // Обновляем состояние и передаем новый UUID родителю
        if (updatedExercise.gif_uuid) {
          onGifChange(file, updatedExercise.gif_uuid);
          setGifUrl(exercisesApi.getGifUrl(updatedExercise.gif_uuid));
        }
      } catch (err: any) {
        console.error('Ошибка при загрузке GIF:', err);
        onError(err.message || 'Ошибка при загрузке GIF');
      } finally {
        setUploading(false);
        // Сбрасываем input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  // Обработчик удаления GIF
  const handleDeleteGif = async () => {
    // Если режим создания - просто очищаем данные
    if (isCreate) {
      onGifChange(null);
      setGifUrl(null);
      return;
    }
    
    // Для режима редактирования и если есть ID упражнения
    if (!isCreate && exerciseId && gifUuid) {
      setUploading(true);
      
      try {
        // Удаляем GIF
        await exercisesApi.deleteGif(exerciseId);
        
        // Дополнительно явно обновляем упражнение, устанавливая gif_uuid в null
        const updateData = { gif_uuid: null };
        await exercisesApi.update(exerciseId, updateData);
        
        onGifChange(null, undefined);
        setGifUrl(null);
      } catch (err: any) {
        console.error('Ошибка при удалении GIF:', err);
        onError(err.message || 'Ошибка при удалении GIF');
      } finally {
        setUploading(false);
      }
    }
  };

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        GIF-анимация
      </Typography>
      
      {/* Отображение GIF или плейсхолдера */}
      <Box 
        sx={{
          width: '100%',
          height: 200,
          border: '1px dashed rgba(255, 255, 255, 0.3)',
          borderRadius: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          mb: 1,
          overflow: 'hidden'
        }}
      >
        {gifUrl ? (
          <>
            <Box 
              component="img"
              src={gifUrl}
              alt="Анимация упражнения"
              sx={{ 
                maxWidth: '100%', 
                maxHeight: '100%', 
                objectFit: 'contain'
              }}
            />
            <IconButton
              aria-label="Удалить GIF"
              onClick={handleDeleteGif}
              disabled={uploading}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                bgcolor: 'rgba(0, 0, 0, 0.5)',
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.7)',
                }
              }}
            >
              <DeleteIcon />
            </IconButton>
          </>
        ) : (
          <Typography 
            variant="body2" 
            color="textSecondary"
            sx={{ textAlign: 'center', p: 2 }}
          >
            GIF-анимация не загружена
          </Typography>
        )}
      </Box>
      
      {/* Кнопка загрузки GIF */}
      <UploadInput
        type="file"
        accept="image/gif"
        id="gif-upload-input"
        ref={fileInputRef}
        onChange={handleUploadGif}
      />
      <Button
        component="label"
        htmlFor="gif-upload-input"
        variant="outlined"
        startIcon={<UploadIcon />}
        disabled={uploading}
        fullWidth
        sx={{
          textTransform: 'none',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          color: theme.palette.textColors?.primary,
          '&:hover': {
            borderColor: 'rgba(255, 255, 255, 0.3)',
          }
        }}
      >
        {uploading ? (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CircularProgress size={16} sx={{ mr: 1, color: 'white' }} />
            Загрузка...
          </Box>
        ) : (
          gifUrl ? 'Заменить GIF' : 'Загрузить GIF'
        )}
      </Button>
    </Box>
  );
}; 