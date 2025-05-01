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
} from "@mui/material";

import CreateIcon from "@mui/icons-material/Create";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs, { Dayjs } from "dayjs";

// Импортируем API
import { userActivityApi, UserActivity } from "../../services/api";

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
      // Получаем ID пользователя из кук или localStorage (зависит от реализации аутентификации)
      // Здесь предполагаем, что есть метод для получения ID текущего пользователя
      const userId = '1'; // Временно задаем фиксированный ID

      // Создаем объект активности для обновления
      const activityData: UserActivity = {
        user_id: userId,
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
      fetchActivityData(startDate, endDate);
    }
  }, []);

  // Обработчик применения фильтра дат
  const handleApplyDateFilter = () => {
    if (startDate && endDate) {
      fetchActivityData(startDate, endDate);
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
        elevation={3}
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
        <Box sx={{ width: "100%", height: 300, mt: 6 }}>
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
                margin={{ top: 0, right: 20, left: -40, bottom: 20 }}
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

        {/* Диалог выбора дат */}
        <Dialog open={open} onClose={handleClose}>
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
            <Button onClick={handleApplyDateFilter} variant="contained" color="primary">
              Применить
            </Button>
          </DialogActions>
        </Dialog>

        {/* Диалог редактирования активности */}
        <Dialog open={editDialogOpen} onClose={handleEditClose} maxWidth="xs" fullWidth>
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
              color="primary"
              disabled={editLoading}
            >
              {editLoading ? <CircularProgress size={24} /> : 'Сохранить'}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </LocalizationProvider>
  );
}