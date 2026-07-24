"use client";

import React, { useState, memo } from "react";
import { useRouter } from "next/navigation";
import {
  type TopicListItemResponse,
  forumApi,
} from "@/services/forum.service";
import { Avatar } from "@heroui/react";
import {
  MessageSquare,
  Eye,
  CheckCircle2,
  Pin,
  ArrowUp,
  Bookmark,
  Award,
  Building2,
  Clock,
  UserCheck,
} from "lucide-react";
import { trackForumEvent } from "../services/forum-telemetry";

interface DiscussionCardProps {
  topic: TopicListItemResponse;
  isAuthenticated: boolean;
  onTagSelect?: (tagSlug: string) => void;
  onCategorySelect?: (categoryId: string) => void;
}

const MAX_VISIBLE_TAGS = 3;

export const DiscussionCard = memo(function DiscussionCard({
  topic,
  isAuthenticated,
  onTagSelect,
  onCategorySelect,
}: DiscussionCardProps) {
  const router = useRouter();

  // Optimistic interactive states
  const [score, setScore] = useState(topic.score);
  const [userVote, setUserVote] = useState<'UPVOTE' | 'DOWNVOTE' | null>(topic.userVote || null);
  const [isBookmarked, setIsBookmarked] = useState(topic.isBookmarked);
  const [isVoting, setIsVoting] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);

  // Time format helper
  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Upvote optimistic toggle
  const handleVote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push(`/login?redirect=/forum/topic/${topic.slug}`);
      return;
    }

    if (isVoting) return;

    const previousVote = userVote;
    const previousScore = score;
    const isUpvoted = previousVote === "UPVOTE";

    const newVote = isUpvoted ? null : "UPVOTE";
    const newScore = isUpvoted ? previousScore - 1 : previousScore + 1;

    setUserVote(newVote);
    setScore(newScore);
    setIsVoting(true);

    trackForumEvent("forum_topic_upvoted", {
      topicId: topic.id,
      topicSlug: topic.slug,
      voteAction: isUpvoted ? "REMOVE" : "UPVOTE",
    });

    try {
      await forumApi.voteTopic(topic.id, "UPVOTE");
    } catch (err) {
      setUserVote(previousVote);
      setScore(previousScore);
    } finally {
      setIsVoting(false);
    }
  };

  // Bookmark optimistic toggle
  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push(`/login?redirect=/forum/topic/${topic.slug}`);
      return;
    }

    if (isBookmarking) return;

    const previousState = isBookmarked;
    const newState = !previousState;

    setIsBookmarked(newState);
    setIsBookmarking(true);

    trackForumEvent("forum_topic_bookmarked", {
      topicId: topic.id,
      topicSlug: topic.slug,
      isBookmarked: newState,
    });

    try {
      await forumApi.bookmarkTopic(topic.id);
    } catch (err) {
      setIsBookmarked(previousState);
    } finally {
      setIsBookmarking(false);
    }
  };

  // Card click handler
  const handleCardClick = () => {
    trackForumEvent("forum_discussion_clicked", {
      topicId: topic.id,
      topicSlug: topic.slug,
    });
    router.push(`/forum/topic/${topic.slug}`);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCardClick();
    }
  };

  const visibleTags = topic.tags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenTagsCount = Math.max(0, topic.tags.length - MAX_VISIBLE_TAGS);

  return (
    <article
      tabIndex={0}
      role="article"
      aria-label={`Discussion: ${topic.title}`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      className="group flex gap-4 px-4 py-3.5 border-b border-border/40 cursor-pointer hover:bg-surface-secondary/30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
    >
      {/* Left: Upvote + Author Avatar */}
      <div className="flex flex-col items-center gap-2 shrink-0 pt-0.5">
        {/* Upvote Button */}
        <button
          type="button"
          onClick={handleVote}
          disabled={isVoting}
          aria-label="Upvote topic"
          className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg text-xs font-bold ${
            userVote === "UPVOTE"
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-primary hover:bg-primary/5"
          }`}
        >
          <ArrowUp className={`w-4 h-4 ${userVote === "UPVOTE" ? "text-primary" : ""}`} />
          <span className="text-[11px]">{score}</span>
        </button>

        {/* Author Avatar */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (topic.author.username) router.push(`/${topic.author.username}`);
          }}
          className="cursor-pointer"
        >
          <Avatar className="w-7 h-7 rounded-full border border-border/60">
            {topic.author.avatarUrl && <Avatar.Image src={topic.author.avatarUrl} alt={topic.author.fullName} />}
            <Avatar.Fallback className="text-[10px] font-bold">
              {topic.author.fullName.substring(0, 2).toUpperCase()}
            </Avatar.Fallback>
          </Avatar>
        </div>
      </div>

      {/* Center: Title, Excerpt, Meta */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {/* Title Row */}
        <div className="flex items-center gap-2 min-w-0">
          {topic.isPinned && (
            <Pin className="w-3.5 h-3.5 text-primary shrink-0" />
          )}
          {topic.isSolved && (
            <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
          )}
          <h2 className="text-sm font-semibold text-foreground group-hover:text-primary truncate leading-snug">
            {topic.title}
          </h2>
        </div>

        {/* Excerpt */}
        <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
          {topic.aiExcerpt || topic.excerpt}
        </p>

        {/* Meta Row: Category, Author, Tags, Time */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground mt-0.5">
          {/* Category */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onCategorySelect) onCategorySelect(topic.categoryId);
              else router.push(`/forum?category=${topic.categoryId}`);
            }}
            className="font-semibold text-primary hover:underline"
          >
            {topic.categoryName}
          </button>

          <span className="text-border">·</span>

          {/* Author */}
          <span
            onClick={(e) => {
              e.stopPropagation();
              if (topic.author.username) router.push(`/${topic.author.username}`);
            }}
            className="flex items-center gap-1 cursor-pointer hover:text-foreground"
          >
            <span className="font-medium">{topic.author.fullName}</span>
            {topic.author.isCandidateVerified && (
              <UserCheck className="w-3 h-3 text-success" />
            )}
            {topic.author.isBusinessVerified && (
              <Building2 className="w-3 h-3 text-primary" />
            )}
            <span className="flex items-center gap-0.5 text-amber-500">
              <Award className="w-2.5 h-2.5" />
              {topic.author.reputation}
            </span>
          </span>

          <span className="text-border">·</span>

          {/* Time */}
          <span className="flex items-center gap-1" title={new Date(topic.createdAt).toLocaleString()}>
            <Clock className="w-3 h-3" />
            {formatTimeAgo(topic.createdAt)}
          </span>

          {/* Tags inline */}
          {visibleTags.length > 0 && (
            <>
              <span className="text-border">·</span>
              {visibleTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onTagSelect) onTagSelect(tag);
                    else router.push(`/forum?tag=${tag}`);
                  }}
                  className="text-[11px] text-muted-foreground hover:text-primary"
                >
                  #{tag}
                </button>
              ))}
              {hiddenTagsCount > 0 && (
                <span
                  className="text-[10px] text-muted-foreground"
                  title={topic.tags.slice(MAX_VISIBLE_TAGS).join(", ")}
                >
                  +{hiddenTagsCount}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right: Stats Column */}
      <div className="hidden sm:flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
        {/* Replies */}
        <div className="flex items-center gap-1" title="Replies">
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="font-medium text-foreground">{topic.replyCount}</span>
        </div>

        {/* Views */}
        <div className="flex items-center gap-1" title="Views">
          <Eye className="w-3.5 h-3.5" />
          <span className="font-medium text-foreground">{topic.viewCount}</span>
        </div>

        {/* Bookmark */}
        <button
          type="button"
          onClick={handleBookmark}
          disabled={isBookmarking}
          aria-label="Bookmark topic"
          className={`p-1 rounded ${
            isBookmarked
              ? "text-accent"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? "fill-accent" : ""}`} />
        </button>

        {/* Last Activity */}
        <div className="text-[11px] text-muted-foreground w-16 text-right" title={topic.lastActivityAt ? new Date(topic.lastActivityAt).toLocaleString() : undefined}>
          {topic.lastReplyAuthor
            ? formatTimeAgo(topic.lastActivityAt)
            : "—"
          }
        </div>
      </div>
    </article>
  );
});
