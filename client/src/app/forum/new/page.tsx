"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  forumApi,
  type CategoryResponse
} from "@/services/forum.service";
import {
  Input,
  Spinner,
  TextArea,
  Chip,
  Button,
  TagGroup,
  Tag
} from "@heroui/react";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import { Card } from "@/components/ui/card";
import {
  ChevronLeft,
  X,
  Megaphone,
  Briefcase,
  Code,
  Layout,
  Server,
  Cloud,
  Shield,
  MessageSquare,
  Folder
} from "lucide-react";
import { PublicPageShell } from "@/components/ui/public-page-shell";

const IconMap: { [key: string]: React.ComponentType<any> } = {
  MessageSquare,
  Code,
  Layout,
  Server,
  Cloud,
  Shield,
  Briefcase,
  Folder,
  Megaphone
};

export default function NewTopicPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, user } = useAuth();

  // Form states
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  
  // Tag input states
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect if guest (unauthenticated)
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login?redirect=/forum/new");
    }
  }, [isAuthenticated, router]);

  // Load categories and pre-select category query param if present
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setCategoriesLoading(true);
        const data = await forumApi.getCategories();
        setCategories(data);
        
        // Check query param
        const preSelectId = searchParams?.get("category");
        if (preSelectId && data.some(c => c.id === preSelectId)) {
          setSelectedCategoryId(preSelectId);
        } else if (data.length > 0) {
          setSelectedCategoryId(data[0].id);
        }
      } catch (err) {
        console.error("Failed to load categories", err);
      } finally {
        setCategoriesLoading(false);
      }
    };

    if (isAuthenticated) {
      loadCategories();
    }
  }, [isAuthenticated, searchParams]);

  // Tag list helpers
  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const cleaned = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (cleaned && !tags.includes(cleaned) && tags.length < 5) {
        setTags([...tags, cleaned]);
        setTagInput("");
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryId || !title.trim() || !content.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const topic = await forumApi.createTopic({
        categoryId: selectedCategoryId,
        title: title.trim(),
        content: content.trim(),
        tags
      });
      router.push(`/forum/topic/${topic.slug}`);
    } catch (err: any) {
      setError(err?.message || "Failed to create discussion topic.");
      setLoading(false);
    }
  };

  return (
    <PublicPageShell>
      <div className="w-full max-w-3xl mx-auto flex flex-col gap-6 text-left">
        
        {/* Back Button */}
        <div>
          <Button
            variant="tertiary"
            size="sm"
            onPress={() => router.push("/forum")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4 mr-1 inline-block align-middle" />
            <span>Cancel and Back</span>
          </Button>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold tracking-tight">Start a Discussion</h1>
          <p className="text-muted-foreground text-sm">
            Share ideas, ask questions, or announce details to the CVerify community.
          </p>
        </div>

        {error && (
          <Card className="p-4 bg-danger-950/10 border border-danger/20 text-danger text-sm font-semibold">
            {error}
          </Card>
        )}

        {/* Editor Form */}
        <Card className="p-6 sm:p-8 border border-border/60">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            
            {/* Category Select */}
            {categoriesLoading ? (
              <Spinner size="sm" />
            ) : (
              <SelectDropdown
                value={selectedCategoryId}
                onChange={setSelectedCategoryId}
                options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
                label="Category"
                placeholder="Select a category"
              />
            )}

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                Discussion Title
              </label>
              <Input
                placeholder="e.g. How to optimize Next.js app build times in Vercel?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="bg-surface"
                required
              />
            </div>

            {/* Markdown Text Area */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                Discussion Body
              </label>
              <TextArea
                placeholder="Describe your question or share your insights in detail. You can use markdown for formatting (**bold**, *italics*, `inline code`, ```code blocks```)."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
                className="bg-surface"
                required
              />
            </div>

            {/* Tags Input */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                Tags (Max 5)
              </label>
              <Input
                placeholder={tags.length >= 5 ? "Tags limit reached" : "Type a tag and press Enter or comma..."}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                className="bg-surface"
                disabled={tags.length >= 5}
              />
              
              {tags.length > 0 && (
                <TagGroup
                  aria-label="Discussion Tags"
                  onRemove={(keys) => {
                    setTags(tags.filter((t) => !keys.has(t)));
                  }}
                >
                  <TagGroup.List className="flex flex-wrap gap-1.5 mt-2 px-1">
                    {tags.map((tag) => (
                      <Tag key={tag} id={tag} textValue={tag}>
                        #{tag}
                      </Tag>
                    ))}
                  </TagGroup.List>
                </TagGroup>
              )}
            </div>

             {/* Submit / Cancel Buttons */}
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border/40">
              <Button
                variant="outline"
                onPress={() => router.push("/forum")}
                isDisabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isDisabled={loading || !selectedCategoryId || !title.trim() || !content.trim()}
              >
                {loading && <Spinner size="sm" color="current" className="mr-1.5" />}
                Publish Discussion
              </Button>
            </div>

          </form>
        </Card>

      </div>
    </PublicPageShell>
  );
}
