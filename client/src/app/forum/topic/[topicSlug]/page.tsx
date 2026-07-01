"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  forumApi,
  type TopicResponse,
  type ReplyResponse,
  type ReactionCountDto
} from "@/services/forum.service";
import {
  Chip,
  Spinner,
  TextArea,
  Avatar,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tooltip,
  Button,
  Skeleton
} from "@heroui/react";
import { Card } from "@/components/ui/card";
import {
  MessageSquare,
  ArrowUp,
  ArrowDown,
  CornerDownRight,
  CheckCircle,
  MoreVertical,
  Flag,
  Pin,
  Lock,
  Unlock,
  Trash2,
  Edit2,
  ChevronLeft,
  Sparkles,
  BookMarked,
  Bell,
  Eye,
  Smile,
  Quote
} from "lucide-react";
import { PublicPageShell } from "@/components/ui/public-page-shell";

interface TopicDetailPageProps {
  params: Promise<{
    topicSlug: string;
  }>;
}

// Lightweight safe regex markdown parser to avoid external dependencies
function parseMarkdownToHtml(markdown: string): string {
  if (!markdown) return "";
  let html = markdown;

  // Escape HTML tags to protect against XSS
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks: ```code```
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-muted p-4 rounded-xl font-mono text-xs overflow-x-auto my-3 border border-border/40 text-foreground/90">$1</pre>');

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded font-mono text-xs text-foreground/95">$1</code>');

  // Bold: **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold">$1</strong>');

  // Italic: *text*
  html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');

  // Headings
  html = html.replace(/^\s*# (.*)$/gm, '<h1 class="text-2xl font-black mt-4 mb-2 text-foreground">$1</h1>');
  html = html.replace(/^\s*## (.*)$/gm, '<h2 class="text-xl font-extrabold mt-4 mb-2 text-foreground">$1</h2>');
  html = html.replace(/^\s*### (.*)$/gm, '<h3 class="text-lg font-bold mt-3 mb-1.5 text-foreground">$1</h3>');

  // Blockquotes
  html = html.replace(/^\s*&gt; (.*)$/gm, '<blockquote class="border-l-4 border-primary pl-4 italic text-muted-foreground my-3">$1</blockquote>');

  // Bullet Lists
  html = html.replace(/^\s*-\s+(.*)$/gm, '<li class="list-disc ml-6 my-1">$1</li>');

  // Paragraph processing
  html = html.split('\n\n').map(p => {
    const trimmed = p.trim();
    if (trimmed.startsWith('<h') || trimmed.startsWith('<pre') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<li')) {
      return p;
    }
    return `<p class="my-2 leading-relaxed text-sm">${p.replace(/\n/g, '<br/>')}</p>`;
  }).join('');

  return html;
}

export default function TopicDetailPage({ params }: TopicDetailPageProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  // Resolve params using React.use() to comply with Next.js 15 guidelines
  const { topicSlug } = use(params);

  // States
  const [topic, setTopic] = useState<TopicResponse | null>(null);
  const [replies, setReplies] = useState<ReplyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [repliesLoading, setRepliesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [replyContent, setReplyContent] = useState("");
  const [parentReplyId, setParentReplyId] = useState<string | undefined>(undefined);
  const [replyingToUser, setReplyingToUser] = useState<string | null>(null);
  const [quoteText, setQuoteText] = useState<string | undefined>(undefined);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const loadTopicDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await forumApi.getTopic(topicSlug);
      setTopic(data);

      setRepliesLoading(true);
      const replyData = await forumApi.getReplies(data.id);
      setReplies(replyData);
    } catch (err: any) {
      setError(err?.message || "Failed to load discussion details.");
    } finally {
      setLoading(false);
      setRepliesLoading(false);
    }
  }, [topicSlug]);

  useEffect(() => {
    loadTopicDetails();
  }, [loadTopicDetails]);

  // Actions
  const handleVote = async (type: 'UPVOTE' | 'DOWNVOTE') => {
    if (!isAuthenticated || !topic) return;
    try {
      await forumApi.voteTopic(topic.id, type);
      // Reload topic
      const data = await forumApi.getTopic(topicSlug);
      setTopic(data);
    } catch (err) {
      console.error("Failed to vote", err);
    }
  };

  const handleReplyVote = async (replyId: string, type: 'UPVOTE' | 'DOWNVOTE') => {
    if (!isAuthenticated || !topic) return;
    try {
      await forumApi.voteReply(replyId, type);
      // Reload replies
      const replyData = await forumApi.getReplies(topic.id);
      setReplies(replyData);
    } catch (err) {
      console.error("Failed to vote reply", err);
    }
  };

  const handleToggleBookmark = async () => {
    if (!isAuthenticated || !topic) return;
    try {
      await forumApi.bookmarkTopic(topic.id);
      setTopic((prev) => prev ? { ...prev, isBookmarked: !prev.isBookmarked } : null);
    } catch (err) {
      console.error("Failed to bookmark", err);
    }
  };

  const handleToggleFollow = async () => {
    if (!isAuthenticated || !topic) return;
    try {
      await forumApi.followTopic(topic.id);
      setTopic((prev) => prev ? { ...prev, isFollowing: !prev.isFollowing } : null);
    } catch (err) {
      console.error("Failed to follow", err);
    }
  };

  const handleReaction = async (emoji: string) => {
    if (!isAuthenticated || !topic) return;
    try {
      await forumApi.reactTopic(topic.id, emoji);
      const data = await forumApi.getTopic(topicSlug);
      setTopic(data);
    } catch (err) {
      console.error("Failed to react", err);
    }
  };

  const handleReplyReaction = async (replyId: string, emoji: string) => {
    if (!isAuthenticated || !topic) return;
    try {
      await forumApi.reactReply(replyId, emoji);
      const replyData = await forumApi.getReplies(topic.id);
      setReplies(replyData);
    } catch (err) {
      console.error("Failed to react to reply", err);
    }
  };

  const handleAcceptSolution = async (replyId: string) => {
    if (!isAuthenticated || !topic) return;
    try {
      await forumApi.acceptSolution(replyId);
      const replyData = await forumApi.getReplies(topic.id);
      setReplies(replyData);
      // Reload topic to check solved status
      const data = await forumApi.getTopic(topicSlug);
      setTopic(data);
    } catch (err) {
      console.error("Failed to accept solution", err);
    }
  };

  const handleDeleteTopic = async () => {
    if (!topic) return;
    if (confirm("Are you sure you want to delete this discussion topic?")) {
      try {
        await forumApi.deleteTopic(topic.id);
        router.push("/forum");
      } catch (err) {
        console.error("Failed to delete topic", err);
      }
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!topic) return;
    if (confirm("Are you sure you want to delete this reply?")) {
      try {
        await forumApi.deleteReply(replyId);
        const replyData = await forumApi.getReplies(topic.id);
        setReplies(replyData);
      } catch (err) {
        console.error("Failed to delete reply", err);
      }
    }
  };

  const handleModeratorAction = async (action: 'LOCK' | 'UNLOCK' | 'PIN' | 'UNPIN') => {
    if (!topic) return;
    try {
      await forumApi.moderateTopic(topic.id, action, "Moderator audit check");
      const data = await forumApi.getTopic(topicSlug);
      setTopic(data);
    } catch (err) {
      console.error("Failed to moderate topic", err);
    }
  };

  const handleReportContent = async (topicId?: string, replyId?: string) => {
    const reason = prompt("Enter the reason for reporting this content:");
    if (!reason || !reason.trim()) return;
    try {
      await forumApi.reportContent({
        topicId,
        replyId,
        reason
      });
      alert("Content reported successfully to system moderators.");
    } catch (err) {
      console.error("Failed to file report", err);
    }
  };

  // Submit Reply
  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !topic || !replyContent.trim()) return;

    setSubmittingReply(true);
    try {
      await forumApi.createReply(topic.id, {
        content: replyContent,
        parentReplyId,
        quoteText
      });

      // Reset form states
      setReplyContent("");
      setParentReplyId(undefined);
      setReplyingToUser(null);
      setQuoteText(undefined);

      // Reload replies
      const replyData = await forumApi.getReplies(topic.id);
      setReplies(replyData);

      // Refresh topic counts
      const updatedTopic = await forumApi.getTopic(topicSlug);
      setTopic(updatedTopic);
    } catch (err) {
      console.error("Failed to post reply", err);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleTriggerQuote = (reply: ReplyResponse) => {
    setParentReplyId(reply.id);
    setReplyingToUser(reply.author.fullName);

    // Extract first 150 chars as quote
    const rawQuote = reply.content.replace(/<.*?>/g, "");
    setQuoteText(rawQuote.length > 150 ? rawQuote.substring(0, 150) + "..." : rawQuote);

    // Scroll to editor
    const editor = document.getElementById("reply-editor-container");
    if (editor) {
      editor.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleTriggerNestedReply = (reply: ReplyResponse) => {
    setParentReplyId(reply.id);
    setReplyingToUser(reply.author.fullName);
    setQuoteText(undefined);

    const editor = document.getElementById("reply-editor-container");
    if (editor) {
      editor.scrollIntoView({ behavior: "smooth" });
    }
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

  // Custom permission check properties
  const isAuthor = topic && user && topic.author.id === user.id;
  const isModerator = user && user.role === "ADMIN";

  // Render recursive reply component
  const renderRepliesList = (repliesList: ReplyResponse[], depth = 0) => {
    return (
      <div className={`flex flex-col gap-4 ${depth > 0 ? "ml-6 sm:ml-10 pl-4 border-l border-border/30" : ""}`}>
        {repliesList.map((reply) => (
          <div key={reply.id} className="flex flex-col gap-3">
            <Card glow={reply.isAcceptedSolution} className={`p-4 sm:p-6 border text-left ${reply.isAcceptedSolution ? "border-success/30 bg-success-950/5" : "border-border/50"
              }`}>

              {/* Reply Header info */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push(`/${reply.author.username}`)}>
                  <Avatar className="w-8 h-8 rounded-full">
                    {reply.author.avatarUrl && <Avatar.Image src={reply.author.avatarUrl} alt={reply.author.fullName} />}
                    <Avatar.Fallback>{reply.author.fullName.substring(0, 2).toUpperCase()}</Avatar.Fallback>
                  </Avatar>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-semibold hover:text-primary transition-colors">
                      {reply.author.fullName}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      @{reply.author.username || "user"} • Rep: {reply.author.reputation}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatTimeAgo(reply.createdAt)}</span>
                  {reply.isAcceptedSolution && (
                    <Chip size="sm" color="success" variant="soft" className="h-5 text-[10px] gap-1">
                      <CheckCircle className="w-3.5 h-3.5 mr-1 inline-block align-middle" />
                      <span>Solution</span>
                    </Chip>
                  )}

                  {/* Dropdown Menu for options */}
                  <Dropdown>
                    <DropdownTrigger>
                      <Button variant="ghost" isIconOnly size="sm"  >
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Reply options">
                      <DropdownItem key="quote" onPress={() => handleTriggerQuote(reply)}>
                        <div className="flex items-center gap-2">
                          <Quote className="w-4 h-4 text-muted-foreground" />
                          <span>Quote Reply</span>
                        </div>
                      </DropdownItem>
                      <DropdownItem key="nested" onPress={() => handleTriggerNestedReply(reply)}>
                        <div className="flex items-center gap-2">
                          <CornerDownRight className="w-4 h-4 text-muted-foreground" />
                          <span>Reply to User</span>
                        </div>
                      </DropdownItem>

                      {isAuthenticated && topic && topic.author.id === user?.id && (
                        <DropdownItem key="accept" className={reply.isAcceptedSolution ? "text-warning" : "text-success"} onPress={() => handleAcceptSolution(reply.id)}>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            <span>{reply.isAcceptedSolution ? "Unmark as Solution" : "Mark as Solution"}</span>
                          </div>
                        </DropdownItem>
                      )}

                      <DropdownItem key="report" onPress={() => handleReportContent(undefined, reply.id)}>
                        <div className="flex items-center gap-2">
                          <Flag className="w-4 h-4 text-muted-foreground" />
                          <span>Report Abuse</span>
                        </div>
                      </DropdownItem>

                      {(user && reply.author.id === user.id || isModerator) ? (
                        <DropdownItem key="delete" className="text-danger" onPress={() => handleDeleteReply(reply.id)}>
                          <div className="flex items-center gap-2">
                            <Trash2 className="w-4 h-4 text-danger" />
                            <span>Delete Reply</span>
                          </div>
                        </DropdownItem>
                      ) : (
                        <DropdownItem key="none" className="hidden" aria-label="hidden" />
                      )}
                    </DropdownMenu>
                  </Dropdown>
                </div>
              </div>

              {/* Quote reference */}
              {reply.quoteText && (
                <div className="bg-muted/40 border-l-3 border-muted-foreground/40 px-3 py-2 text-xs italic text-muted-foreground rounded-r-lg my-2 flex gap-2">
                  <Quote className="w-3.5 h-3.5 shrink-0 text-muted-foreground/60 mt-0.5" />
                  <p className="line-clamp-2">{reply.quoteText}</p>
                </div>
              )}

              {/* Reply Body content */}
              <div
                className="text-sm mt-3 text-foreground leading-relaxed wrap-break-word markdown-body"
                dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(reply.content) }}
              />

              {/* Voting panel for replies */}
              <div className="flex items-center gap-6 mt-4 pt-3 border-t border-border/40">
                <div className="flex items-center gap-1">
                  <Button
                    variant={reply.userVote === 'UPVOTE' ? "primary" : "tertiary"}
                    isIconOnly
                    size="sm"
                    onPress={() => handleReplyVote(reply.id, 'UPVOTE')}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <span className="text-xs font-semibold text-muted-foreground min-w-4 text-center">
                    {reply.score}
                  </span>
                  <Button
                    variant={reply.userVote === 'DOWNVOTE' ? "danger" : "tertiary"}
                    isIconOnly
                    size="sm"
                    onPress={() => handleReplyVote(reply.id, 'DOWNVOTE')}
                  >
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                </div>

                {/* Emoji reactions for reply */}
                <div className="flex items-center gap-2">
                  {reply.reactions.map((react) => (
                    <Button
                      key={react.reactionType}
                      size="sm"
                      variant={react.userReacted ? "primary" : "outline"}
                      className="h-7 min-w-10 px-2 flex items-center gap-1.5"
                      onClick={() => handleReplyReaction(reply.id, react.reactionType)}
                    >
                      <span className="text-sm">{react.reactionType === "thumbs_up" ? "👍" : react.reactionType === "heart" ? "❤️" : "💡"}</span>
                      <span className="text-xs">{react.count}</span>
                    </Button>
                  ))}

                  {isAuthenticated && (
                    <Dropdown>
                      <DropdownTrigger>
                        <Button size="sm" isIconOnly variant="ghost">
                          <Smile className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu aria-label="Reaction emojis" className="min-w-fit flex-row gap-1 p-1">
                        <DropdownItem key="thumbs_up" className="px-2" onPress={() => handleReplyReaction(reply.id, "thumbs_up")}>👍</DropdownItem>
                        <DropdownItem key="heart" className="px-2" onPress={() => handleReplyReaction(reply.id, "heart")}>❤️</DropdownItem>
                        <DropdownItem key="light" className="px-2" onPress={() => handleReplyReaction(reply.id, "insight")}>💡</DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  )}
                </div>
              </div>

            </Card>

            {/* Recursively render child replies */}
            {reply.childReplies && reply.childReplies.length > 0 && renderRepliesList(reply.childReplies, depth + 1)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <PublicPageShell>
      <div className="w-full flex flex-col gap-6 text-left">

        {/* Navigation back and header controls */}
        <div className="flex justify-between items-center">
          <Button
            variant="tertiary"
            size="sm"
            onPress={() => router.push("/forum")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4 mr-1 inline-block align-middle" />
            <span>Back to Discussions</span>
          </Button>

          {/* Edit / Bookmark actions */}
          <div className="flex items-center gap-2">
            {isAuthenticated && topic && (
              <>
                <Button
                  variant={topic.isBookmarked ? "primary" : "outline"}
                  size="sm"
                  onPress={handleToggleBookmark}
                >
                  <BookMarked className="w-4 h-4 mr-1.5 inline-block align-middle" />
                  <span>{topic.isBookmarked ? "Bookmarked" : "Bookmark"}</span>
                </Button>

                <Button
                  variant={topic.isFollowing ? "primary" : "outline"}
                  size="sm"
                  onPress={handleToggleFollow}
                >
                  <Bell className="w-4 h-4 mr-1.5 inline-block align-middle" />
                  <span>{topic.isFollowing ? "Following" : "Follow"}</span>
                </Button>
              </>
            )}

            {/* Moderator dropdown actions */}
            {topic && (isAuthor || isModerator) && (
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="outline" size="sm" isIconOnly>
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Topic management options">
                  {isAuthor && !topic.isLocked ? (
                    <DropdownItem key="edit" onPress={() => router.push(`/forum/topic/${topic.slug}/edit`)}>
                      <div className="flex items-center gap-2">
                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                        <span>Edit Topic</span>
                      </div>
                    </DropdownItem>
                  ) : (
                    <DropdownItem key="edit-hidden" className="hidden" aria-label="hidden" />
                  )}

                  {isModerator ? (
                    <>
                      <DropdownItem key="pin" onPress={() => handleModeratorAction(topic.isPinned ? "UNPIN" : "PIN")}>
                        <div className="flex items-center gap-2">
                          <Pin className="w-4 h-4 text-muted-foreground" />
                          <span>{topic.isPinned ? "Unpin Topic" : "Pin Topic"}</span>
                        </div>
                      </DropdownItem>
                      <DropdownItem key="lock" onPress={() => handleModeratorAction(topic.isLocked ? "UNLOCK" : "LOCK")}>
                        <div className="flex items-center gap-2">
                          {topic.isLocked ? <Unlock className="w-4 h-4 text-muted-foreground" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
                          <span>{topic.isLocked ? "Unlock Topic" : "Lock Topic"}</span>
                        </div>
                      </DropdownItem>
                    </>
                  ) : (
                    <DropdownItem key="mod-hidden" className="hidden" aria-label="hidden" />
                  )}

                  <DropdownItem key="report" onPress={() => handleReportContent(topic.id)}>
                    <div className="flex items-center gap-2">
                      <Flag className="w-4 h-4 text-muted-foreground" />
                      <span>Report Content</span>
                    </div>
                  </DropdownItem>

                  <DropdownItem key="delete" className="text-danger" onPress={handleDeleteTopic}>
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-danger" />
                      <span>Delete Topic</span>
                    </div>
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            )}
          </div>
        </div>

        {/* Main Loading state */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left side: Main Thread skeleton */}
            <div className="lg:col-span-3 flex flex-col gap-6">
              <Card className="p-6 sm:p-8 border border-border/60">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 rounded-md w-16" />
                    <Skeleton className="h-4 rounded-md w-24" />
                  </div>
                  <Skeleton className="h-8 rounded-md w-3/4" />
                  <div className="flex items-center gap-3 border-b border-border/40 pb-6 mt-2">
                    <Skeleton className="h-10 rounded-full w-10" />
                    <div className="flex flex-col gap-1.5 w-32">
                      <Skeleton className="h-4 rounded-md w-full" />
                      <Skeleton className="h-3 rounded-md w-2/3" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 mt-4">
                    <Skeleton className="h-4 rounded-md w-full" />
                    <Skeleton className="h-4 rounded-md w-full" />
                    <Skeleton className="h-4 rounded-md w-2/3" />
                  </div>
                </div>
              </Card>
            </div>
            {/* Right side: Sidebar skeleton */}
            <div className="lg:col-span-1 flex flex-col gap-6">
              <Card className="p-6 border border-border/60 flex flex-col gap-4">
                <Skeleton className="h-5 rounded-md w-1/2" />
                <Skeleton className="h-4 rounded-md w-full" />
                <Skeleton className="h-4 rounded-md w-full" />
                <Skeleton className="h-4 rounded-md w-2/3" />
              </Card>
            </div>
          </div>
        ) : error ? (
          <Card className="p-8 text-center flex flex-col items-center justify-center gap-4">
            <h3 className="text-lg font-bold">Failed to load Discussion</h3>
            <p className="text-muted-foreground text-sm max-w-sm">{error}</p>
            <Button variant="primary" onPress={loadTopicDetails}>
              Retry Loading
            </Button>
          </Card>
        ) : topic ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

            {/* Left side: Main Thread & Replies */}
            <div className="lg:col-span-3 flex flex-col gap-6">

              {/* Topic Post Card */}
              <Card className="p-6 sm:p-8 border border-border/60 text-left">

                {/* Meta details */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-primary">{topic.categoryName}</span>
                  <span>•</span>
                  <span>{formatTimeAgo(topic.createdAt)}</span>

                  {topic.isPinned && <Chip size="sm" color="accent" variant="soft" className="h-5 text-[10px]">Pinned</Chip>}
                  {topic.isLocked && <Chip size="sm" color="default" variant="soft" className="h-5 text-[10px]">Locked</Chip>}
                  {topic.isSolved && (
                    <Chip size="sm" color="success" variant="soft" className="h-5 text-[10px]">
                      <CheckCircle className="w-3.5 h-3.5 mr-1 inline-block align-middle" />
                      <span>Solved</span>
                    </Chip>
                  )}
                </div>

                {/* Big Title */}
                <h1 className="text-2xl sm:text-3xl font-black mt-3 text-foreground wrap-break-word leading-tight">
                  {topic.title}
                </h1>

                {/* Author User Info */}
                <div className="flex items-center gap-4 mt-6 pb-6 border-b border-border/40">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push(`/${topic.author.username}`)}>
                    <Avatar className="w-10 h-10 rounded-full">
                      {topic.author.avatarUrl && <Avatar.Image src={topic.author.avatarUrl} alt={topic.author.fullName} />}
                      <Avatar.Fallback>{topic.author.fullName.substring(0, 2).toUpperCase()}</Avatar.Fallback>
                    </Avatar>
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-semibold hover:text-primary transition-colors">
                        {topic.author.fullName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        @{topic.author.username || "user"} • Reputation Points: {topic.author.reputation}
                      </span>
                    </div>
                  </div>
                  {topic.author.isCandidateVerified && (
                    <Chip size="sm" color="accent" variant="soft" className="h-5 text-[10px]">
                      Verified Candidate
                    </Chip>
                  )}
                  {topic.author.isBusinessVerified && (
                    <Chip size="sm" color="success" variant="soft" className="h-5 text-[10px]">
                      Verified Business
                    </Chip>
                  )}
                </div>

                {/* Content body */}
                <div
                  className="text-base mt-6 text-foreground/90 leading-relaxed wrap-break-word markdown-body"
                  dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(topic.content) }}
                />

                {/* Tags */}
                {topic.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-6">
                    {topic.tags.map((t) => (
                      <Chip key={t} size="sm" variant="soft" className="text-xs bg-muted/60">
                        #{t}
                      </Chip>
                    ))}
                  </div>
                )}

                {/* Action panel (Voting & reactions) */}
                <div className="flex flex-wrap items-center justify-between gap-4 mt-8 pt-4 border-t border-border/40">
                  <div className="flex items-center gap-6">

                    {/* Voting */}
                    <div className="flex items-center gap-1">
                       <Button
                        variant={topic.userVote === 'UPVOTE' ? "primary" : "tertiary"}
                        isIconOnly
                        size="md"
                        onPress={() => handleVote('UPVOTE')}
                      >
                        <ArrowUp className="w-5 h-5" />
                      </Button>
                      <span className="text-sm font-bold text-muted-foreground min-w-6 text-center">
                        {topic.score}
                      </span>
                      <Button
                        variant={topic.userVote === 'DOWNVOTE' ? "danger" : "tertiary"}
                        isIconOnly
                        size="md"
                        onPress={() => handleVote('DOWNVOTE')}
                      >
                        <ArrowDown className="w-5 h-5" />
                      </Button>
                    </div>

                    {/* Reactions */}
                    <div className="flex items-center gap-2">
                      {topic.reactions.map((react) => (
                        <Button
                          key={react.reactionType}
                          size="sm"
                          variant={react.userReacted ? "primary" : "outline"}
                          className="h-8 min-w-12 px-3 flex items-center gap-1.5"
                          onClick={() => handleReaction(react.reactionType)}
                        >
                          <span>{react.reactionType === "thumbs_up" ? "👍" : react.reactionType === "heart" ? "❤️" : "💡"}</span>
                          <span className="text-xs font-semibold">{react.count}</span>
                        </Button>
                      ))}

                      {isAuthenticated && (
                        <Dropdown>
                          <DropdownTrigger>
                            <Button size="sm" isIconOnly variant="ghost">
                              <Smile className="w-5 h-5 text-muted-foreground" />
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu aria-label="Reaction emojis" className="min-w-fit flex-row gap-1 p-1">
                            <DropdownItem key="thumbs_up" className="px-2" onPress={() => handleReaction("thumbs_up")}>👍</DropdownItem>
                            <DropdownItem key="heart" className="px-2" onPress={() => handleReaction("heart")}>❤️</DropdownItem>
                            <DropdownItem key="light" className="px-2" onPress={() => handleReaction("insight")}>💡</DropdownItem>
                          </DropdownMenu>
                        </Dropdown>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {topic.viewCount} Views
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      {topic.replyCount} Replies
                    </span>
                  </div>
                </div>

              </Card>

              {/* Replies Section */}
              <div className="flex flex-col gap-4 mt-4">
                <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Replies ({topic.replyCount})
                </h2>

                {repliesLoading ? (
                  <div className="flex justify-center py-10">
                    <Spinner size="sm" />
                  </div>
                ) : replies.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground border-dashed">
                    No replies yet. Be the first to join the discussion below!
                  </Card>
                ) : (
                  renderRepliesList(replies)
                )}
              </div>

              {/* Reply Editor Form */}
              {isAuthenticated ? (
                <div id="reply-editor-container" className="flex flex-col gap-4 mt-6">
                  {topic.isLocked ? (
                    <Card className="p-4 bg-muted/30 border border-border/40 text-center text-muted-foreground text-sm">
                      This discussion has been locked by a moderator and cannot receive new replies.
                    </Card>
                  ) : (
                    <form onSubmit={handlePostReply} className="flex flex-col gap-3">
                      {replyingToUser && (
                        <div className="flex items-center justify-between bg-primary/10 border border-primary/20 text-primary px-4 py-2 rounded-xl text-xs font-semibold">
                          <span>
                            Replying to <strong>@{replyingToUser}</strong>
                            {quoteText && <span className="text-muted-foreground/80 font-normal"> (Quoted reference)</span>}
                          </span>
                          <button
                            type="button"
                            className="font-bold hover:text-danger"
                            onClick={() => {
                              setParentReplyId(undefined);
                              setReplyingToUser(null);
                              setQuoteText(undefined);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      <TextArea
                        placeholder="Write your response... (Supports Markdown: **bold**, `code`, ```blocks```)"
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        rows={4}
                        className="bg-surface"
                      />
                      <div className="flex justify-end gap-2">
                        {replyingToUser && (
                          <Button
                            variant="tertiary"
                            onPress={() => {
                              setParentReplyId(undefined);
                              setReplyingToUser(null);
                              setQuoteText(undefined);
                            }}
                          >
                            Reset Nesting
                          </Button>
                        )}
                        <Button
                          type="submit"
                          variant="primary"
                          isDisabled={submittingReply || !replyContent.trim()}
                        >
                          {submittingReply && <Spinner size="sm" color="current" className="mr-1.5" />}
                          Post Reply
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                <Card className="p-6 text-center bg-muted/20 border border-border/40 mt-6 flex flex-col items-center justify-center gap-3">
                  <p className="text-sm text-muted-foreground">You must be logged in to participate in the conversation.</p>
                  <Button variant="primary" size="sm" onPress={() => router.push(`/login?redirect=/forum/topic/${topic.slug}`)}>
                    Log In to Reply
                  </Button>
                </Card>
              )}

            </div>

            {/* Right side: AI Summary & Stats */}
            <div className="lg:col-span-1 flex flex-col gap-6">

              {/* AI Summary Card */}
              <Card className="relative overflow-hidden border border-primary/20 bg-linear-to-b from-primary-950/10 to-transparent p-6 text-left">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 blur-2xl rounded-full pointer-events-none" />
                <h3 className="text-sm font-bold text-primary flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  AI Summary
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed mt-3">
                  {topic.aiExcerpt || "No summary available yet. An AI-generated summary will appear once the discussion gains enough replies and detail."}
                </p>
              </Card>

              {/* Discussion Details Stats */}
              <Card className="p-6 flex flex-col gap-4 text-left border border-border/60">
                <h3 className="text-sm font-bold text-foreground">Discussion Details</h3>

                <div className="flex flex-col gap-2.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Created</span>
                    <span className="font-semibold text-foreground">{new Date(topic.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Activity</span>
                    <span className="font-semibold text-foreground">{formatTimeAgo(topic.lastActivityAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Views</span>
                    <span className="font-semibold text-foreground">{topic.viewCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Replies</span>
                    <span className="font-semibold text-foreground">{topic.replyCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Score</span>
                    <span className="font-semibold text-foreground">{topic.score}</span>
                  </div>
                </div>
              </Card>

            </div>

          </div>
        ) : null}

      </div>
    </PublicPageShell>
  );
}
