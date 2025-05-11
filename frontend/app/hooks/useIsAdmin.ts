"use client";

import { useAuth } from '@/app/auth/hooks/useAuth';

/**
 * Хук для проверки, является ли текущий пользователь администратором
 * @returns {boolean} true если пользователь администратор (role_id === 1), иначе false
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  
  // Проверяем наличие пользователя и его роль
  return user?.role_id === 1;
} 