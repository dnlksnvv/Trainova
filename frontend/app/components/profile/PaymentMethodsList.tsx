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
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider
} from '@mui/material';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { PaymentMethodResponse } from '../../services/api';

interface PaymentMethodsListProps {
  paymentMethods: PaymentMethodResponse[];
  loading: boolean;
  onSetDefault?: (paymentMethodId: string) => void;
  onDelete?: (paymentMethodId: string) => void;
}

const PaymentMethodsList: React.FC<PaymentMethodsListProps> = ({ 
  paymentMethods, 
  loading,
  onSetDefault,
  onDelete
}) => {
  const theme = useTheme();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodResponse | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuMethodId, setMenuMethodId] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, methodId: string) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setMenuMethodId(methodId);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuMethodId(null);
  };

  const handleCardClick = (method: PaymentMethodResponse) => {
    setSelectedMethod(method);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedMethod(null);
  };

  const handleSetDefault = (methodId: string) => {
    if (onSetDefault) {
      onSetDefault(methodId);
    }
    handleMenuClose();
  };

  const handleDelete = (methodId: string) => {
    if (onDelete) {
      onDelete(methodId);
    }
    handleMenuClose();
  };

  const getCardDisplayName = (method: PaymentMethodResponse) => {
    if (method.title) {
      return method.title;
    }
    if (method.card_type && method.card_last4) {
      return `${method.card_type} *${method.card_last4}`;
    }
    return method.method || 'Платежная карта';
  };

  const getCardSubtitle = (method: PaymentMethodResponse) => {
    const parts = [];
    if (method.card_expiry_month && method.card_expiry_year) {
      parts.push(`Истекает: ${method.card_expiry_month}/${method.card_expiry_year}`);
    }
    if (method.issuer_country) {
      parts.push(`Страна: ${method.issuer_country}`);
    }
    return parts.join(' • ');
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <Typography variant="body2" color="text.secondary">Загрузка методов оплаты...</Typography>
      </Box>
    );
  }

  if (!paymentMethods || paymentMethods.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <CreditCardIcon sx={{ fontSize: 48, color: theme.palette.textColors?.secondary, mb: 1 }} />
        <Typography variant="body1" color="text.secondary">
          Методы оплаты не найдены
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Добавьте метод оплаты при оформлении подписки
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Stack spacing={2}>
        {paymentMethods.map((method) => (
          <Card 
            key={method.payment_method_id}
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
            onClick={() => handleCardClick(method)}
          >
            <CardContent sx={{ p: 3 }}>
              {/* Заголовок и меню */}
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1 }}>
                  <CreditCardIcon 
                    sx={{ 
                      color: theme.palette.highlight?.main,
                      fontSize: 28
                    }} 
                  />
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          fontWeight: 600,
                          color: theme.palette.textColors?.primary
                        }}
                      >
                        {getCardDisplayName(method)}
                      </Typography>
                      {method.is_default && (
                        <Chip
                          icon={<StarIcon sx={{ fontSize: 16 }} />}
                          label="По умолчанию"
                          size="small"
                          sx={{
                            bgcolor: `${theme.palette.highlight?.main}20`,
                            color: theme.palette.highlight?.main,
                            fontWeight: 500,
                            '& .MuiChip-icon': {
                              color: theme.palette.highlight?.main
                            }
                          }}
                        />
                      )}
                    </Stack>
                    {getCardSubtitle(method) && (
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: theme.palette.textColors?.secondary,
                          mt: 0.5
                        }}
                      >
                        {getCardSubtitle(method)}
                      </Typography>
                    )}
                  </Box>
                </Stack>
                
                <IconButton
                  size="small"
                  onClick={(e) => handleMenuOpen(e, method.payment_method_id)}
                  sx={{
                    color: theme.palette.textColors?.secondary,
                    '&:hover': {
                      bgcolor: `${theme.palette.highlight?.main}10`,
                      color: theme.palette.highlight?.main,
                    }
                  }}
                >
                  <MoreVertIcon />
                </IconButton>
              </Stack>

              {/* Статусы */}
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  label={method.is_verified ? "Подтверждена" : "Не подтверждена"}
                  size="small"
                  sx={{
                    bgcolor: method.is_verified 
                      ? `${theme.palette.success.main}20` 
                      : `${theme.palette.warning.main}20`,
                    color: method.is_verified 
                      ? theme.palette.success.main 
                      : theme.palette.warning.main,
                    fontWeight: 500
                  }}
                />
              </Stack>

              {/* Кнопка подробнее */}
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                <Button
                  size="small"
                  startIcon={<DeleteIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDelete) onDelete(method.payment_method_id);
                  }}
                  sx={{
                    color: theme.palette.error.main,
                    fontWeight: 500,
                    '&:hover': {
                      bgcolor: `${theme.palette.error.main}10`,
                    }
                  }}
                >
                  Удалить
                </Button>
                <Button
                  size="small"
                  startIcon={<InfoOutlinedIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMethod(method);
                    setDetailDialogOpen(true);
                  }}
                  sx={{
                    color: theme.palette.highlight?.main,
                    fontWeight: 500,
                    '&:hover': {
                      bgcolor: `${theme.palette.highlight?.main}10`,
                    }
                  }}
                >
                  Детали
                </Button>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* Меню действий */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            bgcolor: theme.palette.backgrounds?.paper,
            border: `1px solid ${theme.palette.highlight?.main}20`,
            borderRadius: 2,
            minWidth: 180
          }
        }}
      >
        {menuMethodId && !paymentMethods.find(m => m.payment_method_id === menuMethodId)?.is_default && (
          <MenuItem 
            onClick={() => handleSetDefault(menuMethodId)}
            sx={{
              color: theme.palette.textColors?.primary,
              '&:hover': {
                bgcolor: `${theme.palette.highlight?.main}10`,
              }
            }}
          >
            <StarBorderIcon sx={{ mr: 1, fontSize: 20 }} />
            Сделать основной
          </MenuItem>
        )}
        <MenuItem 
          onClick={() => menuMethodId && handleDelete(menuMethodId)}
          sx={{
            color: theme.palette.error.main,
            '&:hover': {
              bgcolor: `${theme.palette.error.main}10`,
            }
          }}
        >
          <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
          Удалить
        </MenuItem>
      </Menu>

      {/* Диалог с подробной информацией */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: theme.palette.backgrounds?.paper,
            borderRadius: 3,
            border: `1px solid ${theme.palette.highlight?.main}20`,
          }
        }}
      >
        <DialogTitle sx={{ 
          color: theme.palette.textColors?.primary,
          borderBottom: `1px solid ${theme.palette.highlight?.main}20`,
          pb: 2
        }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <CreditCardIcon sx={{ color: theme.palette.highlight?.main }} />
            <Typography variant="h6" component="span">
              Подробная информация о карте
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {selectedMethod && (
            <Stack spacing={3}>
              {/* Основная информация */}
              <Box>
                <Typography variant="h6" sx={{ color: theme.palette.textColors?.primary, mb: 1 }}>
                  {getCardDisplayName(selectedMethod)}
                </Typography>
                <Typography variant="body2" sx={{ color: theme.palette.textColors?.secondary }}>
                  ID: {selectedMethod.payment_method_id}
                </Typography>
              </Box>

              <Divider sx={{ bgcolor: `${theme.palette.highlight?.main}20` }} />

              {/* Детали карты */}
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" sx={{ color: theme.palette.textColors?.secondary, mb: 0.5 }}>
                    Тип метода оплаты
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {selectedMethod.method || 'Не указан'}
                  </Typography>
                </Box>
                
                {selectedMethod.card_type && (
                  <Box>
                    <Typography variant="body2" sx={{ color: theme.palette.textColors?.secondary, mb: 0.5 }}>
                      Тип карты
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {selectedMethod.card_type}
                    </Typography>
                  </Box>
                )}

                {selectedMethod.card_last4 && (
                  <Box>
                    <Typography variant="body2" sx={{ color: theme.palette.textColors?.secondary, mb: 0.5 }}>
                      Последние 4 цифры
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                      **** **** **** {selectedMethod.card_last4}
                    </Typography>
                  </Box>
                )}

                {selectedMethod.card_expiry_month && selectedMethod.card_expiry_year && (
                  <Box>
                    <Typography variant="body2" sx={{ color: theme.palette.textColors?.secondary, mb: 0.5 }}>
                      Срок действия
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {selectedMethod.card_expiry_month}/{selectedMethod.card_expiry_year}
                    </Typography>
                  </Box>
                )}

                {selectedMethod.issuer_country && (
                  <Box>
                    <Typography variant="body2" sx={{ color: theme.palette.textColors?.secondary, mb: 0.5 }}>
                      Страна эмитента
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {selectedMethod.issuer_country}
                    </Typography>
                  </Box>
                )}
              </Stack>

              <Divider sx={{ bgcolor: `${theme.palette.highlight?.main}20` }} />

              {/* Статусы */}
              <Box>
                <Typography variant="body2" sx={{ color: theme.palette.textColors?.secondary, mb: 1 }}>
                  Статус
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip
                    label={selectedMethod.is_verified ? "Подтверждена" : "Не подтверждена"}
                    size="small"
                    sx={{
                      bgcolor: selectedMethod.is_verified 
                        ? `${theme.palette.success.main}20` 
                        : `${theme.palette.warning.main}20`,
                      color: selectedMethod.is_verified 
                        ? theme.palette.success.main 
                        : theme.palette.warning.main,
                      fontWeight: 500
                    }}
                  />
                  {selectedMethod.is_default && (
                    <Chip
                      icon={<StarIcon sx={{ fontSize: 16 }} />}
                      label="По умолчанию"
                      size="small"
                      sx={{
                        bgcolor: `${theme.palette.highlight?.main}20`,
                        color: theme.palette.highlight?.main,
                        fontWeight: 500,
                        '& .MuiChip-icon': {
                          color: theme.palette.highlight?.main
                        }
                      }}
                    />
                  )}
                </Stack>
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

export default PaymentMethodsList; 