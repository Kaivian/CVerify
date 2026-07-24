"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  forumApi,
  type CategoryResponse,
  type TopicListItemResponse,
} from "@/services/forum.service";
import { Chip, Button } from "@heroui/react";
import { PaginationWrapper } from "@/components/ui/pagination-wrapper";
import { Card } from "@/components/ui/card";
import { ChevronLeft, PlusCircle } from "lucide-react";
import { PublicPageShell } from "@/components/ui/public-page-shell";

// Redesigned Feature Components
import { DiscussionCard } from "@/features/forum/components/discussion-card";
import { DiscussionStreamSkeleton } from "@/features/forum/components/forum-skeletons";
import { ForumEmptyState } from "@/features/forum/components/forum-empty-state";
import { trackForumEvent } from "@/features/forum/services/forum-telemetry";

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
      const allCategories = await forumApi.getCategories();
      const currentCat = allCategories.find((c) => c.slug === categorySlug);

      if (!currentCat) {
        setError("Category not found.");
        setLoading(false);
        return;
      }
      setCategory(currentCat);

      const result = await forumApi.getTopics({
        categoryId: currentCat.id,
        page,
        pageSize,
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

  const handleTagSelect = (tagSlug: string) => {
    router.push(`/forum?tag=${tagSlug}`);
  };

  const handleCategorySelect = (catId: string) => {
    router.push(`/forum?category=${catId}`);
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

        {/* Header Info Banner */}
        {category && (
          <div className="border-b border-border/40 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  {category.name}
                </h1>
                {category.requiredRole && (
                  <Chip color="warning" size="sm" variant="soft" className="text-xs">
                    {category.requiredRole} Write Restriction
                  </Chip>
                )}
                {category.topicCount !== undefined && (
                  <Chip size="sm" variant="soft" className="text-xs">
                    {category.topicCount} discussions
                  </Chip>
                )}
              </div>
              <p className="text-muted-foreground text-sm max-w-2xl">
                {category.description || `Discussion threads and community answers inside ${category.name}.`}
              </p>
            </div>

            <div className="shrink-0">
              {isAuthenticated ? (
                <Button
                  variant="primary"
                  onPress={() => {
                    trackForumEvent("forum_create_discussion_clicked", { source: "category_header" });
                    router.push(`/forum/new?category=${category.id}`);
                  }}
                  className="font-semibold"
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
          <DiscussionStreamSkeleton count={4} />
        ) : error ? (
          <Card className="p-8 text-center flex flex-col items-center justify-center gap-4 border border-border">
            <h3 className="text-lg font-bold text-foreground">Failed to load Category</h3>
            <p className="text-muted-foreground text-sm max-w-sm">{error}</p>
            <Button variant="primary" onPress={loadCategoryData}>
              Try Again
            </Button>
          </Card>
        ) : topics.length === 0 ? (
          <ForumEmptyState
            type="category"
            categoryName={category?.name}
            isAuthenticated={isAuthenticated}
            onClearFilters={() => router.push("/forum")}
          />
        ) : (
          <div className="flex flex-col gap-4">
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
          <div className="mt-6">
            <PaginationWrapper
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={pageSize}
              onPageChange={(p) => {
                setPage(p);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </div>
        )}

      </div>
    </PublicPageShell>
  );
}
