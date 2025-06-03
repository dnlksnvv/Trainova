"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "@mui/material/styles";
import {
  Box,
  Stack,
  Typography,
  Paper,
  IconButton,
  CircularProgress,
  Button,
  Alert,
  Rating,
  Chip,
  Divider,
  Avatar,
  Container,
  TextField,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  useMediaQuery,
  Card,
  Tooltip,
  Collapse
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbDownOutlinedIcon from "@mui/icons-material/ThumbDownOutlined";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import ShareIcon from "@mui/icons-material/Share";
import SettingsIcon from "@mui/icons-material/Settings";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import CommentIcon from "@mui/icons-material/Comment";
import SendIcon from "@mui/icons-material/Send";
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { coursesApi, workoutsApi, CourseWorkoutResponse, workoutRatingsApi, profileApi } from "@/app/services/api";
import { useAuth } from "@/app/auth/hooks/useAuth";
import MainLayout from "@/app/components/layouts/MainLayout";
import SearchBar from "@/app/components/shared/SearchBar";
import WorkoutRating from '@/app/courses/[id]/components/WorkoutRating';
import TrainerInfo from '@/app/components/shared/TrainerInfo';
import YMAnalytics from '@/app/utils/analytics';
import { WorkoutErrorBlock } from './components/WorkoutErrorBlock';

interface Comment {
  id: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  date: string;
  likes: number;
  isLiked: boolean;
}

interface WorkoutPlayerPageProps {}

export default function WorkoutPlayerPage({}: WorkoutPlayerPageProps) {
  const theme = useTheme();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
  
  // Добавляем состояния для управления панелью поиска при скролле
  const [isSearchBarVisible, setIsSearchBarVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isAtTop, setIsAtTop] = useState(true);
  
  // Добавляем состояние для отображения видео прямо на странице
  const [showVideo, setShowVideo] = useState(false);
  
  // Добавляем состояние для разворачивания описания
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  
  // Извлекаем id курса и тренировки из параметров
  const courseId = Array.isArray(params.id) ? params.id[0] : params.id;
  const workoutId = searchParams.get('workoutId');
  
  // Состояния для данных о тренировке и курсе
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'forbidden' | 'notFound' | null>(null);
  const [workout, setWorkout] = useState<CourseWorkoutResponse | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [authorName, setAuthorName] = useState("Тренер");
  const [authorAvatar, setAuthorAvatar] = useState<string | null>(null);
  const [authorDescription, setAuthorDescription] = useState<string | null>(null);
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [authorLoading, setAuthorLoading] = useState(false);
  const [viewCount, setViewCount] = useState(Math.floor(Math.random() * 1000));
  const [uploadDate, setUploadDate] = useState(new Date().toLocaleDateString());
  const [rating, setRating] = useState<number | null>(0);
  const [authorRating, setAuthorRating] = useState<number>(0);
  const [userWorkoutRating, setUserWorkoutRating] = useState<number>(0);
  
  // Заменяем состояния для лайков/дизлайков на состояния для рейтинга
  const [userRating, setUserRating] = useState<number | null>(null);
  const [isRatingSubmitted, setIsRatingSubmitted] = useState(false);
  const [ratingHover, setRatingHover] = useState(-1);
  const [totalRatings, setTotalRatings] = useState(Math.floor(Math.random() * 50) + 5);
  
  // Состояния для комментариев
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  
  // Обработчик скролла
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const direction = currentScrollY < lastScrollY ? 'up' : 'down';
      const distance = Math.abs(currentScrollY - lastScrollY);
      const atTop = currentScrollY < 10;
      
      setIsAtTop(atTop);
      
      if (atTop) {
        setIsSearchBarVisible(true);
      } else if (direction === 'down' && distance > 30) {
        setIsSearchBarVisible(false);
      } else if (direction === 'up') {
        setIsSearchBarVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [lastScrollY]);
  
  // Эффект для автоматического показа видео при загрузке страницы
  useEffect(() => {
    if (workout && workout.video_url) {
      setShowVideo(true);
      
      // Аналитика: просмотр видео урока
      if (workout.name && courseId) {
        YMAnalytics.watchVideo(workout.name, String(courseId), String(workoutId));
      }
    }
  }, [workout, courseId, workoutId]);
  
  // Эффект для загрузки данных тренировки при открытии страницы
  useEffect(() => {
    console.log('🔄 useEffect сработал:', { workoutId, authLoading, user: !!user, courseId });
    
    if (workoutId) {
      // ПРИНУДИТЕЛЬНО ОЧИЩАЕМ ВЕСЬ КЭШ
      sessionStorage.clear();
      localStorage.clear();
      console.log('🗑️ ВСЁ КЭШ ОЧИЩЕН!');
      
      // Убираем кэширование - всегда загружаем свежие данные
      loadWorkoutData();
      loadMockComments(); // Загрузка фиктивных комментариев
    }
  }, [workoutId, authLoading, user, courseId]);
  
  // Отдельная функция для проверки владения курсом
  const checkOwnership = useCallback(async (courseId: string, userId: number, workoutData: CourseWorkoutResponse) => {
    try {
      console.log('🏫 Начало проверки владения курсом:', courseId);
      const courseData = await coursesApi.getById(courseId);
      console.log('🏫 Данные курса получены:', courseData);
      const isOwner = courseData.user_id === userId;
      setIsOwner(isOwner);
      
      // Устанавливаем рейтинг автора из данных курса
      setAuthorRating(Number(courseData.rating) || 0);
      console.log('⭐ Установлен authorRating:', Number(courseData.rating) || 0);
      
      // Получаем данные автора курса
      if (courseData) {
        setAuthorId(courseData.user_id.toString());
        try {
          const authorProfile = await profileApi.getUserProfile(courseData.user_id.toString());
          if (authorProfile) {
            setAuthorName(`${authorProfile.first_name} ${authorProfile.last_name}`.trim() || "Автор курса");
            setAuthorAvatar(authorProfile.avatar_url);
            setAuthorDescription(authorProfile.description);
          } else {
            setAuthorName(courseData.name?.split(' ')[0] || "Тренер");
          }
        } catch (error) {
          console.error("Ошибка при получении данных автора курса:", error);
          setAuthorName(courseData.name?.split(' ')[0] || "Тренер");
        }
      }
    } catch (error) {
      console.error("Ошибка при проверке владения курсом:", error);
    }
  }, []);
  
  // Функция загрузки данных тренировки
  const loadWorkoutData = async () => {
    if (!workoutId) {
      console.log('❌ workoutId отсутствует, загрузка прекращена');
      return;
    }
    
    try {
      console.log('🚀 Начало загрузки данных тренировки:', workoutId);
      setLoading(true);
      
      // Получаем токен для запроса
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('access_token='))
        ?.split('=')[1];
      
      console.log('🔑 Токен получен:', token ? 'Есть' : 'Нет');
      
      // Загрузка данных тренировки с сервера
      console.log('📡 Выполняем запрос к workoutsApi.getById с workoutId:', String(workoutId));
      const workoutData = await workoutsApi.getById(
        String(workoutId), 
        token
      );
      console.log('✅ Данные тренировки получены:', workoutData);
      setWorkout(workoutData);
      
      // Аналитика: открытие урока
      if (workoutData?.name && courseId) {
        YMAnalytics.openLesson(workoutData.name, String(courseId), String(workoutId));
      }
      
      // Если тренировка получена и пользователь авторизован, проверяем является ли он владельцем
      if (workoutData && !authLoading && user && courseId) {
        console.log('👤 Проверяем владение курсом для courseId:', String(courseId));
        console.log('👤 Условия:', { workoutData: !!workoutData, authLoading, user: !!user, courseId });
        checkOwnership(String(courseId), Number(user.user_id), workoutData);
      } else {
        console.log('❌ Не выполняются условия для checkOwnership:', { workoutData: !!workoutData, authLoading, user: !!user, courseId });
      }
      
      // Загружаем статистику рейтинга тренировки
      try {
        const ratingStats = await workoutRatingsApi.getWorkoutRatingStats(String(workoutId), token);
        if (ratingStats) {
          setRating(ratingStats.average_rating);
          setTotalRatings(ratingStats.total_ratings);
        }
      } catch (ratingError) {
        console.error("Ошибка при загрузке статистики рейтинга:", ratingError);
        // Используем значение из тренировки как запасной вариант
        if (workoutData.rating !== null && typeof workoutData.rating === 'number') {
          setRating(workoutData.rating);
        }
      }
      
      // Загружаем рейтинг пользователя для этой тренировки
      if (token && user) {
        try {
          console.log('⭐ Загружаем пользовательский рейтинг тренировки');
          const userRating = await workoutRatingsApi.getUserRating(String(workoutId), token);
          if (userRating && userRating.rating) {
            setUserWorkoutRating(Number(userRating.rating));
            console.log('⭐ Пользовательский рейтинг получен:', userRating.rating);
          } else {
            setUserWorkoutRating(0);
            console.log('⭐ Пользователь еще не оценивал эту тренировку');
          }
        } catch (userRatingError) {
          console.error("Ошибка при загрузке пользовательского рейтинга:", userRatingError);
          setUserWorkoutRating(0);
        }
      }
      
      // Устанавливаем дату загрузки
      let uploadDateStr = '';
      if (workoutData.created_at) {
        const uploadDate = new Date(workoutData.created_at);
        uploadDateStr = uploadDate.toLocaleDateString();
        setUploadDate(uploadDateStr);
      }
      
      setLoading(false);
      console.log('✅ Загрузка данных тренировки завершена');
    } catch (error: any) {
      console.error("❌ Ошибка при загрузке данных тренировки:", error);
      
      // Проверяем тип ошибки
      if (error?.response?.status === 403 || error?.status === 403) {
        console.log('Доступ к уроку запрещен - устанавливаем errorType = forbidden');
        setErrorType('forbidden');
        setError("Для доступа к данной тренировке необходима активная подписка на курс");
      } else {
        console.log('Другая ошибка - устанавливаем errorType = notFound');
        setErrorType('notFound');
        setError("Не удалось загрузить данные тренировки");
      }
      
      setLoading(false);
    }
  };
  
  // Загрузка фиктивных комментариев
  const loadMockComments = () => {
    setCommentsLoading(true);
    
    // Имитация задержки загрузки
    setTimeout(() => {
      const mockComments: Comment[] = [
        {
          id: '1',
          authorName: 'Александр П.',
          authorAvatar: '',
          text: 'Отличная тренировка! Очень помогла мне улучшить технику.',
          date: '3 дня назад',
          likes: 12,
          isLiked: false
        },
        {
          id: '2',
          authorName: 'Елена С.',
          authorAvatar: '',
          text: 'Спасибо за подробное объяснение упражнений. Буду ждать новых видео!',
          date: '1 неделю назад',
          likes: 8,
          isLiked: false
        },
        {
          id: '3',
          authorName: 'Максим К.',
          authorAvatar: '',
          text: 'Слишком сложно для начинающих, но отличная тренировка для продвинутых спортсменов.',
          date: '2 недели назад',
          likes: 5,
          isLiked: false
        }
      ];
      
      setComments(mockComments);
      setCommentsLoading(false);
    }, 1000);
  };
  
  // Обработчик возврата на страницу курса
  const handleBackToCourse = () => {
    router.push(`/courses/${courseId}`);
  };
  
  // Обработчик перехода к другим курсам
  const handleViewOtherCourses = () => {
    router.push('/courses');
  };
  
  // Обработчик перехода на страницу тренера
  const handleCoachClick = () => {
    // Перенаправление на страницу профиля тренера, если есть ID автора
    if (authorId) {
      router.push(`/courses/coach-profile/${authorId}`);
    }
  };
  
  // Обработчик настроек тренировки
  const handleSettingsClick = () => {
    if (!workout) return;
    // Перенаправляем на страницу создания/редактирования тренировки
    router.push(`/workouts/create?courseId=${courseId}&workoutId=${workout.course_workout_uuid}`);
  };
  
  // Обработчик отправки комментария
  const handleSubmitComment = () => {
    if (!newComment.trim() || !user) return;
    
    const newCommentObj: Comment = {
      id: Date.now().toString(),
      authorName: user.first_name || 'Пользователь',
      authorAvatar: '',
      text: newComment.trim(),
      date: 'только что',
      likes: 0,
      isLiked: false
    };
    
    setComments([newCommentObj, ...comments]);
    setNewComment('');
  };
  
  // Обработчик лайка комментария
  const handleLikeComment = (commentId: string) => {
    setComments(comments.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          likes: comment.isLiked ? comment.likes - 1 : comment.likes + 1,
          isLiked: !comment.isLiked
        };
      }
      return comment;
    }));
  };
  
  // Форматирование длительности
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} сек`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} мин`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (minutes === 0) {
        return `${hours} ч`;
      }
      return `${hours} ч ${minutes} мин`;
    }
  };
  
  // Функция для отображения iframe с видео
  const renderVideoPlayer = () => {
    if (!workout || !workout.video_url) return null;
    
    // Получаем URL видео
    let videoUrl = workout.video_url;
    
    // Определяем тип видео (YouTube, Vimeo, Rutube или другое)
    const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
    const isVimeo = videoUrl.includes('vimeo.com');
    const isRutube = videoUrl.includes('rutube.ru');
    
    // Обработка YouTube
    if (isYouTube) {
      // Добавляем параметры для YouTube
      if (videoUrl.includes('?')) {
        videoUrl += '&autoplay=1&rel=0';
      } else {
        videoUrl += '?autoplay=1&rel=0';
      }
    } 
    // Обработка Vimeo
    else if (isVimeo) {
      // Добавляем параметры для Vimeo
      if (videoUrl.includes('?')) {
        videoUrl += '&autoplay=1';
      } else {
        videoUrl += '?autoplay=1';
      }
    }
    // Обработка Rutube - преобразуем URL в embed формат, если нужно
    else if (isRutube) {
      // Проверяем, содержит ли URL "embed" или "play/embed"
      if (!videoUrl.includes('/embed/') && !videoUrl.includes('/play/embed/')) {
        // Пытаемся извлечь ID видео
        const rutubeIdMatch = videoUrl.match(/\/video\/([a-zA-Z0-9]+)/);
        if (rutubeIdMatch && rutubeIdMatch[1]) {
          // Формируем правильный embed URL
          videoUrl = `https://rutube.ru/play/embed/${rutubeIdMatch[1]}`;
        }
      }
    }
    
    return (
      <Box 
        sx={{ 
          width: '100%', 
          position: 'relative',
          paddingTop: '56.25%', // Соотношение сторон 16:9
          borderRadius: theme.borderRadius.small,
          overflow: 'hidden',
          boxShadow: theme.customShadows.medium,
          bgcolor: 'black',
          mb: 3,
          '& iframe': {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            zIndex: 1 // Добавляем z-index, чтобы iframe был выше других элементов
          }
        }}
      >
        <iframe
          src={videoUrl}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="origin"
        />
      </Box>
    );
  };
  
  // Функция для переключения состояния описания
  const toggleDescription = () => {
    setIsDescriptionExpanded(!isDescriptionExpanded);
  };
  
  return (
    <>
      {/* Панель поиска с кнопками */}
      <SearchBar 
        isSearchBarVisible={isSearchBarVisible} 
        isAtTop={isAtTop} 
        showBackButton={true}
        showProfileButton={false}
        showFilterButton={false}
        showSettingsButton={isOwner}
        showSearchField={false}
        title="Тренировка"
        onBackClick={handleBackToCourse}
        onSettingsClick={isOwner ? handleSettingsClick : undefined}
      />
      
      <MainLayout>
        <Container maxWidth="xl" sx={{ pb: 6, pt: 7 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
              <CircularProgress sx={{ color: theme.palette.highlight?.main }} />
            </Box>
          ) : errorType ? (
            <WorkoutErrorBlock
              type={errorType}
              onViewOtherCourses={handleViewOtherCourses}
              onBackToCourse={handleBackToCourse}
              theme={theme}
            />
          ) : workout ? (
            <Box>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                {/* Левая колонка (видео и информация) */}
                <Box sx={{ flex: 1 }}>
                  {/* Видеоплеер */}
                  {renderVideoPlayer()}
                  
                  {/* Название видео */}
                  <Typography 
                    variant="h4" 
                    sx={{ 
                      fontWeight: 'bold',
                      mb: 2,
                      fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' }
                    }}
                  >
                    {workout.name}
                  </Typography>
                  
                  {/* Информация о видео */}
                  <Stack 
                    direction={{ xs: 'column', sm: 'row' }} 
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    spacing={2}
                    sx={{ mb: 3 }}
                  >
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <VisibilityIcon 
                          fontSize="small" 
                          sx={{ color: theme.palette.textColors?.secondary }} 
                        />
                        <Typography 
                          variant="body2"
                          color={theme.palette.textColors?.secondary}
                        >
                          {viewCount} просмотров
                        </Typography>
                      </Stack>
                      
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <CalendarTodayIcon 
                          fontSize="small" 
                          sx={{ color: theme.palette.textColors?.secondary }} 
                        />
                        <Typography 
                          variant="body2"
                          color={theme.palette.textColors?.secondary}
                        >
                          {uploadDate}
                        </Typography>
                      </Stack>
                    </Stack>
                    
                    <Stack direction="row" spacing={1}>
                      {/* Заменяем кнопки лайков на компонент Rating */}
                      <Paper
                        elevation={0}
                        sx={{
                          py: 0.5,
                          px: 1.5,
                          borderRadius: 20,
                          bgcolor: 'rgba(0,0,0,0.2)',
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <WorkoutRating
                          workoutId={String(workoutId)}
                          userId={user?.user_id}
                          initialRating={rating}
                          totalRatings={totalRatings}
                          theme={theme}
                        />
                      </Paper>
                    </Stack>
                  </Stack>
                  
                  <Divider sx={{ mb: 3 }} />
                  
                  {/* Описание тренировки */}
                  {workout.description && (
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        mb: 3,
                        borderRadius: theme.borderRadius.small,
                        bgcolor: theme.palette.backgrounds?.paper,
                        boxShadow: theme.customShadows.light
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="h6" fontWeight="medium">
                          Описание
                        </Typography>
                        <IconButton
                          onClick={toggleDescription}
                          size="small"
                          sx={{
                            color: theme.palette.highlight?.main,
                            transition: 'transform 0.3s',
                            transform: isDescriptionExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                          }}
                        >
                          <ExpandMoreIcon />
                        </IconButton>
                      </Stack>
                      
                      <Collapse in={isDescriptionExpanded} timeout="auto" unmountOnExit>
                        <Typography 
                          variant="body2" 
                          color={theme.palette.textColors?.secondary}
                          sx={{ 
                            whiteSpace: 'pre-line',
                            mt: 1
                          }}
                        >
                          {workout.description}
                        </Typography>
                      </Collapse>
                    </Paper>
                  )}
                  
                  {/* Информация об авторе */}
                  <Paper 
                    elevation={0}
                    onClick={handleCoachClick}
                    sx={{
                      p: 2,
                      mb: 3,
                      borderRadius: theme.borderRadius.small,
                      bgcolor: theme.palette.backgrounds?.paper,
                      boxShadow: theme.customShadows.medium,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: theme.customShadows.strong,
                      },
                    }}
                  >
                    <TrainerInfo
                      name={authorName}
                      avatarUrl={authorAvatar}
                      rating={authorRating}
                      description={authorDescription}
                      isLoading={authorLoading}
                      theme={theme}
                      size="large"
                    />
                  </Paper>
                  
                  {/* Секция комментариев */}
                  <Typography variant="h6" sx={{ mt: 4, mb: 2, fontWeight: 'medium' }}>
                    Комментарии ({comments.length})
                  </Typography>
                  
                  {/* Форма добавления комментария */}
                  {user && (
                    <Stack 
                      direction="row" 
                      spacing={2} 
                      alignItems="flex-start"
                      sx={{ mb: 3 }}
                    >
                      <Avatar
                        sx={{
                          bgcolor: theme.palette.highlight?.main,
                          width: 40,
                          height: 40
                        }}
                      >
                        {user.first_name?.[0] || 'U'}
                      </Avatar>
                      
                      <TextField
                        fullWidth
                        variant="outlined"
                        placeholder="Добавьте комментарий..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        multiline
                        maxRows={4}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: theme.borderRadius.small,
                            bgcolor: 'rgba(255,255,255,0.05)'
                          }
                        }}
                        InputProps={{
                          endAdornment: (
                            <IconButton 
                              onClick={handleSubmitComment}
                              disabled={!newComment.trim()}
                              sx={{ 
                                color: theme.palette.highlight?.main,
                                opacity: !newComment.trim() ? 0.5 : 1
                              }}
                            >
                              <SendIcon />
                            </IconButton>
                          )
                        }}
                      />
                    </Stack>
                  )}
                  
                  {/* Список комментариев */}
                  {commentsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                      <CircularProgress size={30} />
                    </Box>
                  ) : comments.length > 0 ? (
                    <List sx={{ p: 0 }}>
                      {comments.map((comment) => (
                        <ListItem 
                          key={comment.id}
                          alignItems="flex-start"
                          sx={{ 
                            px: 0, 
                            py: 2,
                            borderBottom: `1px solid rgba(255,255,255,0.1)`
                          }}
                        >
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: theme.palette.highlight?.main }}>
                              {comment.authorName[0]}
                            </Avatar>
                          </ListItemAvatar>
                          
                          <ListItemText
                            primary={
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="subtitle2" fontWeight="bold">
                                  {comment.authorName}
                                </Typography>
                                <Typography 
                                  variant="caption" 
                                  color={theme.palette.textColors?.secondary}
                                >
                                  {comment.date}
                                </Typography>
                              </Stack>
                            }
                            secondary={
                              <Box sx={{ mt: 1 }}>
                                <Typography 
                                  variant="body2" 
                                  sx={{ whiteSpace: 'pre-line', mb: 1 }}
                                >
                                  {comment.text}
                                </Typography>
                                
                                <Button
                                  size="small"
                                  startIcon={comment.isLiked ? <ThumbUpIcon fontSize="small" /> : <ThumbUpOutlinedIcon fontSize="small" />}
                                  onClick={() => handleLikeComment(comment.id)}
                                  sx={{
                                    color: comment.isLiked ? theme.palette.highlight?.main : theme.palette.textColors?.secondary,
                                    py: 0,
                                    minWidth: 0
                                  }}
                                >
                                  {comment.likes}
                                </Button>
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Box 
                      sx={{ 
                        textAlign: 'center',
                        py: 4,
                        color: theme.palette.textColors?.secondary
                      }}
                    >
                      <CommentIcon sx={{ fontSize: 48, opacity: 0.5, mb: 1 }} />
                      <Typography>Комментариев пока нет. Будьте первым!</Typography>
                    </Box>
                  )}
                </Box>
                
                {/* Правая колонка (рекомендации) - только на больших экранах */}
                {!isSmallScreen && (
                  <Box sx={{ width: 360, flexShrink: 0 }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 'medium' }}>
                      Рекомендованные тренировки
                    </Typography>
                    
                    <Stack spacing={2}>
                      {/* Заглушки для рекомендованных тренировок */}
                      {[1, 2, 3, 4].map((item) => (
                        <Card 
                          key={item}
                          sx={{ 
                            display: 'flex', 
                            borderRadius: theme.borderRadius.small,
                            bgcolor: theme.palette.backgrounds?.paper,
                            boxShadow: theme.customShadows.light,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: theme.customShadows.medium,
                              transition: 'all 0.2s ease'
                            }
                          }}
                          onClick={handleBackToCourse}
                        >
                          <Box 
                            sx={{ 
                              width: 160, 
                              height: 90, 
                              position: 'relative',
                              backgroundImage: 'linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(/images/workout-placeholder.jpg)',
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              flexShrink: 0
                            }}
                          >
                            <Box 
                              sx={{
                                position: 'absolute',
                                bottom: 4,
                                right: 4,
                                bgcolor: 'rgba(0,0,0,0.7)',
                                color: 'white',
                                fontSize: '0.75rem',
                                py: 0.2,
                                px: 0.5,
                                borderRadius: 0.5
                              }}
                            >
                              {Math.floor(Math.random() * 30) + 5}:00
                            </Box>
                          </Box>
                          
                          <Box sx={{ p: 1.5, flex: 1 }}>
                            <Typography 
                              variant="subtitle2" 
                              sx={{ 
                                fontWeight: 'medium',
                                mb: 0.5,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                            >
                              Тренировка {item}: {['Кардио', 'Силовая', 'Растяжка', 'Йога'][item % 4]}
                            </Typography>
                            
                            <Typography 
                              variant="caption"
                              color={theme.palette.textColors?.secondary}
                            >
                              {viewCount - (item * 100)} просмотров
                            </Typography>
                          </Box>
                        </Card>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Box>
          ) : (
            <Alert severity="info" sx={{ borderRadius: theme.borderRadius.small }}>
              Тренировка не найдена
            </Alert>
          )}
        </Container>
      </MainLayout>
    </>
  );
} 