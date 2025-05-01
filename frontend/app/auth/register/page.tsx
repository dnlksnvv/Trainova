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
  Stepper,
  Step,
  StepLabel,
  useTheme
} from "@mui/material";
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import Link from "next/link";
import { useRouter } from "next/navigation";

// Шаги регистрации
const steps = ['Данные для входа', 'Подтверждение'];

export default function RegisterPage() {
  const theme = useTheme();
  const router = useRouter();
  
  // Состояние шагов регистрации
  const [activeStep, setActiveStep] = useState(0);
  
  // Состояние данных формы
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  
  // Состояние UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Валидация формы
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  const validateForm = () => {
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
    
    // Проверка пароля
    if (password.trim() === "") {
      setPasswordError("Пароль обязателен");
      isValid = false;
    } else if (password.length < 8) {
      setPasswordError("Пароль должен содержать минимум 8 символов");
      isValid = false;
    } else {
      setPasswordError("");
    }
    
    // Проверка подтверждения пароля
    if (confirmPassword !== password) {
      setConfirmPasswordError("Пароли не совпадают");
      isValid = false;
    } else {
      setConfirmPasswordError("");
    }
    
    return isValid;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${process.env.API_URL}${process.env.AUTH_API_PREFIX}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: email, 
          password, 
          first_name: firstName || undefined, 
          last_name: lastName || undefined 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Ошибка при регистрации");
      }

      setSuccessMessage("Код подтверждения отправлен на указанный email");
      setShowAlert(true);
      setActiveStep(1);
    } catch (err: any) {
      setError(err.message || "Произошла ошибка при регистрации");
      setShowAlert(true);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!verificationCode) {
      setError("Введите код подтверждения");
      setShowAlert(true);
      return;
    }
    
    setLoading(true);
    setError("");

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
        throw new Error(data.detail || "Ошибка подтверждения");
      }

      setSuccessMessage("Аккаунт успешно подтвержден! Теперь вы можете войти в систему.");
      setShowAlert(true);
      
      // Перенаправляем на страницу входа
      setTimeout(() => {
        router.push("/auth/login");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Произошла ошибка при подтверждении");
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
              <PersonAddIcon sx={{ color: theme.palette.textColors?.primary }} />
            </Box>
            <Typography 
              component="h1" 
              variant="h5" 
              sx={{ color: theme.palette.textColors?.primary }}
            >
              Регистрация
            </Typography>
          </Box>

          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel 
                  sx={{
                    "& .MuiStepLabel-label": {
                      color: theme.palette.textColors?.secondary,
                    },
                    "& .MuiStepLabel-label.Mui-active": {
                      color: theme.palette.textColors?.primary,
                    },
                    "& .MuiStepLabel-label.Mui-completed": {
                      color: theme.palette.textColors?.primary,
                    },
                    "& .MuiStepIcon-root": {
                      color: theme.palette.highlight?.main,
                    },
                  }}
                >{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {activeStep === 0 ? (
            <Box component="form" onSubmit={handleRegister}>
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
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Пароль"
                type="password"
                id="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={!!passwordError}
                helperText={passwordError}
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
                name="confirmPassword"
                label="Подтвердите пароль"
                type="password"
                id="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={!!confirmPasswordError}
                helperText={confirmPasswordError}
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
                fullWidth
                name="firstName"
                label="Имя (необязательно)"
                id="firstName"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
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
                fullWidth
                name="lastName"
                label="Фамилия (необязательно)"
                id="lastName"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
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
                {loading ? <CircularProgress size={24} color="inherit" /> : "Зарегистрироваться"}
              </Button>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  mt: 2,
                  color: theme.palette.textColors?.secondary,
                }}
              >
                <Typography variant="body2" sx={{ mr: 1 }}>
                  Уже есть аккаунт?
                </Typography>
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
                    Войти
                  </MuiLink>
                </Link>
              </Box>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleVerify}>
              <Typography 
                variant="body1" 
                align="center" 
                sx={{ 
                  mb: 3,
                  color: theme.palette.textColors?.primary,
                }}
              >
                Мы отправили код подтверждения на указанный email. Пожалуйста, введите его ниже:
              </Typography>
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
                <Button
                  onClick={() => setActiveStep(0)}
                  sx={{
                    color: theme.palette.highlight?.main,
                    "&:hover": {
                      bgcolor: "transparent",
                      color: theme.palette.highlight?.accent,
                    },
                  }}
                >
                  Назад
                </Button>
              </Box>
            </Box>
          )}
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