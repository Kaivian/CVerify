"use client";

import React, { useMemo, useEffect } from "react";
import { useAuth } from "../../../features/auth/hooks/use-auth";
import { navigationConfig } from "../../../config/navigation-config";
import { filterNavigationNodes } from "../../../lib/navigation-utils";
import SidebarLink from "./sidebar-link";
import SidebarGroup from "./sidebar-group";
import SidebarSection from "./sidebar-section";
import { useWorkspace } from "../../../providers/workspace-provider";
import { useWorkspaceStore } from "../../../features/workspace/store/use-workspace-store";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
  BookOpen,
  Building2,
  Shield,
  Users
} from "lucide-react";

interface SidebarContentProps {
  collapsed: boolean;
  isMobile: boolean;
}

export const SidebarContent: React.FC<SidebarContentProps> = ({
  collapsed,
  isMobile,
}) => {
  const { user, isAuthenticated, hasPermission } = useAuth();
  const userRole = user?.role || "USER";
  const { activeWorkspace } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeView = searchParams?.get("view") || "overview";

  const fetchMyOrganizations = useWorkspaceStore((s) => s.fetchMyOrganizations);
  const myOrganizations = useWorkspaceStore((s) => s.myOrganizations);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchMyOrganizations();
    }
  }, [isAuthenticated, user, fetchMyOrganizations]);

  // Memoize filtered navigation nodes to optimize performance and prevent redundant re-renders
  const filteredNodes = useMemo(() => {
    return filterNavigationNodes(navigationConfig, userRole, hasPermission);
  }, [userRole, hasPermission]);

  // Dynamically inject workspace links based on role sections
  const combinedNodes = useMemo(() => {
    if (!myOrganizations || myOrganizations.length === 0) {
      return filteredNodes;
    }

    let hasBusinessSection = false;
    const mappedNodes = filteredNodes.map((node) => {
      if (node.id === "business-section" && (node.type === "section" || node.type === "group")) {
        hasBusinessSection = true;
        const existingChildren = node.children || [];
        const workspaceChildren = myOrganizations.map((org) => ({
          id: `org-workspace-${org.slug}`,
          type: "item" as const,
          label: `${org.name} Workspace`,
          href: `/workspace/${org.slug}`,
          icon: Building2,
        }));
        
        const filteredExisting = existingChildren.filter(
          (child: any) => !child.id.startsWith("org-workspace-")
        );

        return {
          ...node,
          children: [...filteredExisting, ...workspaceChildren],
        };
      }
      return node;
    });

    if (!hasBusinessSection) {
      // Append a workspaces section at the bottom for non-business/admin users
      mappedNodes.push({
        id: "workspaces-section",
        type: "section",
        label: "Workspaces",
        children: myOrganizations.map((org) => ({
          id: `org-workspace-${org.slug}`,
          type: "item" as const,
          label: org.name,
          href: `/workspace/${org.slug}`,
          icon: Building2,
        })),
      });
    }

    return mappedNodes;
  }, [filteredNodes, myOrganizations]);

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
    // Return to Previous Admin Dashboard Page cleanly
    router.push("/admin");
  };

  const handleComponentViewSelect = (viewId: string) => {
    router.push(`/admin/components?view=${viewId}`);
  };

  const pathname = usePathname();

  if (activeWorkspace === "ORGANIZATION") {
    const orgSlug = pathname ? pathname.split("/workspace/")[1]?.split("/")[0] || "" : "";
    const handleBackToDashboard = () => {
      if (userRole === "BUSINESS" || userRole === "ADMIN") {
        router.push("/business");
      } else {
        router.push("/user");
      }
    };

    const orgSections = [
      { id: "members", label: "Members", icon: Users, href: `/workspace/${orgSlug}`, active: pathname === `/workspace/${orgSlug}` },
      { id: "roles", label: "Roles Matrix", icon: Shield, disabled: true },
      { id: "settings", label: "Settings", icon: Settings, disabled: true },
      { id: "billing", label: "Billing", icon: BarChart3, disabled: true }
    ];

    return (
      <nav
        className={["flex flex-col w-full", isMobile ? "gap-2" : "gap-3"].join(" ")}
        aria-label="Organization Workspace Sidebar Navigation"
      >
        {/* Workspace Brand Selector & Back Button */}
        <div className="flex flex-col gap-2 pb-2 border-b border-border/40 mb-1">
          <a
            href={userRole === "BUSINESS" || userRole === "ADMIN" ? "/business" : "/user"}
            onClick={(e) => {
              e.preventDefault();
              handleBackToDashboard();
            }}
            className={[
              "flex items-center gap-2 w-full rounded-xl transition-all duration-200 text-muted hover:bg-accent/10 hover:text-accent font-semibold cursor-pointer",
              isMobile ? "h-12 text-base px-3.5" : "h-10 text-sm px-3",
              collapsed ? "justify-center" : ""
            ].join(" ")}
          >
            <ArrowLeft size={18} />
            {!collapsed && <span>Back to Home</span>}
          </a>

          {!collapsed && (
            <div className="flex items-center gap-2 px-3 pt-2 text-[11px] font-bold text-muted/60 uppercase tracking-wider select-none">
              <Building2 size={12} />
              <span>Org Workspace</span>
            </div>
          )}
        </div>

        {/* Dynamic Sidebar Links */}
        <div className="flex flex-col gap-1 w-full">
          {orgSections.map((item) => {
            const Icon = item.icon;
            const active = item.active;

            const linkContent = item.disabled ? (
              <button
                key={item.id}
                disabled
                className={[
                  "relative flex items-center w-full rounded-xl font-semibold transition-all duration-200 group border-0 bg-transparent text-left",
                  isMobile ? "h-12 text-base px-3.5 gap-3" : "h-10 text-sm gap-2 px-3",
                  "text-muted/40 cursor-not-allowed",
                  collapsed ? "justify-center mx-auto" : "",
                ].join(" ")}
              >
                <Icon size={20} className="shrink-0" />
                {!collapsed && (
                  <span className="truncate">
                    {item.label}
                    <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider opacity-60">(Soon)</span>
                  </span>
                )}
              </button>
            ) : (
              <a
                key={item.id}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  if (item.href) {
                    router.push(item.href);
                  }
                }}
                aria-current={active ? "page" : undefined}
                className={[
                  "relative flex items-center w-full rounded-xl font-semibold transition-all duration-200 group border-0 bg-transparent text-left",
                  isMobile ? "h-12 text-base px-3.5 gap-3" : "h-10 text-sm gap-2 px-3",
                  active
                    ? "bg-accent/10 text-accent font-bold"
                    : "text-muted hover:bg-accent/10 hover:text-accent cursor-pointer",
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
              </a>
            );

            if (collapsed && !isMobile) {
              return (
                <Tooltip key={item.id} delay={0}>
                  <Tooltip.Trigger>
                    {linkContent}
                  </Tooltip.Trigger>
                  <Tooltip.Content
                    placement="right"
                    className="font-outfit text-xs font-semibold px-2.5 py-1.5 shadow-md border border-border"
                  >
                    <span>{item.label} {item.disabled ? "(Coming Soon)" : ""}</span>
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

  if (activeWorkspace === "COMPONENTS") {
    return (
      <nav
        className={["flex flex-col w-full", isMobile ? "gap-2" : "gap-3"].join(" ")}
        aria-label="Components Workspace Sidebar Navigation"
      >
        {/* Workspace Brand Selector & Back Button */}
        <div className="flex flex-col gap-2 pb-2 border-b border-border/40 mb-1">
          <a
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
          </a>

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
              <a
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
              </a>
            );

            if (collapsed && !isMobile) {
              return (
                <Tooltip key={item.id} delay={0}>
                  <Tooltip.Trigger>
                    {linkContent}
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

  // Standard Admin Layout Navigation
  return (
    <nav
      className={["flex flex-col w-full", isMobile ? "gap-2" : "gap-3"].join(
        " ",
      )}
      aria-label={
        isMobile ? "Mobile Sidebar Navigation" : "Desktop Sidebar Navigation"
      }
    >
      {combinedNodes.map((node) => {
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
    </nav>
  );
};

export default SidebarContent;

