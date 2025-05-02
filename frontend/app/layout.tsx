import "./globals.css";
import { Metadata } from "next";
import ThemeRegistry from "./ThemeRegistry";
import { Providers } from "./providers";


// 1. Импортируем Lato из next/font/google
import { Lato } from "next/font/google";

// 2. Указываем нужные начертания (weights)
const lato = Lato({
  weight: ["300", "400", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trainova App",
  description: "Приложение для тренировок",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Trainova",
  },
  themeColor: "#000000",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // 3. Добавляем lato.className к <html>, чтобы применить Lato ко всему
    <html lang="ru" className={lato.className}>
      <head>
        {/* Эта мета нужна для Emotion SSR, если ты уже настраивал ThemeRegistry */}
        <meta name="emotion-insertion-point" content="" />
        <meta name="application-name" content="Trainova" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Trainova" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="384x384" href="/icons/icon-384x384.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512x512.png" />
      </head>
      <body>
        {/* Подключаем MUI-тему, Emotion Cache и провайдеры */}
        <ThemeRegistry>
          <Providers>
              {children}
          </Providers>
        </ThemeRegistry>
      </body>
    </html>
  );
}