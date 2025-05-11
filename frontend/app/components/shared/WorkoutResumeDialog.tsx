import { useState } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  Typography, 
  Box,
  useTheme
} from '@mui/material';
import { PlayArrow, Refresh, Check } from '@mui/icons-material';
import { useRouter } from 'next/navigation';

interface WorkoutResumeDialogProps {
  open: boolean;
  onClose: () => void;
  workoutId: string;
  workoutName: string;
  workoutSessionId?: string; // UUID сессии тренировки
  onContinue: () => void;
  onRestart: () => void;
  onComplete: () => void;
}

export default function WorkoutResumeDialog({
  open,
  onClose,
  workoutId,
  workoutName,
  workoutSessionId,
  onContinue,
  onRestart,
  onComplete
}: WorkoutResumeDialogProps) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          bgcolor: theme.palette.mode === 'dark' 
            ? theme.palette.backgrounds?.paper || '#121212'
            : theme.palette.backgrounds?.default || '#f5f5f5',
        }
      }}
    >
      <DialogTitle 
        sx={{ 
          pb: 1, 
          color: theme.palette.info.main,
          fontWeight: 'bold'
        }}
      >
        Незавершенная тренировка
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Тренировка <b>{workoutName}</b> была начата ранее, но не завершена.
          Что вы хотите сделать?
        </Typography>
        
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 1.5,
          my: 2
        }}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<PlayArrow />}
            onClick={onContinue}
            sx={{ 
              py: 1.5, 
              bgcolor: theme.palette.info.main,
              color: '#fff',
              '&:hover': { bgcolor: theme.palette.info.dark },
              borderRadius: 2,
              fontSize: '1rem',
              textTransform: 'none'
            }}
          >
            Продолжить тренировку
          </Button>
          
          <Button
            fullWidth
            variant="outlined"
            startIcon={<Refresh />}
            onClick={onRestart}
            sx={{ 
              py: 1.5, 
              borderColor: theme.palette.highlight?.main,
              color: theme.palette.highlight?.main,
              '&:hover': { 
                bgcolor: 'rgba(255, 140, 0, 0.08)',
                borderColor: theme.palette.highlight?.accent,
              },
              borderRadius: 2,
              fontSize: '1rem',
              textTransform: 'none'
            }}
          >
            Начать заново
          </Button>
          
          <Button
            fullWidth
            variant="outlined"
            startIcon={<Check />}
            onClick={onComplete}
            sx={{ 
              py: 1.5, 
              borderColor: theme.palette.success.main,
              color: theme.palette.success.main,
              '&:hover': { 
                bgcolor: 'rgba(76, 175, 80, 0.08)',
                borderColor: theme.palette.success.dark,
              },
              borderRadius: 2,
              fontSize: '1rem',
              textTransform: 'none'
            }}
          >
            Завершить и сохранить прогресс
          </Button>
        </Box>
        
        <Typography variant="body2" sx={{ 
          mt: 2, 
          color: theme.palette.text.secondary,
          fontSize: '0.8rem',
          fontStyle: 'italic'
        }}>
          Примечание: При выборе "Начать заново" текущий прогресс будет сброшен.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button 
          onClick={onClose}
          sx={{ 
            color: theme.palette.text.secondary,
            textTransform: 'none'
          }}
        >
          Отмена
        </Button>
      </DialogActions>
    </Dialog>
  );
} 