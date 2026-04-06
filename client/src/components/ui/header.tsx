"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Menu, PanelLeft, Bell, Compass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSidebarStore } from "../../stores/use-sidebar-store";
import { AuthAvatar } from "./auth-avatar";
import { Typography, Button, Separator } from "@heroui/react";
import { getRouteMetadata, getDynamicSegmentLabel } from "../../config/routes";
import { AppBreadcrumbs } from "../../components/ui/app-breadcrumbs";

export const Header: React.FC = () => {
  const { t } = useTranslation(["common", "navbar", "sidebar"]);
  const pathname = usePathname();
  const { isCollapsed, toggleCollapsed, setMobileOpen } = useSidebarStore();

  const metadata = getRouteMetadata(pathname || "");
  let pageTitle = "";
  if (metadata) {
    pageTitle = t(metadata.translationKey, {
      defaultValue: metadata.fallbackLabel,
    });
  } else if (pathname) {
    const segments = pathname
      .split("/")
      .filter((s) => s && !s.startsWith("(") && !s.endsWith(")"));
    const lastSegment = segments[segments.length - 1];
    if (lastSegment) {
      pageTitle = getDynamicSegmentLabel(lastSegment);
    }
  }

  return (
    <header className="flex m-3 ml-0 h-16 items-center justify-between px-6 py-6 border-2 rounded-2xl bg-background select-none">
      {/* Left side: toggle controls & mobile brand logo */}
      <div className="flex items-center gap-3">
        {/* Mobile: Hamburger toggle button */}
        <button
          onClick={() => setMobileOpen(true)}
          aria-label={t("navbar:menu.userMenu", { defaultValue: "Open Menu" })}
          className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-secondary text-muted hover:text-foreground cursor-pointer transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Menu size={20} />
        </button>

        {/* Desktop: Collapse toggle button */}
        <Button
          variant="ghost"
          isIconOnly
          className="rounded-lg"
          onClick={toggleCollapsed}
          aria-label={
            isCollapsed
              ? t("sidebar:expand", { defaultValue: "Expand Sidebar" })
              : t("sidebar:collapse", { defaultValue: "Collapse Sidebar" })
          }
        >
          <PanelLeft className="w-5 h-5" />
        </Button>

        {/* Page Title */}
        {pageTitle && <AppBreadcrumbs />}

        {/* Mobile-only logo */}
        <div className="md:hidden flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-foreground text-background flex items-center justify-center shadow-sm shrink-0">
            <Compass size={16} />
          </div>
          <Typography
            type="body-sm"
            className="font-bold tracking-tight font-outfit text-foreground leading-none"
          >
            {t("common:branding.title", { defaultValue: "CVerify" })}
          </Typography>
        </div>
      </div>
      {/* Right side: Notifications, Session status, User profile avatar */}
      <div className="flex items-center gap-3">
        {/* Session protected indicator */}
        {/* Action Button: Notifications (Placeholder for Page-level actions) */}
        <Button
          variant="ghost"
          isIconOnly
          aria-label={t("navbar:notifications.title", { defaultValue: "Notifications" })}
          className="rounded-lg"
        >
          <Bell size={18} />
        </Button>
        <Separator orientation="vertical" variant="tertiary" />
        {/* User profile dropdown avatar (always in Header now!) */}
        <AuthAvatar />
      </div>
    </header>
  );
};

export default Header;
