"use client";

import React from 'react';
import RoleGuard from '../../../features/auth/guards/role-guard';

export default function BusinessDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard allowedRoles={['BUSINESS', 'ADMIN']}>
      {children}
    </RoleGuard>
  );
}
