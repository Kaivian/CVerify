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
  BookOpen,
  Building2,
  Shield,
  Users,
  Briefcase,
  FileText,
  Info,
  CreditCard,
  UserCheck
} from "lucide-react";
import { type NavigationNode } from "../../../types/navigation.types";

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

  const backHref = useMemo(() => {
    if (userRole === "BUSINESS") return "/business";
    if (userRole === "ADMIN") return "/admin";
    return "/user";
  }, [userRole]);

  const backLabel = useMemo(() => {
    if (userRole === "BUSINESS") return "Back to Business Hub";
    if (userRole === "ADMIN") return "Back to Admin Dashboard";
    return "Back to Personal Hub";
  }, [userRole]);

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

  const pathname = usePathname();

  // Resolve current organization slug:
  // If the path is /workspace/slug/..., use slug.
  // Otherwise, if myOrganizations exists and has entries, default to the first organization's slug.
  const currentOrgSlug = useMemo(() => {
    if (pathname?.startsWith("/workspace/")) {
      return pathname.split("/workspace/")[1]?.split("/")[0] || "";
    }
    return myOrganizations && myOrganizations.length > 0 ? myOrganizations[0].slug : "";
  }, [pathname, myOrganizations]);

  const fetchWorkspace = useWorkspaceStore((s) => s.fetchWorkspace);
  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[currentOrgSlug]);

  useEffect(() => {
    if (currentOrgSlug) {
      fetchWorkspace(currentOrgSlug);
    }
  }, [currentOrgSlug, fetchWorkspace]);

  const permissions = useMemo(() => workspaceDetails?.permissions || [], [workspaceDetails]);

  const canViewRoles = useMemo(() => {
    return permissions.includes("organization:roles:view") || permissions.includes("organization:roles:manage");
  }, [permissions]);

  const canViewBilling = useMemo(() => {
    return permissions.includes("billing:invoice:view") || permissions.includes("billing:subscription:manage");
  }, [permissions]);

  const canEditSettings = useMemo(() => {
    return permissions.includes("organization:settings:edit") || permissions.includes("organization:profile:edit");
  }, [permissions]);

  const canViewRecruitment = useMemo(() => {
    return (
      permissions.includes("ai:interview:configure") ||
      permissions.includes("ai:interview:conduct") ||
      permissions.includes("ai:interview:evaluate")
    );
  }, [permissions]);

  const orgNodes = useMemo<NavigationNode[]>(() => {
    if (!currentOrgSlug) return [];

    return [
      {
        id: "org-workspace-group",
        type: "group" as const,
        label: "Workspace",
        icon: Building2,
        children: [
          {
            id: "org-info",
            type: "item" as const,
            label: "Information",
            href: `/workspace/${currentOrgSlug}/information`,
            icon: Info,
          },
          {
            id: "org-members",
            type: "item" as const,
            label: "Members",
            href: `/workspace/${currentOrgSlug}/members`,
            icon: Users,
          },
          ...(canViewRoles
            ? [
              {
                id: "org-roles",
                type: "item" as const,
                label: "Business Roles",
                href: `/workspace/${currentOrgSlug}/roles`,
                icon: Shield,
              },
            ]
            : []),
          ...(canViewBilling
            ? [
              {
                id: "org-billing",
                type: "item" as const,
                label: "Billing",
                href: `/workspace/${currentOrgSlug}/billing`,
                icon: CreditCard,
              },
            ]
            : []),
          ...(canEditSettings
            ? [
              {
                id: "org-settings",
                type: "item" as const,
                label: "Settings",
                href: `/workspace/${currentOrgSlug}/settings`,
                icon: Settings,
              },
            ]
            : []),
        ],
      },
      ...(canViewRecruitment
        ? [
          {
            id: "org-recruitment-group",
            type: "group" as const,
            label: "Recruitment",
            icon: Briefcase,
            children: [
              {
                id: "org-recruitment-dashboard",
                type: "item" as const,
                label: "Dashboard",
                href: `/workspace/${currentOrgSlug}/recruitment/dashboard`,
                icon: LayoutDashboard,
              },
              {
                id: "org-recruitment-jd",
                type: "item" as const,
                label: "JD Management",
                href: `/workspace/${currentOrgSlug}/recruitment/jd`,
                icon: FileText,
              },
              {
                id: "org-recruitment-intelligence",
                type: "item" as const,
                label: "Talent Intelligence",
                href: `/workspace/${currentOrgSlug}/intelligence`,
                icon: UserCheck,
              },
            ],
          },
        ]
        : []),
    ];
  }, [currentOrgSlug, canViewRoles, canViewBilling, canEditSettings, canViewRecruitment]);

  // Dynamically inject workspace links based on role sections
  const combinedNodes = useMemo(() => {
    const isInsideWorkspace = pathname?.startsWith("/workspace/");

    if (isInsideWorkspace && currentOrgSlug) {
      const backNode: NavigationNode = {
        id: "back-to-hub",
        type: "item" as const,
        label: backLabel,
        href: backHref,
        icon: ArrowLeft,
      };

      // Filter out candidate and business dashboards to focus purely on the workspace
      const baseNodes = filteredNodes.filter(
        (node) => node.id !== "candidate-section" && node.id !== "business-section"
      );

      return [
        backNode,
        ...baseNodes,
        ...orgNodes,
      ];
    }

    if (!myOrganizations || myOrganizations.length === 0) {
      return filteredNodes;
    }

    const mappedNodes = [...filteredNodes];

    mappedNodes.push({
      id: "workspaces-section",
      type: "section",
      label: "Workspaces",
      children: [
        ...myOrganizations.map((org) => ({
          id: `org-workspace-${org.slug}`,
          type: "item" as const,
          label: org.name,
          tooltip: org.name,
          href: `/workspace/${org.slug}/information`,
          icon: Building2,
        })),
      ],
    });

    return mappedNodes;
  }, [filteredNodes, myOrganizations, orgNodes, pathname, currentOrgSlug, backHref, backLabel]);

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

