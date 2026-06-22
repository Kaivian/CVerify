"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/features/workspace/store/use-workspace-store";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useSessionTimeout } from "@/hooks/use-session-timeout";
import { SessionTimeoutModal } from "@/components/ui/session-timeout-modal";
import { Sidebar } from "@/components/ui/sidebar";
import { Header } from "@/components/ui/header";
import { AuthGuard } from "@/features/auth/guards/auth-guard";
import { WorkspaceProvider } from "@/providers/workspace-provider";
import { SkeletonLoader } from "@/components/ui/states";
import { Card } from "@/components/ui/card";
import { Typography, Button } from "@heroui/react";
import { AlertTriangle } from "lucide-react";

function WorkspaceAccessGuard({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  const fetchWorkspace = useWorkspaceStore((s) => s.fetchWorkspace);
  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[organizationSlug]);
  const isDetailsLoading = useWorkspaceStore((s) => s.loading[organizationSlug]);
  const detailsError = useWorkspaceStore((s) => s.errors[organizationSlug]);

  useEffect(() => {
    if (organizationSlug) {
      fetchWorkspace(organizationSlug);
    }
  }, [organizationSlug, fetchWorkspace]);

  if (isDetailsLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 font-outfit text-foreground">
        <div className="h-10 w-48 bg-separator/50 animate-pulse rounded-lg mb-4" />
        <Card className="p-0 overflow-hidden">
          <SkeletonLoader rows={6} columns={4} />
        </Card>
      </div>
    );
  }

  // Access check: if there is a details fetch error (e.g. 403) OR if userRole is null (authenticated visitor/non-member)
  const isAccessDenied =
    (detailsError && (detailsError.toLowerCase().includes("forbidden") || detailsError.includes("403"))) ||
    (workspaceDetails && workspaceDetails.userRole === null);

  if (isAccessDenied || detailsError || !workspaceDetails) {
    return (
      <div className="max-w-xl mx-auto py-20 font-outfit text-foreground">
        <Card className="p-8 border border-border bg-surface text-center">
          <div className="size-16 rounded-2xl bg-danger/10 flex items-center justify-center border border-danger/20 mx-auto mb-5 text-danger">
            <AlertTriangle size={28} />
          </div>
          <Typography type="h4" className="font-bold text-foreground mb-2">
            Access Denied
          </Typography>
          <Typography type="body-xs" className="text-muted leading-relaxed mb-6">
            You do not have permission to access this organization's private workspace. Please verify your membership credentials or switch accounts.
          </Typography>
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => router.push("/user")}
              className="px-4 py-2 bg-foreground text-background font-bold rounded-xl text-xs cursor-pointer"
            >
              Back to Home
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

export default function WorkspacePrivateLayout({
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
        <div className="grid min-h-screen w-full grid-cols-1 md:grid-cols-[auto_1fr] bg-[#ffffff] dark:bg-[#000000] text-foreground transition-colors duration-300">
          {/* Sidebar */}
          <Sidebar />

          {/* Main content viewport */}
          <div className="flex flex-col min-w-0 h-screen overflow-hidden">
            <Header />

            <main className="flex-1 overflow-y-auto mr-3 mb-3 bg-background border-2 rounded-2xl p-6">
              <WorkspaceAccessGuard>{children}</WorkspaceAccessGuard>
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
      </WorkspaceProvider>
    </AuthGuard>
  );
}
