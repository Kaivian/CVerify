"use client";

import React from "react";
import { Separator, Typography, Tooltip } from "@heroui/react";
import { type NavigationSectionItem } from "../../../types/navigation.types";
import SidebarLink from "./sidebar-link";
import SidebarGroup from "./sidebar-group";

interface SidebarSectionProps {
  section: NavigationSectionItem;
  collapsed: boolean;
  isMobile: boolean;
  depth?: number;
}

export const SidebarSection: React.FC<SidebarSectionProps> = ({
  section,
  collapsed,
  isMobile,
  depth = 0,
}) => {
  const label = section.label;

  return (
    <div className="flex flex-col gap-1 w-full select-none">
      {/* Visual Section Header Label */}
      {collapsed ? (
        <Tooltip delay={0} isDisabled={isMobile}>
          <Tooltip.Trigger>
            <button
              type="button"
              className="mb-2 shrink-0 w-full flex items-center justify-center cursor-help border-none bg-transparent p-0 outline-hidden"
            >
              <Separator variant="tertiary" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content
            placement="right"
            className="font-outfit text-xs font-semibold px-2.5 py-1.5 shadow-md border border-border"
          >
            <span>{label}</span>
          </Tooltip.Content>
        </Tooltip>
      ) : (
        <div className="shrink-0">
          <Typography
            type="body-xs"
            className="text-muted/75 text-[10px] font-extrabold uppercase tracking-wider font-outfit select-none truncate"
          >
            {label}
          </Typography>
        </div>
      )}

      {/* Render nested children inside section */}
      <div className="flex flex-col gap-1.5 w-full">
        {section.children.map((child) => {
          if (child.type === "item") {
            return (
              <SidebarLink
                key={child.id}
                item={child}
                collapsed={collapsed}
                isMobile={isMobile}
                depth={depth}
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
                depth={depth}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
};

export default SidebarSection;
