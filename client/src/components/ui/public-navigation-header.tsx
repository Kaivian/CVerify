"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { AuthAvatar } from "@/components/ui/auth-avatar";
import { useThemeStore } from "@/stores/use-theme-store";

interface PublicNavigationHeaderProps {
  className?: string;
}

export function PublicNavigationHeader({ 
  className = "sticky top-0 z-50 w-full bg-surface/80 backdrop-blur-md border-b border-border transition-colors duration-300" 
}: PublicNavigationHeaderProps) {
  const { isAuthenticated, user } = useAuth();
  const { theme } = useThemeStore();
  
  // Choose logo matching the light/dark mode
  const isLight = theme === "light";
  const logoSrc = isLight ? "/brand/logo&name-black.png" : "/brand/logo&name-white.png";

  return (
    <header className={className}>
      <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between w-full">
        <Link href="/" className="select-none rounded-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt="CVerify Logo"
            className="h-8 w-auto"
          />
        </Link>

        <div className="flex items-center gap-6">
          <Link 
            href="/jobs" 
            className="text-xs font-semibold text-muted hover:text-foreground transition-colors rounded-sm"
          >
            Browse Jobs
          </Link>
          
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <Link 
                href={`/${user?.role?.toLowerCase() || 'user'}`} 
                className="text-xs font-semibold text-muted hover:text-foreground transition-colors rounded-sm"
              >
                Dashboard
              </Link>
              <AuthAvatar />
            </div>
          ) : (
            <>
              <Link 
                href="/login" 
                className="text-xs font-semibold text-muted hover:text-foreground transition-colors hidden sm:block rounded-sm"
              >
                Sign In
              </Link>
              <Link href="/login" className="rounded-lg">
                <button className="px-4 py-2 rounded-lg text-xs font-semibold bg-foreground text-background hover:opacity-90 transition-all cursor-pointer">
                  Generate Verified Profile
                </button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default PublicNavigationHeader;

