"use client";

import React from "react";
import { PermissionGuard } from "../../../../features/auth/guards/permission-guard";
import { ComponentsSystemView } from "@/modules/admin/system/components-system-view";
import { Card } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

// ============================================================================
// 1. High-fidelity visual fallback view for unauthorized permission access
// ============================================================================
const UnauthorizedFallbackView: React.FC = () => {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center p-8 min-h-[70vh] font-outfit select-none">
      <Card glow={true} className="max-w-md p-8 border-2 border-dashed border-danger/35 bg-surface text-center space-y-6 shadow-xl animate-fade-in">
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-danger/10 text-danger flex items-center justify-center border border-danger/20 animate-pulse">
            <ShieldAlert size={28} />
          </div>
          <h2 className="text-lg font-bold text-foreground">Access Revoked</h2>
          <p className="text-xs text-muted max-w-xs leading-relaxed">
            You do not possess the required design-system intelligence authorization permission (<code className="font-mono bg-surface-secondary px-1.5 py-0.5 rounded text-danger">components:system:read</code>) to access the explorer.
          </p>
        </div>

        <div className="border-t border-border/30 pt-5 flex flex-col gap-2">
          <Button
            variant="solid"
            onClick={() => router.push("/admin")}
            className="w-full cursor-pointer bg-danger text-danger-foreground hover:opacity-90"
          >
            <ArrowLeft size={16} className="mr-1.5" />
            Return to Admin Panel
          </Button>
        </div>
      </Card>
    </div>
  );
};

// ============================================================================
// 2. Primary Route Entry Point Shell
// ============================================================================
export default function AdminComponentsSystemPage() {
  return (
    <PermissionGuard
      permission="components:system:read"
      fallback={<UnauthorizedFallbackView />}
    >
      <ComponentsSystemView />
    </PermissionGuard>
  );
}
