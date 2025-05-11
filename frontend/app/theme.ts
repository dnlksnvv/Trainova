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
  },
  typography: {
    fontFamily: "Lato, sans-serif",
  },
  shape: {
    borderRadius: 4,
  },
});

export default theme;