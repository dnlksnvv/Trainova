"use client";

import React, { useState, useEffect } from 'react';
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
  IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import { MuscleGroup, MuscleGroupCreate, MuscleGroupUpdate } from '@/app/services/api';

interface MuscleGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: MuscleGroupCreate | MuscleGroupUpdate) => Promise<void>;
  onDelete?: () => Promise<void>;
  muscleGroup?: MuscleGroup | null;
  isCreate?: boolean;
}

export default function MuscleGroupDialog({
  open,
  onClose,
  onSave,
  onDelete,
  muscleGroup,
  isCreate = false
}: MuscleGroupDialogProps) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Заполнение данных при редактировании существующей группы
  useEffect(() => {
    if (muscleGroup && !isCreate) {
      setName(muscleGroup.name || '');
      setDescription(muscleGroup.description || '');
    } else {
      setName('');
      setDescription('');
    }
    setError('');
  }, [muscleGroup, isCreate, open]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Название группы мышц обязательно');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined
      });
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
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
        {isCreate ? 'Добавить группу мышц' : 'Редактировать группу мышц'}
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
        
        <TextField
          autoFocus
          margin="dense"
          label="Название группы мышц"
          type="text"
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          variant="outlined"
          required
          sx={{ 
            mb: 2,
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
          margin="dense"
          label="Описание (необязательно)"
          type="text"
          fullWidth
          multiline
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          variant="outlined"
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
      </DialogContent>
      <DialogActions sx={{ 
        justifyContent: 'space-between', 
        p: 2, 
        borderTop: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
      }}>
        {!isCreate && onDelete && (
          <Button 
            onClick={handleDelete} 
            color="error" 
            disabled={loading}
            startIcon={<DeleteIcon />}
            sx={{ 
              borderRadius: '20px',
              textTransform: 'none',
            }}
          >
            Удалить
          </Button>
        )}
        
        <Box sx={{ ml: 'auto' }}>
          <Button 
            onClick={onClose} 
            disabled={loading}
            sx={{ 
              mr: 1, 
              color: theme.palette.textColors?.secondary,
              textTransform: 'none',
            }}
          >
            Отмена
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading}
            variant="contained"
            sx={{ 
              bgcolor: theme.palette.highlight?.main,
              '&:hover': {
                bgcolor: theme.palette.highlight?.accent,
              },
              textTransform: 'none',
              borderRadius: '20px',
            }}
          >
            {loading ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
} 