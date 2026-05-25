"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Breadcrumbs } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { getRouteMetadata, getDynamicSegmentLabel } from "../../config/routes";

export const AppBreadcrumbs: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation(["common"]);

  if (!pathname) return null;

  // Split path, remove empty strings, and ignore Next.js parenthesized folder route groups (e.g. (private))
  const segments = pathname
    .split("/")
    .filter(
      (segment) =>
        segment && !segment.startsWith("(") && !segment.endsWith(")"),
    );

  // Build breadcrumb items based on accumulated path segments
  const breadcrumbItems = segments.map((segment, index) => {
    // Construct cumulative URL path up to current index
    const href = "/" + segments.slice(0, index + 1).join("/");
    const metadata = getRouteMetadata(href);

    let label = "";

    if (metadata) {
      // Resolve localized label using standard translation key if present
      label = t(metadata.translationKey, {
        defaultValue: metadata.fallbackLabel,
      });
    } else {
      // If no route metadata exists, dynamically format the raw segment (e.g. UUID, number, slug)
      label = getDynamicSegmentLabel(segment);
    }

    const isLast = index === segments.length - 1;

    return {
      href,
      label,
      isLast,
    };
  });

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
