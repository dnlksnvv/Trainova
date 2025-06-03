"use client";

import React, { useState } from "react";
import { 
  Stack, 
  Box, 
  Typography, 
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Paper,
  CircularProgress,
  Divider,
  FormControl,
  FormLabel,
  FormHelperText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import MainLayout from "@/app/components/layouts/MainLayout";
import SearchBar from "@/app/components/shared/SearchBar";

interface CourseSettingsPageProps { 
  formData: { 
    name: string;
    description: string;
    duration: number;
    is_published: boolean;
    is_paid: boolean;
    price: number;
  };
  onFormChange: (field: string, value: any) => void; 
  onSave: () => void; 
  onCancel: () => void; 
  onDelete: () => Promise<void>; 
  loading: boolean;
  deleteLoading?: boolean;
  theme: any;
  formatDuration: (seconds: number | undefined | null) => string;
  isCreateMode?: boolean;
}

export const CourseSettingsPage = ({
  formData, 
  onFormChange, 
  onSave, 
  onCancel, 
  onDelete, 
  loading,
  deleteLoading = false,
  theme,
  formatDuration,
  isCreateMode = false
}: CourseSettingsPageProps) => {
  // Состояние для диалога подтверждения удаления
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Функция для открытия диалога подтверждения
  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  // Функция для закрытия диалога подтверждения
  const handleDeleteDialogClose = () => {
    setDeleteDialogOpen(false);
    setDeleteConfirmText('');
  };

  // Функция для обработки изменения текста подтверждения
  const handleDeleteConfirmTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDeleteConfirmText(e.target.value);
  };

  // Функция для выполнения удаления
  const handleDeleteConfirm = async () => {
    // Проверяем, что введено верное слово подтверждения
    if (deleteConfirmText !== 'УДАЛИТЬ') {
      return;
    }
    
    // Выполняем удаление
    await onDelete();
    
    // Закрываем диалог
    handleDeleteDialogClose();
  };

  return (
    <>
      <SearchBar 
        isSearchBarVisible={true} 
        isAtTop={true} 
        showBackButton={true}
        showProfileButton={false}
        showFilterButton={false}
        showSettingsButton={false}
        showCreateButton={false}
        showSearchField={false}
        onBackClick={onCancel}
        title={isCreateMode ? "Создание курса" : "Настройки курса"}
        placeholder={isCreateMode ? "Создание курса" : "Настройки курса"}
      />
      
      <MainLayout>
        <Stack spacing={3} sx={{ pb: 4, px: 1, pt: 7 }}>
          <Paper
            elevation={0}
            sx={{
              borderRadius: theme.shape.borderRadius,
              backgroundColor: theme.palette.backgrounds?.paper,
              p: { xs: 2, sm: 3 },
              boxShadow: `0 4px 20px ${theme.palette.mode === 'dark' ? theme.palette.common.black : theme.palette.common.black}40`,
              border: `1px solid ${theme.palette.divider}`
            }}
          >
            <form onSubmit={(e) => { e.preventDefault(); onSave(); }}>
              <Stack spacing={3}>
                {/* Основная информация */}
                <Box>
                  
                  
                  <Stack spacing={2}>
                    {/* Название курса */}
                    <TextField
                      label="Название курса"
                      value={formData.name}
                      onChange={(e) => onFormChange('name', e.target.value)}
                      fullWidth
                      required
                      placeholder="Введите название курса"
                      helperText={`${formData.name.length}/125 символов`}
                      error={formData.name.length > 125}
                      inputProps={{ maxLength: 125 }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                        }
                      }}
                    />

                    {/* Описание курса */}
                    <TextField
                      label="Описание курса"
                      value={formData.description}
                      onChange={(e) => onFormChange('description', e.target.value)}
                      fullWidth
                      multiline
                      rows={3}
                      placeholder="Опишите содержание и цели курса"
                      helperText={`${formData.description.length}/500 символов`}
                      error={formData.description.length > 500}
                      inputProps={{ maxLength: 500 }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                        }
                      }}
                    />

                    {/* Длительность */}
                    <Box>
                      <FormControl fullWidth>
                        <FormLabel component="legend" sx={{ fontWeight: 'medium', mb: 1 }}>
                          Длительность курса
                        </FormLabel>
                        <Box 
                          sx={{
                            p: 2, 
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            backgroundColor: theme.palette.backgrounds?.main,
                          }}
                        >
                          <Typography variant="body2" color={theme.palette.textColors?.secondary}>
                            Длительность курса рассчитывается автоматически как сумма длительностей всех тренировок.
                          </Typography>
                          <Typography 
                            variant="subtitle1"
                            sx={{ mt: 1 }}
                          >
                            {formatDuration(formData.duration) || '0 мин'}
                          </Typography>
                        </Box>
                      </FormControl>
                    </Box>
                  </Stack>
                </Box>

                <Divider />

                {/* Настройки доступа */}
                <Box>
                  <Typography 
                    variant="h6" 
                    fontWeight="medium" 
                    sx={{ mb: 2 }}
                  >
                    Настройки доступа
                  </Typography>
                  
                  <Stack spacing={2}>
                    {/* Видимость курса */}
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.is_published}
                          onChange={(e) => onFormChange('is_published', e.target.checked)}
                          color="primary"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body1" fontWeight="medium">
                            {formData.is_published ? 'Курс виден всем' : 'Курс скрыт'}
                          </Typography>
                          <Typography variant="body2" color={theme.palette.textColors?.secondary}>
                            {formData.is_published 
                              ? 'Курс будет доступен всем пользователям в каталоге' 
                              : 'Курс будет виден только вам и администраторам'}
                          </Typography>
                        </Box>
                      }
                      sx={{ ml: 0, alignItems: 'flex-start' }}
                    />

                    {/* Платность курса */}
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.is_paid}
                          onChange={(e) => onFormChange('is_paid', e.target.checked)}
                          color="primary"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body1" fontWeight="medium">
                            {formData.is_paid ? 'Платный курс' : 'Бесплатный курс'}
                          </Typography>
                          <Typography variant="body2" color={theme.palette.textColors?.secondary}>
                            {formData.is_paid 
                              ? 'Курс требует оплаты подписки' 
                              : 'Курс доступен всем пользователям бесплатно'}
                          </Typography>
                        </Box>
                      }
                      sx={{ ml: 0, alignItems: 'flex-start' }}
                    />

                    {/* Стоимость для платного курса */}
                    {formData.is_paid && (
                      <TextField
                        label="Стоимость в месяц (₽)"
                        type="number"
                        value={formData.price}
                        onChange={(e) => onFormChange('price', parseFloat(e.target.value) || 0)}
                        variant="outlined"
                        inputProps={{ min: 0, step: 1 }}
                        required
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                          }
                        }}
                      />
                    )}
                  </Stack>
                </Box>

                <Divider />

                {/* Кнопки действий */}
                <Stack 
                  direction={{ xs: 'column', sm: 'row' }} 
                  spacing={2} 
                  justifyContent="space-between"
                  sx={{ pt: 2 }}
                >
                  {!isCreateMode && (
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={handleDeleteClick}
                      startIcon={<DeleteIcon />}
                      sx={{ 
                        borderColor: theme.palette.error.main,
                        '&:hover': {
                          borderColor: theme.palette.error.dark,
                          backgroundColor: `${theme.palette.error.main}10`
                        }
                      }}
                    >
                      Удалить курс
                    </Button>
                  )}
                  
                  {isCreateMode && <Box />}
                  
                  <Stack 
                    direction={{ xs: 'column', sm: 'row' }} 
                    spacing={2}
                    sx={{ flex: { xs: 1, sm: 'none' } }}
                  >
                    <Button
                      onClick={onCancel}
                      variant="outlined"
                      color="inherit"
                      disabled={loading}
                      sx={{ 
                        borderRadius: 2,
                        flex: { xs: 1, sm: 'none' }
                      }}
                    >
                      Отмена
                    </Button>
                    
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={loading || !formData.name.trim()}
                      startIcon={loading ? <CircularProgress size={16} /> : null}
                      sx={{ 
                        borderRadius: 2,
                        backgroundColor: theme.palette.highlight?.main,
                        '&:hover': {
                          backgroundColor: theme.palette.highlight?.accent,
                        },
                        flex: { xs: 1, sm: 'none' },
                        minWidth: { sm: 200 }
                      }}
                    >
                      {loading ? (isCreateMode ? 'Создание...' : 'Сохранение...') : (isCreateMode ? 'Создать курс' : 'Сохранить изменения')}
                    </Button>
                  </Stack>
                </Stack>
              </Stack>
            </form>
          </Paper>
        </Stack>
      </MainLayout>

      {/* Диалоговое окно подтверждения удаления */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={handleDeleteDialogClose}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: theme.palette.backgrounds?.paper,
            color: theme.palette.textColors?.primary,
            borderRadius: '12px',
            maxWidth: '450px',
            boxShadow: `0 8px 32px ${theme.palette.common.black}80`
          }
        }}
        BackdropProps={{
          sx: {
            backgroundColor: `${theme.palette.backgrounds?.default}cc` // Используем цвет фона с прозрачностью cc (80%)
          }
        }}
      >
        <DialogTitle sx={{ 
          fontSize: '1.25rem',
          fontWeight: 600,
          borderBottom: `1px solid ${theme.palette.divider}`,
          pb: 2
        }}>
          Подтверждение удаления
        </DialogTitle>
        
        <DialogContent sx={{ pt: 3 }}>
          <DialogContentText sx={{ color: theme.palette.textColors?.secondary, mb: 2 }}>
            Вы собираетесь удалить курс <strong>{formData.name}</strong>.
          </DialogContentText>
          
          <Paper
            elevation={0}
            sx={{
              borderRadius: theme.shape.borderRadius,
              backgroundColor: theme.palette.error.main + '10', // Используем цвет ошибки с прозрачностью 10%
              border: `1px solid ${theme.palette.error.main + '20'}`, // Цвет ошибки с прозрачностью 20%
              p: 2,
              mb: 2,
            }}
          >
            <Typography 
              variant="body2" 
              color="error"
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
            >
              <DeleteIcon fontSize="small" />
              Это действие необратимо и приведет к:
            </Typography>
            
            <Stack component="ul" spacing={0.5} sx={{ pl: 2, mb: 0 }}>
              <Typography component="li" variant="body2" color={theme.palette.textColors?.secondary}>
                Удалению всех тренировок, входящих в состав курса
              </Typography>
              <Typography component="li" variant="body2" color={theme.palette.textColors?.secondary}>
                Отмене всех подписок на этот курс
              </Typography>
              <Typography component="li" variant="body2" color={theme.palette.textColors?.secondary}>
                Потере всей статистики и рейтингов
              </Typography>
            </Stack>
          </Paper>
          
          <Typography 
            variant="body2" 
            color={theme.palette.textColors?.secondary}
            sx={{ mb: 2 }}
          >
            Для подтверждения введите слово <span style={{ fontWeight: 'bold', color: theme.palette.error.main }}>УДАЛИТЬ</span>
          </Typography>
          
          <TextField
            fullWidth
            placeholder="УДАЛИТЬ"
            value={deleteConfirmText}
            onChange={handleDeleteConfirmTextChange}
            variant="outlined"
            size="small"
            autoComplete="off"
            InputProps={{
              sx: { 
                borderRadius: 3,
                backgroundColor: `${theme.palette.backgrounds?.default}33` // Используем цвет фона с прозрачностью 20%
              }
            }}
          />
        </DialogContent>

        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={handleDeleteDialogClose}
            color="inherit"
            disabled={deleteLoading}
            sx={{ 
              borderRadius: 25,
              color: theme.palette.textColors?.secondary,
              '&:hover': {
                bgcolor: `${theme.palette.backgrounds?.default}33`
              }
            }}
          >
            Отмена
          </Button>
          <Button 
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            disabled={deleteLoading || deleteConfirmText !== 'УДАЛИТЬ'}
            startIcon={deleteLoading ? <CircularProgress size={16} /> : null}
            sx={{ 
              borderRadius: 25,
              bgcolor: theme.palette.error.main,
              '&:hover': {
                bgcolor: theme.palette.error.dark
              }
            }}
          >
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CourseSettingsPage; 