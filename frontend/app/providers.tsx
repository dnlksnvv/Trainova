"use client";

import React from "react";
import { AuthProvider } from "@/app/auth/hooks/useAuth";
import dynamic from "next/dynamic";

const InstallPWA = dynamic(() => import('./components/InstallPWA'), { ssr: false });

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <InstallPWA />
    </AuthProvider>
  );
} 