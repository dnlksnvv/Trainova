/**
 * Утилиты для работы с cookies в браузере
 */

// Установка cookie с параметрами
export const setCookie = (name: string, value: string, options: { expires?: number; path?: string; secure?: boolean; sameSite?: 'strict' | 'lax' | 'none' } = {}) => {
  const { expires = 7, path = '/', secure = true, sameSite = 'strict' } = options;
  
  // Установка даты истечения срока действия cookie
  const date = new Date();
  date.setTime(date.getTime() + expires * 24 * 60 * 60 * 1000);
  
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${date.toUTCString()}; path=${path}${secure ? '; Secure' : ''}; SameSite=${sameSite}`;
};

// Получение значения cookie по имени
export const getCookie = (name: string): string | null => {
  const matches = document.cookie.match(new RegExp(
    `(?:^|; )${name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1')}=([^;]*)`
  ));
  
  return matches ? decodeURIComponent(matches[1]) : null;
};

// Удаление cookie
export const deleteCookie = (name: string) => {
  setCookie(name, '', { expires: -1 });
}; 