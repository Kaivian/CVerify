"use client";

import React, { useEffect } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { usePathname } from 'next/navigation';
import { Toast, toast } from '@heroui/react';
import { useThemeStore } from '@/stores/use-theme-store';
import { useSidebarStore } from '@/stores/use-sidebar-store';
import { AuthOrchestrator } from '@/features/auth/components/auth-orchestrator';

export function Providers({ children, locale }: { children: React.ReactNode; locale: string }) {
  const { initializeSession } = useAuth();
  const initializeTheme = useThemeStore(state => state.initializeTheme);
  const initializeCollapsed = useSidebarStore(state => state.initializeCollapsed);
  const pathname = usePathname();

  // Initialize theme and sidebar collapse state on client-side boot
  useEffect(() => {
    initializeTheme();
    initializeCollapsed();
  }, [initializeTheme, initializeCollapsed]);

  // Run secure session hydration immediately on app boots
  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  // Clear toasts on navigation to decouple page contexts
  useEffect(() => {
    if (toast && typeof toast.clear === 'function') {
      toast.clear();
    }
  }, [pathname]);

  return (
    <>
      <Toast.Provider />
      <AuthOrchestrator />
      {children}
    </>
  );
}
export default Providers;
