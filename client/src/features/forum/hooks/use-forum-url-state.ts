"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

export interface ForumUrlState {
  category: string;
  filter: string;
  tag: string;
  search: string;
  page: number;
}

export function useForumUrlState() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const urlState = useMemo<ForumUrlState>(() => {
    const category = searchParams.get("category") || "";
    const filter = searchParams.get("filter") || "latest";
    const tag = searchParams.get("tag") || "";
    const search = searchParams.get("search") || "";
    const pageStr = searchParams.get("page");
    const page = pageStr ? Math.max(1, parseInt(pageStr, 10) || 1) : 1;

    return { category, filter, tag, search, page };
  }, [searchParams]);

  const updateUrl = useCallback(
    (newParams: Partial<ForumUrlState>, options?: { replace?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (newParams.category !== undefined) {
        if (newParams.category) params.set("category", newParams.category);
        else params.delete("category");
      }

      if (newParams.filter !== undefined) {
        if (newParams.filter && newParams.filter !== "latest") {
          params.set("filter", newParams.filter);
        } else {
          params.delete("filter");
        }
      }

      if (newParams.tag !== undefined) {
        if (newParams.tag) params.set("tag", newParams.tag);
        else params.delete("tag");
      }

      if (newParams.search !== undefined) {
        if (newParams.search) params.set("search", newParams.search);
        else params.delete("search");
      }

      if (newParams.page !== undefined) {
        if (newParams.page > 1) params.set("page", newParams.page.toString());
        else params.delete("page");
      }

      const queryString = params.toString();
      const newPath = queryString ? `${pathname}?${queryString}` : pathname;

      if (options?.replace) {
        router.replace(newPath, { scroll: false });
      } else {
        router.push(newPath, { scroll: false });
      }
    },
    [searchParams, router, pathname]
  );

  const resetFilters = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [router, pathname]);

  return {
    urlState,
    updateUrl,
    resetFilters,
  };
}
