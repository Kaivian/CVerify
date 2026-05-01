"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/features/workspace/store/use-workspace-store";
import { Card } from "@/components/ui/card";
import { Typography, Chip, Button } from "@heroui/react";
import { Building2, Settings, ShieldCheck, AlertTriangle, ArrowLeft } from "lucide-react";
import { SkeletonLoader } from "@/components/ui/states";

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  const fetchWorkspace = useWorkspaceStore((s) => s.fetchWorkspace);
  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[organizationSlug]);
  const isDetailsLoading = useWorkspaceStore((s) => s.loading[organizationSlug]);
  const detailsError = useWorkspaceStore((s) => s.errors[organizationSlug]);

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

  if (detailsError || !workspaceDetails) {
    return (
      <div className="max-w-xl mx-auto py-20 font-outfit text-foreground">
        <Card className="p-8 border border-border bg-surface text-center">
          <div className="size-16 rounded-2xl bg-danger/10 flex items-center justify-center border border-danger/20 mx-auto mb-5 text-danger">
            <AlertTriangle size={28} />
          </div>
          <Typography type="h4" className="font-bold text-foreground mb-2">
            Workspace Loading Error
          </Typography>
          <Typography type="body-xs" className="text-muted leading-relaxed mb-6">
            {detailsError || "Organization not found"}
          </Typography>
        </Card>
      </div>
    );
  }

  const userRole = workspaceDetails.userRole;
  const isAuthorized = userRole === "OWNER" || userRole === "REPRESENTATIVE";

  if (!isAuthorized) {
    return (
      <div className="max-w-xl mx-auto py-20 font-outfit text-foreground">
        <Card className="p-8 border border-border bg-surface text-center">
          <div className="size-16 rounded-2xl bg-danger/10 flex items-center justify-center border border-danger/20 mx-auto mb-5 text-danger">
            <AlertTriangle size={28} />
          </div>
          <Typography type="h4" className="font-bold text-foreground mb-2">
            Access Denied
          </Typography>
          <Typography type="body-xs" className="text-muted leading-relaxed mb-6">
            You do not have permission to access the workspace settings dashboard. General workspace configuration is restricted to Workspace Owners and Representatives.
          </Typography>
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => router.push(`/workspace/${organizationSlug}`)}
              className="px-4 py-2 bg-foreground text-background font-bold rounded-xl text-xs cursor-pointer"
            >
              <ArrowLeft size={12} className="mr-1.5" />
              Back to Workspace
            </Button>
          </div>
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
            {workspaceDetails.organizationName}
          </Typography>
          <Typography type="body-xs" className="text-muted font-light mt-0.5">
            Workspace context: <span className="font-mono text-accent">@{workspaceDetails.organizationSlug}</span> • My Role: <span className="font-semibold text-foreground">{workspaceDetails.userRole}</span>
          </Typography>
        </div>
        <div className="flex gap-2">
          <Chip color="success" variant="soft" size="sm" className="font-semibold text-xs py-1">
            <ShieldCheck size={12} className="inline mr-1" />
            Verified Enterprise
          </Chip>
        </div>
      </div>

      {/* Main card */}
      <Card className="p-6 md:p-8 bg-surface border border-border rounded-2xl">
        <div className="flex items-center gap-3 mb-4 select-none">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <Settings size={20} />
          </div>
          <div>
            <Typography type="h3" className="font-bold text-foreground">
              Workspace Settings
            </Typography>
            <Typography type="body-xs" className="text-muted">
              Configure global workspace security configurations, single sign-on parameters, and branding.
            </Typography>
          </div>
        </div>

        <div className="mt-8 border border-dashed border-border/80 rounded-2xl p-12 text-center select-none">
          <Typography type="h4" className="font-bold text-foreground mb-2">
            Workspace Settings Portal Coming Soon
          </Typography>
          <Typography type="body-xs" className="text-muted max-w-md mx-auto mb-6">
            Advanced multitenancy branding controls and SSO setup are undergoing audit evaluation. Full panel options will populate in the next feature rollout.
          </Typography>
        </div>
      </Card>
    </div>
  );
}
