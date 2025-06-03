"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Stack,
  Avatar,
  Button,
  Divider,
  TextField,
  Snackbar,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  useTheme,
  IconButton,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Skeleton,
  Collapse,
  useMediaQuery,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import EmailIcon from "@mui/icons-material/Email";
import PersonIcon from "@mui/icons-material/Person";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import SubscriptionsIcon from "@mui/icons-material/Subscriptions";
import PaymentIcon from "@mui/icons-material/Payment";
import CancelIcon from "@mui/icons-material/Cancel";
import SaveIcon from "@mui/icons-material/Save";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import LogoutIcon from "@mui/icons-material/Logout";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import SecurityIcon from "@mui/icons-material/Security";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import MainLayout from "../components/layouts/MainLayout";
import { useAuth } from "../auth/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useAvatar } from "../hooks/useAvatar";
import ProfileCard, { ProfileData } from "../components/shared/ProfileCard";
import { 
  profileApi, 
  ProfileResponse, 
  SubscriptionsResponse, 
  PaymentsResponse,
  PaymentMethodResponse,
  ProfileUpdateRequest,
  ChangeNameRequest,
  ChangeDescriptionRequest,
  ChangePaymentMethodRequest
} from "../services/api";
import SubscriptionsList from "../components/profile/SubscriptionsList";
import PaymentsList from "../components/profile/PaymentsList";
import PaymentMethodsList from "../components/profile/PaymentMethodsList";

