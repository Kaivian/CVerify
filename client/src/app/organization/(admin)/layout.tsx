"use client";

import React from "react";
import { redirect } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useSessionTimeout } from "@/hooks/use-session-timeout";
import { SessionTimeoutModal } from "@/components/ui/session-timeout-modal";
import { Sidebar } from "@/components/ui/sidebar";
import { Header } from "@/components/ui/header";
import { AuthGuard } from "@/features/auth/guards/auth-guard";
import { SidebarModeProvider } from "@/providers/sidebar-mode-provider";
import { WorkspaceProvider } from "@/providers/workspace-provider";

function AdminRoleGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // Enforce ADMIN role strictly on admin company management routes
  if (user && user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  return <>{children}</>;
}

export default function BusinessAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { logout } = useAuth();
  const { showWarning, secondsRemaining, extendSession } = useSessionTimeout();

  const handleSignOut = async () => {
    await logout(true);
  };

  return (
    <AuthGuard>
      <WorkspaceProvider>
        <SidebarModeProvider>
          <div className="grid min-h-screen w-full grid-cols-1 md:grid-cols-[auto_1fr] bg-background text-foreground transition-colors duration-300">
            {/* Sidebar */}
            <Sidebar />

            {/* Main content viewport */}
            <div className="flex flex-col min-w-0 h-screen overflow-hidden">
              <Header />

              <main className="flex-1 overflow-y-auto mr-3 mb-3 bg-background border-2 rounded-2xl p-6">
                <AdminRoleGuard>{children}</AdminRoleGuard>
              </main>
            </div>

            {/* Session timeout modal */}
            <SessionTimeoutModal
              isOpen={showWarning}
              countdown={secondsRemaining}
              onExtend={extendSession}
              onLogout={handleSignOut}
            />
          </div>
        </SidebarModeProvider>
      </WorkspaceProvider>
    </AuthGuard>
  );
}
