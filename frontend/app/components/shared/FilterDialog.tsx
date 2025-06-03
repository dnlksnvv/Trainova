import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemText, 
  useTheme, 
  IconButton,
  Collapse,
  Box,
  Checkbox,
  FormControlLabel,
  Typography,
  Divider,
  Button
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

export interface FilterOption {
  id: string;
  label: string;
}

export interface MuscleGroupFilter {
  id: number;
  name: string;
  selected: boolean;
}

export interface FilterDialogProps {
  open: boolean;
  onClose: () => void;
  options: FilterOption[];
  selectedOption: string | null;
  onOptionSelect: (optionId: string) => void;
  availableMuscleGroups: MuscleGroupFilter[];
  onApplyMuscleGroupFilter: (selectedGroups: number[]) => void;
}

export default function FilterDialog({
  open,
  onClose,
  options,
  selectedOption,
  onOptionSelect,
  availableMuscleGroups,
  onApplyMuscleGroupFilter
}: FilterDialogProps) {
  const theme = useTheme();
  const [muscleGroupsOpen, setMuscleGroupsOpen] = useState(false);
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroupFilter[]>([]);

  // Инициализация состояния при получении доступных групп мышц
  useEffect(() => {
    setMuscleGroups(availableMuscleGroups);
  }, [availableMuscleGroups]);

  // Обработчик переключения выбора группы мышц
  const handleMuscleGroupToggle = (id: number) => {
    setMuscleGroups(prev => 
      prev.map(group => 
        group.id === id ? { ...group, selected: !group.selected } : group
      )
    );
  };

  // Обработчик нажатия кнопки "Применить" для групп мышц
  const handleApplyMuscleGroupFilter = () => {
    const selectedGroupIds = muscleGroups
      .filter(group => group.selected)
      .map(group => group.id);
    
    onApplyMuscleGroupFilter(selectedGroupIds);
    onOptionSelect('muscle_groups');
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      PaperProps={{
        sx: {
          width: '100%',
          maxWidth: '500px',
          borderRadius: '16px',
          bgcolor: theme.palette.backgrounds?.paper
        },
        elevation: 0
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        color: theme.palette.textColors?.primary,
        py: 2
      }}>
        Выберите тип фильтрации
        <IconButton 
          onClick={onClose}
          sx={{ color: theme.palette.textColors?.secondary }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 1, py: 0 }}>
        <List>
          {options.map(option => (
            <ListItem key={option.id} disablePadding>
              <ListItemButton
                onClick={() => {
                  if (option.id === 'muscle_groups') {
                    setMuscleGroupsOpen(!muscleGroupsOpen);
                  } else {
                    onOptionSelect(option.id);
                    onClose();
                  }
                }}
                selected={selectedOption === option.id}
                sx={{
                  borderRadius: '8px',
                  my: 0.5,
                  '&.Mui-selected': {
                    bgcolor: `${theme.palette.highlight?.main}20`,
                    '&:hover': {
                      bgcolor: `${theme.palette.highlight?.main}30`,
                    }
                  },
                  '&:hover': {
                    bgcolor: theme.palette.mode === 'dark' 
                      ? `${theme.palette.textColors?.primary}14` 
                      : `${theme.palette.textColors?.primary}0A`
                  }
                }}
              >
                <ListItemText 
                  primary={option.label}
                  primaryTypographyProps={{
                    sx: {
                      color: theme.palette.textColors?.primary,
                      fontWeight: selectedOption === option.id ? 'medium' : 'normal'
                    }
                  }}
                />
                {option.id === 'muscle_groups' && (
                  muscleGroupsOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />
                )}
              </ListItemButton>
            </ListItem>
          ))}

          {/* Раскрывающийся список групп мышц */}
          <Collapse in={muscleGroupsOpen} timeout="auto" unmountOnExit>
            <Box sx={{ 
              pl: 2, 
              pr: 1, 
              py: 1, 
              bgcolor: theme.palette.mode === 'dark' 
                ? `${theme.palette.textColors?.primary}08` 
                : `${theme.palette.textColors?.primary}05`,
              borderRadius: '8px',
              mb: 1
            }}>
              <Typography 
                variant="subtitle2" 
                sx={{ 
                  mb: 1, 
                  color: theme.palette.textColors?.secondary,
                  px: 1
                }}
              >
                Выберите группы мышц
              </Typography>
              
              {muscleGroups.length > 0 ? (
                <>
                  <List disablePadding>
                    {muscleGroups.map((group) => (
                      <ListItem key={group.id} disablePadding>
                        <FormControlLabel
                          control={
                            <Checkbox 
                              checked={group.selected}
                              onChange={() => handleMuscleGroupToggle(group.id)}
                              sx={{
                                color: theme.palette.textColors?.secondary,
                                '&.Mui-checked': {
                                  color: theme.palette.highlight?.main,
                                },
                              }}
                            />
                          }
                          label={group.name}
                          sx={{ 
                            width: '100%', 
                            color: theme.palette.textColors?.primary,
                            py: 0.5
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                  
                  <Divider sx={{ my: 1 }} />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                    <Button 
                      variant="contained" 
                      size="small"
                      onClick={handleApplyMuscleGroupFilter}
                      sx={{ 
                        bgcolor: theme.palette.highlight?.main,
                        '&:hover': {
                          bgcolor: theme.palette.highlight?.accent,
                        },
                        textTransform: 'none',
                        fontWeight: 'medium',
                        px: 2
                      }}
                    >
                      Применить
                    </Button>
                  </Box>
                </>
              ) : (
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: theme.palette.textColors?.secondary,
                    fontStyle: 'italic',
                    textAlign: 'center',
                    py: 2
                  }}
                >
                  Нет доступных групп мышц
                </Typography>
              )}
            </Box>
          </Collapse>
        </List>
      </DialogContent>
    </Dialog>
  );
} 