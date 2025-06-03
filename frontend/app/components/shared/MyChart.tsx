"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import {
  Box,
  Typography,
  IconButton,
  Paper,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  useTheme,
  CircularProgress,
  TextField,
  InputAdornment,
  Stack,
  Collapse,
  Divider,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
} from "@mui/material";

import CreateIcon from "@mui/icons-material/Create";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import RefreshIcon from "@mui/icons-material/Refresh";
import SettingsIcon from "@mui/icons-material/Settings";

import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs, { Dayjs } from "dayjs";

// Импортируем API
import { userActivityApi, UserActivity, motivationApi, MotivationResponse } from "../../services/api";

// Тип данных для графика
interface ChartItem {
  day: string;
  weight: number;
  workouts: number;
}

// Интерфейс для данных редактирования активности
interface EditActivityData {
  day: string;
  weight: number;
  workouts: number;
}

// Компонент больше не принимает данные как props
interface MyChartProps {}

// Диапазоны для авто-масштаба
const HALF_RANGES = [2.5, 10, 30, 50, 100];

export default function MyChart({}: MyChartProps) {
  // Достаём тему, где прописаны highlight, backgrounds, textColors и т.д.
  const theme = useTheme();

  // Состояние попапа выбора дат
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState<Dayjs | null>(dayjs().subtract(7, "day"));
  const [endDate, setEndDate] = useState<Dayjs | null>(dayjs());
  
  // Состояние для хранения данных
  const [data, setData] = useState<ChartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Состояние для редактирования активности
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState<EditActivityData | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Состояние для мотивационного сообщения
  const [motivationMessage, setMotivationMessage] = useState<MotivationResponse | null>(null);
  const [motivationExpanded, setMotivationExpanded] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Состояние для диалога настроек уровня жёсткости
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [currentResponseLevel, setCurrentResponseLevel] = useState(1); // 1 - лояльный, 2 - средний, 3 - жёсткий
  const [settingsLoading, setSettingsLoading] = useState(false);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  // Обработчики для редактирования активности
  const handleEditOpen = (day: string, weight: number, workouts: number) => {
    setEditData({ day, weight, workouts });
    setEditDialogOpen(true);
  };

  const handleEditClose = () => {
    setEditDialogOpen(false);
    setEditData(null);
  };

  // Обработчики изменения количества тренировок
  const handleWorkoutsIncrement = () => {
    if (editData) {
      setEditData({ ...editData, workouts: editData.workouts + 1 });
    }
  };

  const handleWorkoutsDecrement = () => {
    if (editData && editData.workouts > 0) {
      setEditData({ ...editData, workouts: editData.workouts - 1 });
    }
  };

  // Обработчики изменения веса
  const handleWeightIncrement = () => {
    if (editData) {
      setEditData({ ...editData, weight: +(editData.weight + 0.1).toFixed(1) });
    }
  };

  const handleWeightDecrement = () => {
    if (editData && editData.weight > 0.1) {
      setEditData({ ...editData, weight: +(editData.weight - 0.1).toFixed(1) });
    }
  };

  // Обработчик ручного ввода веса
  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0 && editData) {
      setEditData({ ...editData, weight: +value.toFixed(1) });
    }
  };

  // Обработчик сохранения изменений
  const handleSaveEdit = async () => {
    if (!editData) return;

    setEditLoading(true);
    try {
      // Создаем объект активности для обновления, без указания user_id
      const activityData: UserActivity = {
        record_date: editData.day,
        workout_count: editData.workouts,
        weight: editData.weight
      };

      // Отправляем запрос на обновление
      await userActivityApi.updateActivity(activityData);

      // Обновляем данные на графике
      setData(data.map(item => 
        item.day === editData.day 
          ? { ...item, workouts: editData.workouts, weight: editData.weight }
          : item
      ));

      // Закрываем диалог
      handleEditClose();
    } catch (err) {
      console.error('Ошибка при обновлении активности:', err);
      // Можно добавить отображение ошибки пользователю
    } finally {
      setEditLoading(false);
    }
  };

  // Обработчик перегенерации мотивационного сообщения
  const handleRegenerateMotivation = async () => {
    if (regenerating) return; // Предотвращаем повторные клики
    
    if (!startDate || !endDate) {
      console.warn('Даты не выбраны, невозможно перегенерировать мотивацию');
      return;
    }
    
    setRegenerating(true);
    try {
      // Используем выбранные даты из состояния (меняем местами для API)
      const dateStartFormatted = endDate.format('YYYY-MM-DD'); // API ожидает date_start как конечную дату
      const dateEndFormatted = startDate.format('YYYY-MM-DD');   // API ожидает date_end как начальную дату
      
      console.log(`Запрашиваем перегенерацию мотивации за период: ${startDate.format('YYYY-MM-DD')} → ${endDate.format('YYYY-MM-DD')}`);
      
      // Отправляем запрос на перегенерацию
      const regeneratedResponse = await motivationApi.regenerateMotivation(dateEndFormatted, dateStartFormatted);
      
      // Сразу обновляем состояние новыми данными
      setMotivationMessage(regeneratedResponse);
      console.log('Мотивационное сообщение перегенерировано:', regeneratedResponse);
      
      // Автоматически разворачиваем блок если он свернут
      if (!motivationExpanded) {
        setMotivationExpanded(true);
      }
      
    } catch (error) {
      console.error('Ошибка при перегенерации мотивации:', error);
    } finally {
      setRegenerating(false);
    }
  };

  // Обработчики для диалога настроек
  const handleSettingsOpen = () => {
    setSettingsDialogOpen(true);
    // Загружаем текущий уровень жёсткости пользователя
    loadUserResponseLevel();
  };

  const handleSettingsClose = () => {
    setSettingsDialogOpen(false);
  };

  const handleResponseLevelChange = (level: number) => {
    setCurrentResponseLevel(level);
  };

  // Загрузка текущего уровня жёсткости пользователя
  const loadUserResponseLevel = async () => {
    try {
      const levelData = await motivationApi.getUserResponseLevel();
      if (levelData) {
        setCurrentResponseLevel(levelData.response_level_id);
        console.log('Загружен уровень жёсткости:', levelData.response_level_id);
      } else {
        // По умолчанию уровень 1 (лояльный)
        setCurrentResponseLevel(1);
        console.log('Уровень жёсткости не найден, используем значение по умолчанию: 1');
      }
    } catch (error) {
      console.error('Ошибка при загрузке уровня жёсткости:', error);
      setCurrentResponseLevel(1);
    }
  };

  const handleSettingsSave = async () => {
    setSettingsLoading(true);
    try {
      console.log('Сохраняем уровень жёсткости:', currentResponseLevel);
      
      const result = await motivationApi.updateUserResponseLevel(currentResponseLevel);
      if (result) {
        console.log('Уровень жёсткости успешно сохранён:', result);
        setSettingsDialogOpen(false);
      } else {
        console.error('Не удалось сохранить уровень жёсткости');
      }
    } catch (error) {
      console.error('Ошибка при сохранении настроек:', error);
    } finally {
      setSettingsLoading(false);
    }
  };

  // Функция для получения мотивационного сообщения
  const fetchMotivationData = async (start?: Dayjs, end?: Dayjs) => {
    try {
      // Используем переданные даты или текущие состояния startDate/endDate
      const startToUse = start || startDate;
      const endToUse = end || endDate;
      
      if (!startToUse || !endToUse) {
        console.warn('Даты не выбраны, пропускаем запрос мотивации');
        return;
      }
      
      // Форматируем выбранные даты
      const dateStartFormatted = endToUse.format('YYYY-MM-DD'); // date_start - это конечная дата периода
      const dateEndFormatted = startToUse.format('YYYY-MM-DD');   // date_end - это начальная дата периода
      
      console.log(`Запрашиваем мотивацию за период: ${startToUse.format('YYYY-MM-DD')} → ${endToUse.format('YYYY-MM-DD')}`);
      const motivationResponse = await motivationApi.getDailyMotivation(dateEndFormatted, dateStartFormatted);
      setMotivationMessage(motivationResponse);
      console.log('Мотивационное сообщение успешно получено:', motivationResponse);
    } catch (motivationError) {
      console.warn('Ошибка при получении мотивационного сообщения:', motivationError);
      // Ошибка получения мотивации не влияет на остальную функциональность
    }
  };

  // Функция для получения данных активности
  const fetchActivityData = async (start: Dayjs, end: Dayjs) => {
    setLoading(true);
    setError(null);
    try {
      const startStr = start.format('YYYY-MM-DD');
      const endStr = end.format('YYYY-MM-DD');
      
      const response = await userActivityApi.getActivity(startStr, endStr);
      
      // Преобразуем данные в формат для графика
      const chartData: ChartItem[] = response.map(item => ({
        day: item.record_date,
        workouts: item.workout_count,
        weight: item.weight || 0
      }));
      
      setData(chartData);
    } catch (err) {
      console.error('Ошибка при получении данных активности:', err);
      setError('Не удалось загрузить данные активности');
      // Если не удалось получить данные, используем пустой массив
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Загружаем начальные данные при монтировании компонента
  useEffect(() => {
    if (startDate && endDate) {
      // Загружаем данные активности для графика
      fetchActivityData(startDate, endDate);
      // Загружаем мотивационное сообщение для выбранного периода
      fetchMotivationData(startDate, endDate);
    }
  }, [startDate, endDate]);

  // Автоматическое обновление мотивационного сообщения каждые 5 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      if (startDate && endDate) {
        fetchMotivationData(startDate, endDate);
      }
    }, 5000); // 5 секунд

    // Очищаем интервал при размонтировании компонента
    return () => clearInterval(interval);
  }, [startDate, endDate]);

  // Обработчик применения фильтра дат
  const handleApplyDateFilter = () => {
    if (startDate && endDate) {
      fetchActivityData(startDate, endDate);
      fetchMotivationData(startDate, endDate);
      handleClose();
    }
  };

  // Определяем min/max веса, игнорируя нулевые (weight=0)
  const { weightMin, weightMax } = useMemo(() => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (const item of data) {
      if (item.weight !== 0) {
        if (item.weight < min) min = item.weight;
        if (item.weight > max) max = item.weight;
      }
    }
    if (min === Number.POSITIVE_INFINITY) {
      // Если все weight=0
      min = 50;
      max = 70;
    }
    return { weightMin: min, weightMax: max };
  }, [data]);

  // Нормализация данных: workouts -> 0..1, weight -> 1..2
  const transformedData = useMemo(() => {
    if (!data.length) return [];

    const center = (weightMin + weightMax) / 2;
    const halfDiff = (weightMax - weightMin) / 2;

    let chosen = HALF_RANGES[HALF_RANGES.length - 1];
    for (const hr of HALF_RANGES) {
      if (hr >= halfDiff) {
        chosen = hr;
        break;
      }
    }

    const domainLow = center - chosen;
    const domainHigh = center + chosen;

    return data.map((item) => {
      // Если workouts=0 => null (разрыв)
      let wNorm: number | null = item.workouts === 0 ? null : item.workouts / 5;

      // Вес
      let w = item.weight;
      if (w < domainLow) w = domainLow;
      if (w > domainHigh) w = domainHigh;

      let wtNorm: number | null;
      if (item.weight === 0) {
        wtNorm = null; // разрыв
      } else {
        const ratio = (w - domainLow) / (domainHigh - domainLow);
        wtNorm = 1 + ratio; // 1..2
      }

      return {
        ...item,
        workoutsNorm: wNorm,
        weightNorm: wtNorm,
      };
    });
  }, [data, weightMin, weightMax]);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Paper
        elevation={0}
        sx={{
          position: "relative",
          p: 2,
          borderRadius: 2,
          overflow: "hidden",
          // Фон берём из backgrounds.paper
          bgcolor: theme.palette.backgrounds?.paper,
          width: "100%",
        }}
      >
        {/* Иконка календаря (слева сверху) */}
        <IconButton
          onClick={handleOpen}
          sx={{
            position: "absolute",
            top: 8,
            left: 8,
            // Оранжевый => highlight.main
            color: theme.palette.highlight?.main,
          }}
        >
          <CalendarMonthIcon />
        </IconButton>

        {/* Иконка карандаша (справа сверху) */}
        <IconButton
          onClick={() => {
            const today = dayjs().format('YYYY-MM-DD');
            const todayData = data.find(item => item.day === today) || { day: today, weight: 70, workouts: 0 };
            handleEditOpen(todayData.day, todayData.weight, todayData.workouts);
          }}
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            color: theme.palette.highlight?.main,
          }}
        >
          <CreateIcon />
        </IconButton>

        {/* График */}
        <Box sx={{ width: "100%", height: 300, mt: 6, mb: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress color="primary" />
            </Box>
          ) : error ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Typography color="error">{error}</Typography>
            </Box>
          ) : data.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Typography>Нет данных для отображения</Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={transformedData}
                margin={{ top: 0, right: 20, left: -40, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  // Берём цвет из theme.palette.divider (или backgrounds?.paper)
                  stroke={theme.palette.divider}
                />

                {/* Ось X */}
                <XAxis
                  dataKey="day"
                  tickFormatter={(val) => val.slice(5)}
                  tick={{
                    fontSize: 10,
                    textAnchor: "end",
                    // Текст => textColors.primary
                    fill: theme.palette.textColors?.primary,
                  }}
                  height={50}
                  axisLine={{
                    stroke: theme.palette.divider,
                  }}
                  tickLine={{
                    stroke: theme.palette.divider,
                  }}
                />

                {/* Ось Y */}
                <YAxis domain={[0, 2]} tick={false} axisLine={false} tickLine={false} />

                {/* Линия тренировок */}
                <Line
                  type="monotone"
                  dataKey="workoutsNorm"
                  name="Тренировки"
                  stroke={theme.palette.textColors?.workouts || "#64b5f6"}
                  strokeWidth={2}
                  dot
                  connectNulls
                />

                {/* Линия веса */}
                <Line
                  type="monotone"
                  dataKey="weightNorm"
                  name="Вес"
                  stroke={theme.palette.highlight?.main || "#ff9800"}
                  strokeWidth={2}
                  dot
                  connectNulls
                />

                {/* Tooltip */}
                <Tooltip
                  content={(props) => {
                    if (!props.active || !props.payload || !props.payload.length) return null;
                    const { day, weight, workouts } = props.payload[0].payload;

                    return (
                      <div
                        style={{
                          background: theme.palette.backgrounds?.paper,
                          border: `1px solid ${theme.palette.divider}`,
                          padding: "8px",
                          pointerEvents: "auto",
                          color: theme.palette.textColors?.primary,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div>Дата: {day}</div>
                        {/* Вес (оранжевый) */}
                        <div style={{ color: theme.palette.highlight?.main}}>
                          Вес (кг): {weight}
                        </div>
                        {/* Тренировки (голубой) */}
                        <div style={{ color: theme.palette.textColors?.workouts}}>
                          Тренировки (шт): {workouts}
                        </div>

                        {/* Кнопка «Редактировать» */}
                        <div style={{ marginTop: "8px" }}>
                          <button
                            style={{
                              backgroundColor: theme.palette.highlight?.main,
                              color: theme.palette.textColors?.primary,
                              border: "none",
                              borderRadius: "4px",
                              padding: "4px 8px",
                              cursor: "pointer",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditOpen(day, weight, workouts);
                            }}
                          >
                            Редактировать
                          </button>
                        </div>
                      </div>
                    );
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Box>

        {/* Легенда с маркерами */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: 4, 
          mb: 2
        }}>
          {/* Маркер для веса */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{
              width: 20,
              height: 3,
              backgroundColor: theme.palette.highlight?.main,
              borderRadius: 1
            }} />
            <Typography 
              variant="body2" 
              sx={{ 
                color: theme.palette.textColors?.primary,
                fontFamily: theme.typography.fontFamily
              }}
            >
              Вес
            </Typography>
          </Box>

          {/* Маркер для тренировок */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{
              width: 20,
              height: 3,
              backgroundColor: theme.palette.textColors?.workouts,
              borderRadius: 1
            }} />
            <Typography 
              variant="body2" 
              sx={{ 
                color: theme.palette.textColors?.primary,
                fontFamily: theme.typography.fontFamily
              }}
            >
              Тренировки
            </Typography>
          </Box>
        </Box>

        {/* Диалог выбора дат */}
        <Dialog 
          open={open} 
          onClose={handleClose}
          PaperProps={{
            sx: { bgcolor: theme.palette.backgrounds?.paper },
            elevation: 0
          }}
        >
          <DialogTitle>Выберите период</DialogTitle>
          <DialogContent>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
              <DatePicker
                label="Начальная дата"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
              />
              <DatePicker
                label="Конечная дата"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Отмена</Button>
            <Button 
              onClick={handleApplyDateFilter} 
              variant="contained" 
              sx={{ 
                bgcolor: theme.palette.highlight?.main,
                '&:hover': {
                  bgcolor: theme.palette.highlight?.accent,
                },
                color: theme.palette.textColors?.primary
              }}
            >
              Применить
            </Button>
          </DialogActions>
        </Dialog>

        {/* Диалог редактирования активности */}
        <Dialog 
          open={editDialogOpen} 
          onClose={handleEditClose} 
          maxWidth="xs" 
          fullWidth
          PaperProps={{
            sx: { bgcolor: theme.palette.backgrounds?.paper },
            elevation: 0
          }}
        >
          <DialogTitle>
            Редактировать данные на {editData?.day}
          </DialogTitle>
          <DialogContent>
            {editData && (
              <Stack spacing={3} sx={{ mt: 1 }}>
                {/* Редактирование количества тренировок */}
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Количество тренировок
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton 
                      onClick={handleWorkoutsDecrement} 
                      disabled={editData.workouts <= 0}
                      color="primary"
                    >
                      <RemoveIcon />
                    </IconButton>
                    <Typography variant="h6" sx={{ minWidth: '40px', textAlign: 'center' }}>
                      {editData.workouts}
                    </Typography>
                    <IconButton 
                      onClick={handleWorkoutsIncrement} 
                      color="primary"
                    >
                      <AddIcon />
                    </IconButton>
                  </Box>
                </Box>

                {/* Редактирование веса */}
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Вес (кг)
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton 
                      onClick={handleWeightDecrement} 
                      disabled={editData.weight <= 0.1}
                      color="primary"
                    >
                      <RemoveIcon />
                    </IconButton>
                    <TextField
                      value={editData.weight}
                      onChange={handleWeightChange}
                      inputProps={{ 
                        step: 0.1,
                        min: 0,
                        style: { textAlign: 'center' }
                      }}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">кг</InputAdornment>
                      }}
                      type="number"
                      size="small"
                      sx={{ width: '120px' }}
                    />
                    <IconButton 
                      onClick={handleWeightIncrement} 
                      color="primary"
                    >
                      <AddIcon />
                    </IconButton>
                  </Box>
                </Box>
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleEditClose}>Отмена</Button>
            <Button 
              onClick={handleSaveEdit} 
              variant="contained" 
              sx={{ 
                bgcolor: theme.palette.highlight?.main,
                '&:hover': {
                  bgcolor: theme.palette.highlight?.accent,
                },
                color: theme.palette.textColors?.primary
              }}
              disabled={editLoading}
            >
              {editLoading ? <CircularProgress size={24} /> : 'Сохранить'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Блок с иконкой робота под графиком, который разворачивается при клике */}
        {motivationMessage && (
          <Box sx={{ mt: 2, position: 'relative' }}>
            {/* Кликабельный заголовок с иконкой робота */}
            <Box
              onClick={() => setMotivationExpanded(!motivationExpanded)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                cursor: 'pointer',
                p: 2,
                borderRadius: 2,
                bgcolor: 'transparent',
                border: `2px solid ${theme.palette.highlight?.main}`,
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: theme.palette.action?.hover,
                },
                position: 'relative'
              }}
            >
              <SmartToyIcon 
                sx={{ 
                  color: theme.palette.highlight?.main
                }} 
              />
              <Typography 
                variant="body1" 
                sx={{ 
                  color: theme.palette.textColors?.primary,
                  fontFamily: theme.typography.fontFamily,
                  fontWeight: 'normal',
                  flex: 1
                }}
              >
                {motivationMessage.status === 'new' || motivationMessage.status === 'in_progress' || motivationMessage.status === 'regenerating' || motivationMessage.status === 'regenerated' ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} sx={{ color: theme.palette.highlight?.main }} />
                    <span>Генерируем мотивацию...</span>
                  </Box>
                ) : (
                  motivationMessage.motivation_message || 'Загрузка мотивации...'
                )}
              </Typography>
              {/* Показываем стрелку для раскрытия */}
              {motivationExpanded ? (
                <ExpandLessIcon sx={{ color: theme.palette.textColors?.secondary }} />
              ) : (
                <ExpandMoreIcon sx={{ color: theme.palette.textColors?.secondary }} />
              )}
            </Box>

            {/* Разворачивающееся содержимое с информацией о периоде, кнопками обновления и настроек */}
            <Collapse in={motivationExpanded}>
              <Box sx={{ 
                mt: 2, 
                p: 2, 
                bgcolor: theme.palette.backgrounds?.paper,
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`
              }}>
                {/* Информация о периоде и кнопки обновления и настроек */}
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  mb: motivationMessage.fact || motivationMessage.advice ? 2 : 0
                }}>
                  {/* Показываем период если есть */}
                  {motivationMessage.date_period && (
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: theme.palette.textColors?.secondary,
                        fontFamily: theme.typography.fontFamily,
                        fontSize: '0.75rem'
                      }}
                    >
                      Период: {motivationMessage.date_period}
                    </Typography>
                  )}
                  
                  {/* Кнопки обновления и настроек */}
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {/* Кнопка настроек */}
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSettingsOpen();
                      }}
                      sx={{
                        bgcolor: theme.palette.backgrounds?.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        '&:hover': {
                          bgcolor: theme.palette.action?.hover,
                        }
                      }}
                      size="small"
                      title="Настройки жёсткости ответов"
                    >
                      <SettingsIcon 
                        sx={{ 
                          fontSize: 16,
                          color: theme.palette.textColors?.secondary 
                        }} 
                      />
                    </IconButton>
                    
                    {/* Кнопка обновления или спиннер */}
                    {regenerating ? (
                      <CircularProgress size={24} sx={{ color: theme.palette.highlight?.main }} />
                    ) : (
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRegenerateMotivation();
                        }}
                        sx={{
                          bgcolor: theme.palette.backgrounds?.paper,
                          border: `1px solid ${theme.palette.divider}`,
                          '&:hover': {
                            bgcolor: theme.palette.action?.hover,
                          }
                        }}
                        size="small"
                        title="Перегенерировать мотивацию"
                      >
                        <RefreshIcon 
                          sx={{ 
                            fontSize: 16,
                            color: theme.palette.highlight?.main 
                          }} 
                        />
                      </IconButton>
                    )}
                  </Box>
                </Box>

                {/* Разделительная линия если есть дополнительный контент */}
                {(motivationMessage.fact || motivationMessage.advice) && (
                  <Divider sx={{ mb: 2 }} />
                )}

                {motivationMessage.fact && (
                  <Box sx={{ mb: 2 }}>
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        fontWeight: 'bold', 
                        color: theme.palette.textColors?.primary,
                        fontFamily: theme.typography.fontFamily,
                        mb: 1
                      }}
                    >
                      💡 Интересный факт:
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: theme.palette.textColors?.secondary,
                        fontFamily: theme.typography.fontFamily
                      }}
                    >
                      {motivationMessage.fact}
                    </Typography>
                  </Box>
                )}
                
                {motivationMessage.advice && (
                  <Box>
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        fontWeight: 'bold', 
                        color: theme.palette.textColors?.primary,
                        fontFamily: theme.typography.fontFamily,
                        mb: 1
                      }}
                    >
                      🎯 Совет дня:
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: theme.palette.textColors?.secondary,
                        fontFamily: theme.typography.fontFamily
                      }}
                    >
                      {motivationMessage.advice}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Collapse>
          </Box>
        )}

        {/* Диалог настроек уровня жёсткости */}
        <Dialog 
          open={settingsDialogOpen} 
          onClose={handleSettingsClose}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SettingsIcon sx={{ color: theme.palette.highlight?.main }} />
              <Typography variant="h6">
                Настройки мотивационных сообщений
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <FormControl>
              <FormLabel 
                id="response-level-group-label"
                sx={{ 
                  color: theme.palette.textColors?.primary,
                  fontFamily: theme.typography.fontFamily,
                  mb: 2
                }}
              >
                Выберите уровень жёсткости ответов:
              </FormLabel>
              <RadioGroup
                aria-labelledby="response-level-group-label"
                value={currentResponseLevel}
                onChange={(e) => handleResponseLevelChange(Number(e.target.value))}
                name="response-level-group"
              >
                <FormControlLabel 
                  value={1} 
                  control={<Radio sx={{ color: theme.palette.highlight?.main }} />} 
                  label={
                    <Box>
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          fontWeight: 'bold',
                          color: theme.palette.textColors?.primary,
                          fontFamily: theme.typography.fontFamily
                        }}
                      >
                        💚 Лояльный режим
                      </Typography>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: theme.palette.textColors?.secondary,
                          fontFamily: theme.typography.fontFamily
                        }}
                      >
                        Поддерживающий и воодушевляющий тон. Акцент на позитивных моментах.
                      </Typography>
                    </Box>
                  } 
                />
                <FormControlLabel 
                  value={2} 
                  control={<Radio sx={{ color: theme.palette.highlight?.main }} />} 
                  label={
                    <Box>
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          fontWeight: 'bold',
                          color: theme.palette.textColors?.primary,
                          fontFamily: theme.typography.fontFamily
                        }}
                      >
                        ⚖️ Сбалансированный режим
                      </Typography>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: theme.palette.textColors?.secondary,
                          fontFamily: theme.typography.fontFamily
                        }}
                      >
                        Объективная оценка прогресса. Указывает как достижения, так и области для улучшения.
                      </Typography>
                    </Box>
                  } 
                />
                <FormControlLabel 
                  value={3} 
                  control={<Radio sx={{ color: theme.palette.highlight?.main }} />} 
                  label={
                    <Box>
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          fontWeight: 'bold',
                          color: theme.palette.textColors?.primary,
                          fontFamily: theme.typography.fontFamily
                        }}
                      >
                        🔥 Жёсткий режим
                      </Typography>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: theme.palette.textColors?.secondary,
                          fontFamily: theme.typography.fontFamily
                        }}
                      >
                        Безжалостная честность. Прямая критика при низкой активности, только факты.
                      </Typography>
                    </Box>
                  } 
                />
              </RadioGroup>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={handleSettingsClose}
              sx={{ color: theme.palette.textColors?.secondary }}
            >
              Отмена
            </Button>
            <Button 
              onClick={handleSettingsSave} 
              variant="contained" 
              sx={{ 
                bgcolor: theme.palette.highlight?.main,
                '&:hover': {
                  bgcolor: theme.palette.highlight?.accent,
                },
                color: theme.palette.textColors?.primary
              }}
              disabled={settingsLoading}
            >
              {settingsLoading ? <CircularProgress size={24} /> : 'Сохранить'}
            </Button>
          </DialogActions>
        </Dialog>

      </Paper>
    </LocalizationProvider>
  );
}