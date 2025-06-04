import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Список защищенных маршрутов, требующих авторизации
const protectedRoutes = ['/courses', '/trainings', '/profile'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('access_token');
  
  // Проверка для главной страницы
  if (pathname === '/' && !token) {
    return NextResponse.redirect(new URL('/home', request.url));
  }
  
  // Для защищенных маршрутов не делаем перенаправление
  return NextResponse.next();
}

// Конфигурация для указания, на каких маршрутах должен срабатывать middleware
export const config = {
  matcher: ['/', '/courses/:path*', '/trainings/:path*', '/profile/:path*'],
}; 