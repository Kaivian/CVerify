"use client";

import React from 'react';
import { useAuth } from '../hooks/use-auth';
import { SessionVerificationScreen } from '../components/session-verification-screen';

export const GuestGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, bootstrapState } = useAuth();

  const isLoading = bootstrapState !== 'READY';

  if (isLoading || isAuthenticated) {
    return <SessionVerificationScreen isAuthenticated={isAuthenticated} />;
  }

  return <>{children}</>;
};

export default GuestGuard;
