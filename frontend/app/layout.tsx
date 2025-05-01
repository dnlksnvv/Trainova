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
  description: "Example Next.js 13 + MUI + Lato font",
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