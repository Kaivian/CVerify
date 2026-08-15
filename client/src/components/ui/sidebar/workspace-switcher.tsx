"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Popover, Avatar, Typography, Button } from "@heroui/react";
import { ChevronsUpDown, Plus, Search, Check } from "lucide-react";
import { useWorkspaceStore } from "../../../features/workspace/store/use-workspace-store";
import { useAuth } from "../../../features/auth/hooks/use-auth";
import { useActiveWorkspace } from "../../../features/workspace/hooks/use-active-workspace";
import { CreateWorkspaceModal } from "../../../features/workspace/components/create-workspace-modal";

interface WorkspaceSwitcherProps {
  collapsed: boolean;
  isMobile?: boolean;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({ collapsed, isMobile = false }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchMyOrganizations = useWorkspaceStore((s) => s.fetchMyOrganizations);
  const myOrganizations = useWorkspaceStore((s) => s.myOrganizations);
  const workspacesStore = useWorkspaceStore((s) => s.workspaces);
  const fetchWorkspace = useWorkspaceStore((s) => s.fetchWorkspace);

  // Fetch organizations list on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchMyOrganizations();
    }
  }, [isAuthenticated, fetchMyOrganizations]);

  // Derive active organization slug directly from URL segment
  const activeWorkspaceSlug = useMemo(() => {
    if (pathname?.startsWith("/business/")) {
      const slug = pathname.split("/business/")[1]?.split("/")[0] || "";
      if (slug === "organizations") return "";
      return slug;
    }
    return "";
  }, [pathname]);

  // Fallback organization slug if not currently in a workspace path
  const currentOrgSlug = useMemo(() => {
    if (activeWorkspaceSlug) return activeWorkspaceSlug;
    return myOrganizations && myOrganizations.length > 0 ? myOrganizations[0].slug : "";
  }, [activeWorkspaceSlug, myOrganizations]);

  // Fetch details for active organization to retrieve workspaces
  useEffect(() => {
    if (currentOrgSlug) {
      fetchWorkspace(currentOrgSlug);
    }
  }, [currentOrgSlug, fetchWorkspace]);

  // Active sub-workspaces hook
  const { activeWorkspaceId, setActiveWorkspaceId, workspaces: subWorkspaces } = useActiveWorkspace(currentOrgSlug);
  const activeWorkspaceObj = useMemo(() => subWorkspaces.find(w => w.id === activeWorkspaceId), [subWorkspaces, activeWorkspaceId]);

  // Deterministic avatar monogram
  const getMonogram = (name: string) => {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  // Deterministic background gradient based on ID hash
  const getDeterministicGradient = (id: string) => {
    const gradients = [
      "bg-linear-to-tr from-amber-500 to-orange-600 text-white",
      "bg-linear-to-tr from-blue-500 to-indigo-600 text-white",
      "bg-linear-to-tr from-emerald-500 to-green-600 text-white",
      "bg-linear-to-tr from-purple-500 to-violet-600 text-white",
      "bg-linear-to-tr from-pink-500 to-rose-600 text-white",
      "bg-linear-to-tr from-cyan-500 to-teal-600 text-white",
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  };

  // Switch active enterprise organization context
  const handleSwitchOrganization = (orgSlug: string) => {
    setIsOpen(false);
    setSearchQuery("");
    fetchWorkspace(orgSlug);
    router.push(`/business/${orgSlug}/dashboard`);
  };

  // Switch sub-workspace within current organization context
  const handleSwitchWorkspace = (id: string) => {
    setIsOpen(false);
    setSearchQuery("");
    setActiveWorkspaceId(id);
    router.push(`/business/${currentOrgSlug}/recruitment/dashboard`);
  };

  const handleCreateWorkspace = () => {
    setIsOpen(false);
    setSearchQuery("");
    setIsCreateModalOpen(true);
  };

  // Resolve active organization and workspace details
  const activeOrg = useMemo(() => {
    if (!myOrganizations || myOrganizations.length === 0) return null;
    return myOrganizations.find((o) => o.slug.toLowerCase() === currentOrgSlug.toLowerCase()) || myOrganizations[0];
  }, [myOrganizations, currentOrgSlug]);

  const activeName = activeOrg?.name || activeWorkspaceObj?.displayName || "Select Organization";
  const activeSubName = activeWorkspaceObj?.displayName
    ? activeWorkspaceObj.displayName
    : activeOrg
      ? `@${activeOrg.slug}`
      : "Enterprise Workspace";

  const activeMonogram = getMonogram(activeName);
  const activeGradient = getDeterministicGradient(activeOrg?.slug || currentOrgSlug || "default");

  // Filter organizations list based on search query
  const filteredOrganizations = useMemo(() => {
    if (!myOrganizations) return [];
    if (!searchQuery.trim()) return myOrganizations;
    return myOrganizations.filter(
      (o) =>
        o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [myOrganizations, searchQuery]);

  // Loading skeleton state
  if (myOrganizations === null) {
    return (
      <div className="w-full flex items-center gap-3 select-none px-3 py-2">
        <div className={[
          "rounded-lg bg-muted/20 animate-pulse shrink-0",
          isMobile ? "w-8 h-8" : "w-7 h-7"
        ].join(" ")} />
        {!collapsed && (
          <div className="flex-1 space-y-1 min-w-0">
            <div className="h-2.5 w-24 bg-muted/20 animate-pulse rounded-md" />
            <div className="h-2 w-12 bg-muted/10 animate-pulse rounded-sm" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 select-none">
      <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger className={collapsed ? "" : "w-full"}>
          <button
            type="button"
            className={[
              "w-full min-w-0 flex items-center transition-all duration-200 cursor-pointer border-none select-none text-left outline-hidden",
              isMobile
                ? "h-12 px-3.5 gap-3 rounded-xl bg-surface-secondary/20 hover:bg-surface-secondary/50 text-foreground"
                : collapsed
                  ? "h-10 w-10 justify-center p-0 rounded-full bg-surface-secondary/20 hover:bg-surface-secondary/50 text-foreground mx-auto"
                  : "h-10 px-3 gap-2 rounded-xl bg-surface-secondary/20 hover:bg-surface-secondary/50 text-foreground"
            ].join(" ")}
          >
            {/* Active Avatar */}
            <div className="relative shrink-0">
              <Avatar className={[
                "font-bold font-outfit border border-border shrink-0",
                isMobile
                  ? "w-8 h-8 text-[11px] rounded-lg"
                  : collapsed
                    ? "w-8 h-8 text-[11px] rounded-full"
                    : "w-7 h-7 text-[10px] rounded-lg",
                activeGradient
              ].join(" ")}>
                <Avatar.Fallback>
                  {activeMonogram}
                </Avatar.Fallback>
              </Avatar>
            </div>

            {/* Active Workspace / Organization Info */}
            {!collapsed && (
              <div className="flex-1 min-w-0 max-w-40 md:max-w-35 flex flex-col text-left">
                <Typography type="body-xs" className="font-bold text-foreground font-outfit leading-none truncate block w-full pr-1">
                  {activeName}
                </Typography>
                <span className="text-[9px] text-muted font-medium font-outfit truncate block w-full mt-0.5">
                  {activeSubName}
                </span>
              </div>
            )}

            {/* Switcher Indicator Icon */}
            {!collapsed && (
              <ChevronsUpDown size={13} className="text-muted/70 shrink-0 mr-0.5" />
            )}
          </button>
        </Popover.Trigger>

        <Popover.Content placement={collapsed ? "right" : "top start"} className="min-w-70 w-max max-w-120 p-1.5 bg-background border-2 border-border rounded-2xl shadow-overlay z-9999">
          <div className="flex flex-col w-full font-outfit text-foreground outline-hidden">
            {/* 1. Search Filter */}
            {((myOrganizations && myOrganizations.length > 3) || subWorkspaces.length > 3) && (
              <div className="p-1 pb-2 flex items-center border-b border-separator/40 mb-1">
                <div className="relative w-full flex items-center bg-surface-secondary rounded-lg px-2 h-8 border border-border/50">
                  <Search size={13} className="text-muted shrink-0 mr-1.5" />
                  <input
                    type="text"
                    placeholder="Search organizations & workspaces..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs font-semibold bg-transparent border-none text-foreground outline-hidden placeholder:text-muted/60"
                  />
                </div>
              </div>
            )}

            <div className="max-h-72 overflow-y-auto flex flex-col gap-2 custom-scrollbar pr-0.5">
              {/* 2. Joined Organizations Section */}
              {myOrganizations && myOrganizations.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  <span className="px-2.5 pt-1 pb-0.5 text-[10px] font-bold text-muted/60 uppercase tracking-wider select-none">
                    Joined Organizations
                  </span>
                  {filteredOrganizations.map((org) => {
                    const isActive = org.slug.toLowerCase() === currentOrgSlug.toLowerCase();
                    const orgMonogram = getMonogram(org.name);
                    const orgGradient = getDeterministicGradient(org.slug);

                    return (
                      <button
                        key={org.slug}
                        onClick={() => handleSwitchOrganization(org.slug)}
                        className={[
                          "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 text-left border-none bg-transparent hover:bg-surface-secondary focus:bg-surface-secondary cursor-pointer select-none",
                          isActive ? "bg-accent/10 font-bold text-accent" : "font-semibold text-foreground"
                        ].join(" ")}
                      >
                        <Avatar className={["w-8 h-8 rounded-lg font-bold font-outfit text-[10px] border border-border shrink-0", orgGradient].join(" ")}>
                          <Avatar.Fallback>{orgMonogram}</Avatar.Fallback>
                        </Avatar>

                        <div className="flex-1 min-w-0 text-left">
                          <Typography type="body-xs" className={["truncate pr-1", isActive ? "font-bold text-accent" : "font-semibold text-foreground"].join(" ")}>
                            {org.name}
                          </Typography>
                          <span className="text-[9px] text-muted block -mt-0.5">
                            @{org.slug}
                          </span>
                        </div>

                        {isActive && <Check size={14} className="text-accent shrink-0 ml-1 mr-0.5" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 3. Active Sub-Workspaces Section */}
              {subWorkspaces.length > 0 && (
                <div className="flex flex-col gap-0.5 border-t border-separator/40 pt-1.5">
                  <span className="px-2.5 pb-0.5 text-[10px] font-bold text-muted/60 uppercase tracking-wider select-none">
                    Workspaces ({activeOrg?.name || currentOrgSlug})
                  </span>
                  {subWorkspaces.map((w) => {
                    const isActive = w.id === activeWorkspaceId;
                    const wMonogram = getMonogram(w.displayName);
                    const wGradient = getDeterministicGradient(w.id);

                    return (
                      <button
                        key={w.id}
                        onClick={() => handleSwitchWorkspace(w.id)}
                        className={[
                          "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 text-left border-none bg-transparent hover:bg-surface-secondary focus:bg-surface-secondary cursor-pointer select-none",
                          isActive ? "bg-accent/5 font-bold" : "font-semibold"
                        ].join(" ")}
                      >
                        <Avatar className={["w-7 h-7 rounded-lg font-bold font-outfit text-[9px] border border-border shrink-0", wGradient].join(" ")}>
                          <Avatar.Fallback>{wMonogram}</Avatar.Fallback>
                        </Avatar>

                        <div className="flex-1 min-w-0 text-left">
                          <Typography type="body-xs" className={["truncate pr-1 text-foreground", isActive ? "font-bold" : "font-semibold"].join(" ")}>
                            {w.displayName}
                          </Typography>
                          <span className="text-[9px] text-muted block -mt-0.5">
                            @{w.slug}
                          </span>
                        </div>

                        {isActive && <Check size={14} className="text-accent shrink-0 ml-1 mr-0.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. Action panel: create new workspace */}
            <div className="border-t border-separator/50 mt-1.5 pt-1.5 flex flex-col gap-0.5">
              <button
                onClick={handleCreateWorkspace}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left border-none bg-transparent hover:bg-surface-secondary focus:bg-surface-secondary text-muted hover:text-foreground cursor-pointer font-bold text-xs select-none transition-colors duration-150"
              >
                <div className="w-8 h-8 rounded-lg bg-surface-secondary/80 text-muted flex items-center justify-center shrink-0 border border-dashed border-border/80">
                  <Plus size={14} />
                </div>
                <span>Create Workspace</span>
              </button>
            </div>
          </div>
        </Popover.Content>
      </Popover>

      {currentOrgSlug && (
        <CreateWorkspaceModal
          isOpen={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          organizationSlug={currentOrgSlug}
          onSuccess={() => {
            if (currentOrgSlug) {
              fetchWorkspace(currentOrgSlug);
            }
          }}
        />
      )}
    </div>
  );
};

export default WorkspaceSwitcher;
