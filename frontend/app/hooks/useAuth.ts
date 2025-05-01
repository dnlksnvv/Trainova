import { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

interface UserTokenData {
  user_id: number;
  email: string;
  role: string;
  exp: number;
  role_id?: number;
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [user, setUser] = useState<UserTokenData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAuth = () => {
      try {
        const token = document.cookie
          .split('; ')
          .find(row => row.startsWith('access_token='))
          ?.split('=')[1];

        if (!token) {
          setIsAuthenticated(false);
          setIsAdmin(false);
          setUser(null);
          setLoading(false);
          return;
        }

        // Декодируем JWT-токен
        const decoded = jwtDecode<UserTokenData>(token);
        
        // Проверяем срок действия токена
        const currentTime = Date.now() / 1000;
        if (decoded.exp < currentTime) {
          setIsAuthenticated(false);
          setIsAdmin(false);
          setUser(null);
          setLoading(false);
          return;
        }

        setUser(decoded);
        setIsAuthenticated(true);
        
        // Проверяем, является ли пользователь администратором (role_id = 1)
        // Можно проверять либо по role_id, либо по строковому значению role
        setIsAdmin(decoded.role === 'admin' || decoded.role_id === 1);
        
      } catch (error) {
        console.error('Error checking authentication:', error);
        setIsAuthenticated(false);
        setIsAdmin(false);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  return { isAuthenticated, isAdmin, user, loading };
} 