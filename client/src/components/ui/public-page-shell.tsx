"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { CandidateShell } from "@/components/layouts/candidate-shell";
import { PublicNavigationHeader } from "@/components/ui/public-navigation-header";
import { cn } from "@/lib/utils";

interface PublicPageShellProps {
  children: React.ReactNode;
  
  // Guest Layout customizations
  guestContainerClassName?: string;
  guestMainClassName?: string;
  guestHeader?: React.ReactNode;
  guestFooter?: React.ReactNode;
  guestBackdrop?: React.ReactNode;
  
  // Authenticated Layout customizations
  authenticatedClassName?: string;
}

export function PublicPageShell({
  children,
  guestContainerClassName = "min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-300",
  guestMainClassName = "max-w-7xl mx-auto w-full px-6 md:px-12 mt-8 flex flex-col gap-6",
  guestHeader,
  guestFooter,
  guestBackdrop,
  authenticatedClassName,
}: PublicPageShellProps) {
  const { isAuthenticated, bootstrapState } = useAuth();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Determine if we should render the private platform application shell
  const showAuthenticated = isClient && isAuthenticated && bootstrapState === "READY";

  if (showAuthenticated) {
    return (
      <CandidateShell>
        <div className={cn("w-full h-full", authenticatedClassName)}>
          {children}
        </div>
      </CandidateShell>
    );
  }

  // Unauthenticated Guest Layout
  return (
    <div className={guestContainerClassName}>
      {guestBackdrop}
      {guestHeader || <PublicNavigationHeader />}
      <main className={guestMainClassName}>
        {children}
      </main>
      {guestFooter}
    </div>
  );
}

export default PublicPageShell;
