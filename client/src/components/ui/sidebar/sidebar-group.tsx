"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tooltip, Typography } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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

  const isChildActive = group.children.some(isAnyChildActive);

  const isGroupActive = group.href
    ? isActiveRoute(pathname, group.href, false, group.id, user?.username, paramsRecord) && !isChildActive
    : false;

  const hasActiveDescendant =
    isChildActive ||
    (group.href ? isActiveRoute(pathname, group.href, false, group.id, user?.username, paramsRecord) : false);

  const isExpanded = !!expandedGroups[group.id];

  // Auto-expand/collapse parent group on mount or pathname change based on active descendant
  useEffect(() => {
    setGroupExpanded(group.id, hasActiveDescendant);
  }, [pathname, hasActiveDescendant, group.id, setGroupExpanded]);

  // Handle manual toggle and optional navigation
  const handleToggle = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    toggleGroup(group.id);
  };

  // Expanded Sidebar layout: Custom collapsible style
  if (!collapsed) {
    return (
      <div className="w-full flex flex-col select-none">
        {group.href ? (
          <div
            className={[
              "relative w-full flex items-center rounded-xl font-semibold select-none transition-all duration-200 group/row",
              isMobile ? "h-12 text-base" : "h-10 text-sm",
              isGroupActive
                ? "bg-accent/10 text-accent"
                : hasActiveDescendant
                  ? "text-accent hover:bg-accent/10"
                  : "text-muted hover:bg-accent/10 hover:text-accent",
            ].join(" ")}
          >
            {/* Dynamic Left Active indicator bar */}
            {isGroupActive && (
              <span
                className={[
                  "absolute -left-3 rounded-r-full bg-accent shrink-0",
                  isMobile ? "top-3 w-1.5 h-6" : "w-1 h-8",
                ].join(" ")}
              />
            )}

            <Link
              href={group.href}
              onClick={() => {
                if (isMobile) {
                  setMobileOpen(false);
                }
              }}
              style={{
                paddingLeft: `${depth > 0 ? (isMobile ? 16 : 12) : isMobile ? 14 : 16}px`,
              }}
              className="flex-1 flex items-center gap-2 min-w-0 h-full rounded-l-xl outline-hidden focus-visible:ring-2 focus-visible:ring-focus"
            >
              {Icon && (
                <Icon
                  size={20}
                  className="shrink-0"
                />
              )}
              <span className="truncate whitespace-nowrap">
                {label}
              </span>
            </Link>

            {/* Chevron Button (Toggle Expansion) */}
            <button
              type="button"
              onClick={handleToggle}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? `Collapse ${label}` : `Expand ${label}`}
              className={[
                "flex items-center justify-center shrink-0 rounded-lg transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden",
                isMobile ? "w-9 h-9 mr-1.5" : "w-8 h-8 mr-1",
                "text-muted hover:text-accent hover:bg-accent/20",
              ].join(" ")}
            >
              <ChevronDown
                size={16}
                className={[
                  "transition-transform duration-200 ease-out",
                  isExpanded ? "rotate-180" : "",
                ].join(" ")}
              />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => toggleGroup(group.id)}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? `Collapse ${label}` : `Expand ${label}`}
            style={{
              paddingLeft: `${depth > 0 ? (isMobile ? 16 : 12) : isMobile ? 14 : 16}px`,
            }}
            className={[
              "relative w-full flex items-center justify-between rounded-xl font-semibold select-none transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-focus border-0 bg-transparent text-left outline-hidden group/row",
              isMobile ? "h-12 text-base px-3.5 pr-1.5" : "h-10 text-sm pr-1",
              isGroupActive
                ? "bg-accent/10 text-accent"
                : hasActiveDescendant
                  ? "text-accent hover:bg-accent/10"
                  : "text-muted hover:bg-accent/10 hover:text-accent",
            ].join(" ")}
          >
            {/* Dynamic Left Active indicator bar */}
            {isGroupActive && (
              <span
                className={[
                  "absolute -left-3 rounded-r-full bg-accent shrink-0",
                  isMobile ? "top-3 w-1.5 h-6" : "w-1 h-8",
                ].join(" ")}
              />
            )}

            <div className="flex items-center gap-2 min-w-0 flex-1 h-full">
              {Icon && (
                <Icon
                  size={20}
                  className="shrink-0"
                />
              )}
              <span className="truncate whitespace-nowrap">
                {label}
              </span>
            </div>

            <div
              className={[
                "flex items-center justify-center shrink-0 rounded-lg transition-all duration-200",
                isMobile ? "w-9 h-9 mr-1.5" : "w-8 h-8 mr-1",
                "text-muted group-hover/row:text-accent hover:bg-accent/20",
              ].join(" ")}
            >
              <ChevronDown
                size={16}
                className={[
                  "transition-transform duration-200 ease-out",
                  isExpanded ? "rotate-180" : "",
                ].join(" ")}
              />
            </div>
          </button>
        )}

        {/* Children collapsible panel */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden w-full"
            >
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
            </motion.div>
          )}
        </AnimatePresence>
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