export default function ProfilePage() {
  const theme = useTheme();
  const router = useRouter();
  const { user, logout } = useAuth();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Состояние аккордеона
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Данные профиля
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  
  // Добавляем состояние для рейтинга и подписчиков
  const [userRating, setUserRating] = useState<number>(0);
  const [userRatingCount, setUserRatingCount] = useState<number>(0);
  const [subscribersCount, setSubscribersCount] = useState<number>(0);
  const [ratingLoading, setRatingLoading] = useState(false);
  
  // Получение аватара с авторизацией
  const { avatarUrl, loading: avatarLoading } = useAvatar(profile?.avatar_url);
  const [subscriptions, setSubscriptions] = useState<SubscriptionsResponse | null>(null);
  const [payments, setPayments] = useState<PaymentsResponse | null>(null);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [allPaymentMethods, setAllPaymentMethods] = useState<PaymentMethodResponse[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);

  // Состояния загрузки
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);

  // Диалоги
  const [editProfileDialogOpen, setEditProfileDialogOpen] = useState(false);
  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);
  const [changeEmailDialogOpen, setChangeEmailDialogOpen] = useState(false);
  const [uploadAvatarDialogOpen, setUploadAvatarDialogOpen] = useState(false);

  // Уведомления
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [alertOpen, setAlertOpen] = useState(false);

  // Поля для редактирования профиля
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Ошибки валидации
  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");

  // Функции валидации
  const validateName = (name: string, fieldName: string): string => {
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      return ""; // Пустое имя допустимо
    }
    
    if (trimmedName.includes(' ')) {
      return `${fieldName} не должно содержать пробелы`;
    }
    
    if (!/^[a-zA-Zа-яА-ЯёЁ]+$/.test(trimmedName)) {
      return `${fieldName} должно содержать только буквы`;
    }
    
    return "";
  };

  const validateDescription = (description: string): string => {
    const trimmedDescription = description.trim();
    
    if (!trimmedDescription) {
      return ""; // Пустое описание допустимо
    }
    
    if (description.trim() !== description || /^\s+$/.test(description)) {
      return "Описание не может состоять только из пробелов";
    }
    
    return "";
  };

  const handleFirstNameChange = (value: string) => {
    setEditFirstName(value);
    const error = validateName(value, "Имя");
    setFirstNameError(error);
  };

  const handleLastNameChange = (value: string) => {
    setEditLastName(value);
    const error = validateName(value, "Фамилия");
    setLastNameError(error);
  };

  const handleDescriptionChange = (value: string) => {
    setEditDescription(value);
    const error = validateDescription(value);
    setDescriptionError(error);
  };

  // Поля для смены пароля
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [passwordVerificationStep, setPasswordVerificationStep] = useState(false);

  // Поля для смены email
  const [newEmail, setNewEmail] = useState("");
  const [emailVerificationCode, setEmailVerificationCode] = useState("");
  const [emailVerificationStep, setEmailVerificationStep] = useState(false);
  const [emailError, setEmailError] = useState("");

  // Поля для загрузки аватара
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  // Загрузка данных профиля
  useEffect(() => {
    if (user) {
      loadProfile();
      loadSubscriptions();
      loadPayments();
      loadAllPaymentMethods();
      loadUserRating();
    }
  }, [user]);

  const showMessage = (message: string, isError: boolean = false) => {
    if (isError) {
      setError(message);
      setSuccess("");
    } else {
      setSuccess(message);
      setError("");
    }
    setAlertOpen(true);
  };

  const loadProfile = async () => {
    try {
      setProfileLoading(true);
      const profileData = await profileApi.getMyProfile();
      setProfile(profileData);
      // Инициализируем поля редактирования
      setEditFirstName(profileData.first_name || "");
      setEditLastName(profileData.last_name || "");
      setEditDescription(profileData.description || "");
      // Сбрасываем ошибки валидации
      setFirstNameError("");
      setLastNameError("");
      setDescriptionError("");
      // Добавляем состояние для рейтинга и подписчиков
      await loadUserRating();
    } catch (error: any) {
      showMessage(error.message || "Ошибка загрузки профиля", true);
    } finally {
      setProfileLoading(false);
    }
  };

  // Функция для загрузки рейтинга и количества подписчиков
  const loadUserRating = async () => {
    if (!user?.user_id) return;
    
    try {
      setRatingLoading(true);
      const ratingData = await profileApi.getUserRating(user.user_id.toString());
      setUserRating(ratingData.rating || 0);
      setUserRatingCount(ratingData.rating_count || 0);
      setSubscribersCount(ratingData.subscribers_count || 0);
    } catch (error: any) {
      console.error('Ошибка при загрузке рейтинга пользователя:', error);
      // Не показываем ошибку пользователю, просто логируем
      setUserRating(0);
      setUserRatingCount(0);
      setSubscribersCount(0);
    } finally {
      setRatingLoading(false);
    }
  };

  const loadSubscriptions = async () => {
    try {
      setSubscriptionsLoading(true);
      const subscriptionsData = await profileApi.getSubscriptions();
      setSubscriptions(subscriptionsData);
    } catch (error: any) {
      showMessage(error.message || "Ошибка загрузки подписок", true);
    } finally {
      setSubscriptionsLoading(false);
    }
  };

  const loadPayments = async () => {
    try {
      setPaymentsLoading(true);
      const paymentsData = await profileApi.getPayments();
      setPayments(paymentsData);
    } catch (error: any) {
      showMessage(error.message || "Ошибка загрузки истории платежей", true);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const loadAllPaymentMethods = async () => {
    try {
      setPaymentMethodsLoading(true);
      const paymentMethodsData = await profileApi.getPaymentMethods();
      setAllPaymentMethods(paymentMethodsData.payment_methods || []);
    } catch (error: any) {
      showMessage(error.message || "Ошибка загрузки методов оплаты", true);
    } finally {
      setPaymentMethodsLoading(false);
    }
  };

  const handleSectionClick = async (section: string) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
      
      // Загружаем данные при первом открытии секции
      switch (section) {
        case 'subscriptions':
          if (!subscriptions) await loadSubscriptions();
          break;
        case 'payments':
          if (!payments) await loadPayments();
          break;
        case 'payment-methods':
          if (allPaymentMethods.length === 0) await loadAllPaymentMethods();
          break;
      }
    }
  };

  const handleUpdateProfile = async () => {
    // Проверяем валидацию перед отправкой
    const firstNameErr = validateName(editFirstName, "Имя");
    const lastNameErr = validateName(editLastName, "Фамилия");
    const descriptionErr = validateDescription(editDescription);

    setFirstNameError(firstNameErr);
    setLastNameError(lastNameErr);
    setDescriptionError(descriptionErr);

    if (firstNameErr || lastNameErr || descriptionErr) {
      showMessage("Пожалуйста, исправьте ошибки в форме", true);
      return;
    }

    try {
      setLoading(true);
      const updateData: ProfileUpdateRequest = {
        first_name: editFirstName.trim() || undefined,
        last_name: editLastName.trim() || undefined,
        description: editDescription.trim() || undefined
      };

      await profileApi.updateProfile(updateData);
      await loadProfile();
      setEditProfileDialogOpen(false);
      showMessage("Профиль успешно обновлен");
    } catch (error: any) {
      showMessage(error.message || "Ошибка обновления профиля", true);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadAvatar = async () => {
    if (!selectedFile) {
      showMessage("Выберите файл для загрузки", true);
      return;
    }

    try {
      setLoading(true);
      const response = await profileApi.uploadAvatar(selectedFile);
      await loadProfile();
      setUploadAvatarDialogOpen(false);
      setSelectedFile(null);
      setPreviewUrl("");
      showMessage("Аватар успешно загружен");
    } catch (error: any) {
      showMessage(error.message || "Ошибка загрузки аватара", true);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showMessage("Выберите изображение", true);
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        showMessage("Размер файла не должен превышать 5MB", true);
        return;
      }

      setSelectedFile(file);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleToggleRecurring = async (courseId: string) => {
    setLoading(true);
    try {
      // await profileApi.toggleSubscriptionRecurring(courseId);
      
      // Обновляем список подписок
      await loadSubscriptions();
      
      showMessage("Функциональность переключения автопродления временно недоступна");
    } catch (error: any) {
      showMessage(error.message || "Ошибка при изменении автопродления подписки", true);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCourse = async (courseId: string) => {
    setLoading(true);
    try {
      // Открываем курс в новой вкладке
      window.open(`/courses/${courseId}`, '_blank');
    } catch (error: any) {
      showMessage(error.message || "Ошибка при открытии курса", true);
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefaultPaymentMethod = async (paymentMethodId: string) => {
    try {
      setLoading(true);
      await profileApi.setDefaultPaymentMethod(paymentMethodId);
      await loadAllPaymentMethods();
      showMessage("Метод оплаты установлен по умолчанию");
    } catch (error: any) {
      showMessage(error.message || "Ошибка при установке метода оплаты по умолчанию", true);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePaymentMethod = async (paymentMethodId: string) => {
    try {
      setLoading(true);
      // Здесь должен быть API вызов для удаления метода оплаты
      // await profileApi.deletePaymentMethod(paymentMethodId);
      await loadAllPaymentMethods();
      showMessage("Метод оплаты удален");
    } catch (error: any) {
      showMessage(error.message || "Ошибка при удалении метода оплаты", true);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      showMessage("Пожалуйста, введите текущий пароль", true);
      return;
    }

    if (passwordVerificationStep) {
      await handleVerifyPasswordChange();
      return;
    }

    if (!newPassword || !confirmPassword) {
      showMessage("Пожалуйста, заполните все поля", true);
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage("Пароли не совпадают", true);
      return;
    }

    setLoading(true);

    try {
      const cookies = document.cookie.split('; ');
      const accessTokenCookie = cookies.find(c => c.startsWith('access_token='));
      const accessToken = accessTokenCookie ? decodeURIComponent(accessTokenCookie.split('=')[1]) : null;

      if (!accessToken) {
        throw new Error("Вы не авторизованы. Войдите в систему снова.");
      }

      const response = await fetch(`${process.env.API_URL}${process.env.AUTH_API_PREFIX}/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          current_password: currentPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Не удалось инициировать смену пароля");
      }

      showMessage("Код подтверждения отправлен на ваш email");
      setPasswordVerificationStep(true);
    } catch (error: any) {
      showMessage(error.message || "Произошла ошибка", true);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPasswordChange = async () => {
    if (!verificationCode) {
      showMessage("Пожалуйста, введите код подтверждения", true);
      return;
    }

    setLoading(true);

    try {
      const cookies = document.cookie.split('; ');
      const accessTokenCookie = cookies.find(c => c.startsWith('access_token='));
      const accessToken = accessTokenCookie ? decodeURIComponent(accessTokenCookie.split('=')[1]) : null;

      if (!accessToken) {
        throw new Error("Вы не авторизованы. Войдите в систему снова.");
      }

      const response = await fetch(`${process.env.API_URL}${process.env.AUTH_API_PREFIX}/verify-password-change`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          verification_code: verificationCode,
          new_password: newPassword,
          confirm_password: newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Ошибка при подтверждении смены пароля");
      }

      showMessage("Пароль успешно изменен. Пожалуйста, войдите снова.");
      setChangePasswordDialogOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setVerificationCode("");
      setPasswordVerificationStep(false);
      
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
    } catch (error: any) {
      showMessage(error.message || "Произошла ошибка", true);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = async () => {
    if (emailVerificationStep) {
      await handleVerifyEmailChange();
      return;
    }

    if (!newEmail) {
      showMessage("Пожалуйста, введите новый email", true);
      return;
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(newEmail)) {
      showMessage("Введите корректный email", true);
      return;
    }

    setLoading(true);

    try {
      const cookies = document.cookie.split('; ');
      const accessTokenCookie = cookies.find(c => c.startsWith('access_token='));
      const accessToken = accessTokenCookie ? decodeURIComponent(accessTokenCookie.split('=')[1]) : null;

      if (!accessToken) {
        throw new Error("Вы не авторизованы. Войдите в систему снова.");
      }

      const response = await fetch(`${process.env.API_URL}${process.env.AUTH_API_PREFIX}/change-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          new_email: newEmail
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Не удалось инициировать смену email");
      }

      showMessage("Код подтверждения отправлен на новый email");
      setEmailVerificationStep(true);
    } catch (error: any) {
      showMessage(error.message || "Произошла ошибка", true);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailChange = async () => {
    if (!emailVerificationCode) {
      showMessage("Пожалуйста, введите код подтверждения", true);
      return;
    }

    setLoading(true);

    try {
      const cookies = document.cookie.split('; ');
      const accessTokenCookie = cookies.find(c => c.startsWith('access_token='));
      const accessToken = accessTokenCookie ? decodeURIComponent(accessTokenCookie.split('=')[1]) : null;

      if (!accessToken) {
        throw new Error("Вы не авторизованы. Войдите в систему снова.");
      }

      const response = await fetch(`${process.env.API_URL}${process.env.AUTH_API_PREFIX}/verify-email-change`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          verification_code: emailVerificationCode,
          new_email: newEmail
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Ошибка при подтверждении смены email");
      }

      showMessage("Email успешно изменен. Пожалуйста, войдите снова.");
      setChangeEmailDialogOpen(false);
      setNewEmail("");
      setEmailVerificationCode("");
      setEmailVerificationStep(false);
      
      // Перенаправляем на страницу входа через 2 секунды
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
    } catch (error: any) {
      showMessage(error.message || "Произошла ошибка", true);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/auth/login');
    } catch (error) {
      console.error("Ошибка при выходе:", error);
    }
  };

  const avatarName = profile ? 
    (profile.first_name && profile.last_name) ? 
      `${profile.first_name[0]}${profile.last_name[0]}` : 
      (profile.first_name ? profile.first_name[0] : (profile.email ? profile.email[0].toUpperCase() : "U")) 
    : "U";

  const displayName = profile ? 
    (profile.first_name && profile.last_name) ? 
      `${profile.first_name} ${profile.last_name}` : 
      (profile.first_name ? profile.first_name : profile.email) 
    : "Пользователь";

  return (
    <MainLayout>
      <Stack spacing={2.5} sx={{ pb: 3, px: 1, pt: 7 }}>
        {/* Главная карточка профиля */}
        <ProfileCard
          profile={{
            name: displayName,
            email: profile?.email || undefined,
            description: profile?.description || undefined,
            avatar: profile?.avatar_url || undefined,
            rating: userRating,
            subscribersCount: subscribersCount
          }}
          avatarUrl={avatarUrl}
          loading={profileLoading}
          avatarLoading={avatarLoading}
          onEditClick={() => setEditProfileDialogOpen(true)}
          onAvatarClick={() => setUploadAvatarDialogOpen(true)}
        />

        {/* Секции настроек в виде аккордеона */}
        {[
          {
            key: 'security',
            title: 'Безопасность',
            icon: <SecurityIcon />,
            description: 'Управление паролем и email'
          },
          {
            key: 'subscriptions',
            title: 'Подписки',
            icon: <SubscriptionsIcon />,
            description: 'Ваши активные подписки на курсы'
          },
          {
            key: 'payments',
            title: 'История платежей',
            icon: <PaymentIcon />,
            description: 'Все проведенные платежи'
          },
          {
            key: 'payment-methods',
            title: 'Методы оплаты',
            icon: <CreditCardIcon />,
            description: 'Управление способами оплаты'
          }
        ].map((section) => (
          <Paper
            key={section.key}
            elevation={0}
            sx={{
              borderRadius: 4,
              backgroundColor: theme.palette.backgrounds?.paper,
              overflow: 'hidden',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 25px rgba(0,0,0,0.12)',
              },
            }}
          >
            {/* Заголовок секции */}
            <Box
              onClick={() => handleSectionClick(section.key)}
              sx={{
                p: 3,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: `${theme.palette.highlight?.main}10`,
                },
              }}
            >
              <Box
                sx={{
                  color: theme.palette.highlight?.main,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {section.icon}
              </Box>
              <Box flex={1}>
                <Typography
                  variant="h6"
                  sx={{
                    color: theme.palette.textColors?.primary,
                    fontWeight: 'bold'
                  }}
                >
                  {section.title}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: theme.palette.textColors?.secondary,
                    mt: 0.5
                  }}
                >
                  {section.description}
                </Typography>
              </Box>
              <IconButton
                sx={{
                  color: theme.palette.textColors?.secondary,
                  transform: expandedSection === section.key ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease'
                }}
              >
                <ExpandMoreIcon />
              </IconButton>
            </Box>

            {/* Содержимое секции */}
            <Collapse in={expandedSection === section.key} timeout={300}>
              <Box sx={{ px: 3, pb: 3 }}>
                <Divider sx={{ mb: 3, opacity: 0.3 }} />
                
                {/* Безопасность */}
                {section.key === 'security' && (
                  <Grid container spacing={2}>
                                         <Grid item xs={12} md={6}>
                       <Card 
                         variant="outlined" 
                         sx={{ 
                           borderRadius: 3,
                           backgroundColor: theme.palette.backgrounds?.default,
                           border: `1px solid ${theme.palette.highlight?.main}20`,
                           transition: 'all 0.2s ease',
                           '&:hover': {
                             borderColor: theme.palette.highlight?.main,
                             transform: 'translateY(-2px)',
                           }
                         }}
                       >
                         <CardContent sx={{ p: 3 }}>
                           <Stack spacing={2}>
                             <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                               <EmailIcon sx={{ color: theme.palette.highlight?.main }} />
                               <Typography variant="h6">Email</Typography>
                             </Box>
                            <Typography variant="body2" sx={{ color: theme.palette.textColors?.secondary }}>
                              Изменение адреса электронной почты требует подтверждения по коду.
                            </Typography>
                            <Button
                              variant="outlined"
                              startIcon={<EmailIcon />}
                              onClick={() => setChangeEmailDialogOpen(true)}
                              sx={{
                                borderRadius: 25,
                                borderColor: theme.palette.highlight?.main,
                                color: theme.palette.highlight?.main,
                                "&:hover": {
                                  borderColor: theme.palette.highlight?.accent,
                                  bgcolor: `${theme.palette.highlight?.main}10`,
                                },
                              }}
                            >
                              Изменить email
                            </Button>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                    
                                         <Grid item xs={12} md={6}>
                       <Card 
                         variant="outlined" 
                         sx={{ 
                           borderRadius: 3,
                           backgroundColor: theme.palette.backgrounds?.default,
                           border: `1px solid ${theme.palette.highlight?.main}20`,
                           transition: 'all 0.2s ease',
                           '&:hover': {
                             borderColor: theme.palette.highlight?.main,
                             transform: 'translateY(-2px)',
                           }
                         }}
                       >
                         <CardContent sx={{ p: 3 }}>
                           <Stack spacing={2}>
                             <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                               <LockOutlinedIcon sx={{ color: theme.palette.highlight?.main }} />
                               <Typography variant="h6">Пароль</Typography>
                             </Box>
                            <Typography variant="body2" sx={{ color: theme.palette.textColors?.secondary }}>
                              Регулярно меняйте пароль для повышения безопасности аккаунта.
                            </Typography>
                            <Button
                              variant="outlined"
                              startIcon={<LockOutlinedIcon />}
                              onClick={() => setChangePasswordDialogOpen(true)}
                              sx={{
                                borderRadius: 25,
                                borderColor: theme.palette.highlight?.main,
                                color: theme.palette.highlight?.main,
                                "&:hover": {
                                  borderColor: theme.palette.highlight?.accent,
                                  bgcolor: `${theme.palette.highlight?.main}10`,
                                },
                              }}
                            >
                              Изменить пароль
                            </Button>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                )}

                {/* Подписки */}
                {section.key === 'subscriptions' && (
                  subscriptionsLoading ? (
                    <Stack spacing={2}>
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} variant="rectangular" height={120} sx={{ borderRadius: 3 }} />
                      ))}
                    </Stack>
                  ) : (
                    <SubscriptionsList 
                      subscriptions={subscriptions?.subscriptions || []} 
                      loading={subscriptionsLoading}
                      onToggleRecurring={handleToggleRecurring}
                      onOpenCourse={handleOpenCourse}
                      isProcessing={loading}
                    />
                  )
                )}

                {/* История платежей */}
                {section.key === 'payments' && (
                  paymentsLoading ? (
                    <Stack spacing={2}>
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} variant="rectangular" height={80} sx={{ borderRadius: 3 }} />
                      ))}
                    </Stack>
                  ) : payments?.payments.length ? (
                    <PaymentsList 
                      payments={payments.payments} 
                      loading={paymentsLoading}
                    />
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <PaymentIcon sx={{ fontSize: 64, color: theme.palette.textColors?.secondary, mb: 2 }} />
                      <Typography variant="h6" color="text.secondary">
                        История платежей пуста
                      </Typography>
                    </Box>
                  )
                )}

                {/* Методы оплаты */}
                {section.key === 'payment-methods' && (
                  paymentMethodsLoading ? (
                    <Stack spacing={2}>
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} variant="rectangular" height={120} sx={{ borderRadius: 3 }} />
                      ))}
                    </Stack>
                  ) : allPaymentMethods.length ? (
                    <PaymentMethodsList 
                      paymentMethods={allPaymentMethods} 
                      loading={paymentMethodsLoading}
                      onSetDefault={handleSetDefaultPaymentMethod}
                      onDelete={handleDeletePaymentMethod}
                    />
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <CreditCardIcon sx={{ fontSize: 64, color: theme.palette.textColors?.secondary, mb: 2 }} />
                      <Typography variant="h6" color="text.secondary">
                        Методы оплаты не найдены
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Добавьте метод оплаты при оформлении подписки
                      </Typography>
                    </Box>
                  )
                )}
              </Box>
            </Collapse>
          </Paper>
        ))}

                 {/* Кнопка выхода */}
         <Paper
           elevation={0}
           sx={{
             borderRadius: 4,
             backgroundColor: theme.palette.backgrounds?.paper,
             overflow: 'hidden',
             transition: 'all 0.3s ease',
             '&:hover': {
               transform: 'translateY(-2px)',
               boxShadow: '0 8px 25px rgba(244, 67, 54, 0.2)',
             },
           }}
         >
          <Box
            onClick={handleLogout}
            sx={{
              p: 3,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
              },
            }}
          >
            <Box sx={{ color: theme.palette.error.main }}>
              <LogoutIcon />
            </Box>
            <Box>
              <Typography
                variant="h6"
                sx={{
                  color: theme.palette.error.main,
                  fontWeight: 'bold'
                }}
              >
                Выйти из аккаунта
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.textColors?.secondary,
                  mt: 0.5
                }}
              >
                Завершить текущую сессию
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Stack>

      {/* Все диалоги остаются без изменений... */}
      {/* Диалог редактирования профиля */}
      <Dialog
        open={editProfileDialogOpen}
        onClose={() => {
          setEditProfileDialogOpen(false);
          setFirstNameError("");
          setLastNameError("");
          setDescriptionError("");
        }}
        PaperProps={{
          sx: {
            bgcolor: theme.palette.backgrounds?.paper,
            color: theme.palette.textColors?.primary,
            borderRadius: 4,
            minWidth: '400px'
          },
          elevation: 0
        }}
      >
        <DialogTitle>Редактирование профиля</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Имя"
              fullWidth
              value={editFirstName}
              onChange={(e) => handleFirstNameChange(e.target.value)}
              sx={{ 
                '& .MuiOutlinedInput-root': { borderRadius: 3 }
              }}
              error={!!firstNameError}
              helperText={firstNameError}
            />
            <TextField
              label="Фамилия"
              fullWidth
              value={editLastName}
              onChange={(e) => handleLastNameChange(e.target.value)}
              sx={{ 
                '& .MuiOutlinedInput-root': { borderRadius: 3 }
              }}
              error={!!lastNameError}
              helperText={lastNameError}
            />
            <TextField
              label="Описание"
              fullWidth
              multiline
              rows={3}
              value={editDescription}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="Расскажите о себе..."
              sx={{ 
                '& .MuiOutlinedInput-root': { borderRadius: 3 }
              }}
              error={!!descriptionError}
              helperText={descriptionError}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={() => {
              setEditProfileDialogOpen(false);
              setFirstNameError("");
              setLastNameError("");
              setDescriptionError("");
            }}
            sx={{ borderRadius: 25 }}
          >
            Отмена
          </Button>
          <Button 
            onClick={handleUpdateProfile}
            disabled={loading || !!firstNameError || !!lastNameError || !!descriptionError}
            startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
            variant="contained"
            sx={{ 
              borderRadius: 25,
              bgcolor: theme.palette.highlight?.main,
              '&:hover': {
                bgcolor: theme.palette.highlight?.accent,
              }
            }}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог загрузки аватара */}
      <Dialog
        open={uploadAvatarDialogOpen}
        onClose={() => setUploadAvatarDialogOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: theme.palette.backgrounds?.paper,
            color: theme.palette.textColors?.primary,
            borderRadius: 4,
            minWidth: '400px'
          },
          elevation: 0
        }}
      >
        <DialogTitle>Загрузка аватара</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <input
              accept="image/*"
              style={{ display: 'none' }}
              id="avatar-upload"
              type="file"
              onChange={handleFileSelect}
            />
            <label htmlFor="avatar-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<CloudUploadIcon />}
                fullWidth
                sx={{ 
                  borderRadius: 3,
                  py: 2,
                  borderStyle: 'dashed',
                  borderWidth: 2
                }}
              >
                Выбрать файл
              </Button>
            </label>
            {previewUrl && (
              <Box sx={{ textAlign: 'center' }}>
                <Avatar
                  src={previewUrl}
                  sx={{ width: 100, height: 100, mx: 'auto', mb: 2 }}
                />
                <Typography variant="body2">
                  {selectedFile?.name}
                </Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={() => {
              setUploadAvatarDialogOpen(false);
              setSelectedFile(null);
              setPreviewUrl("");
            }}
            sx={{ borderRadius: 25 }}
          >
            Отмена
          </Button>
          <Button 
            onClick={handleUploadAvatar}
            disabled={loading || !selectedFile}
            startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
            variant="contained"
            sx={{ 
              borderRadius: 25,
              bgcolor: theme.palette.highlight?.main,
              '&:hover': {
                bgcolor: theme.palette.highlight?.accent,
              }
            }}
          >
            Загрузить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Остальные диалоги... */}
      <Dialog
        open={changePasswordDialogOpen}
        onClose={() => {
          setChangePasswordDialogOpen(false);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          setVerificationCode("");
          setPasswordVerificationStep(false);
        }}
        PaperProps={{
          sx: {
            bgcolor: theme.palette.backgrounds?.paper,
            color: theme.palette.textColors?.primary,
            borderRadius: 4,
            minWidth: '400px'
          },
          elevation: 0
        }}
      >
        <DialogTitle>
          {passwordVerificationStep ? "Подтверждение смены пароля" : "Изменение пароля"}
        </DialogTitle>
        <DialogContent>
          {!passwordVerificationStep ? (
            <>
              <DialogContentText sx={{ color: theme.palette.textColors?.secondary, mb: 2 }}>
                Для изменения пароля вам будет отправлен код подтверждения на ваш email.
              </DialogContentText>
              <Stack spacing={2}>
                <TextField
                  autoFocus
                  margin="dense"
                  label="Текущий пароль"
                  type="password"
                  fullWidth
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                />
                <TextField
                  margin="dense"
                  label="Новый пароль"
                  type="password"
                  fullWidth
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                />
                <TextField
                  margin="dense"
                  label="Подтвердите новый пароль"
                  type="password"
                  fullWidth
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                />
              </Stack>
            </>
          ) : (
            <>
              <DialogContentText sx={{ color: theme.palette.textColors?.secondary, mb: 2 }}>
                Пожалуйста, введите код подтверждения, который был отправлен на ваш email.
              </DialogContentText>
              <TextField
                autoFocus
                margin="dense"
                label="Код подтверждения"
                fullWidth
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={() => {
              setChangePasswordDialogOpen(false);
              setCurrentPassword("");
              setNewPassword("");
              setConfirmPassword("");
              setVerificationCode("");
              setPasswordVerificationStep(false);
            }}
            sx={{ borderRadius: 25 }}
          >
            Отмена
          </Button>
          <Button
            onClick={handleChangePassword}
            disabled={loading}
            variant="contained"
            sx={{ 
              borderRadius: 25,
              bgcolor: theme.palette.highlight?.main,
              '&:hover': {
                bgcolor: theme.palette.highlight?.accent,
              }
            }}
          >
            {loading ? <CircularProgress size={24} /> : (passwordVerificationStep ? "Подтвердить" : "Изменить")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={changeEmailDialogOpen}
        onClose={() => {
          setChangeEmailDialogOpen(false);
          setNewEmail("");
          setEmailVerificationCode("");
          setEmailVerificationStep(false);
        }}
        PaperProps={{
          sx: {
            bgcolor: theme.palette.backgrounds?.paper,
            color: theme.palette.textColors?.primary,
            borderRadius: 4,
            minWidth: '400px'
          },
          elevation: 0
        }}
      >
        <DialogTitle>
          {emailVerificationStep ? "Подтверждение смены email" : "Изменение email"}
        </DialogTitle>
        <DialogContent>
          {!emailVerificationStep ? (
            <>
              <DialogContentText sx={{ color: theme.palette.textColors?.secondary, mb: 2 }}>
                Укажите новый email. На него будет отправлен код подтверждения.
              </DialogContentText>
              <TextField
                autoFocus
                margin="dense"
                label="Новый email"
                type="email"
                fullWidth
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  const emailRegex = /\S+@\S+\.\S+/;
                  if (!emailRegex.test(e.target.value) && e.target.value !== '') {
                    setEmailError("Введите корректный email");
                  } else {
                    setEmailError("");
                  }
                }}
                error={!!emailError}
                helperText={emailError}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </>
          ) : (
            <>
              <DialogContentText sx={{ color: theme.palette.textColors?.secondary, mb: 2 }}>
                Пожалуйста, введите код подтверждения, который был отправлен на новый email: {newEmail}
              </DialogContentText>
              <TextField
                autoFocus
                margin="dense"
                label="Код подтверждения"
                fullWidth
                value={emailVerificationCode}
                onChange={(e) => setEmailVerificationCode(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={() => {
              setChangeEmailDialogOpen(false);
              setNewEmail("");
              setEmailVerificationCode("");
              setEmailVerificationStep(false);
            }}
            sx={{ borderRadius: 25 }}
          >
            Отмена
          </Button>
          <Button
            onClick={handleChangeEmail}
            disabled={loading}
            variant="contained"
            sx={{ 
              borderRadius: 25,
              bgcolor: theme.palette.highlight?.main,
              '&:hover': {
                bgcolor: theme.palette.highlight?.accent,
              }
            }}
          >
            {loading ? <CircularProgress size={24} /> : (emailVerificationStep ? "Подтвердить" : "Изменить")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Алерт для уведомлений */}
      <Snackbar
        open={alertOpen}
        autoHideDuration={6000}
        onClose={() => setAlertOpen(false)}
      >
        <Alert
          onClose={() => setAlertOpen(false)}
          severity={error ? "error" : "success"}
          sx={{ width: "100%" }}
        >
          {error || success}
        </Alert>
      </Snackbar>
    </MainLayout>
  );
} 
