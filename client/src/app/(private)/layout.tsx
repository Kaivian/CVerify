"use client";

import React from "react";
import { AuthGuard } from "../../features/auth/guards/auth-guard";
import { PlatformShell } from "../../components/layouts/platform-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <PlatformShell>{children}</PlatformShell>
    </AuthGuard>
  );
}

