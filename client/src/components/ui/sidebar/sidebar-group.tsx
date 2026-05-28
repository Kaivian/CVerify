"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Accordion, Tooltip, Typography } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import { useSidebarStore } from "../../../stores/use-sidebar-store";
import { useAuth } from "../../../features/auth/hooks/use-auth";
import { isActiveRoute } from "../../../lib/navigation-utils";
import {
  type NavigationGroupItem,
  type NavigationNode,
} from "../../../types/navigation.types";
import SidebarLink from "./sidebar-link";

interface SidebarGroupProps {
  group: NavigationGroupItem;
  collapsed: boolean;
  isMobile: boolean;
  depth?: number;
}

export const SidebarGroup: React.FC<SidebarGroupProps> = ({
  group,
  collapsed,
  isMobile,
  depth = 0,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { expandedGroups, toggleGroup, setGroupExpanded, setMobileOpen } =
    useSidebarStore();

  const paramsRecord: Record<string, string> = {};
  if (searchParams) {
    searchParams.forEach((value, key) => {
      paramsRecord[key] = value;
    });
  }

  const Icon = group.icon;

  const label = group.label;

  // Recursively check if any descendant is active
  const isAnyChildActive = (node: NavigationNode): boolean => {
    if (node.type === "item") {
      return isActiveRoute(pathname, node.href, node.exactMatch, node.id, user?.username, paramsRecord);
    }
    if (node.type === "group") {
      return (
        node.children.some(isAnyChildActive) ||
        (node.href ? isActiveRoute(pathname, node.href, false, node.id, user?.username, paramsRecord) : false)
      );
    }
    return false;
  };

  const hasActiveDescendant =
    group.children.some(isAnyChildActive) ||
    (group.href ? isActiveRoute(pathname, group.href, false, group.id, user?.username, paramsRecord) : false);
  const isExpanded = !!expandedGroups[group.id];

  // Auto-expand/collapse parent group on mount or pathname change based on active descendant
  useEffect(() => {
    setGroupExpanded(group.id, hasActiveDescendant);
  }, [pathname, hasActiveDescendant, group.id, setGroupExpanded]);

  // Handle manual toggle and optional navigation
  const handleToggle = () => {
    toggleGroup(group.id);
    if (group.href) {
      router.push(group.href);
      if (isMobile) {
        setMobileOpen(false);
      }
    }
  };

  // Convert expandedGroups record into a React Aria / HeroUI compliant key set
  const expandedKeys = new Set(
    Object.keys(expandedGroups).filter(
      (key) => expandedGroups[key] && key === group.id,
    ),
  );

  // Expanded Sidebar layout: Accordion style
  if (!collapsed) {
    return (
      <div className="w-full flex flex-col select-none">
        <Accordion
          className="p-0 w-full"
          variant="default"
          expandedKeys={expandedKeys}
          onExpandedChange={() => toggleGroup(group.id)}
        >
          <Accordion.Item
            key={group.id}
            id={group.id}
            className="border-none p-0 m-0"
          >
            <Accordion.Heading>
              {group.href ? (
                <div
                  className={[
                    "w-full flex items-center rounded-xl font-semibold text-muted hover:bg-surface-secondary/40 select-none transition-all duration-200 group/row",
                    isMobile ? "h-12" : "h-10",
                  ].join(" ")}
                >
                  <Link
                    href={group.href}
                    onClick={() => {
                      if (isMobile) {
                        setMobileOpen(false);
                      }
                    }}
                    className={[
                      "flex-1 flex items-center gap-2 min-w-0 h-full rounded-l-xl outline-hidden focus-visible:ring-2 focus-visible:ring-focus hover:text-foreground",
                      isMobile ? "pl-3.5 pr-2 text-base" : "pl-4 pr-2 text-sm",
                    ].join(" ")}
                  >
                    {Icon && (
                      <Icon
                        size={20}
                        className={[
                          "shrink-0 transition-colors duration-200",
                          hasActiveDescendant ? "text-accent" : "text-muted group-hover/row:text-foreground",
                        ].join(" ")}
                      />
                    )}
                    <span
                      className={[
                        "whitespace-nowrap font-outfit font-semibold transition-colors duration-200",
                        hasActiveDescendant
                          ? "text-foreground font-bold"
                          : "text-muted group-hover/row:text-foreground",
                      ].join(" ")}
                    >
                      {label}
                    </span>
                  </Link>

                  <Accordion.Trigger
                    className={[
                      "shrink-0 h-full flex items-center justify-center rounded-r-xl text-muted hover:text-foreground hover:bg-surface-secondary/60 transition-colors duration-200 cursor-pointer outline-hidden focus-visible:ring-2 focus-visible:ring-focus",
                      isMobile ? "w-12" : "w-10",
                    ].join(" ")}
                  >
                    <Accordion.Indicator className="text-muted group-hover/row:text-foreground shrink-0 transition-transform duration-200 ease-out">
                      <ChevronDown
                        size={14}
                        className={isExpanded ? "rotate-180" : ""}
                      />
                    </Accordion.Indicator>
                  </Accordion.Trigger>
                </div>
              ) : (
                <Accordion.Trigger
                  className={[
                    "w-full flex items-center justify-between rounded-xl font-semibold text-muted hover:text-foreground hover:bg-surface-secondary/40 select-none cursor-pointer outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden transition-all duration-200",
                    isMobile ? "h-12 px-3.5 text-base" : "h-10 px-4 text-sm",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {Icon && (
                      <Icon
                        size={20}
                        className={[
                          "shrink-0 transition-colors duration-200",
                          hasActiveDescendant ? "text-accent" : "text-muted",
                        ].join(" ")}
                      />
                    )}
                    <span
                      className={[
                        "whitespace-nowrap font-outfit font-semibold",
                        hasActiveDescendant
                          ? "text-foreground font-bold"
                          : "text-muted",
                      ].join(" ")}
                    >
                      {label}
                    </span>
                  </div>
                  <Accordion.Indicator className="text-muted shrink-0 transition-transform duration-200 ease-out">
                    <ChevronDown
                      size={14}
                      className={isExpanded ? "rotate-180" : ""}
                    />
                  </Accordion.Indicator>
                </Accordion.Trigger>
              )}
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body className="p-0">
                {/* Indented recursive items container with a subtle vertical guide line */}
                <div
                  className={[
                    "border-l border-border/70 flex flex-col",
                    isMobile
                      ? "ml-4 pl-1.5 gap-2 my-2"
                      : "ml-4.5 pl-3 gap-1 my-1",
                  ].join(" ")}
                >
                  {group.children.map((child) => {
                    if (child.type === "item") {
                      return (
                        <SidebarLink
                          key={child.id}
                          item={child}
                          collapsed={collapsed}
                          isMobile={isMobile}
                          depth={depth + 1}
                        />
                      );
                    }
                    if (child.type === "group") {
                      return (
                        <SidebarGroup
                          key={child.id}
                          group={child}
                          collapsed={collapsed}
                          isMobile={isMobile}
                          depth={depth + 1}
                        />
                      );
                    }
                    return null;
                  })}
                </div>
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </div>
    );
  }

  // Collapsed Sidebar layout: Floating submenu using HeroUI Tooltip
  return (
    <div className="w-full flex justify-center py-0.5 select-none">
      <Tooltip delay={0} isDisabled={isMobile}>
        <Tooltip.Trigger>
          <button
            onClick={handleToggle}
            className={[
              "relative flex items-center justify-center h-10 w-10 rounded-xl text-muted hover:text-foreground hover:bg-surface-secondary/40 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden cursor-pointer",
              hasActiveDescendant
                ? "bg-surface-secondary/20 text-accent font-bold"
                : "",
            ].join(" ")}
            aria-label={label}
          >
            {/* Active descendant indication dot on top-right of the icon */}
            {hasActiveDescendant && (
              <span className="absolute top-2 right-2 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
            )}

            {Icon && (
              <Icon
                size={18}
                className={[
                  "shrink-0",
                  hasActiveDescendant ? "text-accent" : "text-muted",
                ].join(" ")}
              />
            )}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content
          placement="right"
          className="flex flex-col gap-1.5 p-2 bg-surface border border-border shadow-lg rounded-xl min-w-44 select-none"
        >
          {/* Header title inside the hover popover */}
          <div className="px-2.5 py-1 border-b border-separator mb-1">
            {group.href ? (
              <Link
                href={group.href}
                className="hover:underline flex items-center justify-between"
              >
                <Typography
                  type="body-xs"
                  className="font-bold text-foreground font-outfit uppercase tracking-wider text-[10px]"
                >
                  {label}
                </Typography>
              </Link>
            ) : (
              <Typography
                type="body-xs"
                className="font-bold text-foreground font-outfit uppercase tracking-wider text-[10px]"
              >
                {label}
              </Typography>
            )}
          </div>

          {/* Render children in a list inside the popover */}
          <div className="flex flex-col gap-1">
            {group.children.map((child) => {
              if (child.type === "item") {
                return (
                  <Link
                    key={child.id}
                    href={child.href}
                    className={[
                      "flex items-center h-8 px-2.5 rounded-lg text-xs font-semibold font-outfit transition-colors",
                      isActiveRoute(pathname, child.href, child.exactMatch, child.id, user?.username, paramsRecord)
                        ? "bg-surface-secondary text-foreground font-bold"
                        : "text-muted hover:bg-surface-secondary/40 hover:text-foreground",
                    ].join(" ")}
                  >
                    {child.icon && (
                      <child.icon size={14} className="mr-2 shrink-0" />
                    )}
                    <span className="whitespace-nowrap">
                      {child.label}
                    </span>
                  </Link>
                );
              }
              return null;
            })}
          </div>
        </Tooltip.Content>
      </Tooltip>
    </div>
  );
};

export default SidebarGroup;
