"use client";

import React from 'react';
import { useAuth } from '../hooks/use-auth';
import { UserRole } from '../../../types/auth.types';
import { Card } from '../../../components/ui/card';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useRouter } from 'next/navigation';
import { Spinner, Typography } from '@heroui/react';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  allowedRoles,
  children,
  fallback,
}) => {
  const { user, isAuthenticated, hasRole, bootstrapState } = useAuth();
  const router = useRouter();

  // If session hydration is still active, wait and prevent flashing
  if (bootstrapState !== 'READY') {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[400px]">
        <Spinner color="accent" size="md" />
      </div>
    );
  }

  // Double check if user has access
  const hasAccess = isAuthenticated && user && allowedRoles.some((role) => hasRole(role));

  if (!hasAccess) {
    // If a custom fallback is provided (e.g., hiding a button), render it
    if (fallback !== undefined) {
      return <>{fallback}</>;
    }

    // Default premium Full-page Unauthorized Card layout
    return (
      <div className="flex flex-1 items-center justify-center p-6 w-full max-w-lg mx-auto my-12">
        <Card className="text-center" glow={true}>
          <div className="mx-auto w-12 h-12 bg-danger/10 text-danger border border-danger/20 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert size={24} />
          </div>
          <Typography type="h3" className="font-bold text-foreground tracking-tight mb-2">
            Restricted Content
          </Typography>
          <Typography type="body-sm" className="text-muted leading-relaxed mb-6">
            Your current account role does not have permission to view this resource. 
            Please sign in with a different account if you believe this is an error.
          </Typography>
          <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
            <Button
              variant="bordered"
              onClick={() => router.back()}
              className="w-full sm:w-auto"
            >
              Go Back
            </Button>
            <Button
              variant="solid"
              onClick={() => router.push('/login')}
              className="w-full sm:w-auto"
            >
              Change Account
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
export default RoleGuard;
