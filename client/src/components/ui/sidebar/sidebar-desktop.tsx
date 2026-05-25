"use client";

import React from "react";
import { ScrollShadow } from "@heroui/react";
import { useSidebarStore } from "../../../stores/use-sidebar-store";
import SidebarBrand from "./sidebar-brand";
import SidebarContent from "./sidebar-content";

export const SidebarDesktop: React.FC = () => {
  const isCollapsed = useSidebarStore((state) => state.isCollapsed);

  return (
    <div className="hidden md:flex flex-col min-h-[95%] items-center justify-center">
      <aside
        className={[
          "hidden md:flex flex-col h-full sticky m-3 border-2 rounded-2xl transition-all duration-300 ease-in-out z-20 overflow-hidden bg-background",
          isCollapsed ? "w-16" : "w-64",
        ].join(" ")}
      >
        {/* 1. Header Branding */}
        <SidebarBrand collapsed={isCollapsed} />

        {/* 2. Centralized Scrollable Menu Area wrapped in HeroUI ScrollShadow */}
        <ScrollShadow className="flex-1 px-3 py-4 flex flex-col gap-4 overflow-y-auto min-h-0">
          <SidebarContent collapsed={isCollapsed} isMobile={false} />
        </ScrollShadow>
      </aside>
    </div>
  );
};

export default SidebarDesktop;
