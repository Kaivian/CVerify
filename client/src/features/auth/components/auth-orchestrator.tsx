"use client";

import { useEffect, type FC } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../hooks/use-auth';
import { isValidInternalPath } from '../../../lib/utils/auth-utils';

export const AuthOrchestrator: FC = () => {
  const { isAuthenticated, bootstrapState, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Auth orchestration only triggers once bootstrapping state is resolved
    if (bootstrapState !== 'READY') return;

    const isProtectedRoute = ['/admin', '/business', '/user', '/chat', '/jobs', '/cv'].some((p) => pathname.startsWith(p));
    const isAuthRoute = ['/login', '/register', '/forgot-password', '/reset-password'].some((p) => pathname === p);
    
    // Parse callback URL safely on the client
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const rawCallbackUrl = params.get('callbackUrl');
    
    // Clean and validate callback URL to prevent open redirect vulnerabilities.
    // If the callback URL is '/' (landing page), treat it as null so that post-login redirect goes to dashboard.
    const callbackUrl = (isValidInternalPath(rawCallbackUrl) && rawCallbackUrl !== '/') ? rawCallbackUrl : null;

    if (!isAuthenticated) {
      // 1. Unauthenticated users accessing protected dashboard pages
      if (isProtectedRoute) {
        const fullRedirectPath = `/login?callbackUrl=${encodeURIComponent(pathname + (typeof window !== 'undefined' ? window.location.search : ''))}`;
        console.log(`[Auth Orchestrator] Unauthenticated user accessing private route: ${pathname}. Redirecting to: ${fullRedirectPath}`);
        router.replace(fullRedirectPath);
      }
    } else {
      // Authenticated user checks
      const isEmailVerified = user?.isEmailVerified;

      if (!isEmailVerified) {
        // 2. Authenticated but unverified users must be forced to verify email
        if (pathname !== '/verify-email') {
          console.log(`[Auth Orchestrator] Authenticated but unverified user accessing: ${pathname}. Redirecting to: /verify-email`);
          router.replace('/verify-email');
        }
      } else {
        // 3. Authenticated verified users accessing auth routes (login, register, etc.)
        if (isAuthRoute) {
          if (callbackUrl) {
            console.log(`[Auth Orchestrator] Authenticated user on auth route: ${pathname}. Redirecting to verified callbackUrl: ${callbackUrl}`);
            router.replace(callbackUrl);
          } else {
            const dashboardMap: Record<string, string> = {
              ADMIN: '/admin',
              BUSINESS: '/business',
              USER: '/user'
            };
            const target = dashboardMap[user?.role || ''] || '/';
            console.log(`[Auth Orchestrator] Authenticated user on auth route: ${pathname}. Redirecting to default dashboard: ${target}`);
            router.replace(target);
          }
        }
        
        // 4. Authenticated verified users accessing verify-email (already verified)
        if (pathname === '/verify-email') {
          const dashboardMap: Record<string, string> = {
            ADMIN: '/admin',
            BUSINESS: '/business',
            USER: '/user'
          };
          const target = dashboardMap[user?.role || ''] || '/';
          console.log(`[Auth Orchestrator] Verified user accessing verification page. Redirecting to: ${target}`);
          router.replace(target);
        }
      }
    }
  }, [isAuthenticated, bootstrapState, user, pathname, router]);

  // Orchestrator has no visual layout; it acts purely as a routing side-effect
  return null;
};

export default AuthOrchestrator;
