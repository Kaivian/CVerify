"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Breadcrumbs } from "@heroui/react";
import { getRouteMetadata, getDynamicSegmentLabel } from "../../config/routes";
import { useAuth } from "../../features/auth/hooks/use-auth";

export const AppBreadcrumbs: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const isBusiness = user?.role === "BUSINESS";

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
    if (segment === "workspace" && isBusiness) {
      continue;
    }

    // Construct cumulative URL path up to current index from the original segments array
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

  // Set the isLast property for the final item
  if (breadcrumbItems.length > 0) {
    breadcrumbItems[breadcrumbItems.length - 1].isLast = true;
  }

  return (
    <nav aria-label="Breadcrumbs Navigation" className="hidden md:flex">
      <Breadcrumbs>
        {/* Dynamic Nodes */}
        {breadcrumbItems.map((item) => (
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
