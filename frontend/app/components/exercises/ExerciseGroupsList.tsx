import React from 'react';
import { 
  Box, 
  Paper, 
  List, 
  ListItem, 
  ListItemText, 
  Typography, 
  Collapse, 
  IconButton, 
  Stack,
  useTheme,
  CircularProgress,
  Avatar,
  Tooltip,
  CardMedia
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';

// Интерфейс Exercise, совместимый с client.tsx
interface Exercise {
  id: number | string;
  name: string;
  description: string;
  gifUuid?: string;
}

interface MuscleGroup {
  id: number;
  name: string;
  exercises: Exercise[];
}

interface ExerciseGroupsListProps {
  muscleGroups: MuscleGroup[];
  openGroups: Record<number, boolean>;
  onToggleGroup: (groupId: number) => void;
  onSelectExercise: (exercise: Exercise) => void;
  onEditGroup?: (groupId: number) => void;
  onAddExerciseToGroup?: (groupId: number) => void;
  loading?: boolean;
  error?: string | null;
  showEditControls?: boolean;
}

const ExerciseGroupsList: React.FC<ExerciseGroupsListProps> = ({
  muscleGroups,
  openGroups,
  onToggleGroup,
  onSelectExercise,
  onEditGroup,
  onAddExerciseToGroup,
  loading,
  error,
  showEditControls = false
}) => {
  const theme = useTheme();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography color="error" align="center" sx={{ p: 3 }}>
        {error}
      </Typography>
    );
  }

  if (muscleGroups.length === 0) {
    return (
      <Typography align="center" sx={{ p: 2, color: 'text.secondary' }}>
        Нет доступных групп мышц
      </Typography>
    );
  }

  return (
    <Box sx={{ py: 2 }}>
      {muscleGroups.map((group) => (
        <Box key={group.id} sx={{ mb: 3 }}>
          {/* Заголовок группы мышц - темная карточка */}
          <Paper
            elevation={0}
            sx={{ 
              bgcolor: '#333333', // Темный фон как на скриншоте
              mx: 2,
              borderRadius: 2,
              overflow: 'hidden',
              mb: openGroups[group.id] ? 1 : 0
            }}
          >
            <ListItem
              onClick={() => onToggleGroup(group.id)} 
              sx={{ 
                px: 3, 
                py: 2.5,
                cursor: 'pointer'
              }}
            >
              <ListItemText 
                primary={
                  <Typography 
                    sx={{ 
                      fontWeight: 'medium', 
                      fontSize: '1.25rem',
                      color: 'white' 
                    }}
                  >
                    {group.name}
                  </Typography>
                } 
              />
              <IconButton 
                edge="end" 
                sx={{ color: theme.palette.highlight?.main }}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleGroup(group.id);
                }}
              >
                {openGroups[group.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </ListItem>
          </Paper>
          
          {/* Содержимое группы - список упражнений */}
          <Collapse in={openGroups[group.id]} timeout="auto" unmountOnExit>
            {group.exercises.length === 0 ? (
              <Typography 
                variant="body1" 
                sx={{ 
                  color: theme.palette.textColors?.secondary,
                  pl: 6, // Увеличенный отступ слева для визуальной вложенности
                  py: 2
                }}
              >
                Нет упражнений в этой группе
              </Typography>
            ) : (
              <Box sx={{ ml: 4, mr: 2, mt: 1, mb: 2 }}> {/* Увеличенный отступ слева */}
                {group.exercises.map((exercise) => (
                  <Paper
                    key={exercise.id}
                    elevation={0}
                    sx={{ 
                      bgcolor: '#3a3a3a', // Немного светлее, чем группа
                      borderRadius: 2,
                      mb: 1,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                      },
                      // Дополнительный стиль для визуального выделения вложенности
                      borderLeft: `4px solid ${theme.palette.highlight?.main || '#FFA500'}`
                    }}
                    onClick={() => onSelectExercise(exercise)}
                  >
                    <ListItem 
                      sx={{ px: 2, py: 1.5 }}
                    >
                      {/* Иконка упражнения слева */}
                      <Box 
                        sx={{ 
                          mr: 2, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          color: theme.palette.highlight?.main
                        }}
                      >
                        <FitnessCenterIcon />
                      </Box>
                      
                      {/* Информация об упражнении */}
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}> {/* minWidth: 0 нужен для корректной работы ellipsis */}
                        <Typography 
                          sx={{ 
                            fontWeight: 'medium',
                            fontSize: '1.1rem',
                            color: 'white',
                            display: 'block'
                          }}
                        >
                          {exercise.name}
                        </Typography>
                        {exercise.description && (
                          <Typography
                            variant="body2"
                            sx={{
                              color: '#aaaaaa',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              mt: 0.5,
                              maxWidth: '100%'
                            }}
                          >
                            {exercise.description}
                          </Typography>
                        )}
                      </Box>
                      
                      {/* GIF предпросмотр справа, если доступен */}
                      {exercise.gifUuid ? (
                        <Tooltip title="Посмотреть анимацию">
                          <Avatar 
                            variant="rounded"
                            src={`${process.env.API_URL}${process.env.WORKOUT_API_PREFIX}/exercises/gif/${exercise.gifUuid}`}
                            alt={exercise.name}
                            sx={{ 
                              width: 48, 
                              height: 48, 
                              ml: 1,
                              border: '1px solid rgba(255,255,255,0.1)'
                            }}
                          />
                        </Tooltip>
                      ) : (
                        <ChevronRightIcon 
                          sx={{ 
                            color: theme.palette.textColors?.secondary,
                            ml: 1
                          }} 
                        />
                      )}
                    </ListItem>
                  </Paper>
                ))}
              </Box>
            )}
            
            {showEditControls && onAddExerciseToGroup && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Box 
                  sx={{ 
                    display: 'flex',
                    alignItems: 'center',
                    color: theme.palette.highlight?.main,
                    cursor: 'pointer',
                    py: 1,
                    px: 2,
                    borderRadius: 1,
                    '&:hover': {
                      bgcolor: 'rgba(255, 165, 0, 0.08)'
                    }
                  }}
                  onClick={() => onAddExerciseToGroup(group.id)}
                >
                  <AddIcon sx={{ mr: 1 }} />
                  <Typography>Добавить упражнение</Typography>
                </Box>
              </Box>
            )}
          </Collapse>
        </Box>
      ))}
    </Box>
  );
};

export default ExerciseGroupsList; 