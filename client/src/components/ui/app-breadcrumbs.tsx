"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Breadcrumbs } from "@heroui/react";
import { getRouteMetadata, getDynamicSegmentLabel } from "../../config/routes";
import { useAuth } from "../../features/auth/hooks/use-auth";
import { useWorkspaceStore } from "../../features/workspace/store/use-workspace-store";
import { RESERVED_USERNAMES } from "../../lib/navigation-utils";

/**
 * Checks if a generated breadcrumb URL corresponds to a valid existing page route.
 */
const isRouteExist = (href: string): boolean => {
  const path = href.replace(/\/+/g, "/");

  if (path === "/") {
    return true;
  }

  // Dynamic candidate profiles validation
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 1 && !RESERVED_USERNAMES.has(segments[0].toLowerCase())) {
    return true;
  }

  // 1. Workspace routes checking
  // Matches exact valid pages.
  const workspaceRegex = /^\/business\/([^/]+)(?:\/(billing|information|members|roles|settings|jobs|people|posts|intelligence|dashboard|listings|bookings|revenue|customers|analytics))?$/i;
  
  if (workspaceRegex.test(path)) {
    return true;
  }

  // Check for candidate detail in intelligence: /business/[org]/intelligence/[id]
  const intelligenceDetailRegex = /^\/business\/[^/]+\/intelligence\/[^/]+$/i;
  if (intelligenceDetailRegex.test(path)) {
    return true;
  }

  // Check for recruitment sub-routes:
  // - /business/[org]/recruitment/dashboard
  // - /business/[org]/recruitment/jd
  // - /business/[org]/recruitment/jd/[id]/review
  const recruitmentDashboardOrJdRegex = /^\/business\/[^/]+\/recruitment\/(dashboard|jd)$/i;
  if (recruitmentDashboardOrJdRegex.test(path)) {
    return true;
  }

  const jdReviewRegex = /^\/business\/[^/]+\/recruitment\/jd\/[^/]+\/review$/i;
  if (jdReviewRegex.test(path)) {
    return true;
  }

  // 2. Validate dynamically against centralized route registry
  const metadata = getRouteMetadata(path);
  return metadata !== null;
};

export const AppBreadcrumbs: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const workspacesStore = useWorkspaceStore((s) => s.workspaces);

  if (!pathname) return null;

  // Split path, remove empty strings, and ignore Next.js parenthesized folder route groups (e.g. (private))
  const segments = pathname
    .split("/")
    .filter(
      (segment) =>
        segment && !segment.startsWith("(") && !segment.endsWith(")"),
    );

  // Build breadcrumb items based on accumulated path segments
  const breadcrumbItems: Array<{ href: string; label: string; isLast: boolean }> = [];

  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    
    // Skip "business" segment
    if (segment === "business") {
      if (user?.role === "USER") {
        breadcrumbItems.push({
          href: "/workspace/organizations",
          label: "Organizations",
          isLast: false,
        });
      }
      continue;
    }
    
    // Skip the dynamic organization slug that follows "business"
    if (index > 0 && segments[index - 1] === "business") {
      if (user?.role === "USER") {
        const orgDetails = workspacesStore[segment];
        const label = orgDetails?.organizationName || getDynamicSegmentLabel(segment);
        breadcrumbItems.push({
          href: `/business/${segment}`,
          label,
          isLast: false,
        });
      }
      continue;
    }

    // Construct cumulative URL path up to current index from original segments
    const href = "/" + segments.slice(0, index + 1).join("/");
    const metadata = getRouteMetadata(href);

    let label = "";

    if (metadata) {
      // Use fallbackLabel directly (English text)
      label = metadata.fallbackLabel;
    } else {
      // If no route metadata exists, dynamically format the raw segment (e.g. UUID, number, slug)
      label = getDynamicSegmentLabel(segment);
    }

    breadcrumbItems.push({
      href,
      label,
      isLast: false,
    });
  }

  // Filter breadcrumb items to only include existing routes
  const filteredBreadcrumbItems = breadcrumbItems.filter((item) => isRouteExist(item.href));

  // Set the isLast property for the final item
  if (filteredBreadcrumbItems.length > 0) {
    filteredBreadcrumbItems[filteredBreadcrumbItems.length - 1].isLast = true;
  }

  if (filteredBreadcrumbItems.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumbs Navigation" className="hidden md:flex">
      <Breadcrumbs>
        {/* Dynamic Nodes */}
        {filteredBreadcrumbItems.map((item) => (
          <Breadcrumbs.Item
            key={item.href}
            href={item.href}
            onClick={(e) => {
              e.preventDefault();
              if (item.isLast) {
                window.location.reload();
              } else {
                router.push(item.href);
              }
            }}
            className={item.isLast ? "hover:underline cursor-pointer" : ""}
          >
            {item.label}
          </Breadcrumbs.Item>
        ))}
      </Breadcrumbs>
    </nav>
  );
};

export default AppBreadcrumbs;
