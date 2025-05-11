"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import TrainingSettingsClient from './client';

// Типы для параметров
type PageParams = {
  id: string;
};

// Серверный компонент для обертки клиентского компонента
export default function TrainingSettingsPage({ params }: { params: PageParams }) {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  
  // Перенаправляем не-админов на главную страницу
  useEffect(() => {
    if (!isAdmin) {
      router.push('/');
    }
  }, [isAdmin, router]);

  // Не рендерим форму, если пользователь не админ
  if (!isAdmin) {
    return null;
  }
  
  return <TrainingSettingsClient id={params.id} />;
} 