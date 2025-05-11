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
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/auth/hooks/useAuth";

export default function LoginPage() {
  const theme = useTheme();
  const router = useRouter();
  const { login } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [showAlert, setShowAlert] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /\S+@\S+\.\S+/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Валидация email
    if (!email) {
      setEmailError("Email обязателен");
      return;
    }
    
    if (!validateEmail(email)) {
      setEmailError("Введите корректный email");
      return;
    } else {
      setEmailError("");
    }
    
    setLoading(true);
    setError("");

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Произошла ошибка при входе");
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
              <LockOutlinedIcon sx={{ color: theme.palette.textColors?.primary }} />
            </Box>
            <Typography 
              component="h1" 
              variant="h5" 
              sx={{ color: theme.palette.textColors?.primary }}
            >
              Вход в систему
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email"
              name="email"
              autoComplete="email"
              type="email"
              autoFocus
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
              name="password"
              label="Пароль"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              {loading ? <CircularProgress size={24} color="inherit" /> : "Войти"}
            </Button>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                mt: 2,
                color: theme.palette.textColors?.secondary,
              }}
            >
              <Link href="/auth/register" passHref legacyBehavior>
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
                  Регистрация
                </MuiLink>
              </Link>
              <Link href="/auth/forgot-password" passHref legacyBehavior>
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
                  Забыли пароль?
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
          severity="error" 
          sx={{ width: "100%" }}
        >
          {error}
        </Alert>
      </Snackbar>
    </Container>
  );
} 