"use client";

import React from "react";
import { Skeleton } from "@heroui/react";

export function DiscussionCardSkeleton() {
  return (
    <div className="flex gap-4 px-4 py-3.5 border-b border-border/40">
      {/* Left: Vote + Avatar */}
      <div className="flex flex-col items-center gap-2 shrink-0">
        <Skeleton className="h-8 w-6 rounded-lg" />
        <Skeleton className="h-7 w-7 rounded-full" />
      </div>

      {/* Center: Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <Skeleton className="h-4 rounded-md w-3/4" />
        <Skeleton className="h-3 rounded-md w-full" />
        <div className="flex items-center gap-2 mt-0.5">
          <Skeleton className="h-3 rounded-md w-16" />
          <Skeleton className="h-3 rounded-md w-20" />
          <Skeleton className="h-3 rounded-md w-14" />
        </div>
      </div>

      {/* Right: Stats */}
      <div className="hidden sm:flex items-center gap-4 shrink-0">
        <Skeleton className="h-4 rounded-md w-8" />
        <Skeleton className="h-4 rounded-md w-8" />
        <Skeleton className="h-4 rounded-md w-14" />
      </div>
    </div>
  );
}

export function DiscussionStreamSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col rounded-xl border border-border/60 bg-surface overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <DiscussionCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function CategoriesFilterSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-3 rounded-md w-20 mb-1" />
      <Skeleton className="h-7 rounded-lg w-full" />
      <Skeleton className="h-3 rounded-md w-16 mt-2" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-7 rounded-lg w-full" />
      ))}
    </div>
  );
}
