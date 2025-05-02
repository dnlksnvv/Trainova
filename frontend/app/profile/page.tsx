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
  FormControl,
  InputLabel,
  OutlinedInput,
  InputAdornment
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import EmailIcon from "@mui/icons-material/Email";
import PersonIcon from "@mui/icons-material/Person";
import MainLayout from "../components/layouts/MainLayout";
import { useAuth } from "../auth/hooks/useAuth";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const theme = useTheme();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);
  const [changeEmailDialogOpen, setChangeEmailDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [alertOpen, setAlertOpen] = useState(false);

  // Поля для смены пароля
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Поле для верификации смены пароля
  const [verificationCode, setVerificationCode] = useState("");
  const [passwordVerificationStep, setPasswordVerificationStep] = useState(false);

  // Поля для смены email
  const [newEmail, setNewEmail] = useState("");
  // Поле для верификации смены email
  const [emailVerificationCode, setEmailVerificationCode] = useState("");
  const [emailVerificationStep, setEmailVerificationStep] = useState(false);
  const [emailError, setEmailError] = useState("");

  const handleChangePassword = async () => {
    if (!currentPassword) {
      setError("Пожалуйста, введите текущий пароль");
      setAlertOpen(true);
      return;
    }

    if (passwordVerificationStep) {
      // Если мы на шаге верификации, проверяем код и подтверждаем смену пароля
      await handleVerifyPasswordChange();
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError("Пожалуйста, заполните все поля");
      setAlertOpen(true);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Пароли не совпадают");
      setAlertOpen(true);
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Извлекаем токен напрямую из куки
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

      setSuccess("Код подтверждения отправлен на ваш email");
      setAlertOpen(true);
      
      // Переключаемся на шаг верификации
      setPasswordVerificationStep(true);
    } catch (error: any) {
      setError(error.message || "Произошла ошибка");
      setAlertOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPasswordChange = async () => {
    if (!verificationCode) {
      setError("Пожалуйста, введите код подтверждения");
      setAlertOpen(true);
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Извлекаем токен напрямую из куки
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

      setSuccess("Пароль успешно изменен. Пожалуйста, войдите снова.");
      setAlertOpen(true);
      
      // Закрываем диалог
      setChangePasswordDialogOpen(false);
      
      // Сбрасываем все поля и состояния
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setVerificationCode("");
      setPasswordVerificationStep(false);
      
      // Перенаправляем на страницу входа через 2 секунды
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
    } catch (error: any) {
      setError(error.message || "Произошла ошибка");
      setAlertOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPasswordChange = () => {
    // Сбрасываем все поля и состояния
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setVerificationCode("");
    setPasswordVerificationStep(false);
    setChangePasswordDialogOpen(false);
  };

  const handleChangeEmail = async () => {
    if (emailVerificationStep) {
      // Если мы на шаге верификации, проверяем код и подтверждаем смену email
      await handleVerifyEmailChange();
      return;
    }

    if (!newEmail) {
      setError("Введите новый email");
      setAlertOpen(true);
      return;
    }

    // Валидация email
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(newEmail)) {
      setError("Пожалуйста, введите корректный email");
      setAlertOpen(true);
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Извлекаем токен напрямую из куки
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
        body: JSON.stringify({ new_email: newEmail })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Не удалось инициировать смену email");
      }

      setSuccess("Код подтверждения отправлен на новый email");
      setAlertOpen(true);
      
      // Переключаемся на шаг верификации
      setEmailVerificationStep(true);
    } catch (error: any) {
      setError(error.message || "Произошла ошибка");
      setAlertOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailChange = async () => {
    if (!emailVerificationCode) {
      setError("Пожалуйста, введите код подтверждения");
      setAlertOpen(true);
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Извлекаем токен напрямую из куки
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

      setSuccess("Email успешно изменен. Пожалуйста, войдите снова.");
      setAlertOpen(true);
      
      // Закрываем диалог
      setChangeEmailDialogOpen(false);
      
      // Сбрасываем все поля и состояния
      setNewEmail("");
      setEmailVerificationCode("");
      setEmailVerificationStep(false);
      
      // Перенаправляем на страницу входа через 2 секунды
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
    } catch (error: any) {
      setError(error.message || "Произошла ошибка");
      setAlertOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEmailChange = () => {
    // Сбрасываем все поля и состояния
    setNewEmail("");
    setEmailVerificationCode("");
    setEmailVerificationStep(false);
    setChangeEmailDialogOpen(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/auth/login');
    } catch (error) {
      console.error("Ошибка при выходе:", error);
    }
  };

  const avatarName = user ? 
    (user.first_name && user.last_name) ? 
      `${user.first_name[0]}${user.last_name[0]}` : 
      (user.first_name ? user.first_name[0] : (user.email ? user.email[0].toUpperCase() : "U")) 
    : "U";

  const displayName = user ? 
    (user.first_name && user.last_name) ? 
      `${user.first_name} ${user.last_name}` : 
      (user.first_name ? user.first_name : user.email) 
    : "Пользователь";

  return (
    <MainLayout>
      <Stack spacing={3}>
        <Paper
          elevation={3}
          sx={{
            p: 3,
            borderRadius: 2,
            bgcolor: theme.palette.backgrounds?.paper,
          }}
        >
          {/* Шапка профиля с аватаром */}
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              alignItems: "center",
              gap: 2,
              mb: 3,
            }}
          >
            <Avatar
              sx={{
                width: 80,
                height: 80,
                bgcolor: theme.palette.highlight?.main,
                fontSize: "1.5rem",
              }}
              src={user?.avatar_url || undefined}
            >
              {avatarName}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="h5"
                sx={{ color: theme.palette.textColors?.primary }}
              >
                {displayName}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: theme.palette.textColors?.secondary }}
              >
                {user?.email}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              sx={{
                borderColor: theme.palette.highlight?.main,
                color: theme.palette.highlight?.main,
                "&:hover": {
                  borderColor: theme.palette.highlight?.accent,
                  bgcolor: "transparent",
                },
              }}
            >
              Изменить профиль
            </Button>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Безопасность аккаунта */}
          <Typography
            variant="h6"
            sx={{ mb: 2, color: theme.palette.textColors?.primary }}
          >
            Безопасность аккаунта
          </Typography>

          <Stack spacing={2}>
            <Button
              variant="outlined"
              startIcon={<EmailIcon />}
              onClick={() => setChangeEmailDialogOpen(true)}
              sx={{
                justifyContent: "flex-start",
                borderColor: theme.palette.divider,
                color: theme.palette.textColors?.primary,
                "&:hover": {
                  borderColor: theme.palette.highlight?.main,
                },
              }}
            >
              Изменить email
            </Button>

            <Button
              variant="outlined"
              startIcon={<LockOutlinedIcon />}
              onClick={() => setChangePasswordDialogOpen(true)}
              sx={{
                justifyContent: "flex-start",
                borderColor: theme.palette.divider,
                color: theme.palette.textColors?.primary,
                "&:hover": {
                  borderColor: theme.palette.highlight?.main,
                },
              }}
            >
              Изменить пароль
            </Button>

            <Button
              variant="outlined"
              startIcon={<PersonIcon />}
              color="error"
              onClick={handleLogout}
              sx={{
                justifyContent: "flex-start",
                borderColor: theme.palette.error.main,
                color: theme.palette.error.main,
                "&:hover": {
                  borderColor: theme.palette.error.dark,
                  bgcolor: "transparent",
                },
              }}
            >
              Выйти из аккаунта
            </Button>
          </Stack>
        </Paper>
      </Stack>

      {/* Диалог изменения пароля */}
      <Dialog
        open={changePasswordDialogOpen}
        onClose={handleCancelPasswordChange}
        PaperProps={{
          sx: {
            bgcolor: theme.palette.backgrounds?.paper,
            color: theme.palette.textColors?.primary,
          }
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
                  sx={{
                    "& .MuiInputBase-input": {
                      color: theme.palette.textColors?.primary,
                    },
                    "& .MuiInputLabel-root": {
                      color: theme.palette.textColors?.secondary,
                    },
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": {
                        borderColor: theme.palette.divider,
                      },
                      "&:hover fieldset": {
                        borderColor: theme.palette.highlight?.main,
                      },
                      "&.Mui-focused fieldset": {
                        borderColor: theme.palette.highlight?.main,
                      },
                    },
                  }}
                />
                <TextField
                  margin="dense"
                  label="Новый пароль"
                  type="password"
                  fullWidth
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  sx={{
                    "& .MuiInputBase-input": {
                      color: theme.palette.textColors?.primary,
                    },
                    "& .MuiInputLabel-root": {
                      color: theme.palette.textColors?.secondary,
                    },
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": {
                        borderColor: theme.palette.divider,
                      },
                      "&:hover fieldset": {
                        borderColor: theme.palette.highlight?.main,
                      },
                      "&.Mui-focused fieldset": {
                        borderColor: theme.palette.highlight?.main,
                      },
                    },
                  }}
                />
                <TextField
                  margin="dense"
                  label="Подтвердите новый пароль"
                  type="password"
                  fullWidth
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  sx={{
                    "& .MuiInputBase-input": {
                      color: theme.palette.textColors?.primary,
                    },
                    "& .MuiInputLabel-root": {
                      color: theme.palette.textColors?.secondary,
                    },
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": {
                        borderColor: theme.palette.divider,
                      },
                      "&:hover fieldset": {
                        borderColor: theme.palette.highlight?.main,
                      },
                      "&.Mui-focused fieldset": {
                        borderColor: theme.palette.highlight?.main,
                      },
                    },
                  }}
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
                sx={{
                  "& .MuiInputBase-input": {
                    color: theme.palette.textColors?.primary,
                  },
                  "& .MuiInputLabel-root": {
                    color: theme.palette.textColors?.secondary,
                  },
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": {
                      borderColor: theme.palette.divider,
                    },
                    "&:hover fieldset": {
                      borderColor: theme.palette.highlight?.main,
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: theme.palette.highlight?.main,
                    },
                  },
                }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCancelPasswordChange}
            sx={{ color: theme.palette.textColors?.secondary }}
          >
            Отмена
          </Button>
          <Button
            onClick={handleChangePassword}
            disabled={loading}
            sx={{
              color: theme.palette.highlight?.main,
              "&:hover": {
                bgcolor: "transparent",
                color: theme.palette.highlight?.accent,
              },
            }}
          >
            {loading ? <CircularProgress size={24} /> : (passwordVerificationStep ? "Подтвердить" : "Изменить")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог изменения email */}
      <Dialog
        open={changeEmailDialogOpen}
        onClose={handleCancelEmailChange}
        PaperProps={{
          sx: {
            bgcolor: theme.palette.backgrounds?.paper,
            color: theme.palette.textColors?.primary,
          }
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
                  // Валидация email при изменении
                  const emailRegex = /\S+@\S+\.\S+/;
                  if (!emailRegex.test(e.target.value) && e.target.value !== '') {
                    setEmailError("Введите корректный email");
                  } else {
                    setEmailError("");
                  }
                }}
                error={!!emailError}
                helperText={emailError}
                sx={{
                  "& .MuiInputBase-input": {
                    color: theme.palette.textColors?.primary,
                  },
                  "& .MuiInputLabel-root": {
                    color: theme.palette.textColors?.secondary,
                  },
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": {
                      borderColor: theme.palette.divider,
                    },
                    "&:hover fieldset": {
                      borderColor: theme.palette.highlight?.main,
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: theme.palette.highlight?.main,
                    },
                  },
                }}
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
                sx={{
                  "& .MuiInputBase-input": {
                    color: theme.palette.textColors?.primary,
                  },
                  "& .MuiInputLabel-root": {
                    color: theme.palette.textColors?.secondary,
                  },
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": {
                      borderColor: theme.palette.divider,
                    },
                    "&:hover fieldset": {
                      borderColor: theme.palette.highlight?.main,
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: theme.palette.highlight?.main,
                    },
                  },
                }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCancelEmailChange}
            sx={{ color: theme.palette.textColors?.secondary }}
          >
            Отмена
          </Button>
          <Button
            onClick={handleChangeEmail}
            disabled={loading}
            sx={{
              color: theme.palette.highlight?.main,
              "&:hover": {
                bgcolor: "transparent",
                color: theme.palette.highlight?.accent,
              },
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