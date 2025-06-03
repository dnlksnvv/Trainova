"use client";

import React from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { useServerInsertedHTML } from "next/navigation";
import theme from "./theme"; 
import { GlobalStyles } from "@mui/material";

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const [{ cache, flush }] = React.useState(() => {
    const cache = createCache({
      key: "mui",
      prepend: true,
    });
    cache.compat = true;
    const prevInsert = cache.insert;
    let inserted: string[] = [];
    cache.insert = (...args) => {
      const serialized = args[1];
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name);
      }
      return prevInsert(...args);
    };
    const flush = () => {
      const prevInserted = inserted;
      inserted = [];
      return prevInserted;
    };
    return { cache, flush };
  });

  useServerInsertedHTML(() => {
    const names = flush();
    if (names.length === 0) {
      return null;
    }
    let styles = '';
    for (const name of names) {
      styles += cache.inserted[name];
    }
    return (
      <style
        key={cache.key}
        data-emotion={`${cache.key} ${names.join(' ')}`}
        dangerouslySetInnerHTML={{
          __html: styles,
        }}
      />
    );
  });
  
  // CSS переменные, доступные глобально - экспортируем только необходимые стили из темы
  const globalStyles = {
    ':root': {
      // Экспортируем фоны
      '--mui-background-default': theme.palette.backgrounds?.default,
      '--mui-background-paper': theme.palette.backgrounds?.paper,
      
      // Экспортируем цвета текста
      '--mui-text-primary': theme.palette.textColors?.primary,
      '--mui-text-secondary': theme.palette.textColors?.secondary,
      
      // Экспортируем шрифт
      '--mui-font-family': theme.typography.fontFamily,
    },
    html: {
      backgroundColor: theme.palette.backgrounds?.default,
      height: '100%',
    },
    body: {
      backgroundColor: theme.palette.backgrounds?.default,
      color: theme.palette.textColors?.primary,
      fontFamily: theme.typography.fontFamily,
      margin: 0,
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
    },
    '#__next': {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100%',
      flex: 1,
    }
  };

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        {/* CssBaseline для сброса стилей браузера */}
        <CssBaseline />
        {/* Применяем глобальные стили */}
        <GlobalStyles styles={globalStyles} />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}