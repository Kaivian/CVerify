"use client";

import React from "react";
import { ScrollShadow } from "@heroui/react";
import { useSidebarStore } from "../../../stores/use-sidebar-store";
import SidebarBrand from "./sidebar-brand";
import SidebarContent from "./sidebar-content";
import WorkspaceSwitcher from "./workspace-switcher";
import { useAuth } from "../../../features/auth/hooks/use-auth";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useSidebarMode } from "../../../providers/sidebar-mode-provider";
import { useActiveWorkspace } from "../../../features/workspace/hooks/use-active-workspace";
import { useWorkspaceStore } from "../../../features/workspace/store/use-workspace-store";
import Link from "next/link";

export const SidebarDesktop: React.FC = () => {
  const isCollapsed = useSidebarStore((state) => state.isCollapsed);
  const { user } = useAuth();
  const userRole = user?.role || "USER";

  const pathname = usePathname();
  const { sidebarMode } = useSidebarMode();
  const myOrganizations = useWorkspaceStore((s) => s.myOrganizations);

  // Derive active workspace slug directly from URL path segment
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

  const { activeWorkspaceId, workspaces } = useActiveWorkspace(currentOrgSlug);
  const activeWorkspaceObj = useMemo(() => workspaces.find(w => w.id === activeWorkspaceId), [workspaces, activeWorkspaceId]);
  const activeWorkspaceName = activeWorkspaceObj?.displayName || "Select Workspace";

  return (
    <div className="hidden md:flex flex-col h-screen sticky top-0 items-center justify-center">
      <aside
        className={[
          "flex flex-col h-[calc(100vh-24px)] mx-3 border-2 rounded-2xl transition-all duration-300 ease-in-out z-20 overflow-hidden bg-background",
          isCollapsed ? "w-16" : "w-64",
        ].join(" ")}
      >
        {/* 1. Header Branding */}
        <SidebarBrand collapsed={isCollapsed} />

        {/* 2. Fixed Active Workspace Banner (Desktop only, expanded only) */}
        {sidebarMode === "COMPANY" && activeWorkspaceObj && !isCollapsed && (
          <div className="px-3 pt-2 pb-1 select-none w-full shrink-0">
            <Link
              href={`/business/${currentOrgSlug}/recruitment/dashboard`}
              className="flex items-center justify-between p-2 rounded-xl border border-accent/20 bg-accent/5 hover:bg-accent/10 transition-colors duration-200 cursor-pointer"
            >
              <div className="flex flex-col min-w-0">
                <span className="text-[8px] text-accent font-bold uppercase tracking-wider">Active Workspace</span>
                <span className="text-[11px] font-bold text-foreground truncate">{activeWorkspaceName}</span>
              </div>
              <span className="text-[9px] font-bold text-accent shrink-0 ml-1.5 bg-accent/10 px-1.5 py-0.5 rounded-md border border-accent/20">Open →</span>
            </Link>
          </div>
        )}

        {/* 3. Centralized Scrollable Menu Area wrapped in HeroUI ScrollShadow */}
        <ScrollShadow className="flex-1 px-3 py-4 flex flex-col gap-4 overflow-y-auto min-h-0">
          <SidebarContent 
            collapsed={isCollapsed} 
            isMobile={false} 
            hideSwitcher={true} 
            hideActiveWorkspaceBanner={true} 
          />
        </ScrollShadow>

        {/* 4. Fixed Organization Switcher at the bottom */}
        {(userRole === "BUSINESS" || userRole === "ADMIN") && (
          <div className="p-3 border-t border-separator/50 w-full shrink-0 min-w-0 bg-background z-10">
            <WorkspaceSwitcher collapsed={isCollapsed} isMobile={false} />
          </div>
        )}
      </aside>
    </div>
  );
};

export default SidebarDesktop;
