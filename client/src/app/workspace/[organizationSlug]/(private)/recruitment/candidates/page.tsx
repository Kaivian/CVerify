"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/features/workspace/store/use-workspace-store";
import { useActiveWorkspace } from "@/features/workspace/hooks/use-active-workspace";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Typography, Chip } from "@heroui/react";
import { Users, ArrowLeft, Search, Plus } from "lucide-react";
import { BusinessVerificationBadge } from "@/components/ui/cverify/verification-badges";

export default function WorkspaceCandidatesPage() {
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
            <Users size={24} className="text-accent" />
            Workspace Candidates
          </Typography>
          <Typography type="body-xs" className="text-muted font-medium mt-0.5 font-outfit">
            Managing developers assigned to workspace <span className="font-semibold text-foreground">"{activeWorkspaceName}"</span>.
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
            <Users size={20} />
          </div>
          <div>
            <Typography type="h3" className="font-bold text-foreground font-outfit">
              Candidates Registry
            </Typography>
            <Typography type="body-xs" className="text-muted">
              Filter, screen, and select candidate applications specific to this operational workspace.
            </Typography>
          </div>
        </div>

        <div className="mt-8 border border-dashed border-border/80 rounded-2xl p-12 text-center select-none">
          <Typography type="h4" className="font-bold text-foreground mb-2">
            Candidates Portal Coming Soon
          </Typography>
          <Typography type="body-xs" className="text-muted max-w-md mx-auto mb-6">
            Candidates lists, portfolio evidence graphs, and screening filters are being linked to the intake console. Open positions details will sync shortly.
          </Typography>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => router.push(`/workspace/${organizationSlug}/recruitment/dashboard`)}
              className="px-4 py-2 bg-default hover:bg-default/80 text-foreground font-bold rounded-xl text-xs cursor-pointer border border-border flex items-center gap-1.5"
            >
              <ArrowLeft size={12} /> Back to Dashboard
            </Button>
            <Button
              onClick={() => router.push(`/workspace/${organizationSlug}/intelligence`)}
              className="px-4 py-2 bg-accent hover:bg-accent/90 text-white font-bold rounded-xl text-xs cursor-pointer border-none flex items-center gap-1.5"
            >
              <Search size={12} /> Find Candidates
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
