"use client";

import React from "react";
import { Box } from "@mui/material";

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        bgcolor: "backgrounds.default",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {children}
    </Box>
  );
} 