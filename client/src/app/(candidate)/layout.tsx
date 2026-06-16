"use client";

import React from "react";
import { AuthGuard } from "../../features/auth/guards/auth-guard";
import { CandidateShell } from "../../components/layouts/candidate-shell";

export default function CandidateDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <CandidateShell>{children}</CandidateShell>
    </AuthGuard>
  );
}

