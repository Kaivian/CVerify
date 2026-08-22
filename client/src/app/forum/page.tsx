"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  forumApi,
  type CategoryResponse,
  type TagResponse,
  type TopicListItemResponse,
} from "@/services/forum.service";
import { Input, Button } from "@heroui/react";
import { PaginationWrapper } from "@/components/ui/pagination-wrapper";
import { Search, PlusCircle, RotateCcw, Hash } from "lucide-react";
import { PublicPageShell } from "@/components/ui/public-page-shell";

// Feature Components & Hooks
import { useForumUrlState } from "@/features/forum/hooks/use-forum-url-state";
import { DiscussionCard } from "@/features/forum/components/discussion-card";
import { CategoriesFilter } from "@/features/forum/components/categories-filter";
import { CategoriesDrawerMobile } from "@/features/forum/components/categories-drawer-mobile";
import { ForumQuickFilters } from "@/features/forum/components/forum-quick-filters";
import {
  DiscussionStreamSkeleton,
  CategoriesFilterSkeleton,
} from "@/features/forum/components/forum-skeletons";
import { ForumEmptyState } from "@/features/forum/components/forum-empty-state";
import { trackForumEvent } from "@/features/forum/services/forum-telemetry";

export default function ForumPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { urlState, updateUrl, resetFilters } = useForumUrlState();

  // Local search query for input binding
  const [searchInput, setSearchInput] = useState(urlState.search);

  // Sync local search input with URL search state
  useEffect(() => {
    setSearchInput(urlState.search);
  }, [urlState.search]);

  // Data states
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [trendingTags, setTrendingTags] = useState<TagResponse[]>([]);
  const [topics, setTopics] = useState<TopicListItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination states
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Load Categories & Trending Tags
  useEffect(() => {
    const loadSidebars = async () => {
      try {
        setCategoriesLoading(true);
        const cats = await forumApi.getCategories();
        setCategories(cats);
      } catch (err) {
        console.error("Failed to load categories", err);
      } finally {
        setCategoriesLoading(false);
      }

      try {
        setTagsLoading(true);
        const tags = await forumApi.getTrendingTags();
        setTrendingTags(tags);
      } catch (err) {
        console.error("Failed to load trending tags", err);
      } finally {
        setTagsLoading(false);
      }
    };

    loadSidebars();
  }, []);

  // Fetch Topics based on active URL state
  const fetchTopics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await forumApi.getTopics({
        search: urlState.search || undefined,
        categoryId: urlState.category || undefined,
        tag: urlState.tag || undefined,
        filter: urlState.filter,
        page: urlState.page,
        pageSize,
      });
      setTopics(result.items || []);
      setTotalPages(result.totalPages || 1);
      setTotalItems(result.totalItems || 0);
    } catch (err: any) {
      setError(err?.message || "Failed to load discussions.");
    } finally {
      setLoading(false);
    }
  }, [urlState.search, urlState.category, urlState.tag, urlState.filter, urlState.page, pageSize]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  // Handlers for URL State Updates
  const handleCategorySelect = (categoryId: string) => {
    updateUrl({ category: categoryId, tag: "", page: 1 });
  };

  const handleTagSelect = (tagSlug: string) => {
    updateUrl({ tag: tagSlug, category: "", page: 1 });
  };

  const handleFilterChange = (filterKey: string) => {
    updateUrl({ filter: filterKey, page: 1 });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    trackForumEvent("forum_search_executed", { searchQuery: searchInput });
    updateUrl({ search: searchInput, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    updateUrl({ page: newPage });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const isFiltered = Boolean(
    urlState.category || urlState.tag || urlState.search || urlState.filter !== "latest"
  );

  return (
    <PublicPageShell>
      <div className="w-full flex flex-col gap-0">

        {/* Compact Page Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/40">
          <div>
            <h1 className="text-xl font-bold text-foreground">Discussions</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Share knowledge and seek verified technical answers
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isFiltered && (
              <Button
                variant="outline"
                size="sm"
                onPress={resetFilters}
                className="text-xs"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </Button>
            )}

            {isAuthenticated ? (
              <Button
                variant="primary"
                size="sm"
                onPress={() => {
                  trackForumEvent("forum_create_discussion_clicked", { source: "header" });
                  router.push("/forum/new");
                }}
                className="font-semibold"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1" />
                New Discussion
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onPress={() => router.push("/login?redirect=/forum/new")}
                className="font-semibold"
              >
                Log In to Post
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Category Drawer Trigger */}
        <div className="mt-4">
          <CategoriesDrawerMobile
            categories={categories}
            selectedCategoryId={urlState.category}
            onSelectCategory={handleCategorySelect}
          />
        </div>

        {/* Core Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 mt-4">

          {/* Left Sidebar: Categories (Desktop) */}
          <div className="hidden lg:block order-2 lg:order-1">
            {categoriesLoading ? (
              <CategoriesFilterSkeleton />
            ) : (
              <CategoriesFilter
                categories={categories}
                selectedCategoryId={urlState.category}
                onSelectCategory={handleCategorySelect}
              />
            )}
          </div>

          {/* Main Discussion Stream */}
          <div className="flex flex-col gap-0 order-1 lg:order-2">

            {/* Search Bar */}
            <form onSubmit={handleSearchSubmit} className="mb-3">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                <Input
                  placeholder="Search discussions..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10 pr-12 bg-surface border-border/50 focus:border-primary text-sm rounded-xl h-9"
                />
                {searchInput ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      updateUrl({ search: "", page: 1 });
                    }}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                ) : (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground/40 bg-muted/10 px-1.5 py-0.5 rounded border border-border/30 pointer-events-none">
                    /
                  </span>
                )}
              </div>
            </form>

            {/* Quick Filter Tabs */}
            <div className="mb-3">
              <ForumQuickFilters
                activeFilter={urlState.filter}
                isAuthenticated={isAuthenticated}
                onFilterChange={handleFilterChange}
              />
            </div>

            {/* Trending Tags (inline) */}
            {!tagsLoading && trendingTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-3 px-1">
                <Hash className="w-3 h-3 text-muted-foreground/60" />
                {trendingTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleTagSelect(tag.slug)}
                    className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${
                      urlState.tag === tag.slug
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-secondary/50"
                    }`}
                  >
                    #{tag.name}
                  </button>
                ))}
              </div>
            )}

            {/* Discussion List */}
            {loading ? (
              <DiscussionStreamSkeleton count={5} />
            ) : error ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-3 rounded-xl border border-border/60 bg-surface">
                <h3 className="text-sm font-bold text-foreground">Failed to load discussions</h3>
                <p className="text-muted-foreground text-xs max-w-sm">{error}</p>
                <Button variant="primary" size="sm" onPress={fetchTopics}>
                  Try Again
                </Button>
              </div>
            ) : topics.length === 0 ? (
              <ForumEmptyState
                type={
                  urlState.search
                    ? 'search'
                    : urlState.filter === 'bookmarked'
                    ? 'bookmark'
                    : urlState.category
                    ? 'category'
                    : 'general'
                }
                searchQuery={urlState.search}
                categoryName={categories.find((c) => c.id === urlState.category)?.name}
                isAuthenticated={isAuthenticated}
                onClearFilters={resetFilters}
              />
            ) : (
              <div className="rounded-xl border border-border/60 bg-surface overflow-hidden">
                {topics.map((topic) => (
                  <DiscussionCard
                    key={topic.id}
                    topic={topic}
                    isAuthenticated={isAuthenticated}
                    onTagSelect={handleTagSelect}
                    onCategorySelect={handleCategorySelect}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4">
                <PaginationWrapper
                  page={urlState.page}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  itemsPerPage={pageSize}
                  onPageChange={handlePageChange}
                />
              </div>
            )}

          </div>

        </div>

      </div>
    </PublicPageShell>
  );
}
