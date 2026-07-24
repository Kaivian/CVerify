"use client";

import React, { memo } from "react";
import { Tabs } from "@heroui/react";
import {
  Flame,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  Bookmark,
  Users,
  Clock,
} from "lucide-react";
import { trackForumEvent } from "../services/forum-telemetry";

interface ForumQuickFiltersProps {
  activeFilter: string;
  isAuthenticated: boolean;
  onFilterChange: (filterKey: string) => void;
}

export const ForumQuickFilters = memo(function ForumQuickFilters({
  activeFilter,
  isAuthenticated,
  onFilterChange,
}: ForumQuickFiltersProps) {
  const handleSelectionChange = (key: React.Key) => {
    const filterKey = key.toString();
    trackForumEvent("forum_quick_filter_toggled", {
      filterKey,
    });
    onFilterChange(filterKey);
  };

  return (
    <div className="overflow-x-auto pb-1 scrollbar-none">
      <Tabs
        selectedKey={activeFilter}
        onSelectionChange={handleSelectionChange}
        variant="secondary"
        className="w-max"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Forum quick filters" className="gap-2 sm:gap-4 border-b border-border/40 pb-0">
            
            {/* Latest */}
            <Tabs.Tab id="latest" className="pb-2.5 px-3 text-xs font-semibold select-none cursor-pointer flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Latest</span>
              <Tabs.Indicator />
            </Tabs.Tab>

            {/* Trending */}
            <Tabs.Tab id="trending" className="pb-2.5 px-3 text-xs font-semibold select-none cursor-pointer flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>Trending</span>
              <Tabs.Indicator />
            </Tabs.Tab>

            {/* Solved */}
            <Tabs.Tab id="solved" className="pb-2.5 px-3 text-xs font-semibold select-none cursor-pointer flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-success" />
              <span>Solved</span>
              <Tabs.Indicator />
            </Tabs.Tab>

            {/* Unanswered */}
            <Tabs.Tab id="unanswered" className="pb-2.5 px-3 text-xs font-semibold select-none cursor-pointer flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Unanswered</span>
              <Tabs.Indicator />
            </Tabs.Tab>

            {/* Bookmarked */}
            {isAuthenticated && (
              <Tabs.Tab id="bookmarked" className="pb-2.5 px-3 text-xs font-semibold select-none cursor-pointer flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-accent" />
                <span>Bookmarks</span>
                <Tabs.Indicator />
              </Tabs.Tab>
            )}

            {/* Following */}
            {isAuthenticated && (
              <Tabs.Tab id="following" className="pb-2.5 px-3 text-xs font-semibold select-none cursor-pointer flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" />
                <span>Following</span>
                <Tabs.Indicator />
              </Tabs.Tab>
            )}

          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
    </div>
  );
});
