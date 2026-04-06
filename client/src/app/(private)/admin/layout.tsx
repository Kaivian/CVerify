"use client";

import React from 'react';
import RoleGuard from '../../../features/auth/guards/role-guard';

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      {children}
    </RoleGuard>
  );
}
