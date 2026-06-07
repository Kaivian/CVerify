"use client";

import React, { useMemo, useState } from "react";
import { Typography } from "@heroui/react";
import { Info, AlertTriangle, RefreshCw } from "lucide-react";

interface RepositoryHeatmapProps {
  dailyCommits: Record<string, number> | null | undefined;
  userDailyCommits: Record<string, number> | null | undefined;
  onReanalyze?: () => void;
  isReanalyzing?: boolean;
}

export const RepositoryHeatmap: React.FC<RepositoryHeatmapProps> = ({
  dailyCommits,
  userDailyCommits,
  onReanalyze,
  isReanalyzing = false,
}) => {
  const [showUserOnly, setShowUserOnly] = useState(true);

  // 1. Generate dates for the last 364 days aligned to Sunday
  const dateRange = useMemo(() => {
    const today = new Date();
    const dates: Date[] = [];
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 364);
    const startDay = startDate.getDay(); // 0 is Sunday
    startDate.setDate(startDate.getDate() - startDay); // Align to Sunday

    const current = new Date(startDate);
    for (let i = 0; i < 371; i++) { // 53 weeks * 7 days
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }, []);

  const activeData = showUserOnly ? userDailyCommits : dailyCommits;

  // Calculate stats
  const totalCommits = useMemo(() => {
    if (!activeData) return 0;
    return Object.values(activeData).reduce((sum, val) => sum + val, 0);
  }, [activeData]);

  // Loading state (Undefined data)
  const isLoading = dailyCommits === undefined;

  // Legacy state (Null data from before caches existed)
  const isLegacy = dailyCommits === null;

  // Empty state (0 total commits)
  const isEmpty = !isLoading && !isLegacy && totalCommits === 0;

  // Sparse state (<5 commits)
  const isSparse = !isLoading && !isLegacy && !isEmpty && totalCommits < 5;

  const getCellColor = (count: number) => {
    if (count === 0) return "bg-neutral-100 dark:bg-neutral-800";
    if (count <= 2) return "bg-accent/20 border border-accent/10";
    if (count <= 5) return "bg-accent/40 border border-accent/20";
    if (count <= 10) return "bg-accent/70 border border-accent/30";
    return "bg-accent border border-accent/40";
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLegacy) {
    return (
      <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-surface-secondary/40 h-[120px] text-center">
        <Typography type="body-xs" className="text-muted-foreground mb-2">
          Commit history heatmap is not cached for this repository version.
        </Typography>
        {onReanalyze && (
          <button
            onClick={onReanalyze}
            disabled={isReanalyzing}
            className="flex items-center gap-1.5 text-xs text-accent font-bold hover:underline cursor-pointer border-0 bg-transparent disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${isReanalyzing ? "animate-spin" : ""}`} />
            {isReanalyzing ? "Reanalyzing..." : "Reanalyze to generate heatmap"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 select-none w-full">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <Typography type="body-xs" className="font-bold text-foreground">
          {totalCommits} {showUserOnly ? "Verified Developer" : "Total"} Commits
        </Typography>

        {!isLoading && !isEmpty && (
          <div className="flex items-center gap-1 bg-surface-secondary p-0.5 rounded-lg border border-border">
            <button
              onClick={() => setShowUserOnly(true)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border-0 cursor-pointer ${
                showUserOnly
                  ? "bg-accent text-white shadow-sm"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Verified
            </button>
            <button
              onClick={() => setShowUserOnly(false)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border-0 cursor-pointer ${
                !showUserOnly
                  ? "bg-accent text-white shadow-sm"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
          </div>
        )}
      </div>

      {/* Heatmap Grid */}
      <div className="flex items-center w-full overflow-x-auto no-scrollbar scroll-smooth">
        {/* Day name labels */}
        <div className="grid grid-rows-7 gap-[3px] text-[8px] text-muted-foreground mr-1.5 h-[88px] pr-1 py-[2px] justify-items-end select-none pointer-events-none">
          <span></span>
          <span>Mon</span>
          <span></span>
          <span>Wed</span>
          <span></span>
          <span>Fri</span>
          <span></span>
        </div>

        {/* Calendar Cells */}
        <div className="grid grid-flow-col grid-rows-7 gap-[3px] h-[88px] py-[2px]">
          {isLoading
            ? Array.from({ length: 371 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[10px] h-[10px] rounded-[1.5px] bg-neutral-100 dark:bg-neutral-800 animate-pulse"
                />
              ))
            : dateRange.map((date, idx) => {
                const dateStr = date.toISOString().split("T")[0];
                const count = activeData ? activeData[dateStr] ?? 0 : 0;
                return (
                  <div
                    key={idx}
                    title={`${count} commits on ${formatDate(date)}`}
                    className={`w-[10px] h-[10px] rounded-[1.5px] transition-colors duration-200 cursor-help ${getCellColor(
                      count
                    )}`}
                  />
                );
              })}
        </div>
      </div>

      {/* Heatmap Legend & Warnings */}
      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
        <div>
          {isSparse && (
            <span className="flex items-center gap-1 text-warning font-bold">
              <AlertTriangle className="h-3 w-3" />
              Sparse history. Verified email signature might not match.
            </span>
          )}
          {isEmpty && (
            <span className="flex items-center gap-1 text-muted-foreground font-medium">
              <Info className="h-3 w-3" />
              No verified developer commits recorded in this repository.
            </span>
          )}
        </div>
        {!isLoading && !isEmpty && (
          <div className="flex items-center gap-1 select-none pointer-events-none">
            <span>Less</span>
            <div className="w-2.5 h-2.5 rounded-[1.5px] bg-neutral-100 dark:bg-neutral-800" />
            <div className="w-2.5 h-2.5 rounded-[1.5px] bg-accent/20" />
            <div className="w-2.5 h-2.5 rounded-[1.5px] bg-accent/50" />
            <div className="w-2.5 h-2.5 rounded-[1.5px] bg-accent/70" />
            <div className="w-2.5 h-2.5 rounded-[1.5px] bg-accent" />
            <span>More</span>
          </div>
        )}
      </div>
    </div>
  );
};
