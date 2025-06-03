import { useState, useEffect } from 'react';
import { profileApi } from '@/app/services/api';

interface UseAvatarReturn {
  avatarUrl: string | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Хук для загрузки аватара пользователя
 * @param url - URL аватара или идентификатор аватара
 * @returns Объект с URL аватара, состоянием загрузки и ошибкой
 */
export function useAvatar(url?: string | null): UseAvatarReturn {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!url);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Если URL не предоставлен, нечего загружать
    if (!url) {
      setAvatarUrl(null);
      setLoading(false);
      return;
    }

    // Если URL уже является полным URL (например, начинается с http)
    if (url.startsWith('http')) {
      setAvatarUrl(url);
      setLoading(false);
      return;
    }

    // Если URL нужно загрузить через API
    setLoading(true);

    const fetchAvatar = async () => {
      try {
        const resolvedUrl = await profileApi.getAvatar(url);
        setAvatarUrl(resolvedUrl || null);
        setError(null);
      } catch (err) {
        console.error('Ошибка при загрузке аватара:', err);
        setError(err instanceof Error ? err : new Error('Неизвестная ошибка при загрузке аватара'));
        // В случае ошибки устанавливаем URL в null
        setAvatarUrl(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAvatar();
  }, [url]);

  return { avatarUrl, loading, error };
} 