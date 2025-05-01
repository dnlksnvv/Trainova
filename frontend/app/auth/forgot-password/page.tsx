"use client";

import React, { useState } from "react";
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
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const theme = useTheme();
  const router = useRouter();
  
  // Состояние данных формы
  const [email, setEmail] = useState("");
  
  // Состояние UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  // Валидация формы
  const [emailError, setEmailError] = useState("");

  const validateRequestForm = () => {
    let isValid = true;
    
    // Проверка email
    if (email.trim() === "") {
      setEmailError("Email обязателен");
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError("Введите корректный email");
      isValid = false;
    } else {
      setEmailError("");
    }
    
    return isValid;
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateRequestForm()) {
      return;
    }
    
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(`${process.env.API_URL}${process.env.AUTH_API_PREFIX}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Ошибка при запросе сброса пароля");
      }

      setSuccessMessage("Ссылка для восстановления пароля отправлена на указанный email");
      setShowAlert(true);
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || "Произошла ошибка при запросе сброса пароля");
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
              Восстановление пароля
            </Typography>
          </Box>

          {!isSuccess ? (
            <Box component="form" onSubmit={handleRequestReset}>
              <Typography 
                variant="body2" 
                sx={{ 
                  mb: 2,
                  color: theme.palette.textColors?.primary,
                }}
              >
                Укажите email, который вы использовали при регистрации, и мы отправим вам ссылку для восстановления пароля.
              </Typography>
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                  "& .MuiFormHelperText-root": {
                    color: theme.palette.error.main,
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
                {loading ? <CircularProgress size={24} color="inherit" /> : "Отправить"}
              </Button>
            </Box>
          ) : (
            <Box sx={{ textAlign: "center" }}>
              <Typography 
                variant="body1" 
                sx={{ 
                  mb: 2,
                  color: theme.palette.textColors?.primary,
                }}
              >
                Ссылка для восстановления пароля отправлена на указанный email.
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  mb: 3,
                  color: theme.palette.textColors?.secondary,
                }}
              >
                Проверьте вашу электронную почту и перейдите по ссылке для установки нового пароля.
              </Typography>
            </Box>
          )}
          
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