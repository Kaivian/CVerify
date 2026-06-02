"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/features/workspace/store/use-workspace-store";
import { useActiveWorkspace } from "@/features/workspace/hooks/use-active-workspace";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Typography } from "@heroui/react";
import { Settings, ArrowLeft } from "lucide-react";
import { BusinessVerificationBadge } from "@/components/ui/cverify/verification-badges";

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[organizationSlug]);
  const { activeWorkspaceId, workspaces } = useActiveWorkspace(organizationSlug);
  const activeWorkspaceObj = workspaces.find(w => w.id === activeWorkspaceId);
  const activeWorkspaceName = activeWorkspaceObj?.displayName || "Workspace";

  return (
    <div className="space-y-6 font-outfit max-w-7xl mx-auto text-foreground p-4">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-surface border border-border text-foreground select-none">
        <div className="space-y-1">
          <Typography type="h2" className="text-2xl font-bold flex items-center gap-2 text-foreground font-outfit">
            <Settings size={24} className="text-accent" />
            Workspace Settings
          </Typography>
          <Typography type="body-xs" className="text-muted font-medium mt-0.5 font-outfit">
            Configure recruitment parameters, stages, and notification details for workspace <span className="font-semibold text-foreground">"{activeWorkspaceName}"</span>.
          </Typography>
        </div>
        <div className="flex gap-2">
          <BusinessVerificationBadge level={workspaceDetails?.verificationLevel} />
        </div>
      </div>

      {/* Main card */}
      <Card className="p-6 md:p-8 bg-surface border border-border rounded-2xl">
        <div className="flex items-center gap-3 mb-4 select-none">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <Settings size={20} />
          </div>
          <div>
            <Typography type="h3" className="font-bold text-foreground font-outfit">
              Workspace Configuration
            </Typography>
            <Typography type="body-xs" className="text-muted">
              Configure hiring workflows, default candidate screening metrics, and custom integrations.
            </Typography>
          </div>
        </div>

        <div className="mt-8 border border-dashed border-border/80 rounded-2xl p-12 text-center select-none">
          <Typography type="h4" className="font-bold text-foreground mb-2">
            Workspace Settings Coming Soon
          </Typography>
          <Typography type="body-xs" className="text-muted max-w-md mx-auto mb-6">
            Detailed configurations for automated stage transitions, slack alerts, and evaluation rubric guidelines are in active development.
          </Typography>
          <Button
            onClick={() => router.push(`/workspace/${organizationSlug}/recruitment/dashboard`)}
            className="px-4 py-2 bg-default hover:bg-default/80 text-foreground font-bold rounded-xl text-xs cursor-pointer border border-border flex items-center gap-1.5"
          >
            <ArrowLeft size={12} /> Back to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}
