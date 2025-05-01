"use client";

import React from "react";
import { Box, useTheme } from "@mui/material";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        bgcolor: theme.palette.backgrounds?.default,
        backgroundImage: `linear-gradient(135deg, ${theme.palette.backgrounds?.default} 70%, ${theme.palette.highlight?.main}40 100%)`,
      }}
    >
      {children}
    </Box>
  );
} 