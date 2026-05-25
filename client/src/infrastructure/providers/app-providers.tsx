"use client";

import React, { useEffect } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { usePathname } from 'next/navigation';
import { Toast, toast } from '@heroui/react';
import i18n from '@/lib/i18n';
import { useThemeStore } from '@/stores/use-theme-store';
import { useSidebarStore } from '@/stores/use-sidebar-store';
import { AuthOrchestrator } from '@/features/auth/components/auth-orchestrator';

export function Providers({ children, locale }: { children: React.ReactNode; locale: string }) {
  const { initializeSession } = useAuth();
  const initializeTheme = useThemeStore(state => state.initializeTheme);
  const initializeCollapsed = useSidebarStore(state => state.initializeCollapsed);
  const pathname = usePathname();

  // Synchronize server-resolved locale to client i18n instance before hydration (Server only)
  if (typeof window === 'undefined') {
    if (i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }

  // Initialize theme and sidebar collapse state on client-side boot
  useEffect(() => {
    initializeTheme();
    initializeCollapsed();
  }, [initializeTheme, initializeCollapsed]);

  // Handle client-side changes post-hydration cleanly to satisfy React Compiler constraints
  useEffect(() => {
    if (i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale]);

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
