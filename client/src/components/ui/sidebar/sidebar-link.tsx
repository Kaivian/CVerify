"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@heroui/react";
import { useSidebarStore } from "../../../stores/use-sidebar-store";
import { isActiveRoute } from "../../../lib/navigation-utils";
import { type NavigationLinkItem } from "../../../types/navigation.types";

interface SidebarLinkProps {
  item: NavigationLinkItem;
  collapsed: boolean;
  isMobile: boolean;
  depth?: number;
}

export const SidebarLink: React.FC<SidebarLinkProps> = ({
  item,
  collapsed,
  isMobile,
  depth = 0,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation(["common"]);
  const { setMobileOpen } = useSidebarStore();

  const active = isActiveRoute(pathname, item.href, item.exactMatch);
  const Icon = item.icon;

  // Localized label with fallback
  const label = item.translationKey
    ? t(item.translationKey, { defaultValue: item.label })
    : item.label;

  // Badge styles
  const getBadgeClass = (color = "default") => {
    const base =
      "inline-flex items-center justify-center px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tracking-tight font-outfit select-none scale-90";
    switch (color) {
      case "primary":
        return `${base} bg-accent text-accent-foreground`;
      case "secondary":
        return `${base} bg-surface-secondary text-foreground`;
      case "success":
        return `${base} bg-success/15 text-success font-semibold border border-success/20`;
      case "warning":
        return `${base} bg-warning/15 text-warning font-semibold border border-warning/20`;
      case "danger":
        return `${base} bg-danger/15 text-danger font-semibold border border-danger/20`;
      default:
        return `${base} bg-muted/20 text-muted`;
    }
  };

  // Close mobile drawer and navigate when link is clicked
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setMobileOpen(false);
    router.push(item.href);
  };

  // Standard interactive link component content
  const linkContent = (
    <a
      href={item.href}
      onClick={handleLinkClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      style={{
        paddingLeft: collapsed
          ? undefined
          : `${depth > 0 ? (isMobile ? 12 : 6) : isMobile ? 14 : 9}px`,
      }}
      className={[
        "relative flex items-center w-full rounded-xl font-semibold transition-all duration-200 group cursor-pointer",
        isMobile ? "h-12 text-base px-3.5 gap-3" : "h-10 text-sm gap-2",
        active
          ? "bg-accent/10 text-accent"
          : "text-muted hover:bg-accent/10 hover:text-accent",
        collapsed ? "justify-center mx-auto" : "",
      ].join(" ")}
    >
      {/* Dynamic Left Active indicator bar */}
      {active && (
        <span
          className={[
            "absolute -left-3 rounded-r-full bg-accent shrink-0",
            isMobile ? "top-3 w-1.5 h-6" : "w-1 h-8",
          ].join(" ")}
        />
      )}

      {/* Render icon if provided */}
      {Icon && (
        <Icon
          size={isMobile ? 20 : 20}
          className="shrink-0 transition-transform duration-200 ml-1"
        />
      )}

      {/* Renders text label - Hidden on desktop when collapsed */}
      {!collapsed && <span className="truncate">{label}</span>}

      {/* Renders optional badge - Hidden on desktop when collapsed */}
      {!collapsed && item.badge !== undefined && (
        <span className={getBadgeClass(item.badgeColor)}>{item.badge}</span>
      )}
    </a>
  );

  // If collapsed desktop, wrap item inside HeroUI Tooltip for visual hover accessibility
  if (collapsed && !isMobile) {
    return (
      <Tooltip delay={0}>
        <Tooltip.Trigger>
          {linkContent}
        </Tooltip.Trigger>
        <Tooltip.Content
          placement="right"
          className="font-outfit text-xs font-semibold px-2.5 py-1.5 shadow-md border border-border"
        >
          <div className="flex items-center gap-2">
            <span>{label}</span>
            {item.badge !== undefined && (
              <span className={getBadgeClass(item.badgeColor)}>
                {item.badge}
              </span>
            )}
          </div>
        </Tooltip.Content>
      </Tooltip>
    );
  }

  return linkContent;
};

export default SidebarLink;
