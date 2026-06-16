"use client";

import React, { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthGuard } from '../../../features/auth/guards/auth-guard';
import { AdminShell } from '../../../components/layouts/admin-shell';
import { adminModuleRegistry } from '../../../config/admin-module-registry';
import { useAuth } from '../../../features/auth/hooks/use-auth';
import { Card } from '../../../components/ui/card';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { isModuleEnabled } from '../../../lib/utils/feature-flags';

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { hasPermission, user } = useAuth();
  const router = useRouter();

  // 1. Find matching module in the registry
  const activeModule = useMemo(() => {
    if (!pathname) return null;
    return adminModuleRegistry.find(m => {
      if (m.path === pathname) return true;
      if (pathname.startsWith(m.path + '/')) return true;
      return false;
    });
  }, [pathname]);

  // 2. Check portal-level access
  const hasPortalAccess = hasPermission('portal:admin:view') || user?.role === 'ADMIN';
  
  // Resolve feature flag check and module permission check
  const isAuthorized = useMemo(() => {
    if (!hasPortalAccess) return false;
    if (!activeModule) return true;
    
    // Check feature flag
    const userPerms = user?.permissions || [];
    if (!isModuleEnabled(activeModule, userPerms)) {
      return false;
    }

    // Check granular module permission
    return hasPermission(activeModule.requiredPermission);
  }, [hasPortalAccess, activeModule, hasPermission, user]);

  if (!hasPortalAccess || !isAuthorized) {
    return (
      <AuthGuard>
        <AdminShell>
          <div className="flex flex-col items-center justify-center p-8 min-h-[70vh] font-outfit select-none">
            <Card glow={true} className="max-w-md p-8 border-2 border-dashed border-danger/35 bg-surface text-center space-y-6 shadow-xl animate-fade-in">
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-danger/10 text-danger flex items-center justify-center border border-danger/20">
                  <ShieldAlert size={28} />
                </div>
                <h2 className="text-lg font-bold text-foreground">Restricted Console</h2>
                <p className="text-xs text-muted max-w-xs leading-relaxed">
                  Your identity authorization does not possess access to this administrative area or the module is currently disabled.
                </p>
              </div>
              <div className="border-t border-border/30 pt-5 flex flex-col sm:flex-row gap-3 w-full justify-center">
                <Button
                  variant="bordered"
                  onClick={() => router.back()}
                  className="w-full sm:w-auto"
                >
                  Go Back
                </Button>
                <Button
                  variant="solid"
                  onClick={() => router.push('/user')}
                  className="w-full sm:w-auto bg-danger text-danger-foreground hover:opacity-90"
                >
                  Candidate Portal
                </Button>
              </div>
            </Card>
          </div>
        </AdminShell>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <AdminShell>
        {children}
      </AdminShell>
    </AuthGuard>
  );
}
