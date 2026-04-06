"use client";

import React from 'react';
import RoleGuard from '../../../features/auth/guards/role-guard';

export default function UserDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard allowedRoles={['USER', 'BUSINESS', 'ADMIN']}>
      {children}
    </RoleGuard>
  );
}
