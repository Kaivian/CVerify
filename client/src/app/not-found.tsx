'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, ArrowLeft, Search, Briefcase, MessageSquare } from 'lucide-react';
import { Button } from '@heroui/react';
import { PublicPageShell } from '@/components/ui/public-page-shell';
import { RESERVED_USERNAMES } from '@/config/routes';

export default function NotFound() {
  const pathname = usePathname();
  const router = useRouter();

  // Parse path to see if it represents a potential user profile route
  const profileUsername = useMemo(() => {
    if (!pathname) return null;
    const segments = pathname.split('/').filter(Boolean);

    // Profile paths are exactly "/[username]" (1 segment)
    if (segments.length === 1) {
      const username = segments[0];

      // Standard username character check and length limits (3 to 30)
      const isUsernamePattern = /^[a-zA-Z0-9_\-\.]+$/.test(username);
      const isReserved = RESERVED_USERNAMES.has(username.toLowerCase().trim());

      if (isUsernamePattern && !isReserved && username.length >= 3 && username.length <= 30) {
        return username;
      }
    }
    return null;
  }, [pathname]);

  return (
    <PublicPageShell
      authenticatedClassName="flex items-center justify-center min-h-[75vh] w-full p-4"
      guestContainerClassName="relative min-h-screen w-full bg-background text-foreground flex flex-col justify-between overflow-x-hidden antialiased"
      guestBackdrop={<div className="absolute inset-0 bg-[radial-gradient(var(--separator)_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none opacity-40" />}
      guestMainClassName="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-16 flex flex-col items-center justify-center gap-6"
    >
      <div className="w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-xl p-8 sm:p-12 flex flex-col items-center text-center gap-8">
        {/* Large Glassmorphism 404 Text */}
        <div className="flex flex-col items-center justify-center w-36 h-36 rounded-2xl bg-surface-secondary/40 border border-border/80 backdrop-blur-md shadow-inner select-none">
          <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground/90 font-mono">
            404
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted mt-1 select-none">
            Not Found
          </span>
        </div>

        {/* Messaging Area */}
        <div className="flex flex-col gap-3 w-full max-w-lg">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {profileUsername ? 'Profile Not Found' : 'Page Not Found'}
          </h1>
          <p className="text-sm text-muted leading-relaxed">
            {profileUsername ? (
              <>
                The profile <code className="px-1.5 py-0.5 rounded bg-surface-secondary text-xs border border-border font-semibold font-mono text-foreground">@{profileUsername}</code> could not be found. Please check the spelling and try again.
              </>
            ) : (
              'The page you are looking for does not exist or has been moved to a different address.'
            )}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full justify-center mt-2">
          <Button
            onPress={() => router.back()}
            variant="outline"
            className="flex items-center justify-center gap-2 border-border text-foreground hover:bg-surface-secondary font-semibold px-6 py-2.5 rounded-lg"
          >
            <ArrowLeft size={16} />
            Go Back
          </Button>
          <Button
            onPress={() => router.push('/')}
            className="flex items-center justify-center gap-2 bg-foreground text-background font-semibold hover:opacity-90 px-6 py-2.5 rounded-lg"
          >
            <Home size={16} />
            Return Home
          </Button>
        </div>

        {/* CVerify Navigation Links */}
        <div className="w-full border-t border-separator/85 pt-6 mt-2">
          <p className="text-[10px] uppercase font-bold text-muted tracking-wider mb-4 select-none">
            Useful Links
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-semibold text-muted">
            <Link
              href="/ranking"
              className="flex items-center gap-1.5 hover:text-foreground"
            >
              <Search size={14} />
              Search Developers
            </Link>
            <span className="text-separator hidden sm:inline">•</span>
            <Link
              href="/jobs"
              className="flex items-center gap-1.5 hover:text-foreground"
            >
              <Briefcase size={14} />
              Explore Jobs
            </Link>
            <span className="text-separator hidden sm:inline">•</span>
            <Link
              href="/forum"
              className="flex items-center gap-1.5 hover:text-foreground"
            >
              <MessageSquare size={14} />
              Discussions Forum
            </Link>
          </div>
        </div>
      </div>
    </PublicPageShell>
  );
}
