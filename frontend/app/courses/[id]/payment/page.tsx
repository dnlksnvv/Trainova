"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "@mui/material/styles";
import { 
  Stack, 
  Box, 
  Typography, 
  CircularProgress,
  Paper,
  Button,
  Radio,
  Divider,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  useMediaQuery,
  alpha
} from "@mui/material";
import { useParams, useRouter } from "next/navigation";
import CreditCardIcon from '@mui/icons-material/CreditCard';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import MainLayout from "@/app/components/layouts/MainLayout";
import SearchBar from "@/app/components/shared/SearchBar";
import { useAuth } from "@/app/auth/hooks/useAuth";
import { coursesApi, profileApi } from "@/app/services/api";

export default function PaymentPage() {
  const theme = useTheme();
  const params = useParams();
  const courseId = params.id as string;
  const router = useRouter();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user, loading: authLoading } = useAuth();

  // Состояния для данных курса
  const [courseData, setCourseData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Состояния для методов оплаты
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  // Состояние для обработки платежа
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentResult, setPaymentResult] = useState<any | null>(null);

  // Состояние для диалога с результатом оплаты
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState("");

  // Загружаем данные курса при монтировании компонента
  useEffect(() => {
    const loadCourse = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);
        const course = await coursesApi.getById(courseId);
        setCourseData(course);
      } catch (error: any) {
        console.error('Ошибка при загрузке курса:', error);
        setErrorMessage('Не удалось загрузить информацию о курсе');
      } finally {
        setLoading(false);
      }
    };

    if (courseId) {
      loadCourse();
    }
  }, [courseId]);

  // Загружаем методы оплаты пользователя
  useEffect(() => {
    const loadPaymentMethods = async () => {
      try {
        setLoadingPaymentMethods(true);
        const response = await profileApi.getPaymentMethods();
        setPaymentMethods(response.payment_methods || []);
        
        // Если есть методы оплаты, выбираем дефолтный или первый
        if (response.payment_methods && response.payment_methods.length > 0) {
          const defaultMethod = response.payment_methods.find((method) => method.is_default);
          setSelectedMethod(defaultMethod ? defaultMethod.payment_method_id : response.payment_methods[0].payment_method_id);
        }
      } catch (error) {
        console.error('Ошибка при загрузке методов оплаты:', error);
      } finally {
        setLoadingPaymentMethods(false);
      }
    };

    if (!authLoading && user) {
      loadPaymentMethods();
    }
  }, [authLoading, user]);

  // Обработчик выбора метода оплаты
  const handleMethodChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedMethod(event.target.value);
  };

  // Обработчик нажатия кнопки "Назад"
  const handleGoBack = () => {
    router.push(`/courses/${courseId}`);
  };

  // Обработчик оплаты новой картой
  const handlePayWithNewCard = async () => {
    try {
      setPaymentLoading(true);
      setPaymentError(null);
      
      // Оплата с использованием нового метода (существующий API)
      const response = await profileApi.subscribe(courseId);
      
      if (response.confirmation_url) {
        // Перенаправляем на страницу оплаты
        window.location.href = response.confirmation_url;
      } else {
        setPaymentError('Не удалось получить ссылку для оплаты');
      }
    } catch (error: any) {
      console.error('Ошибка при оплате новой картой:', error);
      setPaymentError(error.message || 'Не удалось выполнить оплату');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Обработчик оплаты сохраненной картой
  const handlePayWithSavedMethod = async () => {
    if (!selectedMethod) {
      setPaymentError('Выберите способ оплаты');
      return;
    }

    try {
      setPaymentLoading(true);
      setPaymentError(null);
      
      // Используем метод подписки с указанием сохраненного метода оплаты
      const response = await profileApi.subscribe(courseId, selectedMethod);
      
      // Если есть URL для подтверждения оплаты, перенаправляем на него
      if (response.confirmation_url) {
        window.location.href = response.confirmation_url;
      } else if (response.status === "success") {
        // Если статус успешный, но нет URL для подтверждения,
        // возможно оплата уже прошла автоматически
        setPaymentSuccess(true);
        setPaymentResult(response);
        setDialogMessage(response.message || "Оплата успешно завершена");
        setDialogOpen(true);
      } else {
        setPaymentError('Не удалось выполнить оплату');
      }
    } catch (error: any) {
      console.error('Ошибка при оплате сохраненной картой:', error);
      setPaymentError(error.message || 'Не удалось выполнить оплату');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Обработчик закрытия диалога
  const handleCloseDialog = () => {
    setDialogOpen(false);
    
    // Если оплата прошла успешно, перенаправляем на страницу курса
    if (paymentSuccess) {
      router.push(`/courses/${courseId}`);
    }
  };

  // Отображение карточки способа оплаты
  const renderPaymentMethodCard = (method: any) => {
    const isSelected = selectedMethod === method.payment_method_id;
    const cardInfo = method.card_type && method.card_last4 
      ? `${method.card_type} *${method.card_last4}` 
      : method.title || 'Платежная карта';
    
    const expiryInfo = method.card_expiry_month && method.card_expiry_year 
      ? `${method.card_expiry_month}/${method.card_expiry_year}` 
      : '';

    return (
      <Card 
        key={method.payment_method_id}
        sx={{
          borderRadius: theme.borderRadius.small,
          mb: 1.5,
          position: 'relative',
          cursor: 'pointer',
          boxShadow: isSelected 
            ? theme.customShadows.colored(theme.palette.highlight?.main || '#FF8C00', '30') 
            : theme.customShadows.light,
          border: isSelected 
            ? `1px solid ${theme.palette.highlight?.main}`
            : `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
          transition: 'all 0.25s ease-in-out',
          transform: isSelected ? 'scale(1.01)' : 'scale(1)',
          '&:hover': {
            boxShadow: isSelected 
              ? theme.customShadows.colored(theme.palette.highlight?.main || '#FF8C00', '40') 
              : theme.customShadows.hover,
            transform: 'translateY(-3px)',
          },
          backgroundColor: theme.palette.backgrounds?.paper,
          overflow: 'hidden',
        }}
        onClick={() => setSelectedMethod(method.payment_method_id)}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Radio
              checked={isSelected}
              onChange={handleMethodChange}
              value={method.payment_method_id}
              name="payment-method-radio"
              sx={{
                color: theme.palette.textColors?.secondary,
                '&.Mui-checked': {
                  color: theme.palette.highlight?.main,
                },
              }}
            />
            <CreditCardIcon 
              sx={{ 
                color: isSelected ? theme.palette.highlight?.main : theme.palette.textColors?.secondary,
                fontSize: 24,
                transition: 'color 0.2s ease-in-out',
              }} 
            />
            <Stack spacing={0.2} sx={{ flex: 1 }}>
              <Typography variant="body1" fontWeight="medium">
                {cardInfo}
              </Typography>
              {expiryInfo && (
                <Typography variant="caption" color={theme.palette.textColors?.secondary}>
                  Истекает: {expiryInfo}
                </Typography>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
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
        onBackClick={handleGoBack}
        title="Оплата курса"
        placeholder="Оплата курса"
      />
      
      <MainLayout>
        <Stack spacing={2.5} sx={{ pb: 4, px: 2, pt: 7 }}>
          {/* Основной контент */}
          {loading ? (
            <Paper
              elevation={0}
              sx={{
                borderRadius: theme.borderRadius.small,
                backgroundColor: theme.palette.backgrounds?.paper,
                p: 3,
                textAlign: 'center',
                boxShadow: theme.customShadows.light,
              }}
            >
              <Stack spacing={2} alignItems="center">
                <CircularProgress 
                  size={36} 
                  sx={{ color: theme.palette.highlight?.main }}
                />
                <Typography variant="body1" color={theme.palette.textColors?.secondary}>
                  Загрузка информации о курсе...
                </Typography>
              </Stack>
            </Paper>
          ) : errorMessage ? (
            <Paper
              elevation={0}
              sx={{
                borderRadius: theme.borderRadius.small,
                backgroundColor: theme.palette.backgrounds?.paper,
                p: 3,
                textAlign: 'center',
                boxShadow: theme.customShadows.light,
              }}
            >
              <Typography variant="h6" color="error" gutterBottom>
                Ошибка
              </Typography>
              <Typography variant="body1" color={theme.palette.textColors?.secondary}>
                {errorMessage}
              </Typography>
              <Button
                variant="outlined"
                onClick={handleGoBack}
                sx={{ 
                  mt: 2,
                  borderRadius: theme.borderRadius.small,
                  borderColor: theme.palette.highlight?.main,
                  color: theme.palette.highlight?.main,
                  '&:hover': {
                    borderColor: theme.palette.highlight?.accent,
                    backgroundColor: alpha(theme.palette.highlight?.main || '#FF8C00', 0.05),
                  }
                }}
              >
                Вернуться назад
              </Button>
            </Paper>
          ) : courseData ? (
            <>
              {/* Информация о курсе */}
              <Paper
                elevation={0}
                sx={{
                  borderRadius: theme.borderRadius.small,
                  backgroundColor: theme.palette.backgrounds?.paper,
                  p: 2.5,
                  boxShadow: theme.customShadows.light,
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '30%',
                    height: '100%',
                    background: `radial-gradient(circle at right, ${alpha(theme.palette.highlight?.main || '#FF8C00', 0.15)}, transparent 70%)`,
                    pointerEvents: 'none',
                  }
                }}
              >
                <Stack spacing={2}>
                  <Typography variant="h6" fontWeight="bold">
                    {courseData.name}
                  </Typography>
                  
                  <Divider sx={{ bgcolor: alpha(theme.palette.common.white, 0.1) }} />
                  
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body1">
                      Стоимость:
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color={theme.palette.highlight?.main}>
                      {(!courseData.price || courseData.price <= 0) ? "Бесплатно" : `${courseData.price} ₽/месяц`}
                    </Typography>
                  </Stack>
                </Stack>
              </Paper>
              
              {/* Выбор способа оплаты */}
              <Paper
                elevation={0}
                sx={{
                  borderRadius: theme.borderRadius.small,
                  backgroundColor: theme.palette.backgrounds?.paper,
                  p: 2.5,
                  boxShadow: theme.customShadows.light,
                  position: 'relative',
                  zIndex: 1,
                  overflow: 'visible',
                }}
              >
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Выберите способ оплаты
                </Typography>
                
                {loadingPaymentMethods ? (
                  <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
                    <CircularProgress 
                      size={28} 
                      sx={{ color: theme.palette.highlight?.main }}
                    />
                    <Typography variant="body2" color={theme.palette.textColors?.secondary}>
                      Загрузка способов оплаты...
                    </Typography>
                  </Stack>
                ) : (
                  <Stack spacing={2} sx={{ mt: 2 }}>
                    {/* Сохраненные методы оплаты */}
                    {paymentMethods.length > 0 ? (
                      <Stack spacing={1}>
                        <Typography variant="body2" color={theme.palette.textColors?.secondary} gutterBottom>
                          Сохраненные способы оплаты:
                        </Typography>
                        
                        {paymentMethods.map(renderPaymentMethodCard)}
                      </Stack>
                    ) : (
                      <Box sx={{ py: 2, textAlign: 'center' }}>
                        <Typography variant="body2" color={theme.palette.textColors?.secondary}>
                          У вас пока нет доступных способов оплаты
                        </Typography>
                        <Typography variant="caption" color={theme.palette.textColors?.secondary} sx={{ mt: 1, display: 'block' }}>
                          Для сохранения карты необходимо успешно завершить платеж
                        </Typography>
                      </Box>
                    )}
                    
                    <Divider sx={{ my: 1, bgcolor: alpha(theme.palette.common.white, 0.1) }} />
                    
                    {/* Новый способ оплаты */}
                    <Card
                      sx={{
                        borderRadius: theme.borderRadius.small,
                        mb: 1.5,
                        position: 'relative',
                        cursor: 'pointer',
                        boxShadow: selectedMethod === 'new_card' 
                          ? theme.customShadows.colored(theme.palette.highlight?.main || '#FF8C00', '30') 
                          : theme.customShadows.light,
                        border: selectedMethod === 'new_card' 
                          ? `1px solid ${theme.palette.highlight?.main}`
                          : `1px dashed ${alpha(theme.palette.highlight?.main || '#FF8C00', 0.3)}`,
                        transition: 'all 0.25s ease-in-out',
                        transform: selectedMethod === 'new_card' ? 'scale(1.01)' : 'scale(1)',
                        backgroundColor: selectedMethod === 'new_card'
                          ? alpha(theme.palette.highlight?.main || '#FF8C00', 0.05)
                          : theme.palette.backgrounds?.paper,
                        '&:hover': {
                          boxShadow: selectedMethod === 'new_card'
                            ? theme.customShadows.colored(theme.palette.highlight?.main || '#FF8C00', '40') 
                            : theme.customShadows.hover,
                          transform: 'translateY(-3px)',
                          backgroundColor: alpha(theme.palette.highlight?.main || '#FF8C00', 0.05),
                        },
                        overflow: 'hidden',
                      }}
                      onClick={() => setSelectedMethod('new_card')}
                    >
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Radio
                            checked={selectedMethod === 'new_card'}
                            onChange={() => setSelectedMethod('new_card')}
                            value="new_card"
                            name="payment-method-radio"
                            sx={{
                              color: theme.palette.textColors?.secondary,
                              '&.Mui-checked': {
                                color: theme.palette.highlight?.main,
                              },
                            }}
                          />
                          
                          <Stack spacing={0.2} sx={{ flex: 1 }}>
                            <Typography variant="body1" fontWeight="medium">
                              Добавить карту
                            </Typography>
                            <Typography variant="caption" color={theme.palette.textColors?.secondary}>
                              Новый способ оплаты
                            </Typography>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Stack>
                )}
                
                {/* Кнопка оплаты */}
                {(paymentMethods.length > 0 || selectedMethod === 'new_card') && (
                  <Button
                    variant="contained"
                    fullWidth
                    disabled={paymentLoading || !selectedMethod}
                    onClick={selectedMethod === 'new_card' ? handlePayWithNewCard : handlePayWithSavedMethod}
                    sx={{
                      mt: 3,
                      py: 1.2,
                      backgroundColor: theme.palette.highlight?.main,
                      color: '#fff',
                      fontWeight: 'bold',
                      borderRadius: theme.borderRadius.small,
                      boxShadow: theme.customShadows.colored(theme.palette.highlight?.main || '#FF8C00', '30'),
                      '&:hover': {
                        backgroundColor: theme.palette.highlight?.accent,
                        boxShadow: theme.customShadows.colored(theme.palette.highlight?.main || '#FF8C00', '40'),
                        transform: 'translateY(-2px)',
                      },
                      transition: 'all 0.25s ease',
                      position: 'relative',
                      zIndex: 5,
                      pointerEvents: 'auto',
                    }}
                  >
                    {paymentLoading ? (
                      <CircularProgress size={24} sx={{ color: '#fff' }} />
                    ) : (
                      (!courseData.price || courseData.price <= 0) ? "Получить доступ" : `Оплатить ${courseData.price} ₽/месяц`
                    )}
                  </Button>
                )}
                
                {/* Сообщение об ошибке */}
                {paymentError && (
                  <Typography 
                    variant="body2" 
                    color="error" 
                    sx={{ mt: 2, textAlign: 'center' }}
                  >
                    {paymentError}
                  </Typography>
                )}
              </Paper>
            </>
          ) : null}
        </Stack>
      </MainLayout>
      
      {/* Диалог с результатом оплаты */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        PaperProps={{
          sx: {
            borderRadius: theme.borderRadius.small,
            backgroundColor: theme.palette.backgrounds?.paper,
            boxShadow: theme.customShadows.strong,
          }
        }}
        BackdropProps={{
          sx: {
            backgroundColor: alpha(theme.palette.backgrounds?.default || '#2b2b2b', 0.8),
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          {paymentSuccess ? "Успешно" : "Ошибка"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: theme.palette.textColors?.secondary }}>
            {dialogMessage}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={handleCloseDialog} 
            color="primary" 
            variant="contained"
            sx={{
              borderRadius: theme.borderRadius.small,
              backgroundColor: theme.palette.highlight?.main,
              '&:hover': {
                backgroundColor: theme.palette.highlight?.accent,
              },
              boxShadow: theme.customShadows.light,
              transition: 'all 0.2s ease',
            }}
          >
            {paymentSuccess ? "Перейти к курсу" : "Закрыть"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
} 