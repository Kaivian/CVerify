"use client";

import React, { useMemo, useEffect, useState } from "react";
import { useAuth } from "../../../features/auth/hooks/use-auth";
import {
  companyNavigationConfig,
  workspaceNavigationConfig,
  candidateNavigationConfig,
  adminNavigationConfig
} from "../../../config/navigation-config";
import { useSidebarMode } from "../../../providers/sidebar-mode-provider";
import { useActiveWorkspace } from "../../../features/workspace/hooks/use-active-workspace";
import { filterNavigationNodes } from "../../../lib/navigation-utils";
import { isModuleEnabled } from "../../../lib/utils/feature-flags";
import SidebarLink from "./sidebar-link";
import SidebarGroup from "./sidebar-group";
import SidebarSection from "./sidebar-section";
import WorkspaceSwitcher from "./workspace-switcher";
import { useWorkspace } from "../../../providers/workspace-provider";
import { useWorkspaceStore } from "../../../features/workspace/store/use-workspace-store";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Tooltip } from "@heroui/react";
import {
  LayoutDashboard,
  Orbit,
  FlaskConical,
  Boxes,
  LayoutGrid,
  Blocks,
  Beaker,
  AlertTriangle,
  Network,
  BarChart3,
  Settings,
  ArrowLeft,
  BookOpen
} from "lucide-react";
import { type NavigationNode } from "../../../types/navigation.types";

interface SidebarContentProps {
  collapsed: boolean;
  isMobile: boolean;
  hideSwitcher?: boolean;
  hideActiveWorkspaceBanner?: boolean;
}

