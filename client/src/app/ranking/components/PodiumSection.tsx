"use client";

import React from "react";
import { type RankingResponseItem } from "@/types/profile.types";
import { PodiumCard } from "./PodiumCard";
import { Skeleton } from "@heroui/react";

interface PodiumSectionProps {
  candidates: RankingResponseItem[];
  loading: boolean;
  category: string;
  page: number;
}

export const PodiumSection: React.FC<PodiumSectionProps> = ({
  candidates,
  loading,
  category,
  page,
}) => {
  const supportedCategories = ["Global", "TopContributors", "TopVerified", "HighestTrust", "TopAi"];
  
  // Show podium only on page 1 for specific supported ranking lists
  if (page !== 1 || !supportedCategories.includes(category)) {
    return null;
  }

  // Loading skeleton state
  if (loading && candidates.length === 0) {
    return (
      <div className="grid grid-cols-3 gap-3 md:gap-6 items-end justify-center py-8 border-b border-border/40 mb-8 bg-surface-secondary/15 rounded-3xl px-3 md:px-6 min-h-[260px] relative select-none">
        {/* Second Place Skeleton (Left) */}
        <div className="flex flex-col items-center justify-end w-full relative">
          <div className="flex flex-col items-center gap-2 mb-3 z-10 w-full px-2">
            <Skeleton className="w-20 h-20 rounded-2xl" />
            <Skeleton className="h-3 w-16 rounded-md" />
            <Skeleton className="h-2 w-24 rounded-md" />
          </div>
          <div className="w-full relative flex flex-col items-center">
            <div className="h-6 w-full bg-surface-secondary/40" style={{ clipPath: "polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%)" }} />
            <Skeleton className="w-full rounded-b-2xl h-28" />
          </div>
        </div>

        {/* First Place Skeleton (Center) */}
        <div className="flex flex-col items-center justify-end w-full relative">
          <div className="flex flex-col items-center gap-2 mb-3 z-10 w-full px-2">
            <Skeleton className="w-24 h-24 rounded-2xl" />
            <Skeleton className="h-3.5 w-20 rounded-md" />
            <Skeleton className="h-2.5 w-28 rounded-md" />
          </div>
          <div className="w-full relative flex flex-col items-center">
            <div className="h-6 w-full bg-surface-secondary/40" style={{ clipPath: "polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%)" }} />
            <Skeleton className="w-full rounded-b-2xl h-36" />
          </div>
        </div>

        {/* Third Place Skeleton (Right) */}
        <div className="flex flex-col items-center justify-end w-full relative">
          <div className="flex flex-col items-center gap-2 mb-3 z-10 w-full px-2">
            <Skeleton className="w-16 h-16 rounded-2xl" />
            <Skeleton className="h-3 w-12 rounded-md" />
            <Skeleton className="h-2 w-20 rounded-md" />
          </div>
          <div className="w-full relative flex flex-col items-center">
            <div className="h-6 w-full bg-surface-secondary/40" style={{ clipPath: "polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%)" }} />
            <Skeleton className="w-full rounded-b-2xl h-24" />
          </div>
        </div>
      </div>
    );
  }

  // If there aren't enough candidates, hide the podium section gracefully
  if (candidates.length < 3) {
    return null;
  }

  const first = candidates[0];
  const second = candidates[1];
  const third = candidates[2];

  return (
    <div className="grid grid-cols-3 gap-3 md:gap-6 items-end justify-center py-8 border-b border-border/40 mb-8 bg-surface-secondary/15 rounded-3xl px-3 md:px-6 relative">
      <PodiumCard candidate={second} rank={2} />
      <PodiumCard candidate={first} rank={1} />
      <PodiumCard candidate={third} rank={3} />
    </div>
  );
};
