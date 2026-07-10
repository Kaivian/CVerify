'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';
import { Button } from '@heroui/react';
import { PublicPageShell } from '@/components/ui/public-page-shell';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ProfileError({ error, reset }: ErrorProps) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Production Diagnostics / Telemetry Logging
    const telemetryPayload = {
      event: 'profile_route_error',
      timestamp: new Date().toISOString(),
      pathname,
      errorMessage: error.message || 'Unknown profile fetch error',
      errorStack: error.stack,
      errorDigest: error.digest,
      environment: process.env.NODE_ENV,
    };

    // Log to console in high-contrast for diagnostics
    console.error(
      `%c[Telemetry System - Error Captured]%c\n`,
      'color: #ef4444; font-weight: bold; font-size: 14px;',
      'color: inherit;',
      JSON.stringify(telemetryPayload, null, 2)
    );

    // Note: Production telemetry tools (like Sentry, LogRocket, or Datadog) should be integrated here.
  }, [error, pathname]);

  return (
    <PublicPageShell
      authenticatedClassName="flex items-center justify-center min-h-[75vh] w-full p-4"
      guestContainerClassName="relative min-h-screen w-full bg-background text-foreground flex flex-col justify-between overflow-x-hidden antialiased"
      guestBackdrop={<div className="absolute inset-0 bg-[radial-gradient(var(--separator)_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none opacity-40" />}
      guestMainClassName="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-20 flex flex-col items-center justify-center gap-6"
    >
      <div className="w-full max-w-xl bg-surface border border-border rounded-2xl shadow-lg p-8 sm:p-10 flex flex-col items-center text-center gap-6">
        {/* Glow Hazard Visual */}
        <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-danger/10 border border-danger/20 text-danger">
          <AlertCircle size={32} />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Profile Temporarily Unavailable
          </h1>
          <p className="text-sm text-muted max-w-md leading-relaxed">
            The profile at <code className="px-1.5 py-0.5 rounded bg-surface-secondary text-xs border border-border font-mono">{pathname}</code> cannot be loaded due to a temporary service error. Please try again.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full justify-center mt-2">
          <Button
            onPress={() => reset()}
            className="flex items-center justify-center gap-2 bg-foreground text-background font-semibold hover:opacity-90 px-6 py-2.5 rounded-lg transition-all"
          >
            <RotateCcw size={16} />
            Try Again
          </Button>
          <Button
            onPress={() => router.push('/')}
            variant="outline"
            className="flex items-center justify-center gap-2 border-border text-foreground hover:bg-surface-secondary font-semibold px-6 py-2.5 rounded-lg transition-all"
          >
            <Home size={16} />
            Return Home
          </Button>
        </div>
      </div>
    </PublicPageShell>
  );
}
