import { createTheme } from "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    textColors?: {
      primary: string;
      secondary: string;
      workouts: string;
    };
    highlight?: {
      main: string;  // основной «выделяющийся» цвет
      accent: string; 
    };
    backgrounds?: {
      default2: string; 
      default: string; 
      paper: string;
      
    };
    iconColors?: {
      main: string;
      secondary: string;
    };
    muscleColors?: {
      pink: string;
      green: string;
      blue: string;
      
    };
    ratingColor?: {
      main: string;
    };
  }
  interface PaletteOptions {
    textColors?: {
      primary: string;
      secondary: string;
      workouts: string;
    };
    highlight?: {
      main: string;
      accent: string;
    };
    backgrounds?: {
      default2: string; 
      default: string; 
      paper: string;
    };
    iconColors?: {
      main: string;
      secondary: string;
    };
    muscleColors?: {
      pink: string;
      green: string;
      blue: string;
    };
    ratingColor?: {
      main: string;
    };
  }
  
  interface Theme {
    borderRadius: {
      small: number;
      medium: number;
      large: number;
      xlarge: number;
    };
    customShadows: {
      light: string;
      medium: string;
      strong: string;
      hover: string;
      colored: (color: string, opacity?: string) => string;
    };
  }
  
  interface ThemeOptions {
    borderRadius?: {
      small: number;
      medium: number;
      large: number;
      xlarge: number;
    };
    customShadows?: {
      light: string;
      medium: string;
      strong: string;
      hover: string;
      colored: (color: string, opacity?: string) => string;
    };
  }
}

const theme = createTheme({
  palette: {
    mode: "dark", 
    // ТЕКСТ
    textColors: {
      primary: "#fff",
      secondary: "#ccc",
      workouts: "#64b5f6", 
    },
    // ВЫДЕЛЕНИЯ (например, оранжевые)
    highlight: {
      main: "#FF8C00",  // основной оранжевый
      accent: "#FFA733", // светлее оранжевый
    },
    // ФОН
    backgrounds: {
      default2: "#FF8C00",
      default: "#2b2b2b",
      paper: "#3a3a3a",
    },
    // ЦВЕТА ИКОНОК 
    iconColors: {
      main: "#888",
      secondary: "#999",
    },
    // ЦВЕТА для «мышц» 
    muscleColors: {
      pink: "#FF8080",
      green: "#81c784",
      blue: "#64b5f6",
    },
    // ЦВЕТ для рейтингов (звездочки)
    ratingColor: {
      main: "#FF8C00", // Оранжевый цвет для звезд (как в highlight.main)
    },
  },
  typography: {
    fontFamily: "Lato, sans-serif",
  },
  shape: {
    borderRadius: 4,
  },
  borderRadius: {
    small: 4,
    medium: 12,
    large: 24,
    xlarge: 48
  },
  customShadows: {
    light: '0 2px 4px rgba(0,0,0,0.1)',
    medium: '0 3px 6px rgba(0,0,0,0.15)',
    strong: '0 6px 12px rgba(0,0,0,0.2)',
    hover: '0 8px 15px rgba(0,0,0,0.25)',
    colored: (color: string, opacity = '30') => `0 0 8px 1px ${color}${opacity}`
  }
});

export default theme;