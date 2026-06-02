"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/features/workspace/store/use-workspace-store";
import { useActiveWorkspace } from "@/features/workspace/hooks/use-active-workspace";
import { CreateWorkspaceModal } from "@/features/workspace/components/create-workspace-modal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Typography, Spinner } from "@heroui/react";
import { Building2, Plus, ArrowRight, FolderOpen } from "lucide-react";
import { BusinessVerificationBadge } from "@/components/ui/cverify/verification-badges";

export default function WorkspacesDirectoryPage() {
  const params = useParams();
  const router = useRouter();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  const fetchWorkspace = useWorkspaceStore((s) => s.fetchWorkspace);
  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[organizationSlug]);
  const isDetailsLoading = useWorkspaceStore((s) => s.loading[organizationSlug]);

  const { activeWorkspaceId, setActiveWorkspaceId } = useActiveWorkspace(organizationSlug);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    if (organizationSlug) {
      fetchWorkspace(organizationSlug);
    }
  }, [organizationSlug, fetchWorkspace]);

  const workspaces = workspaceDetails?.workspaces || [];

  const handleOpenWorkspace = (id: string) => {
    setActiveWorkspaceId(id);
    router.push(`/business/${organizationSlug}/recruitment/dashboard`);
  };

  if (isDetailsLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 font-outfit text-foreground select-none">
        <div className="h-10 w-48 bg-separator/50 animate-pulse rounded-lg mb-4" />
        <Card className="p-0 overflow-hidden">
          <Spinner size="lg" className="mx-auto my-12" color="current" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-outfit max-w-7xl mx-auto text-foreground p-4">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-surface border border-border text-foreground select-none">
        <div className="space-y-1">
          <Typography type="h2" className="text-2xl font-bold flex items-center gap-2 text-foreground font-outfit">
            <Building2 size={24} className="text-accent" />
            Workspaces Directory
          </Typography>
          <Typography type="body-xs" className="text-muted font-medium mt-0.5 font-outfit">
            Manage your company's operational hiring teams, university outreach initiatives, and recruiting workflows.
          </Typography>
        </div>
        <div className="flex gap-2.5 items-center">
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-accent hover:bg-accent/90 text-white font-bold text-xs rounded-xl px-4 py-2 cursor-pointer border-none"
          >
            <Plus size={14} className="mr-1.5" /> Create Workspace
          </Button>
          <BusinessVerificationBadge level={workspaceDetails?.verificationLevel} />
        </div>
      </div>

      {/* Directory list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workspaces.length === 0 ? (
          <Card className="col-span-full p-12 text-center border border-dashed border-border/80 bg-surface select-none">
            <Typography type="h4" className="font-bold text-foreground mb-2">
              No Workspaces Configured
            </Typography>
            <Typography type="body-xs" className="text-muted max-w-md mx-auto mb-6">
              Create an operational environment to manage job listings, review evidence portfolios, and configure pipelines.
            </Typography>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-foreground text-background font-bold rounded-xl px-6 py-2.5 cursor-pointer border-none"
            >
              Add First Workspace
            </Button>
          </Card>
        ) : (
          workspaces.map((w) => {
            const isActive = w.id === activeWorkspaceId;
            return (
              <Card
                key={w.id}
                className={`p-6 bg-surface border hover:border-accent/40 transition-colors duration-200 rounded-2xl flex flex-col justify-between h-44 ${isActive ? "border-accent/50 shadow-xs" : "border-border"}`}
              >
                <div className="space-y-1.5 select-none">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center font-bold text-sm border border-accent/20">
                      {w.displayName[0]?.toUpperCase()}
                    </div>
                    {isActive && (
                      <span className="text-[10px] font-bold text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Active context
                      </span>
                    )}
                  </div>
                  <Typography type="body-xs" className="font-bold text-foreground truncate block font-outfit text-sm">
                    {w.displayName}
                  </Typography>
                  <span className="text-[10px] text-muted font-mono block">
                    @{w.slug}
                  </span>
                </div>
                <div className="flex justify-end pt-4">
                  <Button
                    size="sm"
                    onClick={() => handleOpenWorkspace(w.id)}
                    className="bg-default hover:bg-default/80 text-foreground font-bold text-xs px-3.5 py-1.5 rounded-xl border border-border cursor-pointer flex items-center gap-1.5"
                  >
                    Open Workspace <ArrowRight size={14} />
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <CreateWorkspaceModal
        isOpen={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
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
