"use client";

import React from 'react';
import { useAuth } from '../hooks/use-auth';
import { type ResourceActionPermission } from '../../../types/auth.types';

interface PermissionGuardProps {
  permission: ResourceActionPermission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  children,
  fallback = null,
}) => {
  const { hasPermission, isInitialized } = useAuth();

  // Return nothing/skeleton while session hydrates to avoid visual layout jumps
  if (!isInitialized) {
    return null;
  }

  const hasAccess = hasPermission(permission);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
export default PermissionGuard;
