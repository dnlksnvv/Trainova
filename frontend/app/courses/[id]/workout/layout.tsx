"use client";

import React from "react";
import { Box, Container } from "@mui/material";
import { useTheme } from "@mui/material/styles";

export default function WorkoutPlayerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: theme.palette.backgrounds?.default,
      }}
    >
      {children}
    </Box>
  );
} 