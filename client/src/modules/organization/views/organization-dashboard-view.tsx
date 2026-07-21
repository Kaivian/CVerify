"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/features/workspace/store/use-workspace-store";
import { CreateWorkspaceModal } from "@/features/workspace/components/create-workspace-modal";
import { useActiveWorkspace } from "@/features/workspace/hooks/use-active-workspace";
import { 
  Building2, 
  Plus, 
  Settings, 
  Bookmark, 
  Compass, 
  ShieldCheck,
  CreditCard,
  ArrowRight
} from "lucide-react";
import { Typography, Spinner, Card, Button } from "@heroui/react";
import { BusinessVerificationBadge } from "@/components/ui/cverify/verification-badges";

export function OrganizationDashboardView() {
  const params = useParams();
  const router = useRouter();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  const fetchWorkspace = useWorkspaceStore((s) => s.fetchWorkspace);
  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[organizationSlug]);
  const isDetailsLoading = useWorkspaceStore((s) => s.loading[organizationSlug]);

  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] = useState(false);
  const { setActiveWorkspaceId } = useActiveWorkspace(organizationSlug);

  useEffect(() => {
    if (organizationSlug) {
      fetchWorkspace(organizationSlug);
    }
  }, [organizationSlug, fetchWorkspace]);

  const workspaces = workspaceDetails?.workspaces || [];

  const handleOpenWorkspace = (workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
    router.push(`/organization/${organizationSlug}/recruitment/dashboard`);
  };

  if (isDetailsLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 font-outfit text-foreground select-none">
        <div className="h-10 w-48 bg-separator/50 animate-pulse rounded-lg mb-4" />
        <Card className="p-8 border border-border bg-surface text-center">
          <Spinner size="lg" color="current" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-outfit max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-surface border border-border text-foreground select-none">
        <div className="space-y-1">
          <Typography type="h2" className="text-xl font-bold flex items-center gap-2 text-foreground font-outfit">
            Company Console
            <Building2 size={20} className="text-accent" />
          </Typography>
          <Typography type="body-xs" className="text-muted font-medium mt-0.5 font-outfit">
            Manage your hiring workspaces, subscription plans, and team role hierarchies.
          </Typography>
        </div>
        <div className="flex gap-2.5 items-center">
          <Button 
            variant="primary" 
            onClick={() => setIsCreateWorkspaceModalOpen(true)}
            className="bg-accent hover:bg-accent/90 text-white border-none shrink-0 cursor-pointer font-bold text-xs rounded-xl px-4 py-2"
          >
            <Plus size={14} className="mr-1.5" />
            Create Workspace
          </Button>
          <BusinessVerificationBadge level={workspaceDetails?.verificationLevel} />
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 select-none">
        {/* KPI 1: Active Workspaces */}
        <Card className="p-6 bg-surface border border-border rounded-xl">
          <div className="flex justify-between items-start mb-4">
            <div>
              <Typography type="body-xs" className="text-muted uppercase font-bold block mb-1 tracking-wider">
                Operational Workspaces
              </Typography>
              <Typography type="h2" className="text-3xl font-extrabold tracking-tight text-foreground font-outfit">
                {workspaces.length}
              </Typography>
            </div>
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              <Building2 size={18} />
            </div>
          </div>
          <Typography type="body-xs" className="text-muted font-medium">
            Active recruiting departments
          </Typography>
        </Card>

        {/* KPI 2: Saved Talent Pool */}
        <Card className="p-6 bg-surface border border-border rounded-xl">
          <div className="flex justify-between items-start mb-4">
            <div>
              <Typography type="body-xs" className="text-muted uppercase font-bold block mb-1 tracking-wider">
                Talent Pool
              </Typography>
              <Typography type="h2" className="text-3xl font-extrabold tracking-tight text-foreground font-outfit">
                32
              </Typography>
            </div>
            <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center">
              <Bookmark size={18} />
            </div>
          </div>
          <Typography type="body-xs" className="text-muted font-medium">
            Candidates saved across workspaces
          </Typography>
        </Card>

        {/* KPI 3: Company Member Count */}
        <Card className="p-6 bg-surface border border-border rounded-xl">
          <div className="flex justify-between items-start mb-4">
            <div>
              <Typography type="body-xs" className="text-muted uppercase font-bold block mb-1 tracking-wider">
                Ecosystem Discoveries
              </Typography>
              <Typography type="h2" className="text-3xl font-extrabold tracking-tight text-foreground font-outfit">
                128
              </Typography>
            </div>
            <div className="w-10 h-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center">
              <Compass size={18} />
            </div>
          </div>
          <Typography type="body-xs" className="text-muted font-medium">
            Registry developer searches run
          </Typography>
        </Card>
      </div>

      {/* Main Content Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workspaces List Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 bg-surface border border-border rounded-2xl">
            <div className="flex justify-between items-center mb-6 select-none">
              <div>
                <Typography type="h3" className="font-bold text-foreground font-outfit">
                  Operational Workspaces
                </Typography>
                <Typography type="body-xs" className="text-muted mt-0.5">
                  Select a workspace to manage jobs, pipeline stages, and screen candidates.
                </Typography>
              </div>
              <Button 
                onClick={() => setIsCreateWorkspaceModalOpen(true)}
                className="bg-default hover:bg-default/80 text-foreground text-xs font-bold px-3 py-1.5 rounded-xl border border-border cursor-pointer flex items-center gap-1.5"
              >
                <Plus size={14} /> New Workspace
              </Button>
            </div>

            {workspaces.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border rounded-xl select-none">
                <Typography type="body-xs" className="text-muted italic">
                  No active workspaces found. Create a workspace to launch hiring.
                </Typography>
              </div>
            ) : (
              <div className="divide-y divide-separator">
                {workspaces.map((w) => (
                  <div key={w.id} className="flex justify-between items-center py-4 first:pt-0 last:pb-0">
                    <div className="space-y-0.5 min-w-0">
                      <Typography type="body-xs" className="font-bold text-foreground truncate block font-outfit">
                        {w.displayName}
                      </Typography>
                      <span className="text-[10px] text-muted font-mono truncate block">
                        @{w.slug}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleOpenWorkspace(w.id)}
                      className="bg-accent hover:bg-accent/90 text-white font-bold text-[10px] px-3 py-1.5 rounded-xl border-none cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      Open Workspace <ArrowRight size={12} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Quick Actions Panel */}
        <div className="space-y-6">
          <Card className="p-6 bg-surface border border-border rounded-2xl space-y-4">
            <Typography type="h4" className="font-bold text-foreground font-outfit select-none">
              Quick Actions
            </Typography>
            <div className="flex flex-col gap-2.5">
              <Button
                onClick={() => router.push(`/organization/${organizationSlug}/intelligence`)}
                className="w-full justify-start text-xs font-bold h-10 px-3 bg-surface-secondary/40 hover:bg-surface-secondary/80 border border-border text-foreground rounded-xl flex items-center gap-2.5 cursor-pointer text-left"
              >
                <Compass size={16} className="text-accent shrink-0" />
                Global Candidate Search
              </Button>
              <Button
                onClick={() => router.push(`/organization/${organizationSlug}/billing`)}
                className="w-full justify-start text-xs font-bold h-10 px-3 bg-surface-secondary/40 hover:bg-surface-secondary/80 border border-border text-foreground rounded-xl flex items-center gap-2.5 cursor-pointer text-left"
              >
                <CreditCard size={16} className="text-accent shrink-0" />
                Subscription & Billing
              </Button>
              <Button
                onClick={() => router.push(`/organization/${organizationSlug}/verification`)}
                className="w-full justify-start text-xs font-bold h-10 px-3 bg-surface-secondary/40 hover:bg-surface-secondary/80 border border-border text-foreground rounded-xl flex items-center gap-2.5 cursor-pointer text-left"
              >
                <ShieldCheck size={16} className="text-accent shrink-0" />
                Legal Verification Status
              </Button>
              <Button
                onClick={() => router.push(`/organization/${organizationSlug}/settings`)}
                className="w-full justify-start text-xs font-bold h-10 px-3 bg-surface-secondary/40 hover:bg-surface-secondary/80 border border-border text-foreground rounded-xl flex items-center gap-2.5 cursor-pointer text-left"
              >
                <Settings size={16} className="text-accent shrink-0" />
                Organization Settings
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <CreateWorkspaceModal
        isOpen={isCreateWorkspaceModalOpen}
        onOpenChange={setIsCreateWorkspaceModalOpen}
        organizationSlug={organizationSlug}
        onSuccess={() => {
          if (organizationSlug) {
            fetchWorkspace(organizationSlug);
          }
        }}
      />
    </div>
  );
}
