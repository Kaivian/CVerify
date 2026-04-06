"use client";

import React, { useEffect } from 'react';
import { useAuth } from '../features/auth/hooks/use-auth';
import { usePathname } from 'next/navigation';
import { Toast } from '@heroui/react';
import i18n from '../lib/i18n';
import { useThemeStore } from '../stores/use-theme-store';
import { useSidebarStore } from '../stores/use-sidebar-store';
import { AuthOrchestrator } from '../features/auth/components/auth-orchestrator';
import { NotificationHub } from '../infrastructure/notifications/orchestrator';
import { HeroUIToastRenderer } from '../infrastructure/notifications/renderers/heroui-toast-renderer';

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

  // Register decoupled HeroUI renderer to the abstract system NotificationHub
  useEffect(() => {
    const renderer = new HeroUIToastRenderer();
    const unbind = NotificationHub.registerRenderer(renderer);
    return () => {
      unbind();
    };
  }, []);

  // Clear toasts on navigation to decouple page contexts
  useEffect(() => {
    NotificationHub.clearAll();
  }, [pathname]);

  // Swallow harmless View Transition abort errors (InvalidStateError) to prevent annoying Next.js dev overlays in development
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      if (
        error &&
        (error.name === 'InvalidStateError' ||
         error.message?.includes('Transition was aborted') ||
         error.message?.includes('transition was aborted'))
      ) {
        event.preventDefault();
        console.warn('[View Transition] Handled and absorbed harmless view transition abortion:', error.message);
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <>
      <Toast.Provider />
      <AuthOrchestrator />
      {children}
    </>
  );
}
export default Providers;
