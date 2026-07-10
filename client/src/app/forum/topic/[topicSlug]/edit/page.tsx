"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  forumApi,
  type TopicResponse
} from "@/services/forum.service";
import {
  Input,
  TextArea,
  Chip,
  Spinner,
  Button,
  TagGroup,
  Tag
} from "@heroui/react";
import { Card } from "@/components/ui/card";
import { ChevronLeft, X } from "lucide-react";
import { PublicPageShell } from "@/components/ui/public-page-shell";

interface EditTopicPageProps {
  params: Promise<{
    topicSlug: string;
  }>;
}

export default function EditTopicPage({ params }: EditTopicPageProps) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  
  // Resolve params using React.use() to comply with Next.js 15 guidelines
  const { topicSlug } = use(params);

  // States
  const [topic, setTopic] = useState<TopicResponse | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing topic details
  useEffect(() => {
    const loadTopic = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await forumApi.getTopic(topicSlug);
        setTopic(data);
        setTitle(data.title);
        setContent(data.content);
        setTags(data.tags);
      } catch (err: any) {
        setError(err?.message || "Failed to load discussion details.");
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      loadTopic();
    } else {
      router.push(`/login?redirect=/forum/topic/${topicSlug}/edit`);
    }
  }, [topicSlug, isAuthenticated, router]);

  // Auth ownership safeguard
  useEffect(() => {
    if (topic && user && topic.author.id !== user.id && user.role !== "ADMIN") {
      router.push(`/forum/topic/${topicSlug}`);
    }
  }, [topic, user, topicSlug, router]);

  // Tag helper functions
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
    if (!topic || !title.trim() || !content.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      await forumApi.updateTopic(topic.id, {
        title: title.trim(),
        content: content.trim(),
        tags
      });
      router.push(`/forum/topic/${topic.slug}`);
    } catch (err: any) {
      setError(err?.message || "Failed to update discussion topic.");
      setSubmitting(false);
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
            onPress={() => router.push(`/forum/topic/${topicSlug}`)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4 mr-1 inline-block align-middle" />
            <span>Cancel and Back</span>
          </Button>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold tracking-tight">Edit Discussion</h1>
          <p className="text-muted-foreground text-sm">
            Revise your title, content details, or tags to clarify the topic.
          </p>
        </div>

        {error && (
          <Card className="p-4 bg-danger-950/10 border border-danger/20 text-danger text-sm font-semibold">
            {error}
          </Card>
        )}

        {/* Main Editor Card */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : topic ? (
          <Card className="p-6 sm:p-8 border border-border/60">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              
              {/* Category display (locked) */}
              <div className="flex flex-col gap-1.5 px-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Category (Locked)
                </span>
                <span className="text-sm font-bold text-primary">{topic.categoryName}</span>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Discussion Title
                </label>
                <Input
                  placeholder="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  className="bg-surface"
                  required
                />
              </div>

              {/* Markdown Content */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Discussion Body
                </label>
                <TextArea
                  placeholder="Content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={10}
                  className="bg-surface"
                  required
                />
              </div>

              {/* Tags */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Tags (Max 5)
                </label>
                <Input
                  placeholder={tags.length >= 5 ? "Tags limit reached" : "Type a tag and press Enter..."}
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

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border/40">
                <Button
                  variant="outline"
                  onPress={() => router.push(`/forum/topic/${topicSlug}`)}
                  isDisabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isDisabled={submitting || !title.trim() || !content.trim()}
                >
                  {submitting && <Spinner size="sm" color="current" className="mr-1.5" />}
                  Save Changes
                </Button>
              </div>

            </form>
          </Card>
        ) : null}

      </div>
    </PublicPageShell>
  );
}
