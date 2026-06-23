"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Popover, Avatar, Typography, Button } from "@heroui/react";
import { ChevronsUpDown, Plus, Search, Check, Building2 } from "lucide-react";
import { useWorkspaceStore } from "../../../features/workspace/store/use-workspace-store";
import { useAuth } from "../../../features/auth/hooks/use-auth";

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

  const fetchMyOrganizations = useWorkspaceStore((s) => s.fetchMyOrganizations);
  const myOrganizations = useWorkspaceStore((s) => s.myOrganizations);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const fetchWorkspace = useWorkspaceStore((s) => s.fetchWorkspace);

  // Fetch workspaces list on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchMyOrganizations();
    }
  }, [isAuthenticated, fetchMyOrganizations]);

  // Derive active workspace slug directly from URL segment
  const activeWorkspaceSlug = useMemo(() => {
    if (pathname?.startsWith("/workspace/")) {
      const slug = pathname.split("/workspace/")[1]?.split("/")[0] || "";
      if (slug === "organizations") return "";
      return slug;
    }
    return "";
  }, [pathname]);

  // Fallback active organization if not on a workspace path
  const activeOrg = useMemo(() => {
    if (!myOrganizations || myOrganizations.length === 0) return null;
    
    // If we have an active slug, find it in the list
    if (activeWorkspaceSlug) {
      const found = myOrganizations.find(org => org.slug === activeWorkspaceSlug);
      if (found) return found;
    }
    
    // Otherwise fallback to first organization
    return myOrganizations[0];
  }, [activeWorkspaceSlug, myOrganizations]);

  // Fetch details for active organization to retrieve logoUrl
  useEffect(() => {
    if (activeOrg?.slug) {
      fetchWorkspace(activeOrg.slug);
    }
  }, [activeOrg?.slug, fetchWorkspace]);

  const activeDetails = useMemo(() => {
    return activeOrg ? workspaces[activeOrg.slug] : null;
  }, [activeOrg, workspaces]);

  // Deterministic avatar monogram
  const getMonogram = (name: string) => {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  // Deterministic background gradient based on slug hash
  const getDeterministicGradient = (slug: string) => {
    const gradients = [
      "bg-linear-to-tr from-amber-500 to-orange-600 text-white",
      "bg-linear-to-tr from-blue-500 to-indigo-600 text-white",
      "bg-linear-to-tr from-emerald-500 to-green-600 text-white",
      "bg-linear-to-tr from-purple-500 to-violet-600 text-white",
      "bg-linear-to-tr from-pink-500 to-rose-600 text-white",
      "bg-linear-to-tr from-cyan-500 to-teal-600 text-white",
    ];
    let hash = 0;
    for (let i = 0; i < slug.length; i++) {
      hash = slug.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  };

  // Filter organizations list based on search query
  const filteredOrgs = useMemo(() => {
    if (!myOrganizations) return [];
    if (!searchQuery.trim()) return myOrganizations;
    return myOrganizations.filter((org) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [myOrganizations, searchQuery]);

  const handleSwitchWorkspace = (slug: string) => {
    setIsOpen(false);
    setSearchQuery("");
    
    // Preserve sub-path (e.g. settings, members) if switching from workspace page
    if (pathname?.startsWith("/workspace/")) {
      const segments = pathname.split("/");
      if (segments[2] && segments[2] !== "organizations") {
        segments[2] = slug;
        router.push(segments.join("/"));
        return;
      }
    }
    
    // Default fallback to dashboard
    router.push(`/workspace/${slug}/dashboard`);
  };

  const handleCreateWorkspace = () => {
    setIsOpen(false);
    setSearchQuery("");
    router.push("/workspace-setup");
  };

  // 1. Loading state (No workspaces list loaded yet)
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

  // 2. Empty state (User has no workspaces)
  if (myOrganizations.length === 0) {
    return (
      <div className="w-full flex flex-col gap-2 select-none px-3 py-1">
        <Button
          onClick={handleCreateWorkspace}
          className="w-full h-9 bg-accent hover:bg-accent/90 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer border-none shrink-0"
        >
          <Plus size={14} />
          Create Workspace
        </Button>
      </div>
    );
  }

  // Active workspace styling details
  const activeName = activeOrg?.name || "Select Workspace";
  const activeSlug = activeOrg?.slug || "";
  const activeLogo = activeDetails?.logoUrl;
  const activeMonogram = getMonogram(activeName);
  const activeGradient = getDeterministicGradient(activeSlug);

  return (
    <div className="w-full min-w-0 select-none">
      <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger>
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
            {/* Active Workspace Avatar */}
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
                {activeLogo && (
                  <Avatar.Image src={activeLogo} alt={activeName} />
                )}
                <Avatar.Fallback>
                  {activeMonogram}
                </Avatar.Fallback>
              </Avatar>
            </div>

            {/* Active Workspace Label Info */}
            {!collapsed && (
              <div className="flex-1 min-w-0 max-w-[160px] md:max-w-[140px] flex flex-col text-left">
                <Typography type="body-xs" className="font-bold text-foreground font-outfit leading-none truncate block w-full pr-1">
                  {activeName}
                </Typography>
                <span className="text-[9px] text-muted font-medium font-outfit truncate block w-full mt-0.5">
                  Business Workspace
                </span>
              </div>
            )}

            {/* Switcher Indicator Icon */}
            {!collapsed && (
              <ChevronsUpDown size={13} className="text-muted/70 shrink-0 mr-0.5" />
            )}
          </button>
        </Popover.Trigger>

        <Popover.Content placement={collapsed ? "right" : "top start"} className="min-w-[272px] w-max max-w-[480px] p-1.5 bg-background border-2 border-border rounded-2xl shadow-overlay z-9999">
          <div className="flex flex-col w-full font-outfit text-foreground outline-hidden">
            {/* 1. Switcher Search filter */}
            {myOrganizations.length > 5 && (
              <div className="p-1 pb-2 flex items-center border-b border-separator/40 mb-1">
                <div className="relative w-full flex items-center bg-surface-secondary rounded-lg px-2 h-8 border border-border/50">
                  <Search size={13} className="text-muted shrink-0 mr-1.5" />
                  <input
                    type="text"
                    placeholder="Search workspaces..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs font-semibold bg-transparent border-none text-foreground outline-hidden placeholder:text-muted/60"
                  />
                </div>
              </div>
            )}

            {/* 2. Scrollable organizations list */}
            <div className="max-h-60 overflow-y-auto flex flex-col gap-0.5 custom-scrollbar pr-0.5">
              {filteredOrgs.length === 0 ? (
                <div className="py-6 px-3 text-center text-xs font-semibold text-muted select-none">
                  No matching workspaces
                </div>
              ) : (
                filteredOrgs.map((org) => {
                  const isActive = org.slug === activeSlug;
                  const orgLogo = workspaces[org.slug]?.logoUrl;
                  const orgMonogram = getMonogram(org.name);
                  const orgGradient = getDeterministicGradient(org.slug);

                  return (
                    <button
                      key={org.slug}
                      onClick={() => handleSwitchWorkspace(org.slug)}
                      className={[
                        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 text-left border-none bg-transparent hover:bg-surface-secondary focus:bg-surface-secondary cursor-pointer select-none",
                        isActive ? "bg-accent/5 font-bold" : "font-semibold"
                      ].join(" ")}
                    >
                      {/* Workspace Avatar */}
                      <Avatar className={["w-8 h-8 rounded-lg font-bold font-outfit text-[10px] border border-border shrink-0", orgGradient].join(" ")}>
                        {orgLogo && (
                          <Avatar.Image src={orgLogo} alt={org.name} />
                        )}
                        <Avatar.Fallback>
                          {orgMonogram}
                        </Avatar.Fallback>
                      </Avatar>

                      {/* Workspace Name */}
                      <div className="flex-1 min-w-0 text-left">
                        <Typography type="body-xs" className={["truncate pr-1 text-foreground", isActive ? "font-bold" : "font-semibold"].join(" ")}>
                          {org.name}
                        </Typography>
                        <span className="text-[9px] text-muted block -mt-0.5">
                          @{org.slug}
                        </span>
                      </div>

                      {/* Checkmark indicator */}
                      {isActive && (
                        <Check size={14} className="text-accent shrink-0 ml-1 mr-0.5" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* 3. Action panel: create new */}
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
    </div>
  );
};

export default WorkspaceSwitcher;
