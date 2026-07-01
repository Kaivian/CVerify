"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  forumApi,
  type CategoryResponse,
  type TopicListItemResponse
} from "@/services/forum.service";
import {
  Chip,
  Spinner,
  Avatar,
  Button,
  Skeleton
} from "@heroui/react";
import { PaginationWrapper } from "@/components/ui/pagination-wrapper";
import { Card } from "@/components/ui/card";
import {
  MessageSquare,
  Eye,
  CheckCircle,
  PlusCircle,
  ArrowUp,
  ChevronLeft,
  BookMarked
} from "lucide-react";
import { PublicPageShell } from "@/components/ui/public-page-shell";

interface CategoryPageProps {
  params: Promise<{
    categorySlug: string;
  }>;
}

export default function CategoryForumPage({ params }: CategoryPageProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  // Resolve params using React.use() to comply with Next.js 15 guidelines
  const { categorySlug } = use(params);

  // States
  const [category, setCategory] = useState<CategoryResponse | null>(null);
  const [topics, setTopics] = useState<TopicListItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Load category details and topics
  const loadCategoryData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Load all categories to find the matching slug (backend resolves slugs this way or we find category by slug)
      const allCategories = await forumApi.getCategories();
      const currentCat = allCategories.find((c) => c.slug === categorySlug);

      if (!currentCat) {
        setError("Category not found.");
        setLoading(false);
        return;
      }
      setCategory(currentCat);

      // 2. Load topics for this category
      const result = await forumApi.getTopics({
        categoryId: currentCat.id,
        page,
        pageSize
      });
      setTopics(result.items || []);
      setTotalPages(result.totalPages || 1);
      setTotalItems(result.totalItems || 0);
    } catch (err: any) {
      setError(err?.message || "Failed to load category data.");
    } finally {
      setLoading(false);
    }
  }, [categorySlug, page, pageSize]);

  useEffect(() => {
    loadCategoryData();
  }, [loadCategoryData]);

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
      <div className="w-full flex flex-col gap-6 text-left">

        {/* Back Button */}
        <div>
          <Button
            variant="tertiary"
            size="sm"
            onPress={() => router.push("/forum")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4 mr-1 inline-block align-middle" />
            <span>Back to Forum</span>
          </Button>
        </div>

        {/* Header Info */}
        {category && (
          <div className="border-b border-border/40 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-extrabold tracking-tight">{category.name}</h1>
                {category.requiredRole && (
                  <Chip color="warning" size="sm" variant="soft">
                    {category.requiredRole} Write Restriction
                  </Chip>
                )}
              </div>
              <p className="text-muted-foreground text-sm mt-1">
                {category.description || `Discussion thread for ${category.name}.`}
              </p>
            </div>

            <div className="shrink-0">
              {isAuthenticated ? (
                <Button
                  variant="primary"
                  onPress={() => router.push(`/forum/new?category=${category.id}`)}
                >
                  <PlusCircle className="w-4 h-4 mr-1.5 inline-block align-middle" />
                  <span>Create Discussion</span>
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onPress={() => router.push(`/login?redirect=/forum/new?category=${category.id}`)}
                >
                  Log In to Post
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Main Feed stream */}
        {loading ? (
          <div className="flex flex-col gap-4">
             {[1, 2, 3].map((n) => (
              <Card key={n} className="p-6 flex flex-col gap-4">
                <Skeleton className="h-4 rounded-md w-1/3" />
                <Skeleton className="h-6 rounded-md w-2/3" />
                <Skeleton className="h-4 rounded-md w-full" />
                <div className="flex justify-between items-center pt-2">
                  <Skeleton className="h-4 rounded-md w-16" />
                  <Skeleton className="h-8 rounded-full w-8" />
                </div>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="p-8 text-center flex flex-col items-center justify-center gap-4">
            <h3 className="text-lg font-bold">Failed to load Category</h3>
            <p className="text-muted-foreground text-sm max-w-sm">{error}</p>
            <Button variant="primary" onPress={loadCategoryData}>
              Try Again
            </Button>
          </Card>
        ) : topics.length === 0 ? (
          <Card className="p-12 text-center flex flex-col items-center justify-center gap-4 border-dashed">
            <MessageSquare className="w-12 h-12 text-muted-foreground/60" />
            <h3 className="text-lg font-bold">No discussions yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              Be the first to start a thread inside {category?.name || "this category"}!
            </p>
            {isAuthenticated && (
              <Button
                onPress={() => router.push(`/forum/new?category=${category?.id}`)}
              >
                <PlusCircle className="w-4 h-4 mr-1.5" />
                Create Discussion
              </Button>
            )}
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {topics.map((topic) => (
              <Card
                key={topic.id}
                as="div"
                glow={topic.isPinned}
                className={`p-6 flex flex-col gap-4 border cursor-pointer hover:border-primary/50 transition-all ${topic.isPinned ? "border-primary/30 bg-primary-950/5" : "border-border/60"
                  }`}
                onClick={() => router.push(`/forum/topic/${topic.slug}`)}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex flex-col gap-1 text-left">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatTimeAgo(topic.createdAt)}</span>
                      {topic.isPinned && <Chip size="sm" variant="soft" className="h-5 text-[10px]">Pinned</Chip>}
                      {topic.isLocked && <Chip size="sm" color="default" variant="soft" className="h-5 text-[10px]">Locked</Chip>}
                      {topic.isSolved && (
                        <Chip size="sm" color="success" variant="soft" className="h-5 text-[10px]">
                          <CheckCircle className="w-3 h-3 mr-1 inline-block align-middle" />
                          <span>Solved</span>
                        </Chip>
                      )}
                    </div>

                    <h2 className="text-lg font-bold hover:text-primary transition-colors mt-2 text-left line-clamp-2">
                      {topic.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2 text-left">
                      {topic.excerpt}
                    </p>
                  </div>
                </div>

                {topic.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {topic.tags.map((t) => (
                      <Chip key={t} size="sm" variant="soft" className="text-[11px] h-5 bg-muted/60">
                        #{t}
                      </Chip>
                    ))}
                  </div>
                )}

                <div className="w-full h-px bg-border/40" />

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
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      {topic.viewCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {topic.replyCount}
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <ArrowUp className="w-3.5 h-3.5" />
                      {topic.score}
                    </span>
                    {topic.isBookmarked && <BookMarked className="w-3.5 h-3.5 text-primary" />}
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
    </PublicPageShell>
  );
}
