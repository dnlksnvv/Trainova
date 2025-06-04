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
  Collapse,
  Modal,
  Backdrop,
  Fade
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
import ReplyIcon from '@mui/icons-material/Reply';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CloseIcon from '@mui/icons-material/Close';
import { 
  coursesApi, 
  workoutsApi, 
  CourseWorkoutResponse, 
  workoutRatingsApi, 
  profileApi,
  commentsApi,
  CommentResponse,
  CommentWithReplies,
  CommentList
} from "@/app/services/api";
import { useAuth } from "@/app/auth/hooks/useAuth";
import MainLayout from "@/app/components/layouts/MainLayout";
import SearchBar from "@/app/components/shared/SearchBar";
import WorkoutRating from '@/app/courses/[id]/components/WorkoutRating';
import TrainerInfo from '@/app/components/shared/TrainerInfo';
import YMAnalytics from '@/app/utils/analytics';
import { WorkoutErrorBlock } from './components/WorkoutErrorBlock';

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
  const [comments, setComments] = useState<CommentList>({ comments: [], total_count: 0 });
  const [newComment, setNewComment] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  
  // Состояния для меню действий с комментариями
  const [commentMenuAnchor, setCommentMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedComment, setSelectedComment] = useState<CommentResponse | null>(null);
  
  // Кэш аватарок пользователей
  const [avatarCache, setAvatarCache] = useState<Map<string, string | null>>(new Map());
  const [avatarLoadingCache, setAvatarLoadingCache] = useState<Set<string>>(new Set());
  
  // Функция для загрузки аватарки с кэшированием
  const getOrLoadAvatar = useCallback(async (avatarUrl: string | null | undefined, userId?: string): Promise<string | null> => {
    if (!avatarUrl) return null;
    
    // Используем URL как ключ кэша, если userId не предоставлен
    const cacheKey = userId || avatarUrl;
    
    // Проверяем кэш
    if (avatarCache.has(cacheKey)) {
      console.log(`🎯 Аватарка найдена в кэше для ${cacheKey}`);
      return avatarCache.get(cacheKey) || null;
    }
    
    // Проверяем, не загружается ли уже
    if (avatarLoadingCache.has(cacheKey)) {
      console.log(`⏳ Аватарка уже загружается для ${cacheKey}`);
      return null; // Возвращаем null пока загружается
    }
    
    try {
      console.log(`📥 Загружаем аватарку для ${cacheKey}`);
      
      // Добавляем в список загружающихся
      setAvatarLoadingCache(prev => new Set(prev).add(cacheKey));
      
      // Загружаем аватарку
      const resolvedUrl = await profileApi.getAvatar(avatarUrl);
      
      // Сохраняем в кэш
      setAvatarCache(prev => new Map(prev).set(cacheKey, resolvedUrl));
      
      console.log(`✅ Аватарка загружена и сохранена в кэш для ${cacheKey}`);
      return resolvedUrl;
    } catch (error) {
      console.error(`❌ Ошибка загрузки аватарки для ${cacheKey}:`, error);
      // Сохраняем null в кэш чтобы не пытаться загружать снова
      setAvatarCache(prev => new Map(prev).set(cacheKey, null));
      return null;
    } finally {
      // Убираем из списка загружающихся
      setAvatarLoadingCache(prev => {
        const newSet = new Set(prev);
        newSet.delete(cacheKey);
        return newSet;
      });
    }
  }, [avatarCache, avatarLoadingCache]);
  
  // Очистка кэша при размонтировании компонента
  useEffect(() => {
    return () => {
      console.log('🧹 Очищаем кэш аватарок');
      setAvatarCache(new Map());
      setAvatarLoadingCache(new Set());
    };
  }, []);
  
  // Загрузка аватарки текущего пользователя
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    const loadUserAvatar = async () => {
      if (user) {
        try {
          const userProfile = await profileApi.getUserProfile(user.user_id);
          if (userProfile?.avatar_url) {
            const avatarUrl = await getOrLoadAvatar(userProfile.avatar_url, `user_${user.user_id}`);
            setUserAvatarUrl(avatarUrl);
          }
        } catch (error) {
          console.error('Ошибка загрузки аватарки пользователя:', error);
        }
      }
    };
    loadUserAvatar();
  }, [user, getOrLoadAvatar]);
  
  // Получение токена для API запросов
  const getToken = () => {
    return document.cookie
      .split('; ')
      .find(row => row.startsWith('access_token='))
      ?.split('=')[1];
  };
  
  // Загрузка комментариев для тренировки
  const loadComments = useCallback(async () => {
    if (!workoutId) return;
    
    setCommentsLoading(true);
    try {
      // Получаем токен для проверки роли пользователя
      const token = getToken();
      const isAdmin = user?.role_id === 1;
      
      const commentsData = await commentsApi.getWorkoutComments(workoutId, {
        show_deleted: isAdmin, // Админы видят удаленные комментарии
        limit: 50
      });
      setComments(commentsData);
    } catch (error) {
      console.error("Ошибка при загрузке комментариев:", error);
      setComments({ comments: [], total_count: 0 });
    } finally {
      setCommentsLoading(false);
    }
  }, [workoutId]);
  
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
  
  // Эффект для автообновления комментариев каждые 30 секунд
  useEffect(() => {
    if (!workoutId) return;
    
    const interval = setInterval(() => {
      loadComments();
    }, 30000); // 30 секунд
    
    return () => clearInterval(interval);
  }, [workoutId]);
  
  // Эффект для загрузки данных тренировки при открытии страницы
  useEffect(() => {
    console.log('🔄 useEffect сработал:', { workoutId, authLoading, user: !!user, courseId });
    
    if (workoutId && !authLoading) {
      // ПРИНУДИТЕЛЬНО ОЧИЩАЕМ ВЕСЬ КЭШ
      sessionStorage.clear();
      localStorage.clear();
      console.log('🗑️ ВСЁ КЭШ ОЧИЩЕН!');
      
      // Убираем кэширование - всегда загружаем свежие данные
      loadWorkoutData();
      loadComments(); // Загрузка реальных комментариев
    }
  }, [workoutId, authLoading, courseId]);
  
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
  const handleSubmitComment = useCallback(async () => {
    if (!newComment.trim() || !user || !workoutId) return;
    
    try {
      const token = getToken();
      await commentsApi.create({
        course_workout_uuid: workoutId,
        content: newComment.trim(),
        parent_comment_uuid: null
      }, token);
      
      setNewComment('');
      // Перезагружаем комментарии
      await loadComments();
    } catch (error) {
      console.error("Ошибка при создании комментария:", error);
    }
  }, [newComment, workoutId, loadComments]);
  
  // Обработчик отправки ответа на комментарий
  const handleSubmitReply = useCallback(async (parentCommentUuid: string) => {
    if (!replyText.trim() || !user || !workoutId) return;
    
    try {
      const token = getToken();
      await commentsApi.create({
        course_workout_uuid: workoutId,
        content: replyText.trim(),
        parent_comment_uuid: parentCommentUuid
      }, token);
      
      setReplyText('');
      setReplyingTo(null);
      // Перезагружаем комментарии
      await loadComments();
    } catch (error) {
      console.error("Ошибка при создании ответа:", error);
    }
  }, [replyText, workoutId, loadComments]);
  
  // Обработчик удаления комментария
  const handleDeleteComment = useCallback(async (commentUuid: string) => {
    try {
      const token = getToken();
      await commentsApi.delete(commentUuid, token);
      
      // Перезагружаем комментарии
      await loadComments();
      
      // Закрываем меню
      setCommentMenuAnchor(null);
      setSelectedComment(null);
    } catch (error) {
      console.error("Ошибка при удалении комментария:", error);
    }
  }, [loadComments]);
  
  // Проверка прав на удаление комментария
  const canDeleteComment = useCallback((comment: CommentResponse): boolean => {
    if (!user) return false;
    
    // Админ может удалить любой комментарий
    if (user.role_id === 1) return true;
    
    // Автор комментария может удалить свой комментарий
    if (comment.user_id === Number(user.user_id)) return true;
    
    // Автор курса может удалить любой комментарий в своем курсе
    if (isOwner) return true;
    
    return false;
  }, [user, isOwner]);
  
  // Обработчик открытия меню комментария
  const handleCommentMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>, comment: CommentResponse) => {
    event.stopPropagation();
    setCommentMenuAnchor(event.currentTarget);
    setSelectedComment(comment);
  }, []);
  
  // Обработчик закрытия меню комментария
  const handleCommentMenuClose = useCallback(() => {
    setCommentMenuAnchor(null);
    setSelectedComment(null);
  }, []);
  
  // Обработчик начала ответа на комментарий
  const handleReplyToComment = useCallback((commentUuid: string) => {
    setReplyingTo(commentUuid);
    handleCommentMenuClose();
  }, [handleCommentMenuClose]);
  
  // Функция для переключения состояния разворачивания ответов
  const toggleRepliesExpansion = useCallback((commentUuid: string) => {
    const newExpanded = new Set(expandedReplies);
    if (newExpanded.has(commentUuid)) {
      newExpanded.delete(commentUuid);
    } else {
      newExpanded.add(commentUuid);
    }
    setExpandedReplies(newExpanded);
  }, [expandedReplies]);
  
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
  
  // Форматирование даты для комментариев
  const formatCommentDate = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInMinutes < 1) return 'только что';
    if (diffInMinutes < 60) return `${diffInMinutes} мин назад`;
    if (diffInHours < 24) return `${diffInHours} ч назад`;
    if (diffInDays < 7) return `${diffInDays} дн назад`;
    
    return date.toLocaleDateString();
  }, []);
  
  // Компонент для кэшированного отображения аватарки
  const CachedAvatar = React.memo(({ 
    avatarUrl, 
    userId, 
    userInitial, 
    size = 40,
    ...props 
  }: {
    avatarUrl?: string | null;
    userId?: string;
    userInitial: string;
    size?: number;
    [key: string]: any;
  }) => {
    const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
      if (!avatarUrl) {
        setResolvedUrl(null);
        return;
      }
      
      const cacheKey = userId || avatarUrl;
      
      // Проверяем кэш
      if (avatarCache.has(cacheKey)) {
        setResolvedUrl(avatarCache.get(cacheKey) || null);
        return;
      }
      
      // Если уже загружается, не запускаем повторную загрузку
      if (avatarLoadingCache.has(cacheKey)) {
        setLoading(true);
        return;
      }
      
      // Загружаем аватарку
      setLoading(true);
      getOrLoadAvatar(avatarUrl, userId).then(url => {
        setResolvedUrl(url);
        setLoading(false);
      });
    }, [avatarUrl, userId]);
    
    return (
      <Avatar
        src={resolvedUrl || undefined}
        sx={{
          bgcolor: theme.palette.highlight?.main,
          width: size,
          height: size,
          ...props.sx
        }}
        {...props}
      >
        {loading ? (
          <CircularProgress size={size * 0.5} sx={{ color: 'white' }} />
        ) : (
          userInitial
        )}
      </Avatar>
    );
  });
  
  // Компонент для отображения одного комментария
  const CommentItem = React.memo(({ 
    comment, 
    isReply = false,
    theme,
    user,
    canDeleteComment,
    handleCommentMenuOpen,
    replyingTo,
    replyText,
    setReplyText,
    handleSubmitReply,
    setReplyingTo,
    handleReplyToComment,
    formatCommentDate
  }: { 
    comment: CommentResponse; 
    isReply?: boolean;
    theme: any;
    user: any;
    canDeleteComment: (comment: CommentResponse) => boolean;
    handleCommentMenuOpen: (event: React.MouseEvent<HTMLElement>, comment: CommentResponse) => void;
    replyingTo: string | null;
    replyText: string;
    setReplyText: (text: string) => void;
    handleSubmitReply: (parentCommentUuid: string) => void;
    setReplyingTo: (uuid: string | null) => void;
    handleReplyToComment: (commentUuid: string) => void;
    formatCommentDate: (dateString: string) => string;
  }) => {
    
    // Мемоизированные значения для предотвращения лишних перерендеров
    const avatarInitial = React.useMemo(() => comment.user_name?.[0] || 'U', [comment.user_name]);
    const displayName = React.useMemo(() => 
      comment.is_deleted ? null : (comment.user_name || 'Пользователь'), 
      [comment.is_deleted, comment.user_name]
    );
    const formattedDate = React.useMemo(() => 
      formatCommentDate(comment.created_at), 
      [comment.created_at, formatCommentDate]
    );
    
    return (
      <ListItem 
        alignItems="flex-start"
        sx={{ 
          px: isReply ? 4 : 0, 
          py: 2,
          borderBottom: `1px solid rgba(255,255,255,0.1)`
        }}
      >
        <ListItemAvatar>
          <CachedAvatar
            avatarUrl={comment.user_avatar_url}
            userId={comment.user_id.toString()}
            userInitial={avatarInitial}
            size={40}
          />
        </ListItemAvatar>
        
        <ListItemText
          primary={
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2" fontWeight="bold">
                {displayName}
              </Typography>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography 
                  variant="caption" 
                  color={theme.palette.textColors?.secondary}
                >
                  {formattedDate}
                </Typography>
                {canDeleteComment(comment) && (
                  <IconButton
                    size="small"
                    onClick={(e) => handleCommentMenuOpen(e, comment)}
                    sx={{ color: theme.palette.textColors?.secondary }}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>
            </Stack>
          }
          secondary={
            <Box sx={{ mt: 1 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  whiteSpace: 'pre-line', 
                  mb: 1,
                  fontStyle: comment.is_deleted ? 'italic' : 'normal',
                  color: comment.is_deleted ? theme.palette.textColors?.secondary : 'inherit'
                }}
              >
                {comment.content}
              </Typography>
              
              {/* Кнопка "Ответить" только для корневых комментариев */}
              {!isReply && user && !comment.is_deleted && (
                <Button
                  size="small"
                  startIcon={<ReplyIcon fontSize="small" />}
                  onClick={() => handleReplyToComment(comment.comment_uuid)}
                  sx={{
                    color: theme.palette.textColors?.secondary,
                    py: 0,
                    minWidth: 0,
                    mb: 1
                  }}
                >
                  Ответить
                </Button>
              )}
              
              {/* Форма ответа */}
              {replyingTo === comment.comment_uuid && (
                <Box sx={{ mt: 2 }}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <CachedAvatar
                      avatarUrl={userAvatarUrl}
                      userId={user?.user_id.toString()}
                      userInitial={user?.first_name?.[0] || 'U'}
                      size={32}
                    />
                    
                    <TextField
                      fullWidth
                      variant="outlined"
                      placeholder="Написать ответ..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      multiline
                      maxRows={4}
                      size="small"
                      autoFocus
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: theme.borderRadius.small,
                          bgcolor: 'rgba(255,255,255,0.05)'
                        }
                      }}
                    />
                    
                    <Stack direction="row" spacing={1}>
                      <IconButton 
                        onClick={() => handleSubmitReply(comment.comment_uuid)}
                        disabled={!replyText.trim()}
                        sx={{ 
                          color: theme.palette.highlight?.main,
                          opacity: !replyText.trim() ? 0.5 : 1
                        }}
                      >
                        <SendIcon />
                      </IconButton>
                      <IconButton 
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyText('');
                        }}
                        sx={{ color: theme.palette.textColors?.secondary }}
                      >
                        ×
                      </IconButton>
                    </Stack>
                  </Stack>
                </Box>
              )}
            </Box>
          }
        />
      </ListItem>
    );
  }, (prevProps, nextProps) => {
    // Сравниваем только важные пропсы для предотвращения лишних перерендеров
    return (
      prevProps.comment.comment_uuid === nextProps.comment.comment_uuid &&
      prevProps.comment.content === nextProps.comment.content &&
      prevProps.comment.user_avatar_url === nextProps.comment.user_avatar_url &&
      prevProps.comment.user_name === nextProps.comment.user_name &&
      prevProps.comment.created_at === nextProps.comment.created_at &&
      prevProps.comment.is_deleted === nextProps.comment.is_deleted &&
      prevProps.isReply === nextProps.isReply &&
      prevProps.replyingTo === nextProps.replyingTo &&
      prevProps.replyText === nextProps.replyText &&
      prevProps.user?.user_id === nextProps.user?.user_id
    );
  });
  
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
      {/* CSS для анимации bottom sheet */}
      <style jsx global>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0%);
            opacity: 1;
          }
        }
      `}</style>
      
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
                    Комментарии ({comments.total_count})
                  </Typography>
                  
                  {/* Форма добавления комментария */}
                  {user && (
                    <Stack 
                      direction="row" 
                      spacing={2} 
                      alignItems="flex-start"
                      sx={{ mb: 3 }}
                    >
                      <CachedAvatar
                        avatarUrl={userAvatarUrl}
                        userId={user?.user_id.toString()}
                        userInitial={user?.first_name?.[0] || 'U'}
                        size={40}
                      />
                      
                      <TextField
                        fullWidth
                        variant="outlined"
                        placeholder="Добавьте комментарий..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        multiline
                        maxRows={4}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmitComment();
                          }
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: theme.borderRadius.small,
                            bgcolor: 'rgba(255,255,255,0.05)'
                          }
                        }}
                      />
                      
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
                    </Stack>
                  )}
                  
                  {/* Список комментариев */}
                  {commentsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                      <CircularProgress size={30} />
                    </Box>
                  ) : comments.total_count > 0 ? (
                    <>
                      <List sx={{ p: 0 }}>
                        {comments.comments.map((comment) => (
                          <Box key={comment.comment_uuid}>
                            <CommentItem 
                              comment={comment} 
                              isReply={false}
                              theme={theme}
                              user={user}
                              canDeleteComment={canDeleteComment}
                              handleCommentMenuOpen={handleCommentMenuOpen}
                              replyingTo={replyingTo}
                              replyText={replyText}
                              setReplyText={setReplyText}
                              handleSubmitReply={handleSubmitReply}
                              setReplyingTo={setReplyingTo}
                              handleReplyToComment={handleReplyToComment}
                              formatCommentDate={formatCommentDate}
                            />
                            
                            {/* Кнопка разворачивания ответов */}
                            {comment.replies && comment.replies.length > 0 && (
                              <Box sx={{ ml: 6, my: 1 }}>
                                <Button
                                  size="small"
                                  startIcon={
                                    expandedReplies.has(comment.comment_uuid) ? 
                                    <ExpandLessIcon fontSize="small" /> : 
                                    <ExpandMoreIcon fontSize="small" />
                                  }
                                  onClick={() => toggleRepliesExpansion(comment.comment_uuid)}
                                  sx={{
                                    color: theme.palette.highlight?.main,
                                    textTransform: 'none',
                                    fontWeight: 'medium',
                                    '&:hover': {
                                      bgcolor: 'rgba(255,255,255,0.05)'
                                    }
                                  }}
                                >
                                  {expandedReplies.has(comment.comment_uuid) ? 
                                    'Скрыть ответы' : 
                                    `${comment.replies.length} ${comment.replies.length === 1 ? 'ответ' : 
                                      comment.replies.length < 5 ? 'ответа' : 'ответов'}`
                                  }
                                </Button>
                              </Box>
                            )}
                            
                            {/* Отображение ответов при разворачивании */}
                            <Collapse in={expandedReplies.has(comment.comment_uuid)} timeout="auto" unmountOnExit>
                              {comment.replies && comment.replies.length > 0 && (
                                <Box sx={{ ml: 4 }}>
                                  {comment.replies.map((reply) => (
                                    <CommentItem 
                                      key={reply.comment_uuid} 
                                      comment={reply} 
                                      isReply={true} 
                                      theme={theme}
                                      user={user}
                                      canDeleteComment={canDeleteComment}
                                      handleCommentMenuOpen={handleCommentMenuOpen}
                                      replyingTo={replyingTo}
                                      replyText={replyText}
                                      setReplyText={setReplyText}
                                      handleSubmitReply={handleSubmitReply}
                                      setReplyingTo={setReplyingTo}
                                      handleReplyToComment={handleReplyToComment}
                                      formatCommentDate={formatCommentDate}
                                    />
                                  ))}
                                </Box>
                              )}
                            </Collapse>
                          </Box>
                        ))}
                      </List>
                      
                      {/* Меню действий с комментариями */}
                      <Modal
                        open={Boolean(commentMenuAnchor)}
                        onClose={handleCommentMenuClose}
                        closeAfterTransition
                        BackdropComponent={Backdrop}
                        BackdropProps={{
                          timeout: 500,
                        }}
                      >
                        <Fade in={Boolean(commentMenuAnchor)}>
                          <Box
                            sx={{
                              position: 'fixed',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              bgcolor: theme.palette.backgrounds?.paper,
                              borderTopLeftRadius: theme.borderRadius.medium,
                              borderTopRightRadius: theme.borderRadius.medium,
                              boxShadow: theme.customShadows.strong,
                              p: 3,
                              pb: 'max(24px, env(safe-area-inset-bottom))', // Safe area для iOS
                              zIndex: 10000,
                              border: `1px solid rgba(255,255,255,0.1)`,
                              maxHeight: '50vh',
                              transform: 'translateY(0%)',
                              animation: 'slideUp 0.3s ease-out'
                            }}
                          >
                            {/* Заголовок с кнопкой закрытия */}
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                              <Typography variant="h6" fontWeight="medium">
                                Действия с комментарием
                              </Typography>
                              <IconButton 
                                onClick={handleCommentMenuClose}
                                size="small"
                                sx={{ color: theme.palette.textColors?.secondary }}
                              >
                                <CloseIcon />
                              </IconButton>
                            </Stack>
                            
                            <Stack spacing={1}>
                              {/* Кнопка "Ответить" только для корневых комментариев */}
                              {selectedComment && !selectedComment.is_deleted && 
                               !comments.comments.some(comment => 
                                 comment.replies?.some(reply => reply.comment_uuid === selectedComment.comment_uuid)
                               ) && (
                                <Button
                                  fullWidth
                                  variant="outlined"
                                  startIcon={<ReplyIcon />}
                                  onClick={() => handleReplyToComment(selectedComment.comment_uuid)}
                                  sx={{ 
                                    justifyContent: 'flex-start',
                                    color: theme.palette.textColors?.primary,
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    '&:hover': {
                                      borderColor: theme.palette.highlight?.main,
                                      bgcolor: 'rgba(255,255,255,0.05)'
                                    }
                                  }}
                                >
                                  Ответить на комментарий
                                </Button>
                              )}
                              
                              {selectedComment && canDeleteComment(selectedComment) && (
                                <Button
                                  fullWidth
                                  variant="outlined"
                                  startIcon={<DeleteIcon />}
                                  onClick={() => handleDeleteComment(selectedComment.comment_uuid)}
                                  sx={{ 
                                    justifyContent: 'flex-start',
                                    color: theme.palette.error?.main,
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    '&:hover': {
                                      borderColor: theme.palette.error?.main,
                                      bgcolor: 'rgba(255,0,0,0.05)'
                                    }
                                  }}
                                >
                                  Удалить комментарий
                                </Button>
                              )}
                            </Stack>
                          </Box>
                        </Fade>
                      </Modal>
                    </>
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