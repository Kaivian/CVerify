"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/features/workspace/store/use-workspace-store";
import { Card } from "@/components/ui/card";
import { Typography, Button } from "@heroui/react";
import { Building2, BarChart3, ArrowLeft } from "lucide-react";
import { SkeletonLoader } from "@/components/ui/states";
import { BusinessVerificationBadge } from "@/components/ui/cverify/verification-badges";

export default function WorkspaceAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  const fetchWorkspace = useWorkspaceStore((s) => s.fetchWorkspace);
  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[organizationSlug]);
  const isDetailsLoading = useWorkspaceStore((s) => s.loading[organizationSlug]);

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

  return (
    <div className="space-y-6 font-outfit max-w-7xl mx-auto text-foreground">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-surface border border-border text-foreground select-none">
        <div className="space-y-1">
          <Typography
            type="h2"
            className="text-2xl font-bold flex items-center gap-2 text-foreground"
          >
            <Building2 size={24} className="text-accent" />
            {workspaceDetails?.organizationName || "Workspace"}
          </Typography>
          <Typography type="body-xs" className="text-muted font-light mt-0.5">
            Workspace context: <span className="font-mono text-accent">@{organizationSlug}</span>
          </Typography>
        </div>
        {workspaceDetails && (
          <div className="flex gap-2">
            <BusinessVerificationBadge level={workspaceDetails.verificationLevel} />
          </div>
        )}
      </div>

      {/* Main card */}
      <Card className="p-6 md:p-8 bg-surface border border-border rounded-2xl">
        <div className="flex items-center gap-3 mb-4 select-none">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <BarChart3 size={20} />
          </div>
          <div>
            <Typography type="h3" className="font-bold text-foreground">
              Analytics & Conversion Indexes
            </Typography>
            <Typography type="body-xs" className="text-muted">
              Analyze visitor acquisition rates, conversion funnels, and verification score trajectories.
            </Typography>
          </div>
        </div>

        <div className="mt-8 border border-dashed border-border/80 rounded-2xl p-12 text-center select-none">
          <Typography type="h4" className="font-bold text-foreground mb-2">
            Analytics Dashboard Coming Soon
          </Typography>
          <Typography type="body-xs" className="text-muted max-w-md mx-auto mb-6">
            The workspace analytics portal is currently in active configuration. Visual chart boards and conversion logging will become active in the next release.
          </Typography>
          <Button
            onClick={() => router.push(`/business/${organizationSlug}/dashboard`)}
            className="px-4 py-2 bg-foreground text-background font-bold rounded-xl text-xs cursor-pointer border-none"
          >
            <ArrowLeft size={12} className="mr-1.5" />
            Back to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}
