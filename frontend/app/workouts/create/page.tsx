"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useTheme } from "@mui/material/styles";
import { 
  Stack, 
  Box, 
  Typography, 
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Paper,
  useMediaQuery,
  CircularProgress,
  Alert,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import MainLayout from "@/app/components/layouts/MainLayout";
import SearchBar from "@/app/components/shared/SearchBar";
import { useAuth } from "@/app/auth/hooks/useAuth";
import { getCookie } from "@/app/utils/cookie";
import { workoutsApi } from "@/app/services/api";
import MuscleGroupSelector from '@/app/components/MuscleGroupSelector';
import { muscleGroupsApi, MuscleGroup, CreateWorkoutData, UpdateWorkoutData } from '@/app/services/api';

// Интерфейс для данных формы
interface WorkoutFormData {
  name: string;
  description: string;
  video_url: string;
  is_published: boolean;
  is_paid: boolean;
  duration: number;
  hours: number;
  minutes: number;
  muscle_groups: any[]; // Изменяем тип на any[] для совместимости с MuscleGroupResponse
}

// Добавляем интерфейс для групп мышц с процентами
interface MuscleGroupWithPercentage {
  id: number;
  name: string;
  description?: string;
  percentage: number;
  created_at?: string; // Делаем необязательным для совместимости с MuscleGroupResponse
  updated_at?: string; // Делаем необязательным для совместимости с MuscleGroupResponse
}

// Интерфейс для создания тренировки курса с группами мышц и процентами
// Используем CreateWorkoutData из API вместо отдельного интерфейса
type CourseWorkoutCreate = CreateWorkoutData;

// Компонент с основным содержимым страницы
function WorkoutCreateContent() {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId');
  const workoutId = searchParams.get('workoutId'); // Проверяем наличие ID тренировки
  const isEditMode = !!workoutId; // Режим редактирования если есть ID тренировки
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();

  // Состояния формы
  const [formData, setFormData] = useState<WorkoutFormData>({
    name: '',
    description: '',
    video_url: '',
    is_published: false,
    is_paid: false,
    duration: 0,
    hours: 0,
    minutes: 0,
    muscle_groups: []
  });

  // Состояние для групп мышц с процентами
  const [muscleGroupsWithPercentage, setMuscleGroupsWithPercentage] = useState<MuscleGroupWithPercentage[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null); // Добавляем состояние для сообщения об успехе
  const [initialLoading, setInitialLoading] = useState(isEditMode); // Загрузка при редактировании

  // Состояния для диалога подтверждения удаления
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Загрузка данных существующей тренировки при редактировании
  useEffect(() => {
    if (isEditMode && workoutId) {
      const fetchWorkoutData = async () => {
        try {
          setInitialLoading(true);
          const token = getCookie('access_token');
          if (!token) {
            setError('Необходима авторизация для редактирования тренировки');
            setInitialLoading(false);
            return;
          }
          
          // Загружаем данные тренировки по ID
          const workoutData = await workoutsApi.getById(String(workoutId), token);
          
          // Рассчитываем часы и минуты из секунд
          const durationInSeconds = workoutData.duration || 0;
          const hours = Math.floor(durationInSeconds / 3600);
          const minutes = Math.floor((durationInSeconds % 3600) / 60);
          
          // Получаем группы мышц из данных тренировки
          const muscleGroups = workoutData.muscle_groups || [];
          
          setFormData({
            name: workoutData.name,
            description: workoutData.description || '',
            video_url: workoutData.video_url || '',
            is_published: workoutData.is_published,
            is_paid: workoutData.is_paid,
            duration: durationInSeconds,
            hours: hours,
            minutes: minutes,
            muscle_groups: muscleGroups // Тип any[] совместим с MuscleGroupResponse[]
          });
          
          // Устанавливаем группы мышц с процентами для компонента распределения
          if (muscleGroups.length > 0) {
            // Используем проценты из полученных данных, вместо расчета новых
            setMuscleGroupsWithPercentage(muscleGroups as MuscleGroupWithPercentage[]);
          }
          
        } catch (err: any) {
          console.error('Ошибка при загрузке данных тренировки:', err);
          setError(err.message || 'Не удалось загрузить данные тренировки');
        } finally {
          setInitialLoading(false);
        }
      };
      
      fetchWorkoutData();
    }
  }, [isEditMode, workoutId]);

  // Проверяем наличие courseId при загрузке
  useEffect(() => {
    if (!courseId) {
      setError('ID курса не указан');
      return;
    }
  }, [courseId]);

  // Функция для возврата к курсу
  const handleBack = () => {
    router.back();
  };

  // Оптимизированные обработчики формы
  const handleFieldChange = useCallback((field: keyof WorkoutFormData, value: string | boolean | number) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };
      
      // Если изменились часы или минуты, пересчитываем общую продолжительность
      if (field === 'hours' || field === 'minutes') {
        newData.duration = (newData.hours * 3600) + (newData.minutes * 60);
      }
      
      return newData;
    });
    
    // Очищаем ошибку при изменении данных
    if (error) {
      setError(null);
    }
  }, [error]);

  // Обработчик изменения групп мышц
  const handleMuscleGroupsChange = useCallback((muscleGroups: MuscleGroup[]) => {
    setFormData(prev => ({
      ...prev,
      muscle_groups: muscleGroups
    }));
  }, []);

  // Обработчик изменения распределения процентов
  const handleDistributionChange = useCallback((groups: MuscleGroupWithPercentage[]) => {
    setMuscleGroupsWithPercentage(groups);
  }, []);

  // Оптимизированные TextField компоненты с защитой от ошибок состояния
  const renderTextField = useCallback(({
    label,
    value,
    onChange,
    field,
    multiline = false,
    rows = 1,
    type = 'text',
    inputProps = {},
    placeholder = '',
    required = false,
    error = false
  }: {
    label: string,
    value: string | number,
    onChange: (value: string | number) => void,
    field: keyof WorkoutFormData,
    multiline?: boolean,
    rows?: number,
    type?: string,
    inputProps?: Record<string, any>,
    placeholder?: string,
    required?: boolean,
    error?: boolean
  }) => {
    // Определяем максимальную длину для разных полей
    let maxLength = 255; // По умолчанию
    let helperText = '';
    let hasError = error;
    
    if (field === 'name') {
      maxLength = 125;
      helperText = `${String(value).length}/125 символов`;
      hasError = error || String(value).length > 125;
    } else if (field === 'description') {
      maxLength = 500;
      helperText = `${String(value).length}/500 символов`;
      hasError = error || String(value).length > 500;
    } else if (field === 'video_url') {
      maxLength = 500;
      helperText = `${String(value).length}/500 символов`;
      hasError = error || String(value).length > 500;
    }
    
    return (
      <TextField
        label={label}
        value={value}
        onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        fullWidth
        multiline={multiline}
        rows={rows}
        type={type}
        inputProps={{ ...inputProps, maxLength: type !== 'number' ? maxLength : undefined }}
        placeholder={placeholder}
        required={required}
        error={hasError}
        disabled={loading}
        helperText={type !== 'number' && ['name', 'description', 'video_url'].includes(field) ? helperText : undefined}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
          }
        }}
      />
    );
  }, [loading]);

  // Валидация формы
  const validateForm = (): string | null => {
    if (!formData.name.trim()) {
      return 'Название тренировки обязательно для заполнения';
    }
    
    if (formData.name.trim().length < 3) {
      return 'Название тренировки должно содержать минимум 3 символа';
    }

    if (formData.name.trim().length > 125) {
      return 'Название тренировки не должно превышать 125 символов';
    }

    if (formData.description && formData.description.length > 500) {
      return 'Описание тренировки не должно превышать 500 символов';
    }

    if (formData.video_url && formData.video_url.length > 500) {
      return 'Ссылка на видео не должна превышать 500 символов';
    }

    // Простая валидация URL (если поле заполнено)
    if (formData.video_url && formData.video_url.trim()) {
      const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
      if (!urlPattern.test(formData.video_url)) {
        return 'Введите корректную ссылку на видео';
      }
    }

    // Валидация процентного распределения групп мышц
    if (muscleGroupsWithPercentage && muscleGroupsWithPercentage.length > 0) {
      // Фильтруем только задействованные группы (с процентом > 0)
      const activeGroups = muscleGroupsWithPercentage.filter(group => group.percentage > 0);
      
      if (activeGroups.length > 0) {
        const totalPercentage = activeGroups.reduce((sum, group) => sum + group.percentage, 0);
        
        if (totalPercentage !== 100) {
          return `Сумма процентной задействованности групп мышц должна равняться 100%. Текущая сумма: ${totalPercentage}%`;
        }
      }
      // Если нет задействованных групп (все имеют 0%), это тоже валидно
    }

    return null;
  };

  // Форматирование длительности для отображения
  const formatDuration = (seconds: number | null | undefined): string => {
    if (!seconds) return '0 мин';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours} ч ${minutes > 0 ? `${minutes} мин` : ''}`;
    }
    
    return `${minutes} мин`;
  };

  // Обработчик отправки формы
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Валидация формы
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    if (!courseId) {
      setError('ID курса не указан');
      return;
    }
    
    try {
      setLoading(true);
      setSuccess(null); // Сбрасываем предыдущее сообщение об успехе
      
      // Подготавливаем данные для отправки
      const workoutPayload: CourseWorkoutCreate = {
        course_uuid: String(courseId),
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        video_url: formData.video_url.trim() || undefined,
        duration: formData.duration || undefined,
        is_paid: formData.is_paid,
        is_published: formData.is_published,
        // Фильтруем группы мышц с 0% - передаем только задействованные
        muscle_groups: muscleGroupsWithPercentage
          .filter(group => group.percentage > 0)
          .map(group => ({
            id: group.id,
            percentage: group.percentage
          }))
      };
      
      // Получаем токен авторизации
      const token = getCookie('access_token');
      if (!token) {
        setError('Необходима авторизация для создания тренировки');
        setLoading(false);
        return;
      }
      
      let result;
      if (isEditMode && workoutId) {
        // Обновляем существующую тренировку
        const updateData: UpdateWorkoutData = {
          name: workoutPayload.name,
          description: workoutPayload.description,
          video_url: workoutPayload.video_url,
          duration: workoutPayload.duration,
          is_paid: workoutPayload.is_paid,
          is_published: workoutPayload.is_published,
          // Фильтруем группы мышц с 0% - передаем только задействованные
          muscle_groups: muscleGroupsWithPercentage
            .filter(group => group.percentage > 0)
            .map(group => ({
              id: group.id,
              percentage: group.percentage
            }))
        };
        
        result = await workoutsApi.update(String(workoutId), updateData, token);
        
        // Показываем сообщение об успешном сохранении
        setSuccess('Тренировка успешно обновлена');
      } else {
        // Создаем новую тренировку
        result = await workoutsApi.create(workoutPayload, token);
        
        // Показываем сообщение об успешном сохранении
        setSuccess('Тренировка успешно создана');
      }
      
    } catch (err: any) {
      console.error('Ошибка при сохранении тренировки:', err);
      setError(err.message || 'Не удалось сохранить тренировку');
    } finally {
      setLoading(false);
    }
  };

  // Сброс сообщения об успехе через некоторое время
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000); // Скрываем через 5 секунд
      
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Обновление заголовка страницы после успешного сохранения в режиме редактирования
  useEffect(() => {
    if (success && isEditMode && workoutId) {
      // Обновляем title в компоненте SearchBar, если имя тренировки изменилось
      document.title = `Редактирование тренировки - ${formData.name}`;
    }
  }, [success, isEditMode, workoutId, formData.name]);

  // Обработчик открытия диалога подтверждения удаления
  const handleOpenDeleteDialog = () => {
    setDeleteDialogOpen(true);
  };

  // Обработчик закрытия диалога подтверждения удаления
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
  };

  // Обработчик удаления тренировки
  const handleDeleteWorkout = async () => {
    if (!workoutId) return;
    
    try {
      setDeleteLoading(true);
      const token = getCookie('access_token');
      if (!token) {
        setError('Необходима авторизация для удаления тренировки');
        return;
      }
      
      // Отправляем запрос на удаление тренировки
      await workoutsApi.delete(String(workoutId), token);
      
      // Закрываем диалог
      setDeleteDialogOpen(false);
      
      // Перенаправляем на страницу курса
      if (courseId) {
        router.push(`/courses/${courseId}`);
      } else {
        router.push('/courses');
      }
      
    } catch (err: any) {
      console.error('Ошибка при удалении тренировки:', err);
      setError(err.message || 'Произошла ошибка при удалении тренировки');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Показываем ошибку, если нет courseId
  if (!courseId) {
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
          onBackClick={() => router.push('/courses')}
          title={isEditMode ? "Редактирование тренировки" : "Создание тренировки"}
          placeholder={isEditMode ? "Редактирование тренировки" : "Создание тренировки"}
        />
        
        <MainLayout>
          <Stack spacing={3} sx={{ p: 3, pt: 7 }}>
            <Alert severity="error">
              ID курса не указан. Попробуйте вернуться на страницу курса и повторить попытку.
            </Alert>
            <Button 
              onClick={() => router.push('/courses')}
              variant="outlined"
              sx={{ alignSelf: 'flex-start' }}
            >
              Перейти к курсам
            </Button>
          </Stack>
        </MainLayout>
      </>
    );
  }
  
  // Показываем индикатор загрузки при загрузке данных тренировки
  if (initialLoading) {
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
          onBackClick={handleBack}
          title="Редактирование тренировки"
          placeholder="Редактирование тренировки"
        />
        
        <MainLayout>
          <Stack spacing={3} sx={{ pb: 4, px: 1, pt: 7, alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
            <CircularProgress size={40} />
            <Typography>Загрузка данных тренировки...</Typography>
          </Stack>
        </MainLayout>
      </>
    );
  }

  return (
    <>
      {/* SearchBar с кнопкой назад */}
      <SearchBar 
        isSearchBarVisible={true} 
        isAtTop={true} 
        showBackButton={true}
        showProfileButton={false}
        showFilterButton={false}
        showSettingsButton={false}
        showCreateButton={false}
        showSearchField={false}
        onBackClick={handleBack}
        title={isEditMode ? "Редактирование тренировки" : "Создание тренировки"}
        placeholder={isEditMode ? "Редактирование тренировки" : "Создание тренировки"}
      />
      
      <MainLayout>
        <Stack spacing={3} sx={{ pb: 4, px: 1, pt: 7 }}>
          {/* Форма создания/редактирования тренировки */}
          <Paper
            elevation={0}
            sx={{
              borderRadius: theme.shape.borderRadius,
              backgroundColor: theme.palette.backgrounds?.paper,
              p: { xs: 2, sm: 3 },
            }}
          >
            <form onSubmit={handleSubmit}>
              <Stack spacing={3}>
                {/* Показываем ошибку, если есть */}
                {error && (
                  <Alert severity="error" sx={{ borderRadius: 2 }}>
                    {error}
                  </Alert>
                )}

                {/* Основная информация */}
                <Box>
                  <Stack spacing={2}>
                    {/* Название тренировки */}
                    {renderTextField({
                      label: "Название тренировки",
                      value: formData.name,
                      onChange: (value) => handleFieldChange('name', value as string),
                      field: 'name',
                      required: true,
                      error: !!error && error.includes('Название'),
                      placeholder: "Введите название тренировки"
                    })}

                    {/* Описание тренировки */}
                    {renderTextField({
                      label: "Описание тренировки",
                      value: formData.description,
                      onChange: (value) => handleFieldChange('description', value as string),
                      field: 'description',
                      multiline: true,
                      rows: 3,
                      placeholder: "Введите подробное описание тренировки"
                    })}
                    
                    {/* Длительность тренировки */}
                    <Box>
                      <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 1 }}>
                        Длительность тренировки
                      </Typography>
                      <Stack direction="row" spacing={2} alignItems="flex-start">
                        {renderTextField({
                          label: "Часы",
                          value: formData.hours,
                          onChange: (value) => handleFieldChange('hours', Number(value)),
                          field: 'hours',
                          type: 'number',
                          inputProps: { min: 0, step: 1 }
                        })}
                        {renderTextField({
                          label: "Минуты",
                          value: formData.minutes,
                          onChange: (value) => handleFieldChange('minutes', Number(value)),
                          field: 'minutes',
                          type: 'number',
                          inputProps: { min: 0, max: 59, step: 1 }
                        })}
                      </Stack>
                      <Typography variant="caption" color={theme.palette.textColors?.secondary} sx={{ mt: 0.5, display: 'block' }}>
                        Общая длительность: {formatDuration(formData.duration)}
                      </Typography>
                    </Box>

                    {/* Ссылка на видео */}
                    {renderTextField({
                      label: "Ссылка на видео",
                      value: formData.video_url,
                      onChange: (value) => handleFieldChange('video_url', value as string),
                      field: 'video_url',
                      placeholder: "Вставьте ссылку на видео",
                      error: !!error && error.includes('видео')
                    })}
                  </Stack>
                </Box>

                <Divider />

                {/* Группы мышц */}
                <MuscleGroupSelector 
                  selectedGroups={formData.muscle_groups} 
                  onGroupsChange={handleMuscleGroupsChange}
                  onDistributionChange={handleDistributionChange}
                />
                
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
                    {/* Видимость тренировки */}
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.is_published}
                          onChange={(e) => handleFieldChange('is_published', e.target.checked)}
                          color="primary"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body1" fontWeight="medium">
                            {formData.is_published ? 'Урок виден всем' : 'Урок скрыт'}
                          </Typography>
                          <Typography variant="body2" color={theme.palette.textColors?.secondary}>
                            {formData.is_published 
                              ? 'Тренировка будет доступна подписчикам курса' 
                              : 'Тренировка будет видна только вам'}
                          </Typography>
                        </Box>
                      }
                      sx={{ ml: 0, alignItems: 'flex-start' }}
                    />

                    {/* Платность тренировки */}
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.is_paid}
                          onChange={(e) => handleFieldChange('is_paid', e.target.checked)}
                          color="primary"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body1" fontWeight="medium">
                            {formData.is_paid ? 'Доступ по подписке' : 'Без подписки'}
                          </Typography>
                          <Typography variant="body2" color={theme.palette.textColors?.secondary}>
                            {formData.is_paid 
                              ? 'Тренировка требует активной подписки на курс' 
                              : 'Тренировка доступна всем пользователям'}
                          </Typography>
                        </Box>
                      }
                      sx={{ ml: 0, alignItems: 'flex-start' }}
                    />
                  </Stack>
                </Box>

                <Divider />

                {/* Кнопки действий */}
                <Box>
                  <Stack 
                    direction={{ xs: 'column', sm: 'row' }} 
                    spacing={2} 
                    sx={{ pt: 2 }}
                    justifyContent="space-between"
                  >
                    <Button
                      onClick={handleBack}
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
                    
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      {/* Кнопка удаления (только в режиме редактирования) */}
                      {isEditMode && (
                        <Button
                          variant="outlined"
                          color="error"
                          onClick={handleOpenDeleteDialog}
                          disabled={loading}
                          sx={{ 
                            borderRadius: 2,
                            flex: { xs: 1, sm: 'none' }
                          }}
                        >
                          Удалить тренировку
                        </Button>
                      )}
                      
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
                        {loading 
                          ? (isEditMode ? 'Сохранение...' : 'Создание...') 
                          : (isEditMode ? 'Сохранить изменения' : 'Создать тренировку')
                        }
                      </Button>
                    </Stack>
                  </Stack>
                  
                  {/* Показываем сообщение об успешном сохранении */}
                  {success && (
                    <Alert 
                      severity="success" 
                      sx={{ 
                        borderRadius: 2, 
                        mt: 3,
                        backgroundColor: theme.palette.success.light,
                        color: theme.palette.success.dark,
                        '& .MuiAlert-icon': {
                          color: theme.palette.success.main
                        }
                      }}
                    >
                      {success}
                    </Alert>
                  )}
                </Box>
              </Stack>
            </form>
          </Paper>
          
          {/* Диалог подтверждения удаления */}
          <Dialog
            open={deleteDialogOpen}
            onClose={handleCloseDeleteDialog}
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-description"
          >
            <DialogTitle id="delete-dialog-title">
              Удаление тренировки
            </DialogTitle>
            <DialogContent>
              <DialogContentText id="delete-dialog-description">
                Вы действительно хотите удалить эту тренировку? Это действие невозможно отменить.
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button 
                onClick={handleCloseDeleteDialog} 
                color="inherit"
                disabled={deleteLoading}
              >
                Отмена
              </Button>
              <Button 
                onClick={handleDeleteWorkout} 
                color="error"
                disabled={deleteLoading}
                startIcon={deleteLoading ? <CircularProgress size={16} /> : null}
                autoFocus
              >
                {deleteLoading ? 'Удаление...' : 'Удалить'}
              </Button>
            </DialogActions>
          </Dialog>
        </Stack>
      </MainLayout>
    </>
  );
}

// Основной компонент страницы с оберткой Suspense
export default function CreateWorkoutPage() {
  return (
    <Suspense fallback={
      <MainLayout>
        <Stack sx={{ pt: 10, px: 2, alignItems: 'center' }}>
          <CircularProgress size={40} />
          <Typography sx={{ mt: 2 }}>Загрузка...</Typography>
        </Stack>
      </MainLayout>
    }>
      <WorkoutCreateContent />
    </Suspense>
  );
} 