export const SidebarContent: React.FC<SidebarContentProps> = ({
  collapsed,
  isMobile,
  hideSwitcher = false,
  hideActiveWorkspaceBanner = false,
}) => {
  const { user, isAuthenticated, hasPermission } = useAuth();
  const userRole = user?.role || "USER";

  const { activeWorkspace } = useWorkspace();
  const { sidebarMode } = useSidebarMode();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeView = searchParams?.get("view") || "overview";

  const fetchMyOrganizations = useWorkspaceStore((s) => s.fetchMyOrganizations);
  const myOrganizations = useWorkspaceStore((s) => s.myOrganizations);
  const workspacesStore = useWorkspaceStore((s) => s.workspaces);
  const fetchWorkspace = useWorkspaceStore((s) => s.fetchWorkspace);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchMyOrganizations();
    }
  }, [isAuthenticated, user, fetchMyOrganizations]);

  const pathname = usePathname();

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

  // Fetch workspace details to run permission checks
  useEffect(() => {
    if (currentOrgSlug) {
      fetchWorkspace(currentOrgSlug);
    }
  }, [currentOrgSlug, fetchWorkspace]);

  const workspaceDetails = useMemo(() => {
    return currentOrgSlug ? workspacesStore[currentOrgSlug] : null;
  }, [currentOrgSlug, workspacesStore]);

  const workspacePermissions = useMemo(() => workspaceDetails?.permissions || [], [workspaceDetails]);
  const workspaceUserRole = useMemo(() => workspaceDetails?.userRole || null, [workspaceDetails]);

  // Active sub-workspaces hook
  const { activeWorkspaceId, setActiveWorkspaceId, workspaces } = useActiveWorkspace(currentOrgSlug);
  const activeWorkspaceObj = useMemo(() => workspaces.find(w => w.id === activeWorkspaceId), [workspaces, activeWorkspaceId]);
  const activeWorkspaceName = activeWorkspaceObj?.displayName || "Select Workspace";

  // Helper check for role & permissions at workspace level
  const hasWorkspaceAccess = (node: NavigationNode) => {
    const reqPerms = node.requiredWorkspacePermissions;
    if (reqPerms && reqPerms.length > 0) {
      // Strictly permission-based checking (no role-specific bypasses)
      const hasPerm = reqPerms.some((p) => workspacePermissions.includes(p));
      if (!hasPerm) return false;
    }

    const reqRoles = node.requiredWorkspaceRoles;
    if (reqRoles && reqRoles.length > 0) {
      if (!workspaceUserRole || !reqRoles.includes(workspaceUserRole)) {
        return false;
      }
    }

    return true;
  };

  // Helper to substitute workspace slug and username in href
  const resolveNodeHref = (node: NavigationNode): NavigationNode => {
    const username = user?.username ? user.username.toLowerCase() : "";
    const replaceTokens = (str: string) => {
      let result = str.replace(/\[slug\]/g, currentOrgSlug).replace(/:slug/g, currentOrgSlug);
      if (user?.username) {
        result = result.replace(/\[username\]/g, username).replace(/:username/g, username);
      } else {
        result = result.replace(/\/\[username\]/g, "/user/profile").replace(/\/:username/g, "/user/profile");
      }
      return result;
    };

    if (node.type === "item") {
      return {
        ...node,
        href: replaceTokens(node.href),
      };
    }
    if (node.type === "group") {
      return {
        ...node,
        href: node.href ? replaceTokens(node.href) : undefined,
        children: node.children.map(resolveNodeHref),
      };
    }
    if (node.type === "section") {
      return {
        ...node,
        children: node.children.map(resolveNodeHref),
      };
    }
    return node;
  };

  // Filter navigation nodes based on user role, global permissions, and workspace permissions
  const filteredNodes = useMemo(() => {
    const filterRecurse = (nodes: NavigationNode[]): NavigationNode[] => {
      return nodes
        .map((node) => {
          // 1. Role-based check
          if (node.requiredRoles && !node.requiredRoles.includes(userRole)) {
            return null;
          }

          // 2. Global permission check
          if (node.requiredPermissions) {
            const passes = node.requiredPermissions.some((p) => hasPermission(p));
            if (!passes) {
              return null;
            }
          }

          // 2.5 Feature flag check
          if (node.featureFlag) {
            const userPerms = user?.permissions || [];
            if (!isModuleEnabled({ featureFlag: node.featureFlag }, userPerms)) {
              return null;
            }
          }

          // 3. Workspace membership and permission check
          const hasWorkspacePerms = node.requiredWorkspacePermissions && node.requiredWorkspacePermissions.length > 0;
          const isWorkspaceRoute = node.id.startsWith("workspace-") || node.id.startsWith("org-") || hasWorkspacePerms;
          if (isWorkspaceRoute) {
            if (!currentOrgSlug || !workspaceDetails || workspaceUserRole === null) {
              return null;
            }
            if (!hasWorkspaceAccess(node)) {
              return null;
            }
          }

          // 4. Recursive child filtering
          if (node.type === "group" || node.type === "section") {
            const filteredChildren = filterRecurse(node.children);
            if (filteredChildren.length === 0) {
              return null;
            }
            return {
              ...node,
              children: filteredChildren,
            } as NavigationNode;
          }

          return node;
        })
        .filter((node): node is NavigationNode => node !== null);
    };

    // Determine config array depending on mode
    let targetConfig: NavigationNode[] = [];
    if (sidebarMode === "WORKSPACE") {
      targetConfig = workspaceNavigationConfig;
    } else if (sidebarMode === "CANDIDATE") {
      targetConfig = candidateNavigationConfig;
    } else if (sidebarMode === "SYSTEM_ADMIN") {
      targetConfig = adminNavigationConfig;
    } else {
      // Default mode: COMPANY
      targetConfig = [...companyNavigationConfig];
      if (userRole === "USER") {
        targetConfig = [...candidateNavigationConfig];
      } else if (userRole === "ADMIN") {
        targetConfig = [...targetConfig, ...adminNavigationConfig];
      }
    }

    const rawNodes = filterRecurse(targetConfig);
    return rawNodes.map(resolveNodeHref);
  }, [sidebarMode, userRole, hasPermission, currentOrgSlug, workspaceDetails, workspaceUserRole, workspacePermissions]);

  // Dedicated specialized components workspace navigation sections
  const componentSections = useMemo(() => [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "atoms", label: "Atoms", icon: Orbit },
    { id: "molecules", label: "Molecules", icon: FlaskConical },
    { id: "organisms", label: "Organisms", icon: Boxes },
    { id: "templates", label: "Templates", icon: LayoutGrid },
    { id: "features", label: "Features", icon: Blocks },
    { id: "experimental", label: "Experimental", icon: Beaker },
    { id: "deprecated", label: "Deprecated", icon: AlertTriangle },
    { id: "graph", label: "Dependency Graph", icon: Network },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings }
  ], []);

  const handleBackToAdmin = () => {
    router.push("/admin");
  };

  const handleComponentViewSelect = (viewId: string) => {
    router.push(`/admin/components?view=${viewId}`);
  };

  if (activeWorkspace === "COMPONENTS") {
    return (
      <nav
        className={["flex flex-col w-full", isMobile ? "gap-2" : "gap-3"].join(" ")}
        aria-label="Components Workspace Sidebar Navigation"
      >
        {/* Workspace Brand Selector & Back Button */}
        <div className="flex flex-col gap-2 pb-2 border-b border-border/40 mb-1">
          <Link
            href="/admin"
            onClick={(e) => {
              e.preventDefault();
              handleBackToAdmin();
            }}
            className={[
              "flex items-center gap-2 w-full rounded-xl transition-all duration-200 text-muted hover:bg-accent/10 hover:text-accent font-semibold cursor-pointer",
              isMobile ? "h-12 text-base px-3.5" : "h-10 text-sm px-3",
              collapsed ? "justify-center" : ""
            ].join(" ")}
          >
            <ArrowLeft size={18} />
            {!collapsed && <span>Back to Admin</span>}
          </Link>

          {!collapsed && (
            <div className="flex items-center gap-2 px-3 pt-2 text-[11px] font-bold text-muted/60 uppercase tracking-wider select-none">
              <BookOpen size={12} />
              <span>Workspace</span>
            </div>
          )}
        </div>

        {/* Dynamic Sidebar Links */}
        <div className="flex flex-col gap-1 w-full">
          {componentSections.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            const href = `/admin/components?view=${item.id}`;

            const linkContent = (
              <Link
                key={item.id}
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  handleComponentViewSelect(item.id);
                }}
                aria-current={active ? "page" : undefined}
                className={[
                  "relative flex items-center w-full rounded-xl font-semibold transition-all duration-200 group cursor-pointer border-0 bg-transparent text-left",
                  isMobile ? "h-12 text-base px-3.5 gap-3" : "h-10 text-sm gap-2 px-3",
                  active
                    ? "bg-accent/10 text-accent font-bold"
                    : "text-muted hover:bg-accent/10 hover:text-accent",
                  collapsed ? "justify-center mx-auto" : "",
                ].join(" ")}
              >
                {active && (
                  <span
                    className={[
                      "absolute -left-1 rounded-r-full bg-accent shrink-0",
                      isMobile ? "top-3 w-1.5 h-6" : "w-1 h-8",
                    ].join(" ")}
                  />
                )}

                <Icon size={20} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );

            if (collapsed && !isMobile) {
              return (
                <Tooltip key={item.id} delay={0}>
                  <Tooltip.Trigger>
                    <div className="w-full">
                      {linkContent}
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Content
                    placement="right"
                    className="font-outfit text-xs font-semibold px-2.5 py-1.5 shadow-md border border-border"
                  >
                    <span>{item.label}</span>
                  </Tooltip.Content>
                </Tooltip>
              );
            }

            return linkContent;
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav
      className={["flex flex-col w-full h-full", isMobile ? "gap-2" : "gap-3"].join(
        " ",
      )}
      aria-label={
        isMobile ? "Mobile Sidebar Navigation" : "Desktop Sidebar Navigation"
      }
    >
      <div className="flex-1 flex flex-col gap-3 w-full">
        {/* Workspace specific Mode Header */}
        {sidebarMode === "WORKSPACE" && (
          <div className="flex flex-col gap-2 pb-2 border-b border-border/40 mb-1 select-none">
            <Link
              href={`/business/${currentOrgSlug}/dashboard`}
              className={[
                "flex items-center gap-2 w-full rounded-xl transition-all duration-200 text-muted hover:bg-accent/10 hover:text-accent font-semibold cursor-pointer border-0 bg-transparent text-left",
                isMobile ? "h-12 text-base px-3.5" : "h-10 text-sm px-3",
                collapsed ? "justify-center" : ""
              ].join(" ")}
            >
              <ArrowLeft size={16} />
              {!collapsed && <span className="text-xs">Company Console</span>}
            </Link>
          </div>
        )}

        {/* Company Quick-Jump Banner (Rendered when in Company Mode and a workspace is selected) */}
        {!hideActiveWorkspaceBanner && sidebarMode === "COMPANY" && activeWorkspaceObj && !collapsed && (
          <div className="select-none">
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

        {/* Dynamic Navigation Node Links */}
        {filteredNodes.map((node) => {
          if (node.type === "item") {
            return (
              <SidebarLink
                key={node.id}
                item={node}
                collapsed={collapsed}
                isMobile={isMobile}
              />
            );
          }
          if (node.type === "group") {
            return (
              <SidebarGroup
                key={node.id}
                group={node}
                collapsed={collapsed}
                isMobile={isMobile}
              />
            );
          }
          if (node.type === "section") {
            return (
              <SidebarSection
                key={node.id}
                section={node}
                collapsed={collapsed}
                isMobile={isMobile}
              />
            );
          }
          return null;
        })}
      </div>

      {/* Organization Switcher at the bottom */}
      {!hideSwitcher && (userRole === "BUSINESS" || userRole === "ADMIN") && (
        <div className="mt-auto pt-3 border-t border-separator/50 w-full shrink-0 min-w-0">
          <WorkspaceSwitcher collapsed={collapsed} isMobile={isMobile} />
        </div>
      )}
    </nav>
  );
};

export default SidebarContent;
