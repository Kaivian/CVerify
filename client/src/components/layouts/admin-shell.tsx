"use client";

import React from "react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useSessionTimeout } from "@/hooks/use-session-timeout";
import { SessionTimeoutModal } from "@/components/ui/session-timeout-modal";
import { Sidebar } from "@/components/ui/sidebar";
import { Header } from "@/components/ui/header";
import { WorkspaceProvider } from "@/providers/workspace-provider";
import { SidebarModeProvider } from "@/providers/sidebar-mode-provider";

interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const { logout } = useAuth();
  const { showWarning, secondsRemaining, extendSession } = useSessionTimeout();

  const handleSignOut = async () => {
    await logout(true);
  };

  return (
    <WorkspaceProvider>
      <SidebarModeProvider>
        <div className="grid min-h-screen w-full grid-cols-1 md:grid-cols-[auto_1fr] bg-background text-foreground transition-colors duration-300">
          {/* 1. Admin Navigation Sidebar */}
          <Sidebar />

          {/* 2. Main content viewport section */}
          <div className="flex flex-col min-w-0 h-screen overflow-hidden">
            {/* Global Header shell */}
            <Header />

            {/* Dynamic page contents wrapper */}
            <main className="flex-1 overflow-y-auto mr-3 mb-3 bg-background border-2 rounded-2xl p-6">
              {children}
            </main>
          </div>

          {/* 3. Session Inactivity Countdown Modal Overlay */}
          <SessionTimeoutModal
            isOpen={showWarning}
            countdown={secondsRemaining}
            onExtend={extendSession}
            onLogout={handleSignOut}
          />
        </div>
      </SidebarModeProvider>
    </WorkspaceProvider>
  );
}

export default AdminShell;
