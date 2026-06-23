"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/features/workspace/store/use-workspace-store";
import { Card } from "@/components/ui/card";
import { Typography, Chip, Button, Tabs } from "@heroui/react";
import { Building2, Shield, ShieldCheck, AlertTriangle, ArrowLeft, List, Key, Users, History } from "lucide-react";
import { SkeletonLoader } from "@/components/ui/states";
import { RolesList } from "@/features/workspace/views/roles-list";
import { BusinessVerificationBadge } from "@/components/ui/cverify/verification-badges";
import { RoleAssignments } from "@/features/workspace/views/role-assignments";
import { PermissionGrid } from "@/features/workspace/views/permission-grid";
import { RoleAuditLogs } from "@/features/workspace/views/role-audit-logs";

export default function WorkspaceRolesPage() {
  const params = useParams();
  const router = useRouter();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  const fetchWorkspace = useWorkspaceStore((s) => s.fetchWorkspace);
  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[organizationSlug]);
  const isDetailsLoading = useWorkspaceStore((s) => s.loading[organizationSlug]);
  const detailsError = useWorkspaceStore((s) => s.errors[organizationSlug]);

  const [selectedTab, setSelectedTab] = useState("roles");

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

  const permissions = workspaceDetails.permissions || [];
  const isAuthorized =
    permissions.includes("organization:roles:view") ||
    permissions.includes("organization:roles:manage") ||
    workspaceDetails.userRole === "OWNER" ||
    workspaceDetails.userRole === "REPRESENTATIVE";

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
            You do not have permission to access the business roles administration panel. This section is restricted to Workspace Owners and Representatives.
          </Typography>
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => router.push(`/business/${organizationSlug}/information`)}
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
          <BusinessVerificationBadge level={workspaceDetails.verificationLevel} />
        </div>
      </div>

      {/* Main card */}
      <Card className="p-6 md:p-8 bg-surface border border-border rounded-2xl">
        <div className="flex items-center gap-3 mb-6 select-none">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <Shield size={20} />
          </div>
          <div>
            <Typography type="h3" className="font-bold text-foreground">
              Business Roles & Governance
            </Typography>
            <Typography type="body-xs" className="text-muted">
              Configure fine-grained resource permission maps, manage role assignments, and review audit trails.
            </Typography>
          </div>
        </div>

        {/* HeroUI Tabs Layout switcher */}
        <Tabs
          className="w-full"
          variant="secondary"
          selectedKey={selectedTab}
          onSelectionChange={(key) => setSelectedTab(key as string)}
        >
          <Tabs.ListContainer>
            <Tabs.List
              aria-label="Roles Management Panels"
              className="flex items-center gap-6 h-10 border-b border-divider w-full select-none"
            >
              <Tabs.Tab
                id="roles"
                className="flex items-center justify-center gap-2 h-full pb-3 text-xs font-semibold cursor-pointer"
              >
                <List size={13} />
                <span>Roles Matrix</span>
                <Tabs.Indicator className="bottom-0!" />
              </Tabs.Tab>
              <Tabs.Tab
                id="assignments"
                className="flex items-center justify-center gap-2 h-full pb-3 text-xs font-semibold cursor-pointer"
              >
                <Users size={13} />
                <span>Scoped Assignments</span>
                <Tabs.Indicator className="bottom-0!" />
              </Tabs.Tab>
              <Tabs.Tab
                id="grid"
                className="flex items-center justify-center gap-2 h-full pb-3 text-xs font-semibold cursor-pointer"
              >
                <Key size={13} />
                <span>Permission Grid</span>
                <Tabs.Indicator className="bottom-0!" />
              </Tabs.Tab>
              <Tabs.Tab
                id="audit"
                className="flex items-center justify-center gap-2 h-full pb-3 text-xs font-semibold cursor-pointer"
              >
                <History size={13} />
                <span>Audit Trail Logs</span>
                <Tabs.Indicator className="bottom-0!" />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>

          <Tabs.Panel id="roles" className="pt-6">
            {selectedTab === "roles" && <RolesList organizationSlug={organizationSlug} />}
          </Tabs.Panel>
          <Tabs.Panel id="assignments" className="pt-6">
            {selectedTab === "assignments" && <RoleAssignments organizationSlug={organizationSlug} />}
          </Tabs.Panel>
          <Tabs.Panel id="grid" className="pt-6">
            {selectedTab === "grid" && <PermissionGrid organizationSlug={organizationSlug} />}
          </Tabs.Panel>
          <Tabs.Panel id="audit" className="pt-6">
            {selectedTab === "audit" && <RoleAuditLogs organizationSlug={organizationSlug} />}
          </Tabs.Panel>
        </Tabs>
      </Card>
    </div>
  );
}
