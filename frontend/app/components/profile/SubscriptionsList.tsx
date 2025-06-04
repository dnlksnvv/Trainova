import React from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Stack, 
  Chip, 
  Button,
  useTheme,
  IconButton
} from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import SubscriptionsIcon from '@mui/icons-material/Subscriptions';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { SubscriptionInfo } from '../../services/api';

interface SubscriptionsListProps {
  subscriptions: SubscriptionInfo[];
  loading: boolean;
  onToggleRecurring: (courseId: string) => void;
  isProcessing: boolean;
  onOpenCourse?: (courseId: string) => void;
}

const SubscriptionsList: React.FC<SubscriptionsListProps> = ({ 
  subscriptions, 
  loading, 
  onToggleRecurring,
  isProcessing,
  onOpenCourse
}) => {
  const theme = useTheme();

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <Typography variant="body2" color="text.secondary">Загрузка подписок...</Typography>
      </Box>
    );
  }

  if (!subscriptions || subscriptions.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <SubscriptionsIcon sx={{ fontSize: 48, color: theme.palette.textColors?.secondary, mb: 1 }} />
        <Typography variant="body1" color="text.secondary">
          У вас пока нет активных подписок
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {subscriptions.map((subscription, index) => (
        <Card 
          key={subscription.subscription_uuid || `subscription-${index}`}
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
            {/* Заголовок и цена */}
            <Box sx={{ mb: 2 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600,
                  color: theme.palette.textColors?.primary,
                  mb: 0.5,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {subscription.course_name}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <Chip 
                  label="Активна" 
                  size="small" 
                  sx={{ 
                    bgcolor: theme.palette.success.main,
                    color: 'white',
                    fontSize: '0.75rem',
                    height: 24
                  }} 
                />
                <Button
                  size="small"
                  variant="outlined"
                  endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                  onClick={() => onOpenCourse?.(subscription.course_id)}
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
                  Открыть
                </Button>
              </Stack>
            </Box>

            {/* Цена */}
            <Typography 
              variant="h6" 
              sx={{ 
                color: theme.palette.highlight?.main, 
                fontWeight: 700,
                mb: 2
              }}
            >
              {(!subscription.price || subscription.price <= 0) ? "Бесплатно" : `${subscription.price} ₽`}
            </Typography>

            {/* Даты */}
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
              <Box>
                <Typography variant="body2" sx={{ color: theme.palette.textColors?.secondary }}>
                  Начало
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {new Date(subscription.start_date).toLocaleDateString('ru-RU')}
                </Typography>
              </Box>
              {subscription.end_date && (
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" sx={{ color: theme.palette.textColors?.secondary }}>
                    Окончание
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {new Date(subscription.end_date).toLocaleDateString('ru-RU')}
                  </Typography>
                </Box>
              )}
            </Stack>

            {/* Оставшиеся дни */}
            {subscription.days_left !== undefined && subscription.days_left !== null && (
              <Box 
                sx={{ 
                  bgcolor: subscription.days_left < 7 
                    ? theme.palette.error.light + '20'
                    : theme.palette.success.light + '20',
                  borderRadius: 2,
                  p: 1.5,
                  mb: 2
                }}
              >
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontWeight: 600,
                    color: subscription.days_left < 7 
                      ? theme.palette.error.main 
                      : theme.palette.success.main,
                    textAlign: 'center'
                  }}
                >
                  {subscription.days_left === 0 
                    ? 'Истекает сегодня' 
                    : subscription.days_left === 1
                    ? 'Остался 1 день'
                    : `Осталось ${subscription.days_left} дней`}
                </Typography>
              </Box>
            )}

            {/* Неограниченная подписка (для бесплатных курсов) */}
            {subscription.days_left === null && !subscription.end_date && (
              <Box 
                sx={{ 
                  bgcolor: theme.palette.highlight?.main + '20',
                  borderRadius: 2,
                  p: 1.5,
                  mb: 2
                }}
              >
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontWeight: 600,
                    color: theme.palette.highlight?.main,
                    textAlign: 'center'
                  }}
                >
                  Неограниченная
                </Typography>
              </Box>
            )}

            {/* Кнопка автопродления (только для платных подписок) */}
            {subscription.end_date && subscription.days_left !== null && (
              <Button
                fullWidth
                variant="outlined"
                startIcon={subscription.recurring ? <CancelIcon /> : <AutorenewIcon />}
                onClick={() => onToggleRecurring(subscription.course_id)}
                disabled={isProcessing}
                sx={{
                  borderRadius: 25,
                  borderColor: theme.palette.highlight?.main,
                  color: subscription.recurring ? theme.palette.error.main : theme.palette.highlight?.main,
                  py: 1,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  textTransform: 'none',
                  "&:hover": {
                    borderColor: subscription.recurring ? theme.palette.error.main : theme.palette.highlight?.accent,
                    bgcolor: subscription.recurring 
                      ? `${theme.palette.error.main}10`
                      : `${theme.palette.highlight?.main}10`,
                  },
                }}
              >
                {subscription.recurring ? "Отменить автопродление" : "Включить автопродление"}
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
};

export default SubscriptionsList; 