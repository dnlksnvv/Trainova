"use client";

import React, { useState, useEffect, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { setCookie, getCookie, deleteCookie } from '@/app/utils/cookie';

// Константы для имен куков
const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

interface User {
  id: string;
  email: string;
  role_id: number;
  first_name?: string | null;
  last_name?: string | null;
  is_verified: boolean;
  avatar_url?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegistrationData) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (data: ResetPasswordData) => Promise<void>;
  verifyAccount: (email: string, code: string) => Promise<void>;
}

interface RegistrationData {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

interface ResetPasswordData {
  email: string;
  code: string;
  new_password: string;
  confirm_password: string;
}

// API URL из переменных окружения или по умолчанию
const API_URL = process.env.API_URL;
const AUTH_API_PREFIX = process.env.AUTH_API_PREFIX;

// Создаем контекст
const AuthContext = createContext<AuthContextType | null>(null);

// Провайдер контекста
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  // Проверяем авторизацию при загрузке страницы
  useEffect(() => {
    const checkAuth = async () => {
      const accessToken = getCookie(ACCESS_TOKEN_COOKIE);
      if (!accessToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}${AUTH_API_PREFIX}/me`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          // Если токен недействителен, пробуем обновить его
          await refreshToken();
        }
      } catch (error) {
        console.error('Ошибка при проверке авторизации:', error);
        // Очищаем токены при ошибке
        deleteCookie(ACCESS_TOKEN_COOKIE);
        deleteCookie(REFRESH_TOKEN_COOKIE);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Обновление токена
  const refreshToken = async () => {
    const refreshToken = getCookie(REFRESH_TOKEN_COOKIE);
    if (!refreshToken) {
      setUser(null);
      return;
    }

    try {
      const response = await fetch(`${API_URL}${AUTH_API_PREFIX}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Сохраняем токены в куки
        setCookie(ACCESS_TOKEN_COOKIE, data.access_token, { 
          expires: 1, 
          secure: true,
          sameSite: 'strict'
        });
        
        setCookie(REFRESH_TOKEN_COOKIE, data.refresh_token, { 
          expires: 7, 
          secure: true,
          sameSite: 'strict'
        });

        // Получаем информацию о пользователе
        const userResponse = await fetch(`${API_URL}${AUTH_API_PREFIX}/me`, {
          headers: {
            'Authorization': `Bearer ${data.access_token}`
          }
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUser(userData);
        }
      } else {
        // Если обновление не удалось, выходим
        setUser(null);
        deleteCookie(ACCESS_TOKEN_COOKIE);
        deleteCookie(REFRESH_TOKEN_COOKIE);
      }
    } catch (error) {
      console.error('Ошибка при обновлении токена:', error);
      setUser(null);
      deleteCookie(ACCESS_TOKEN_COOKIE);
      deleteCookie(REFRESH_TOKEN_COOKIE);
    }
  };

  // Авторизация
  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}${AUTH_API_PREFIX}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Ошибка при входе');
      }

      const data = await response.json();
      
      // Сохраняем токены в куки
      setCookie(ACCESS_TOKEN_COOKIE, data.access_token, { 
        expires: 1, 
        secure: true,
        sameSite: 'strict'
      });
      
      setCookie(REFRESH_TOKEN_COOKIE, data.refresh_token, { 
        expires: 7, 
        secure: true,
        sameSite: 'strict'
      });

      // Получаем информацию о пользователе
      const userResponse = await fetch(`${API_URL}${AUTH_API_PREFIX}/me`, {
        headers: {
          'Authorization': `Bearer ${data.access_token}`
        }
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser(userData);
      }

      router.push('/');
    } catch (error: any) {
      throw new Error(error.message || 'Произошла ошибка при входе');
    } finally {
      setLoading(false);
    }
  };

  // Выход
  const logout = async () => {
    setLoading(true);
    try {
      const accessToken = getCookie(ACCESS_TOKEN_COOKIE);
      const refreshToken = getCookie(REFRESH_TOKEN_COOKIE);
      
      if (accessToken && refreshToken) {
        await fetch(`${API_URL}${AUTH_API_PREFIX}/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ refresh_token: refreshToken })
        });
      }
    } catch (error) {
      console.error('Ошибка при выходе:', error);
    } finally {
      deleteCookie(ACCESS_TOKEN_COOKIE);
      deleteCookie(REFRESH_TOKEN_COOKIE);
      setUser(null);
      setLoading(false);
      router.push('/auth/login');
    }
  };

  // Регистрация
  const register = async (data: RegistrationData) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}${AUTH_API_PREFIX}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Ошибка при регистрации');
      }

      router.push(`/auth/verify?email=${encodeURIComponent(data.email)}`);
    } catch (error: any) {
      throw new Error(error.message || 'Произошла ошибка при регистрации');
    } finally {
      setLoading(false);
    }
  };

  // Запрос на восстановление пароля
  const forgotPassword = async (email: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}${AUTH_API_PREFIX}/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Ошибка при запросе сброса пароля');
      }

      return await response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Произошла ошибка при запросе сброса пароля');
    } finally {
      setLoading(false);
    }
  };

  // Сброс пароля
  const resetPassword = async (data: ResetPasswordData) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}${AUTH_API_PREFIX}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Ошибка при сбросе пароля');
      }

      router.push('/auth/login');
    } catch (error: any) {
      throw new Error(error.message || 'Произошла ошибка при сбросе пароля');
    } finally {
      setLoading(false);
    }
  };

  // Верификация аккаунта
  const verifyAccount = async (email: string, code: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}${AUTH_API_PREFIX}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email, code })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Ошибка при верификации');
      }

      router.push('/auth/login');
    } catch (error: any) {
      throw new Error(error.message || 'Произошла ошибка при верификации');
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    register,
    forgotPassword,
    resetPassword,
    verifyAccount
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Хук для использования контекста
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }
  return context;
} 