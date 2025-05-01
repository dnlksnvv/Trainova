"use client";

import React, { useState, useEffect, Suspense } from "react";
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Paper, 
  Container,
  Link as MuiLink,
  Snackbar,
  Alert,
  CircularProgress,
  useTheme
} from "@mui/material";
import LockResetIcon from '@mui/icons-material/LockReset';
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

// Компонент с содержимым, который использует useSearchParams
function ResetPasswordContent() {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Получаем параметры из URL
  const code = searchParams.get('code') || '';
  const email = searchParams.get('email') || '';
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showAlert, setShowAlert] = useState(false);

  // Проверяем, что все необходимые параметры есть
  useEffect(() => {
    if (!code || !email) {
      setError("Неверная ссылка для сброса пароля. Пожалуйста, проверьте ссылку или запросите новую.");
      setShowAlert(true);
    }
  }, [code, email]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code || !email) {
      setError("Неверная ссылка для сброса пароля");
      setShowAlert(true);
      return;
    }
    
    if (!newPassword || !confirmPassword) {
      setError("Пожалуйста, заполните все поля");
      setShowAlert(true);
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError("Пароли не совпадают");
      setShowAlert(true);
      return;
    }
    
    if (newPassword.length < 8) {
      setError("Пароль должен содержать не менее 8 символов");
      setShowAlert(true);
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const response = await fetch(`${process.env.API_URL}${process.env.AUTH_API_PREFIX}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          code: code,
          new_password: newPassword,
          confirm_password: confirmPassword
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Ошибка при сбросе пароля");
      }

      setSuccessMessage("Пароль успешно изменен! Перенаправляем на страницу входа...");
      setShowAlert(true);
      
      // Перенаправляем на страницу входа через 2 секунды
      setTimeout(() => {
        router.push("/auth/login");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Произошла ошибка при сбросе пароля");
      setShowAlert(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs">
      <Box
        sx={{
          mt: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: "100%",
            borderRadius: 2,
            bgcolor: theme.palette.backgrounds?.paper,
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              mb: 3,
            }}
          >
            <Box
              sx={{
                bgcolor: theme.palette.highlight?.main,
                p: 2,
                borderRadius: "50%",
                mb: 2,
              }}
            >
              <LockResetIcon sx={{ color: theme.palette.textColors?.primary }} />
            </Box>
            <Typography 
              component="h1" 
              variant="h5" 
              sx={{ color: theme.palette.textColors?.primary }}
            >
              Сброс пароля
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleResetPassword} sx={{ mt: 1 }}>
            <Typography
              variant="body2"
              sx={{
                mb: 3,
                color: theme.palette.textColors?.primary,
              }}
            >
              Пожалуйста, придумайте новый пароль для входа в систему.
            </Typography>
            
            <TextField
              margin="normal"
              required
              fullWidth
              name="newPassword"
              label="Новый пароль"
              type="password"
              id="newPassword"
              autoComplete="new-password"
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
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Подтвердите пароль"
              type="password"
              id="confirmPassword"
              autoComplete="new-password"
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
            
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{
                mt: 3,
                mb: 2,
                bgcolor: theme.palette.highlight?.main,
                color: theme.palette.textColors?.primary,
                "&:hover": {
                  bgcolor: theme.palette.highlight?.accent,
                },
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Установить новый пароль"}
            </Button>
            
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                mt: 2,
                color: theme.palette.textColors?.secondary,
              }}
            >
              <Link href="/auth/login" passHref>
                <MuiLink 
                  variant="body2" 
                  sx={{ 
                    cursor: 'pointer',
                    color: theme.palette.highlight?.main,
                    "&:hover": {
                      color: theme.palette.highlight?.accent,
                    },
                  }}
                >
                  Вернуться к входу
                </MuiLink>
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
      
      <Snackbar 
        open={showAlert} 
        autoHideDuration={6000} 
        onClose={() => setShowAlert(false)}
      >
        <Alert 
          onClose={() => setShowAlert(false)} 
          severity={error ? "error" : "success"} 
          sx={{ width: "100%" }}
        >
          {error || successMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
}

// Основной компонент страницы с Suspense
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
} 