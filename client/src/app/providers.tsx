"use client";

import "@/lib/logger-bootstrap";
import React, { useEffect, useState } from "react";
import { useAuth } from "../features/auth/hooks/use-auth";
import { usePathname } from "next/navigation";
import { Toast } from "@heroui/react";
import { useThemeStore } from "../stores/use-theme-store";
import { useSidebarStore } from "../stores/use-sidebar-store";
import { AuthOrchestrator } from "../features/auth/components/auth-orchestrator";
import { NotificationHub } from "../infrastructure/notifications/orchestrator";
import { HeroUIToastRenderer } from "../infrastructure/notifications/renderers/heroui-toast-renderer";
import { SignalRProvider } from "../providers/signalr-provider";

import { useAuthStore } from "../features/auth/store/use-auth-store";
import { type User } from "../types/auth.types";

export function Providers({
  children,
  locale,
  initialUser,
}: {
  children: React.ReactNode;
  locale: string;
  initialUser: User | null;
}) {
  const [storeInitialized] = useState(() => {
    if (initialUser) {
      useAuthStore.setState({
        isAuthenticated: true,
        user: initialUser,
        bootstrapState: "READY",
        isInitialized: true,
      });
    } else {
      useAuthStore.setState({
        isAuthenticated: false,
        user: null,
        bootstrapState: "IDLE",
        isInitialized: true,
      });
    }
    return true;
  });

  const { initializeSession } = useAuth();
  const initializeTheme = useThemeStore((state) => state.initializeTheme);
  const initializeCollapsed = useSidebarStore(
    (state) => state.initializeCollapsed,
  );
  const pathname = usePathname();

  // Initialize theme and sidebar collapse state on client-side boot
  useEffect(() => {
    initializeTheme();
    initializeCollapsed();
  }, [initializeTheme, initializeCollapsed]);

  // Run secure session hydration immediately on app boots
  // Uses forceRevalidate to silently refresh the profile from auth/me even when
  // SSR provides initialUser, ensuring signed avatar URLs and fresh data.
  useEffect(() => {
    initializeSession(true);

    // Revalidate on visibility change (e.g. user returns to the tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        initializeSession(true);
      }
    };

    // Revalidate on page restore (e.g. BFCache / Browser Back Button from external site)
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log("[Auth System] App restored from BFCache. Force revalidating session.");
        initializeSession(true);
      }
    };

    // Detect browser back/forward navigation within the same session
    const handlePopState = () => {
      console.log("[Auth System] Browser popstate detected. Force revalidating session.");
      initializeSession(true);
    };

    // Detect when the window regains focus (e.g., clicking back into the app)
    const handleFocus = () => {
      initializeSession(true);
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("focus", handleFocus);
    };
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
        (error.name === "InvalidStateError" ||
          error.message?.includes("Transition was aborted") ||
          error.message?.includes("transition was aborted"))
      ) {
        event.preventDefault();
        console.warn(
          "[View Transition] Handled and absorbed harmless view transition abortion:",
          error.message,
        );
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
    };
  }, []);

  return (
    <>
      <Toast.Provider />
      <AuthOrchestrator />
      <SignalRProvider>
        {children}
      </SignalRProvider>
    </>
  );
}
export default Providers;
