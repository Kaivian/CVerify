"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/features/workspace/store/use-workspace-store";
import { Card } from "@/components/ui/card";
import { Typography, Chip, Button } from "@heroui/react";
import { AlertTriangle, Building2, ShieldCheck, ArrowLeft } from "lucide-react";
import { SkeletonLoader } from "@/components/ui/states";
import { BusinessVerificationBadge } from "@/components/ui/cverify/verification-badges";
import { type HiringRequirement } from "@/services/hiring-requirement.service";

// Subcomponents
import JdDashboardList from "@/features/recruitment/components/JdDashboardList";
import JdIntakeWizard from "@/features/recruitment/components/JdIntakeWizard";
import JdDetailView from "@/features/recruitment/components/JdDetailView";
import TaxonomyManager from "@/features/recruitment/components/TaxonomyManager";

export default function WorkspaceJDManagementPage() {
  const params = useParams();
  const router = useRouter();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  const fetchWorkspace = useWorkspaceStore((s) => s.fetchWorkspace);
  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[organizationSlug]);
  const isDetailsLoading = useWorkspaceStore((s) => s.loading[organizationSlug]);
  const detailsError = useWorkspaceStore((s) => s.errors[organizationSlug]);

  const workspaceId = workspaceDetails?.workspaces?.[0]?.id;

  // View state: list, wizard, detail, taxonomy
  const [pageMode, setPageMode] = useState<"list" | "wizard" | "detail" | "taxonomy">("list");
  const [selectedRequirement, setSelectedRequirement] = useState<HiringRequirement | null>(null);

  // Initial Load: Workspace details
  useEffect(() => {
    if (organizationSlug) {
      fetchWorkspace(organizationSlug);
    }
  }, [organizationSlug, fetchWorkspace]);

  // Auth/Permissions Check
  if (isDetailsLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 font-outfit text-foreground select-none">
        <div className="h-10 w-48 bg-separator/50 animate-pulse rounded-lg mb-4" />
        <Card className="p-0 overflow-hidden">
          <SkeletonLoader rows={6} columns={4} />
        </Card>
      </div>
    );
  }

  if (detailsError || !workspaceDetails || !workspaceId) {
    return (
      <div className="max-w-xl mx-auto py-20 font-outfit text-foreground select-none">
        <Card className="p-8 border border-border bg-surface text-center">
          <div className="size-16 rounded-2xl bg-danger/10 flex items-center justify-center border border-danger/20 mx-auto mb-5 text-danger">
            <AlertTriangle size={28} />
          </div>
          <Typography type="h4" className="font-bold text-foreground mb-2">
            Workspace Loading Error
          </Typography>
          <Typography type="body-xs" className="text-muted leading-relaxed mb-6 font-medium">
            {detailsError || "Organization workspace not found."}
          </Typography>
        </Card>
      </div>
    );
  }

  const permissions = workspaceDetails.permissions || [];
  const isAuthorized =
    permissions.includes("ai:interview:configure") ||
    permissions.includes("ai:interview:conduct") ||
    permissions.includes("ai:interview:evaluate") ||
    workspaceDetails.userRole === "OWNER" ||
    workspaceDetails.userRole === "REPRESENTATIVE" ||
    workspaceDetails.userRole === "HR";

  if (!isAuthorized) {
    return (
      <div className="max-w-xl mx-auto py-20 font-outfit text-foreground select-none">
        <Card className="p-8 border border-border bg-surface text-center">
          <div className="size-16 rounded-2xl bg-danger/10 flex items-center justify-center border border-danger/20 mx-auto mb-5 text-danger">
            <AlertTriangle size={28} />
          </div>
          <Typography type="h4" className="font-bold text-foreground mb-2">
            Access Denied
          </Typography>
          <Typography type="body-xs" className="text-muted leading-relaxed mb-6 font-medium">
            You do not have permission to access the hiring requirements intake console.
          </Typography>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-outfit max-w-7xl mx-auto text-foreground p-4 md:p-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-surface border border-border/60 text-foreground select-none">
        <div className="space-y-1">
          <Typography
            type="h2"
            className="text-2xl font-bold flex items-center gap-2 text-foreground"
          >
            <Building2 size={24} className="text-accent" />
            {workspaceDetails.organizationName}
          </Typography>
          <Typography type="body-xs" className="text-muted font-light mt-0.5 font-medium">
            Workspace context: <span className="font-mono text-accent">@{workspaceDetails.organizationSlug}</span> &bull; My Role: <span className="font-semibold text-foreground">{workspaceDetails.userRole}</span>
          </Typography>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            onClick={() => router.push(`/workspace/${organizationSlug}/recruitment/dashboard`)}
            className="bg-default text-default-foreground border border-border text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </Button>
          <BusinessVerificationBadge level={workspaceDetails.verificationLevel} />
        </div>
      </div>

      {/* Main page content based on current view mode */}
      {pageMode === "list" && (
        <JdDashboardList
          workspaceId={workspaceId}
          onViewRequirement={(req) => {
            setSelectedRequirement(req);
            setPageMode("detail");
          }}
          onEditRequirement={(req) => {
            setSelectedRequirement(req);
            setPageMode("wizard");
          }}
          onCreateNew={() => {
            setSelectedRequirement(null);
            setPageMode("wizard");
          }}
          onManageTaxonomy={() => setPageMode("taxonomy")}
        />
      )}

      {pageMode === "wizard" && (
        <JdIntakeWizard
          workspaceId={workspaceId}
          organizationSlug={organizationSlug}
          initialDraft={selectedRequirement}
          onGenerationStarted={(id) => {
            setSelectedRequirement({ id } as any);
            setPageMode("detail");
          }}
          onCancel={() => {
            setSelectedRequirement(null);
            setPageMode("list");
          }}
        />
      )}

      {pageMode === "detail" && selectedRequirement && (
        <JdDetailView
          workspaceId={workspaceId}
          requirementId={selectedRequirement.id}
          onBack={() => {
            setSelectedRequirement(null);
            setPageMode("list");
          }}
          onEdit={(req) => {
            setSelectedRequirement(req);
            setPageMode("wizard");
          }}
        />
      )}

      {pageMode === "taxonomy" && (
        <TaxonomyManager
          workspaceId={workspaceId}
          onBack={() => setPageMode("list")}
        />
      )}
    </div>
  );
}
