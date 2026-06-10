"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  forumApi,
  type CategoryResponse,
  type TagResponse,
  type TopicListItemResponse
} from "@/services/forum.service";
import {
  Input,
  Chip,
  Tabs,
  Spinner,
  Avatar,
  Button,
  Skeleton,
  TagGroup,
  Tag
} from "@heroui/react";
import { PaginationWrapper } from "@/components/ui/pagination-wrapper";
import { Card } from "@/components/ui/card";
import {
  Search,
  MessageSquare,
  TrendingUp,
  Eye,
  CheckCircle,
  PlusCircle,
  Hash,
  Award,
  Megaphone,
  Briefcase,
  Code,
  Layout,
  Server,
  Cloud,
  Shield,
  HelpCircle,
  Folder,
  ArrowUp,
  BookMarked
} from "lucide-react";
import { PublicPageShell } from "@/components/ui/public-page-shell";

// Map lucide icons dynamically based on backend seed values
const IconMap: { [key: string]: React.ComponentType<any> } = {
  MessageSquare,
  Code,
  Layout,
  Server,
  Cloud,
  Shield,
  TrendingUp,
  Briefcase,
  Folder,
  Megaphone
};

export default function ForumPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();

  // Search & filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("latest");
  const [selectedTag, setSelectedTag] = useState<string>("");

  // Data states
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [trendingTags, setTrendingTags] = useState<TagResponse[]>([]);
  const [topics, setTopics] = useState<TopicListItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Initialize filters from URL search params
  useEffect(() => {
    const catParam = searchParams?.get("category");
    const tagParam = searchParams?.get("tag");
    const filterParam = searchParams?.get("filter");
    const searchParam = searchParams?.get("search");

    if (catParam) setSelectedCategoryId(catParam);
    if (tagParam) setSelectedTag(tagParam);
    if (filterParam) setActiveTab(filterParam);
    if (searchParam) setSearchQuery(searchParam);
  }, [searchParams]);

  // Load Categories & Tags
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

  // Fetch Topics based on active filters
  const fetchTopics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await forumApi.getTopics({
        search: searchQuery || undefined,
        categoryId: selectedCategoryId || undefined,
        tag: selectedTag || undefined,
        filter: activeTab,
        page,
        pageSize
      });
      setTopics(result.items || []);
      setTotalPages(result.totalPages || 1);
      setTotalItems(result.totalItems || 0);
    } catch (err: any) {
      setError(err?.message || "Failed to load discussions.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategoryId, selectedTag, activeTab, page, pageSize]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  // Handle filter changes
  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedTag(""); // Clear tag filter
    setPage(1);
    
    const params = new URLSearchParams(window.location.search);
    if (categoryId) {
      params.set("category", categoryId);
    } else {
      params.delete("category");
    }
    params.delete("tag");
    router.push(`/forum?${params.toString()}`);
  };

  const handleTagSelect = (tagSlug: string) => {
    setSelectedTag(tagSlug);
    setSelectedCategoryId(""); // Clear category filter
    setPage(1);

    const params = new URLSearchParams(window.location.search);
    if (tagSlug) {
      params.set("tag", tagSlug);
    } else {
      params.delete("tag");
    }
    params.delete("category");
    router.push(`/forum?${params.toString()}`);
  };

  const handleTabChange = (key: React.Key) => {
    const tab = key.toString();
    setActiveTab(tab);
    setPage(1);

    const params = new URLSearchParams(window.location.search);
    params.set("filter", tab);
    router.push(`/forum?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    
    const params = new URLSearchParams(window.location.search);
    if (searchQuery) {
      params.set("search", searchQuery);
    } else {
      params.delete("search");
    }
    router.push(`/forum?${params.toString()}`);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCategoryId("");
    setSelectedTag("");
    setActiveTab("latest");
    setPage(1);
    router.push("/forum");
  };

  // Helper to format timestamps nicely
  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <PublicPageShell>
      <div className="w-full flex flex-col gap-6">
        
        {/* Banner Section */}
        <div className="relative rounded-3xl bg-linear-to-r from-primary-900/40 via-surface/60 to-surface border border-border/40 p-8 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/5 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />
          <div className="flex flex-col gap-2 relative z-10 text-left">
            <h1 className="text-3xl font-extrabold tracking-tight">Community Forum</h1>
            <p className="text-muted-foreground text-sm max-w-lg">
              Collaborate, share knowledge, and seek verified answers from candidates, businesses, and experts on CVerify.
            </p>
          </div>
          
          <div className="relative z-10 flex gap-3 shrink-0">
            {isAuthenticated ? (
              <Button
                variant="primary"
                onPress={() => router.push("/forum/new")}
              >
                <PlusCircle className="w-4 h-4 mr-1.5 inline-block align-middle" />
                <span>Create Discussion</span>
              </Button>
            ) : (
              <Button
                variant="primary"
                onPress={() => router.push("/login?redirect=/forum/new")}
              >
                Log In to Post
              </Button>
            )}
            
            {(selectedCategoryId || selectedTag || searchQuery) && (
              <Button
                variant="outline"
                onPress={handleClearFilters}
              >
                Reset Filters
              </Button>
            )}
          </div>
        </div>

        {/* Core Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Left Sidebar: Categories */}
          <div className="lg:col-span-1 flex flex-col gap-6 order-2 lg:order-1">
            <Card glow={false} className="p-4 flex flex-col gap-3">
              <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase px-2">
                Categories
              </h3>
              
              {categoriesLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner size="sm" />
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleCategorySelect("")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                      !selectedCategoryId
                        ? "bg-primary/10 text-primary"
                        : "text-foreground/80 hover:bg-muted/50"
                    }`}
                  >
                    <MessageSquare className="w-4.5 h-4.5 shrink-0" />
                    <span>All Categories</span>
                  </button>

                  {categories.map((cat) => {
                    const CategoryIcon = IconMap[cat.iconName || "MessageSquare"] || MessageSquare;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => handleCategorySelect(cat.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                          selectedCategoryId === cat.id
                            ? "bg-primary/10 text-primary"
                            : "text-foreground/80 hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <CategoryIcon className="w-4.5 h-4.5 shrink-0" />
                          <span className="truncate">{cat.name}</span>
                        </div>
                        {cat.requiredRole && (
                          <Chip size="sm" variant="soft" color="warning" className="text-[10px] h-4 min-h-4">
                            {cat.requiredRole}
                          </Chip>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Popular Tags List */}
            <Card glow={false} className="p-4 flex flex-col gap-3">
              <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase px-2">
                Trending Tags
              </h3>
              
              {tagsLoading ? (
                <div className="flex justify-center py-6">
                  <Spinner size="sm" />
                </div>
              ) : (
                <div className="px-1">
                  {trendingTags.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No tags available.</span>
                  ) : (
                    <TagGroup
                      aria-label="Trending Tags"
                      selectionMode="single"
                      selectedKeys={selectedTag ? new Set([selectedTag]) : new Set()}
                      onSelectionChange={(keys) => {
                        if (keys === "all") return;
                        const tagSlug = Array.from(keys)[0] as string;
                        handleTagSelect(tagSlug || "");
                      }}
                    >
                      <TagGroup.List className="flex flex-wrap gap-1.5">
                        {trendingTags.map((tag) => (
                          <Tag key={tag.id} id={tag.slug} textValue={tag.name} className="cursor-pointer">
                            #{tag.name}
                          </Tag>
                        ))}
                      </TagGroup.List>
                    </TagGroup>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* Main Discussion Stream */}
          <div className="lg:col-span-3 flex flex-col gap-6 order-1 lg:order-2">
            
            {/* Search and Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <form onSubmit={handleSearchSubmit} className="w-full sm:max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search discussions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-12 bg-surface"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(""); router.push("/forum"); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              </form>

              <Tabs
                selectedKey={activeTab}
                onSelectionChange={(key) => handleTabChange(key as string)}
                variant="secondary"
                className="w-full sm:w-auto"
              >
                <Tabs.ListContainer>
                  <Tabs.List aria-label="Forum feeds" className="gap-6 border-b border-border/40">
                    <Tabs.Tab id="latest" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
                      <span>Latest</span>
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="trending" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
                      <span>Trending</span>
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="solved" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
                      <span>Solved</span>
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="unanswered" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
                      <span>Unanswered</span>
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    {isAuthenticated && (
                      <Tabs.Tab id="bookmarked" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
                        <span>Bookmarks</span>
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    )}
                    {isAuthenticated && (
                      <Tabs.Tab id="following" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
                        <span>Following</span>
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    )}
                  </Tabs.List>
                </Tabs.ListContainer>
              </Tabs>
            </div>

            {/* List Stream */}
            {loading ? (
              <div className="flex flex-col gap-4">
                {[1, 2, 3].map((n) => (
                  <Card key={n} className="p-6 flex flex-col gap-4">
                    <Skeleton className="h-4 rounded-md w-1/3" />
                    <Skeleton className="h-6 rounded-md w-2/3" />
                    <Skeleton className="h-4 rounded-md w-full" />
                    <div className="flex justify-between items-center pt-2">
                      <div className="flex gap-4">
                        <Skeleton className="h-4 rounded-md w-16" />
                        <Skeleton className="h-4 rounded-md w-16" />
                      </div>
                      <Skeleton className="h-8 rounded-full w-8" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : error ? (
              <Card className="p-8 text-center flex flex-col items-center justify-center gap-4">
                <HelpCircle className="w-12 h-12 text-danger" />
                <h3 className="text-lg font-bold">Failed to load discussions</h3>
                <p className="text-muted-foreground text-sm max-w-sm">{error}</p>
                <Button variant="primary"   onPress={fetchTopics}>
                  Try Again
                </Button>
              </Card>
            ) : topics.length === 0 ? (
              <Card className="p-12 text-center flex flex-col items-center justify-center gap-4 border-dashed">
                <MessageSquare className="w-12 h-12 text-muted-foreground/60" />
                <h3 className="text-lg font-bold">No discussions found</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  {selectedCategoryId || selectedTag || searchQuery
                    ? "No results match your active filters. Try broadening your query or clear the filters."
                    : "No discussions have been started here yet. Be the first to start a thread!"}
                </p>
                {selectedCategoryId || selectedTag || searchQuery ? (
                  <Button variant="secondary" onPress={handleClearFilters}>
                    Clear Filters
                  </Button>
                ) : (
                  isAuthenticated && (
                    <Button variant="primary"   onPress={() => router.push("/forum/new")}>
                      <PlusCircle className="w-4 h-4 mr-1.5" />
                      Create Discussion
                    </Button>
                  )
                )}
              </Card>
            ) : (
              <div className="flex flex-col gap-4">
                {topics.map((topic) => (
                  <Card
                    key={topic.id}
                    as="div"
                    glow={topic.isPinned}
                    className={`p-6 flex flex-col gap-4 border cursor-pointer hover:border-primary/50 transition-all ${
                      topic.isPinned ? "border-primary/30 bg-primary-950/5" : "border-border/60"
                    }`}
                    onClick={() => router.push(`/forum/topic/${topic.slug}`)}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex flex-col gap-1 text-left">
                        {/* Category & Tags Header */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-primary">{topic.categoryName}</span>
                          <span className="text-muted-foreground/50">•</span>
                          <span className="text-muted-foreground">{formatTimeAgo(topic.createdAt)}</span>
                          
                          {topic.isPinned && (
                            <Chip size="sm" color="accent" variant="soft" className="h-5 text-[10px]">
                              Pinned
                            </Chip>
                          )}
                          {topic.isLocked && (
                            <Chip size="sm" color="default" variant="soft" className="h-5 text-[10px]">
                              Locked
                            </Chip>
                          )}
                          {topic.isSolved && (
                            <Chip size="sm" color="success" variant="soft" className="h-5 text-[10px] gap-1">
                              <CheckCircle className="w-3 h-3 mr-1 inline-block align-middle" />
                              <span>Solved</span>
                            </Chip>
                          )}
                        </div>

                        {/* Title */}
                        <h2 className="text-lg font-bold hover:text-primary transition-colors mt-2 text-left line-clamp-2">
                          {topic.title}
                        </h2>
                        
                        {/* Excerpt */}
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2 text-left">
                          {topic.excerpt}
                        </p>
                      </div>
                    </div>

                    {/* Tags List */}
                    {topic.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {topic.tags.map((t) => (
                          <Chip key={t} size="sm" variant="soft" className="text-[11px] h-5 bg-muted/60">
                            #{t}
                          </Chip>
                        ))}
                      </div>
                    )}

                    {/* Divider */}
                    <div className="w-full h-px bg-border/40" />

                    {/* Footer / Author info & Metrics */}
                    <div className="flex items-center justify-between gap-4">
                      <div onClick={(e) => { e.stopPropagation(); router.push(`/${topic.author.username}`); }} className="flex items-center gap-2 cursor-pointer">
                        <Avatar className="w-8 h-8 rounded-full">
                          {topic.author.avatarUrl && <Avatar.Image src={topic.author.avatarUrl} alt={topic.author.fullName} />}
                          <Avatar.Fallback>{topic.author.fullName.substring(0, 2).toUpperCase()}</Avatar.Fallback>
                        </Avatar>
                        <div className="flex flex-col text-left">
                          <span className="text-xs font-semibold hover:text-primary transition-colors">
                            {topic.author.fullName}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            @{topic.author.username || "user"} • Rep: {topic.author.reputation}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                        <span className="flex items-center gap-1" title="Views">
                          <Eye className="w-3.5 h-3.5" />
                          {topic.viewCount}
                        </span>
                        
                        <span className="flex items-center gap-1" title="Replies">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {topic.replyCount}
                        </span>
                        
                        <span className="flex items-center gap-1 font-medium" title="Score">
                          <ArrowUp className="w-3.5 h-3.5" />
                          {topic.score}
                        </span>

                        {topic.isBookmarked && (
                          <span title="Bookmarked">
                            <BookMarked className="w-3.5 h-3.5 text-primary" />
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6">
                <PaginationWrapper
                  page={page}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  itemsPerPage={pageSize}
                  onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                />
              </div>
            )}

          </div>

        </div>

      </div>
    </PublicPageShell>
  );
}
