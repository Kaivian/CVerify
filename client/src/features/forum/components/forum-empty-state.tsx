"use client";

import React from "react";
import { Button } from "@heroui/react";
import {
  MessageSquare,
  SearchX,
  BookmarkX,
  PlusCircle,
  RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface ForumEmptyStateProps {
  type?: 'search' | 'category' | 'bookmark' | 'solved' | 'general';
  searchQuery?: string;
  categoryName?: string;
  isAuthenticated: boolean;
  onClearFilters: () => void;
}

export function ForumEmptyState({
  type = 'general',
  searchQuery,
  categoryName,
  isAuthenticated,
  onClearFilters,
}: ForumEmptyStateProps) {
  const router = useRouter();

  let icon = <MessageSquare className="w-6 h-6 text-muted-foreground/50" />;
  let title = "No discussions found";
  let description = "There are no topics matching your active filter criteria. Try clearing your filters or start a new discussion.";
  let actions: React.ReactNode = null;

  if (type === 'search' || searchQuery) {
    icon = <SearchX className="w-6 h-6 text-muted-foreground/50" />;
    title = "No matching discussions";
    description = `No topics found for "${searchQuery}". Try broadening your search or reset filters.`;
    actions = (
      <Button variant="secondary" size="sm" onPress={onClearFilters}>
        <RotateCcw className="w-3.5 h-3.5 mr-1" />
        Clear Search
      </Button>
    );
  } else if (type === 'bookmark') {
    icon = <BookmarkX className="w-6 h-6 text-muted-foreground/50" />;
    title = "No bookmarked discussions";
    description = "You haven\u0027t saved any discussions yet. Bookmark topics to find them here.";
    actions = (
      <Button variant="secondary" size="sm" onPress={onClearFilters}>
        Browse All Discussions
      </Button>
    );
  } else if (type === 'category' && categoryName) {
    title = `No discussions in ${categoryName}`;
    description = `Be the first to start a discussion in ${categoryName}.`;
    actions = isAuthenticated ? (
      <Button variant="primary" size="sm" onPress={() => router.push("/forum/new")}>
        <PlusCircle className="w-3.5 h-3.5 mr-1" />
        Start Discussion
      </Button>
    ) : (
      <Button variant="secondary" size="sm" onPress={() => router.push("/login?redirect=/forum/new")}>
        Log In to Post
      </Button>
    );
  } else {
    actions = (
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onPress={onClearFilters}>
          Clear Filters
        </Button>
        {isAuthenticated && (
          <Button variant="primary" size="sm" onPress={() => router.push("/forum/new")}>
            <PlusCircle className="w-3.5 h-3.5 mr-1" />
            New Discussion
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 rounded-xl border border-dashed border-border/60 bg-surface">
      <div className="mb-3">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground text-center max-w-xs mb-4 leading-relaxed">
        {description}
      </p>
      {actions}
    </div>
  );
}
