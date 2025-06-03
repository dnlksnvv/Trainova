"use client";

import React, { useState, Suspense } from "react";
import { useTheme } from "@mui/material/styles";
import { Stack, CircularProgress, Typography } from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import MainLayout from "@/app/components/layouts/MainLayout";
import { CourseSettingsPage } from "../[id]/components/CourseSettingsPage";
import { coursesApi, CourseCreate } from "@/app/services/api";
import { getCookie } from "@/app/utils/cookie";

// Компонент с содержимым страницы создания курса
function CourseCreateContent() {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const coachId = searchParams.get('coachId');

  // Состояние для данных формы
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration: 0,
    hours: 0,
    minutes: 0,
    is_published: false,
    is_paid: false,
    price: 0
  });

  const [loading, setLoading] = useState(false);

  // Обработчик изменения полей формы
  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => {
      // Для часов и минут пересчитываем общую длительность
      if (field === 'hours' || field === 'minutes') {
        const hours = field === 'hours' ? value : prev.hours;
        const minutes = field === 'minutes' ? value : prev.minutes;
        return {
          ...prev,
          [field]: value,
          duration: hours * 3600 + minutes * 60  // Пересчет в секунды
        };
      }
      return { ...prev, [field]: value };
    });
  };

  // Функция для возврата на предыдущую страницу
  const handleCancel = () => {
    if (coachId) {
      router.push(`/courses/coach-profile/${coachId}`);
    } else {
      router.push('/courses');
    }
  };

  // Функция для сохранения курса
  const handleSave = async () => {
    setLoading(true);
    
    try {
      // Получаем токен из куки
      const token = getCookie('access_token');
      if (!token) {
        alert('Необходима авторизация для создания курса');
        setLoading(false);
        return;
      }
      
      // Создаем объект данных для API
      const courseData: CourseCreate = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        price: formData.is_paid ? formData.price : undefined,
        duration: formData.duration || undefined,
        exercise_count: 0,
        is_published: formData.is_published
      };

      // Создаем курс через API
      const createdCourse = await coursesApi.create(courseData);
      
      // Перенаправляем на страницу созданного курса
      router.push(`/courses/${createdCourse.course_uuid}`);
      
    } catch (error) {
      console.error('Ошибка при создании курса:', error);
      alert('Произошла ошибка при создании курса. Попробуйте еще раз.');
    } finally {
      setLoading(false);
    }
  };

  // Заглушка для удаления (не используется при создании)
  const handleDelete = async () => {
    return Promise.resolve();
  };

  // Функция для форматирования времени из секунд в читаемый формат
  const formatDuration = (seconds: number | undefined | null): string => {
    if (!seconds || seconds <= 0) {
      return "Не указано";
    }
    
    if (seconds < 60) {
      return `${seconds} сек`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      if (remainingSeconds === 0) {
        return `${minutes} мин`;
      }
      return `${minutes} мин ${remainingSeconds} сек`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (minutes === 0) {
        return `${hours} ч`;
      }
      return `${hours} ч ${minutes} мин`;
    }
  };

  return (
    <CourseSettingsPage
      formData={formData}
      onFormChange={handleFormChange}
      onSave={handleSave}
      onCancel={handleCancel}
      onDelete={handleDelete}
      loading={loading}
      theme={theme}
      formatDuration={formatDuration}
      isCreateMode={true} // Указываем, что это режим создания
    />
  );
}

// Основной компонент страницы с оберткой Suspense
export default function CreateCoursePage() {
  const theme = useTheme();
  
  return (
    <Suspense fallback={
      <MainLayout>
        <Stack sx={{ pt: 10, px: 2, alignItems: 'center' }}>
          <CircularProgress size={40} />
          <Typography sx={{ mt: 2 }}>Загрузка...</Typography>
        </Stack>
      </MainLayout>
    }>
      <CourseCreateContent />
    </Suspense>
  );
} 