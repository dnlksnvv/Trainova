"use client";

import React from "react";
import { AuthProvider } from "@/app/auth/hooks/useAuth";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
} 