"use client";

import React, { useMemo } from "react";
import { useAuth } from "../../../features/auth/hooks/use-auth";
import { navigationConfig } from "../../../config/navigation-config";
import { filterNavigationNodes } from "../../../lib/navigation-utils";
import SidebarLink from "./sidebar-link";
import SidebarGroup from "./sidebar-group";
import SidebarSection from "./sidebar-section";

interface SidebarContentProps {
  collapsed: boolean;
  isMobile: boolean;
}

export const SidebarContent: React.FC<SidebarContentProps> = ({
  collapsed,
  isMobile,
}) => {
  const { user, hasPermission } = useAuth();
  const userRole = user?.role || "USER";

  // Memoize filtered navigation nodes to optimize performance and prevent redundant re-renders
  const filteredNodes = useMemo(() => {
    return filterNavigationNodes(navigationConfig, userRole, hasPermission);
  }, [userRole, hasPermission]);

  return (
    <nav
      className={["flex flex-col w-full", isMobile ? "gap-2" : "gap-3"].join(
        " ",
      )}
      aria-label={
        isMobile ? "Mobile Sidebar Navigation" : "Desktop Sidebar Navigation"
      }
    >
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
    </nav>
  );
};

export default SidebarContent;
