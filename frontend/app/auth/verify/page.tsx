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
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

// Создаем компонент для внутреннего содержимого, который использует useSearchParams
function VerifyContent() {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Получаем email из параметров URL
  const emailFromUrl = searchParams.get('email') || '';
  
  const [email, setEmail] = useState(emailFromUrl);
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    // Обновляем состояние email при изменении URL
    if (emailFromUrl) {
      setEmail(emailFromUrl);
    }
  }, [emailFromUrl]);

  const validateEmail = (email: string) => {
    const emailRegex = /\S+@\S+\.\S+/;
    return emailRegex.test(email);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError("Пожалуйста, введите email");
      setShowAlert(true);
      return;
    }

    if (!validateEmail(email)) {
      setError("Пожалуйста, введите корректный email");
      setShowAlert(true);
      return;
    }
    
    if (!verificationCode) {
      setError("Пожалуйста, введите код подтверждения");
      setShowAlert(true);
      return;
    }
    
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(`${process.env.API_URL}${process.env.AUTH_API_PREFIX}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: email, 
          code: verificationCode 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Ошибка при верификации");
      }

      setSuccessMessage("Аккаунт успешно подтвержден! Перенаправление на страницу входа...");
      setShowAlert(true);
      
      // Перенаправляем на страницу входа через 2 секунды
      setTimeout(() => {
        router.push("/auth/login");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Произошла ошибка при верификации");
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
              <VerifiedUserIcon sx={{ color: theme.palette.textColors?.primary }} />
            </Box>
            <Typography 
              component="h1" 
              variant="h5" 
              sx={{ color: theme.palette.textColors?.primary }}
            >
              Подтверждение аккаунта
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleVerify} sx={{ mt: 1 }}>
            <Typography
              variant="body2"
              sx={{
                mb: 3,
                color: theme.palette.textColors?.primary,
              }}
            >
              Пожалуйста, введите код подтверждения, который мы отправили на ваш email.
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
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (e.target.value && !validateEmail(e.target.value)) {
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
                "& .MuiFormHelperText-root": {
                  color: theme.palette.error.main,
                },
              }}
            />
            
            <TextField
              margin="normal"
              required
              fullWidth
              id="verificationCode"
              label="Код подтверждения"
              name="verificationCode"
              autoFocus
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
              {loading ? <CircularProgress size={24} color="inherit" /> : "Подтвердить"}
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
export default function VerifyPage() {
  return (
    <Suspense fallback={
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    }>
      <VerifyContent />
    </Suspense>
  );
} 