import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Stack, 
  Chip, 
  Button,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider
} from '@mui/material';
import PaymentIcon from '@mui/icons-material/Payment';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { PaymentInfo } from '../../services/api';

interface PaymentsListProps {
  payments: PaymentInfo[];
  loading: boolean;
}

const PaymentsList: React.FC<PaymentsListProps> = ({ 
  payments, 
  loading
}) => {
  const theme = useTheme();
  const [selectedPayment, setSelectedPayment] = useState<PaymentInfo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'succeeded':
        return theme.palette.success.main;
      case 'pending':
        return theme.palette.warning.main;
      case 'canceled':
        return theme.palette.error.main;
      default:
        return theme.palette.textColors?.secondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'succeeded':
        return 'Успешно';
      case 'pending':
        return 'В обработке';
      case 'canceled':
        return 'Отменен';
      default:
        return status;
    }
  };

  const handleCardClick = (payment: PaymentInfo) => {
    setSelectedPayment(payment);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedPayment(null);
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <Typography variant="body2" color="text.secondary">Загрузка платежей...</Typography>
      </Box>
    );
  }

  if (!payments || payments.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <PaymentIcon sx={{ fontSize: 48, color: theme.palette.textColors?.secondary, mb: 1 }} />
        <Typography variant="body1" color="text.secondary">
          История платежей пуста
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Stack spacing={2}>
        {payments.map((payment) => (
          <Card 
            key={payment.payment_id}
            variant="outlined"
            sx={{ 
              borderRadius: 3,
              backgroundColor: theme.palette.backgrounds?.default,
              border: `1px solid ${theme.palette.highlight?.main}20`,
              transition: 'all 0.2s ease',
              cursor: 'pointer',
              '&:hover': {
                borderColor: theme.palette.highlight?.main,
                transform: 'translateY(-2px)',
              }
            }}
            onClick={() => handleCardClick(payment)}
          >
            <CardContent sx={{ p: 3 }}>
              {/* Заголовок и статус */}
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                <Box sx={{ flex: 1, mr: 2 }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 600,
                      color: theme.palette.textColors?.primary,
                      mb: 0.5
                    }}
                  >
                    {payment.course_name}
                  </Typography>
                  <Typography variant="h6" sx={{ color: theme.palette.highlight?.main, fontWeight: 700 }}>
                    {payment.amount} ₽
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip 
                    label={getStatusLabel(payment.status)} 
                    size="small" 
                    sx={{ 
                      bgcolor: getStatusColor(payment.status),
                      color: 'white',
                      fontSize: '0.75rem',
                      height: 24
                    }} 
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    endIcon={<InfoOutlinedIcon sx={{ fontSize: 14 }} />}
                    sx={{
                      minWidth: 'auto',
                      px: 1.5,
                      py: 0.5,
                      fontSize: '0.75rem',
                      borderRadius: 2,
                      borderColor: theme.palette.highlight?.main + '40',
                      color: theme.palette.highlight?.main,
                      textTransform: 'none',
                      fontWeight: 500,
                      '&:hover': {
                        borderColor: theme.palette.highlight?.main,
                        bgcolor: `${theme.palette.highlight?.main}10`,
                      }
                    }}
                  >
                    Детали
                  </Button>
                </Stack>
              </Stack>

              {/* Дата создания */}
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                <Box>
                  <Typography variant="body2" sx={{ color: theme.palette.textColors?.secondary }}>
                    Дата создания заявки
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {new Date(payment.payment_date).toLocaleDateString('ru-RU')} {new Date(payment.payment_date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" sx={{ color: theme.palette.textColors?.secondary }}>
                    ID платежа
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                    {payment.payment_id.slice(-8)}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* Диалог с подробной информацией */}
      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            backgroundColor: theme.palette.backgrounds?.default,
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Детали платежа
          </Typography>
        </DialogTitle>
        <DialogContent>
          {selectedPayment && (
            <Stack spacing={3}>
              {/* Основная информация */}
              <Box>
                <Typography variant="h6" sx={{ mb: 1, color: theme.palette.textColors?.primary }}>
                  {selectedPayment.course_name}
                </Typography>
                <Typography variant="h5" sx={{ color: theme.palette.highlight?.main, fontWeight: 700 }}>
                  {selectedPayment.amount} ₽
                </Typography>
              </Box>

              <Divider />

              {/* Статус */}
              <Box>
                <Typography variant="body2" sx={{ color: theme.palette.textColors?.secondary, mb: 1 }}>
                  Статус платежа
                </Typography>
                <Chip 
                  label={getStatusLabel(selectedPayment.status)} 
                  sx={{ 
                    bgcolor: getStatusColor(selectedPayment.status),
                    color: 'white',
                    fontWeight: 500
                  }} 
                />
              </Box>

              {/* Даты */}
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" sx={{ color: theme.palette.textColors?.secondary, mb: 0.5 }}>
                    Дата создания заявки
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {new Date(selectedPayment.payment_date).toLocaleDateString('ru-RU')} в {new Date(selectedPayment.payment_date).toLocaleTimeString('ru-RU')}
                  </Typography>
                </Box>
                
                {selectedPayment.status === 'succeeded' && (
                  <Box>
                    <Typography variant="body2" sx={{ color: theme.palette.textColors?.secondary, mb: 0.5 }}>
                      Дата оплаты
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {new Date(selectedPayment.payment_date).toLocaleDateString('ru-RU')} в {new Date(selectedPayment.payment_date).toLocaleTimeString('ru-RU')}
                    </Typography>
                  </Box>
                )}
              </Stack>

              {/* Идентификаторы */}
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" sx={{ color: theme.palette.textColors?.secondary, mb: 0.5 }}>
                    ID платежа
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                    {selectedPayment.payment_id}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="body2" sx={{ color: theme.palette.textColors?.secondary, mb: 0.5 }}>
                    ID курса
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                    {selectedPayment.course_id}
                  </Typography>
                </Box>
              </Stack>

              {/* Метод оплаты */}
              <Box>
                <Typography variant="body2" sx={{ color: theme.palette.textColors?.secondary, mb: 0.5 }}>
                  Метод оплаты
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {selectedPayment.payment_method || 'Не указан'}
                </Typography>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={handleCloseDialog}
            variant="outlined"
            sx={{
              borderRadius: 25,
              borderColor: theme.palette.highlight?.main,
              color: theme.palette.highlight?.main,
              px: 3,
              "&:hover": {
                borderColor: theme.palette.highlight?.accent,
                bgcolor: `${theme.palette.highlight?.main}10`,
              },
            }}
          >
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PaymentsList; 