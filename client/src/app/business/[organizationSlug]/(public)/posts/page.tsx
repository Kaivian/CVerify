"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Typography, Chip, toast } from "@heroui/react";
import { BusinessVerificationBadge } from "@/components/ui/cverify/verification-badges";
import { useWorkspaceStore } from "@/features/workspace/store/use-workspace-store";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { workspaceService } from "@/features/workspace/services/workspace.service";
import { formatDate } from "@/lib/utils/format";
import {
  ThumbsUp,
  MessageSquare,
  Share2,
  Globe,
  MoreHorizontal,
  Send,
  Heart,
  Check,
  X,
  Upload,
  Building
} from "lucide-react";

interface Comment {
  id: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  date: string;
}

export default function WorkspacePostsTab() {
  const params = useParams();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[organizationSlug]);
  const user = useAuthStore((s) => s.user);
  const allPosts = useWorkspaceStore((s) => s.posts);
  const allPostsLoading = useWorkspaceStore((s) => s.postsLoading);
  const allPostsErrors = useWorkspaceStore((s) => s.postsErrors);
  const fetchPosts = useWorkspaceStore((s) => s.fetchPosts);
  const createPostAction = useWorkspaceStore((s) => s.createPostAction);

  const postsFromStore = useMemo(() => allPosts[organizationSlug] ?? [], [allPosts, organizationSlug]);
  const loadingPosts = allPostsLoading[organizationSlug] ?? false;
  const postsError = allPostsErrors[organizationSlug];
  const posts = postsFromStore;
  const errorPosts = !!postsError;

  const [commentsState, setCommentsState] = useState<Record<string, Comment[]>>({});

  useEffect(() => {
    if (organizationSlug) {
      fetchPosts(organizationSlug);
    }
  }, [organizationSlug, fetchPosts]);

  useEffect(() => {
    if (postsFromStore.length > 0) {
      const updateComments = async () => {
        await Promise.resolve();
        setCommentsState((prev) => {
          const updated = { ...prev };
          postsFromStore.forEach((p) => {
            if (!updated[p.id]) {
              let initialComments: Comment[] = [];
              if (p.category === "Engineering") {
                initialComments = [
                  {
                    id: "c-1",
                    authorName: "Emily Nguyen",
                    content: "The signing event is so grand! Congratulations to CVerify and partners.",
                    date: "2h ago"
                  },
                  {
                    id: "c-2",
                    authorName: "John Doe",
                    content: "Great progress, keep up the outstanding work team! The new features are very practical.",
                    date: "1h ago"
                  }
                ];
              } else if (p.category === "Recruitment") {
                initialComments = [
                  {
                    id: "c-4",
                    authorName: "Alex Mercer",
                    content: "Are we accepting undergraduate Web Interns (.NET/React) right now?",
                    date: "2d ago"
                  }
                ];
              }
              updated[p.id] = initialComments;
            }
          });
          return updated;
        });
      };
      updateComments();
    }
  }, [postsFromStore]);

  const [likedPosts, setLikedPosts] = useState<string[]>([]);
  const [sharedPosts, setSharedPosts] = useState<string[]>([]);
  const [expandedPosts, setExpandedPosts] = useState<string[]>([]);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [showAllComments, setShowAllComments] = useState<Record<string, boolean>>({});

  const commentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostCategory, setNewPostCategory] = useState<"Announcement" | "Engineering" | "Recruitment">("Announcement");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!workspaceDetails) return null;

  // Reactive Permission helper key check
  const hasPermission = (permissionKey: string): boolean => {
    if (!workspaceDetails) return false;
    // Fallback logic for managers
    if (
      workspaceDetails.userRole === "OWNER" ||
      workspaceDetails.userRole === "REPRESENTATIVE" ||
      workspaceDetails.userRole === "HR"
    ) {
      return true;
    }
    return workspaceDetails.permissions?.includes(permissionKey) || false;
  };

  // Handle local form submission for post creation
  const handleCreatePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim()) {
      toast.danger("Please enter the announcement content!");
      return;
    }

    setIsSubmitting(true);
    let uploadedUrls: string[] = [];
    try {
      if (selectedFiles.length > 0) {
        uploadedUrls = await workspaceService.uploadWorkspaceMedia(organizationSlug, selectedFiles);
      }

      const createdPost = await createPostAction(organizationSlug, {
        category: newPostCategory,
        content: newPostContent.trim(),
        imageUrls: uploadedUrls
      });

      if (createdPost) {
        toast.success("Announcement posted successfully!");
        // Reset fields
        setNewPostContent("");
        setSelectedFiles([]);
        setNewPostCategory("Announcement");
        setShowCreatePostModal(false);
      } else {
        toast.danger("Failed to post announcement!");
      }
    } catch (error) {
      console.error(error);
      toast.danger("An error occurred while uploading images or posting announcement!");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle like status (Facebook style)
  const handleLike = (postId: string) => {
    if (likedPosts.includes(postId)) {
      setLikedPosts(likedPosts.filter((id) => id !== postId));
    } else {
      setLikedPosts([...likedPosts, postId]);
    }
  };

  // Focus comment input field
  const handleFocusCommentInput = (postId: string) => {
    const inputEl = commentInputRefs.current[postId];
    if (inputEl) {
      inputEl.focus();
    }
  };

  // Handle share post link
  const handleSharePost = (postId: string) => {
    if (typeof window !== "undefined") {
      const shareUrl = `${window.location.origin}/business/${organizationSlug}/posts?post=${postId}`;
      navigator.clipboard.writeText(shareUrl);
      toast.success("Copied post link to clipboard!");
      setSharedPosts((prev) => (prev.includes(postId) ? prev : [...prev, postId]));
    }
  };

  // Handle text input for comments
  const handleCommentInputChange = (postId: string, text: string) => {
    setCommentInputs({
      ...commentInputs,
      [postId]: text
    });
  };

  // Submit comment
  const handleSubmitComment = (postId: string) => {
    const content = commentInputs[postId]?.trim();
    if (!content) return;

    const newComment: Comment = {
      id: `c-new-${Date.now()}`,
      authorName: user?.fullName || "Guest Visitor",
      authorAvatar: user?.avatarUrl,
      content,
      date: "Just now"
    };

    setCommentsState((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), newComment]
    }));

    // Clear input
    setCommentInputs({
      ...commentInputs,
      [postId]: ""
    });

    // Auto expand to show the newly added comment
    setShowAllComments({
      ...showAllComments,
      [postId]: true
    });
  };

  // Component for image grid layout (Facebook collage grid)
  const PostImageGrid = ({ images }: { images: string[] }) => {
    if (!images || images.length === 0) return null;

    if (images.length === 1) {
      return (
        <div className="overflow-hidden border border-border/60 bg-card/20 rounded-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[0]} alt="Post attachment" className="w-full h-auto max-h-[480px] object-cover" />
        </div>
      );
    }

    if (images.length === 2) {
      return (
        <div className="grid grid-cols-2 gap-1 overflow-hidden border border-border/60 bg-card/20 rounded-md h-[280px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[0]} alt="Post attachment 1" className="w-full h-full object-cover" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[1]} alt="Post attachment 2" className="w-full h-full object-cover" />
        </div>
      );
    }

    if (images.length === 3) {
      return (
        <div className="grid grid-cols-2 gap-1 overflow-hidden border border-border/60 bg-card/20 rounded-md h-[360px]">
          <div className="col-span-1 h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[0]} alt="Post attachment 1" className="w-full h-full object-cover" />
          </div>
          <div className="col-span-1 grid grid-rows-2 gap-1 h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[1]} alt="Post attachment 2" className="w-full h-full object-cover" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[2]} alt="Post attachment 3" className="w-full h-full object-cover" />
          </div>
        </div>
      );
    }

    if (images.length === 4) {
      return (
        <div className="grid grid-cols-2 gap-1 overflow-hidden border border-border/60 bg-card/20 rounded-md h-[360px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[0]} alt="Post attachment 1" className="w-full h-full object-cover" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[1]} alt="Post attachment 2" className="w-full h-full object-cover" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[2]} alt="Post attachment 3" className="w-full h-full object-cover" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[3]} alt="Post attachment 4" className="w-full h-full object-cover" />
        </div>
      );
    }

    // 5 or more images
    return (
      <div className="grid grid-cols-6 gap-1 overflow-hidden border border-border/60 bg-card/20 rounded-md h-[380px]">
        <div className="col-span-3 h-52">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[0]} alt="Post attachment 1" className="w-full h-full object-cover" />
        </div>
        <div className="col-span-3 h-52">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[1]} alt="Post attachment 2" className="w-full h-full object-cover" />
        </div>
        <div className="col-span-2 h-36">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[2]} alt="Post attachment 3" className="w-full h-full object-cover" />
        </div>
        <div className="col-span-2 h-36">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[3]} alt="Post attachment 4" className="w-full h-full object-cover" />
        </div>
        <div className="col-span-2 h-36 relative select-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[4]} alt="Post attachment 5" className="w-full h-full object-cover" />
          {images.length > 5 && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-base font-bold">
              +{images.length - 4}
            </div>
          )}
        </div>
      </div>
    );
  };

  const orgName = workspaceDetails.organizationName || "Partner Enterprise";
  const orgLogo = workspaceDetails.logoUrl;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* -- Main Feed Column -- */}
      <div className="lg:col-span-2 space-y-6">
        {/* "What's on your mind?" announcement widget */}
        {hasPermission("organization:posts:write") && (
          <Card className="p-4 bg-surface border border-border rounded-xl flex items-center gap-3 w-full">
            <div className="w-10 h-10 rounded-full bg-accent/10 border border-border flex items-center justify-center text-accent font-semibold text-sm shrink-0 select-none overflow-hidden">
              {orgLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={orgLogo} alt={`${orgName} Logo`} className="w-full h-full object-cover" />
              ) : (
                <Building className="size-5 text-accent" />
              )}
            </div>
            <button
              onClick={() => setShowCreatePostModal(true)}
              className="flex-1 text-left bg-card/40 hover:bg-card/60 transition-colors border border-border rounded-full px-4 py-2.5 text-muted-foreground text-xs cursor-pointer font-outfit"
            >
              Write an announcement or share company updates...
            </button>
          </Card>
        )}

        {loadingPosts && (
          <div className="space-y-4">
            {[1, 2].map((n) => (
              <Card key={n} className="p-4 bg-surface border border-border rounded-xl space-y-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-accent/10 rounded w-1/4" />
                    <div className="h-3 bg-accent/10 rounded w-1/6" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-accent/10 rounded w-full" />
                  <div className="h-3 bg-accent/10 rounded w-5/6" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {errorPosts && !loadingPosts && (
          <Card className="p-6 bg-surface border border-border rounded-xl flex flex-col items-center justify-center text-muted select-none text-center">
            <span className="text-xs font-medium italic text-danger">An error occurred while loading announcements. Please try again later.</span>
          </Card>
        )}

        {!loadingPosts && !errorPosts && posts.length === 0 && (
          <Card className="p-8 bg-surface border border-border rounded-xl flex flex-col items-center justify-center text-muted select-none text-center">
            <Building className="size-8 text-accent/40 mb-2" />
            <span className="text-xs font-semibold text-foreground">No posts or announcements found</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">The organization has not published any announcements on this feed.</span>
          </Card>
        )}

        {!loadingPosts && !errorPosts && posts.map((post) => {
          const isLiked = likedPosts.includes(post.id);

          // Truncate logic
          const isLong = post.content.length > 250;
          const shouldTruncate = isLong && !expandedPosts.includes(post.id);
          const displayText = shouldTruncate ? `${post.content.slice(0, 250)}...` : post.content;

          // Comments list visibility logic
          const commentsList = commentsState[post.id] || [];
          const hasManyComments = commentsList.length > 3;
          const showingAll = showAllComments[post.id];
          const visibleComments = showingAll ? commentsList : commentsList.slice(0, 3);

          return (
            <Card key={post.id} className="p-4 bg-surface border border-border rounded-xl space-y-4">
              {/* -- Facebook Post Header -- */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  {/* Organization Avatar */}
                  <div className="w-10 h-10 rounded-full bg-accent/10 border border-border flex items-center justify-center text-accent font-semibold text-sm select-none overflow-hidden shrink-0">
                    {orgLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={orgLogo} alt={`${orgName} Logo`} className="w-full h-full object-cover" />
                    ) : (
                      <Building className="size-5 text-accent" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Typography type="body-sm" className="font-semibold text-foreground text-sm hover:underline cursor-pointer">
                        {orgName}
                      </Typography>
                      <BusinessVerificationBadge level={workspaceDetails.verificationLevel} className="scale-85 origin-left" />
                    </div>

                    {/* Admin Badge */}
                    {post.authorName && (
                      <div className="text-[10px] text-accent font-medium mt-0.5 select-none">
                        Posted by: {post.authorName} ({post.authorRole || "Member"})
                      </div>
                    )}

                    {/* Subtitle with date & Globe icon */}
                    <div className="flex items-center gap-1 text-[11px] text-muted font-normal select-none mt-0.5">
                      <span>{formatDate(post.createdAt, { dateStyle: "medium", timeStyle: "short" })}</span>
                      <span>·</span>
                      <span title="Public"><Globe className="size-3" /></span>
                    </div>
                  </div>
                </div>

                {/* Tag + Menu icon */}
                <div className="flex items-center gap-2 select-none">
                  <Chip size="sm" variant="soft" color="default" className="text-[9px] font-medium h-5 px-1.5">
                    {post.category}
                  </Chip>
                  <button
                    aria-label="Settings"
                    className="text-muted hover:text-foreground p-1.5 rounded-full hover:bg-card/50 transition-colors cursor-pointer border-none"
                  >
                    <MoreHorizontal className="size-5" />
                  </button>
                </div>
              </div>

              {/* -- Facebook Post Content -- */}
              <div className="space-y-3 font-normal text-xs leading-relaxed">
                <Typography type="body-xs" className="text-foreground whitespace-pre-line text-xs font-normal">
                  {displayText}
                  {shouldTruncate && (
                    <button
                      onClick={() => setExpandedPosts([...expandedPosts, post.id])}
                      className="text-accent font-semibold hover:underline text-xs ml-1 focus:outline-hidden cursor-pointer"
                    >
                      See more
                    </button>
                  )}
                </Typography>

                {/* Collage Grid */}
                <PostImageGrid images={post.images} />
              </div>

              {/* -- Facebook Interactions Counter -- */}
              <div className="flex items-center justify-between text-[11px] text-muted select-none pb-1 font-normal">
                <div className="flex items-center gap-1.5">
                  <span className="flex items-center">
                    <span className="flex items-center justify-center bg-blue-500 text-white rounded-full p-0.5 size-4 shadow-sm z-10">
                      <ThumbsUp className="size-2.5 fill-white text-white" />
                    </span>
                    <span className="flex items-center justify-center bg-red-500 text-white rounded-full p-0.5 size-4 shadow-sm -ml-1.5 z-20">
                      <Heart className="size-2.5 fill-white text-white" />
                    </span>
                  </span>
                  <span className="font-normal text-muted-foreground">
                    {post.likes + (isLiked ? 1 : 0)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{commentsList.length} comments</span>
                  <span>·</span>
                  <span>{post.sharesCount + (sharedPosts.includes(post.id) ? 1 : 0)} shares</span>
                </div>
              </div>

              <div className="border-b border-border/50" />

              {/* -- Facebook Actions -- */}
              <div className="flex items-center gap-1 text-xs select-none">
                {/* Like Button */}
                <button
                  onClick={() => handleLike(post.id)}
                  className={`flex items-center justify-center gap-2 flex-1 py-1.5 rounded-lg hover:bg-card/45 transition-colors cursor-pointer font-semibold ${isLiked ? "text-blue-500" : "text-muted hover:text-foreground"
                    }`}
                >
                  <ThumbsUp className={`size-4 ${isLiked ? "fill-blue-500 text-blue-500" : ""}`} />
                  <span>Like</span>
                </button>

                {/* Comment Button */}
                <button
                  onClick={() => handleFocusCommentInput(post.id)}
                  className="flex items-center justify-center gap-2 flex-1 py-1.5 rounded-lg hover:bg-card/45 transition-colors cursor-pointer font-semibold text-muted hover:text-foreground"
                >
                  <MessageSquare className="size-4" />
                  <span>Comment</span>
                </button>

                {/* Share Button */}
                <button
                  onClick={() => handleSharePost(post.id)}
                  className="flex items-center justify-center gap-2 flex-1 py-1.5 rounded-lg hover:bg-card/45 transition-colors cursor-pointer font-semibold text-muted hover:text-foreground"
                >
                  <Share2 className="size-4" />
                  <span>Share</span>
                </button>
              </div>

              <div className="border-b border-border/50" />

              {/* -- Facebook Comments Section -- */}
              <div className="space-y-3 pt-1">
                {/* Toggle to see more comments */}
                {hasManyComments && !showingAll && (
                  <button
                    onClick={() => setShowAllComments({ ...showAllComments, [post.id]: true })}
                    className="text-[11px] text-muted-foreground hover:text-accent font-semibold hover:underline block text-left pt-0.5 select-none cursor-pointer"
                  >
                    See more {commentsList.length - 3} comments
                  </button>
                )}

                {/* Comments list */}
                {visibleComments.length > 0 && (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {visibleComments.map((comment) => (
                      <div key={comment.id} className="flex gap-2 text-xs items-start">
                        {/* Comment Avatar */}
                        <div className="w-8 h-8 rounded-full bg-accent/10 border border-border flex items-center justify-center text-accent font-semibold text-xs shrink-0 select-none overflow-hidden">
                          {comment.authorAvatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={comment.authorAvatar} alt={comment.authorName} className="w-full h-full object-cover" />
                          ) : (
                            comment.authorName.substring(0, 1).toUpperCase()
                          )}
                        </div>

                        {/* Comment Bubble */}
                        <div className="flex flex-col gap-0.5 max-w-[85%]">
                          <div className="bg-card/60 border border-border/60 px-3 py-1.5 rounded-2xl">
                            <span className="font-semibold text-foreground block text-[11px] leading-tight">
                              {comment.authorName}
                            </span>
                            <p className="text-foreground font-normal leading-normal whitespace-pre-line wrap-break-word text-[11px] mt-0.5">
                              {comment.content}
                            </p>
                          </div>

                          {/* Comment Actions */}
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-semibold px-2 select-none">
                            <button className="hover:text-foreground cursor-pointer">Like</button>
                            <span>·</span>
                            <button className="hover:text-foreground cursor-pointer">Reply</button>
                            <span>·</span>
                            <span>{comment.date}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Comment Input block */}
                <div className="flex gap-2 pt-1 items-center">
                  {/* User Avatar */}
                  <div className="w-8 h-8 rounded-full bg-accent/10 border border-border flex items-center justify-center text-accent font-semibold text-xs shrink-0 select-none overflow-hidden">
                    {user?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
                    ) : (
                      user?.fullName.substring(0, 1).toUpperCase() || "K"
                    )}
                  </div>

                  {/* Input box */}
                  <div className="relative flex-1">
                    <input
                      ref={(el) => {
                        commentInputRefs.current[post.id] = el;
                      }}
                      type="text"
                      placeholder={user ? `Comment as ${user.fullName}...` : "Write a public comment..."}
                      value={commentInputs[post.id] || ""}
                      onChange={(e) => handleCommentInputChange(post.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSubmitComment(post.id);
                        }
                      }}
                      className="w-full bg-card/40 border border-border rounded-full pl-4 pr-10 py-1.5 text-xs focus:outline-hidden focus:border-accent text-foreground font-outfit font-normal"
                    />
                    <button
                      onClick={() => handleSubmitComment(post.id)}
                      aria-label="Send comment"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-accent cursor-pointer flex items-center justify-center border-none"
                    >
                      <Send className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* -- Side Widget Column -- */}
      <div className="space-y-6">
        {/* Corporate Stats */}
        <Card className="p-5 bg-surface border border-border rounded-xl space-y-4">
          <Typography type="h4" className="font-semibold text-foreground text-xs uppercase tracking-wider block">
            Company details
          </Typography>

          <div className="space-y-3 text-xs select-none font-normal">
            {workspaceDetails.companyType && (
              <div>
                <span className="text-[9px] text-muted-foreground uppercase block">Company Type</span>
                <span className="font-medium text-foreground text-xs">{workspaceDetails.companyType}</span>
              </div>
            )}

            {workspaceDetails.companySize && (
              <div>
                <span className="text-[9px] text-muted-foreground uppercase block">Company Size</span>
                <span className="font-medium text-foreground text-xs">
                  {workspaceDetails.companySize.toLowerCase().includes("employee")
                    ? workspaceDetails.companySize
                    : `${workspaceDetails.companySize} employees`}
                </span>
              </div>
            )}

            {workspaceDetails.industryTags && workspaceDetails.industryTags.length > 0 && (
              <div>
                <span className="text-[9px] text-muted-foreground uppercase block">Primary Focus</span>
                <span className="font-medium text-foreground text-xs">{workspaceDetails.industryTags[0]}</span>
              </div>
            )}

            {workspaceDetails.website && (
              <div>
                <span className="text-[9px] text-muted-foreground uppercase block">Website</span>
                <a
                  href={workspaceDetails.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent hover:underline break-all text-xs"
                >
                  {workspaceDetails.website.replace("https://", "").replace("http://", "")}
                </a>
              </div>
            )}

            <div>
              <span className="text-[9px] text-muted-foreground uppercase block">Headquarters</span>
              <span className="font-medium text-foreground text-xs">
                {workspaceDetails.city
                  ? workspaceDetails.city.toLowerCase().includes("vietnam")
                    ? workspaceDetails.city
                    : `${workspaceDetails.city}, Vietnam`
                  : workspaceDetails.location || "Not specified"}
              </span>
            </div>

            <div>
              <span className="text-[9px] text-muted-foreground uppercase block">Branch Offices</span>
              <span className="font-medium text-foreground text-xs">{workspaceDetails.branchCount || 0} branches</span>
            </div>

            <div>
              <span className="text-[9px] text-muted-foreground uppercase block">Founded</span>
              <span className="font-medium text-foreground text-xs">{workspaceDetails.founded || "Not specified"}</span>
            </div>

            {workspaceDetails.taxCode && (
              <div>
                <span className="text-[9px] text-muted-foreground uppercase block">Tax Registered Code</span>
                <span className="font-medium text-foreground text-xs font-mono">{workspaceDetails.taxCode}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Social Links */}
        <Card className="p-5 bg-surface border border-border rounded-xl space-y-4">
          <Typography type="h4" className="font-semibold text-foreground text-xs uppercase tracking-wider block">
            Social Coordinates
          </Typography>
          <div className="flex flex-col gap-2 font-normal">
            {workspaceDetails.linkedinUrl && (
              <a
                href={workspaceDetails.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-card/5 hover:bg-card/15 transition-colors text-xs font-medium text-muted hover:text-foreground"
              >
                <span>LinkedIn</span>
                <span className="text-[9px] text-accent uppercase">Visit</span>
              </a>
            )}
            {workspaceDetails.facebookUrl && (
              <a
                href={workspaceDetails.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-card/5 hover:bg-card/15 transition-colors text-xs font-medium text-muted hover:text-foreground"
              >
                <span>Facebook</span>
                <span className="text-[9px] text-accent uppercase">Visit</span>
              </a>
            )}
            {workspaceDetails.twitterUrl && (
              <a
                href={workspaceDetails.twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-card/5 hover:bg-card/15 transition-colors text-xs font-medium text-muted hover:text-foreground"
              >
                <span>Twitter / X</span>
                <span className="text-[9px] text-accent uppercase">Visit</span>
              </a>
            )}
            {workspaceDetails.website && (
              <a
                href={workspaceDetails.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-card/5 hover:bg-card/15 transition-colors text-xs font-medium text-muted hover:text-foreground"
              >
                <span>Website Portal</span>
                <span className="text-[9px] text-accent uppercase">Visit</span>
              </a>
            )}
            {!workspaceDetails.linkedinUrl &&
              !workspaceDetails.facebookUrl &&
              !workspaceDetails.twitterUrl &&
              !workspaceDetails.website && (
                <span className="text-xs text-muted font-normal italic">No social coordinates specified.</span>
              )}
          </div>
        </Card>

        {/* Office Location */}
        <Card className="p-5 bg-surface border border-border rounded-xl space-y-4">
          <Typography type="h4" className="font-semibold text-foreground text-xs uppercase tracking-wider block">
            Office Location
          </Typography>
          <div className="space-y-3 font-normal">
            <div className="text-xs text-foreground">
              <span>
                {workspaceDetails.detailAddress
                  ? `${workspaceDetails.detailAddress}, ${workspaceDetails.city || ""}`
                  : workspaceDetails.city || workspaceDetails.location || "No office locations registered."}
              </span>
            </div>
            {workspaceDetails.googleMapsEmbedUrl ? (
              <div className="h-48 rounded-xl overflow-hidden border border-border/80">
                <iframe
                  src={workspaceDetails.googleMapsEmbedUrl}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen={false}
                  loading="lazy"
                  title="Google Maps Location"
                />
              </div>
            ) : (
              <div className="h-28 border border-dashed border-border rounded-xl bg-surface-secondary/40 flex flex-col items-center justify-center text-muted select-none">
                <span className="text-xs font-medium italic">No interactive map location specified.</span>
              </div>
            )}
          </div>
        </Card>

        {/* Verification Highlights */}
        <Card className="p-5 bg-surface border border-border rounded-xl space-y-3">
          <Typography type="h4" className="font-semibold text-foreground text-xs uppercase tracking-wider block">
            Verification Badging
          </Typography>
          <Typography type="body-xs" className="text-muted leading-relaxed font-normal text-xs">
            This workspace holds a Level 3 Domain & Ownership verification status. All corporate information has been
            cryptographic-hashed and signed by CVerify Authorities.
          </Typography>
          <div className="pt-1 select-none font-normal text-xs text-muted-foreground space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span>•</span>
              Legal Authority Verified
            </div>
            <div className="flex items-center gap-1.5">
              <span>•</span>
              Representative Signature Matches
            </div>
          </div>
        </Card>
      </div>

      {/* -- Scoped Form Drawer Modal Dialog for Announcement/Post Creation -- */}
      {showCreatePostModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border w-full max-w-xl rounded-xl shadow-2xl overflow-hidden font-outfit select-none flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-card/10">
              <span className="font-semibold text-sm text-foreground">Write an announcement or share company updates...</span>
              <button
                onClick={() => setShowCreatePostModal(false)}
                className="p-1 rounded-full hover:bg-card/50 text-muted hover:text-foreground cursor-pointer border-none"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreatePostSubmit} className="p-6 overflow-y-auto space-y-4 text-xs font-normal">
              {/* Content Textarea */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted uppercase font-semibold">Announcement Content *</label>
                <textarea
                  required
                  rows={5}
                  placeholder="Enter announcement content or company update..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent resize-none font-outfit"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Category Selection */}
                <div className="space-y-1">
                  <label className="text-[10px] text-muted uppercase font-semibold">Category</label>
                  <select
                    value={newPostCategory}
                    onChange={(e) => setNewPostCategory(e.target.value as "Announcement" | "Engineering" | "Recruitment")}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-accent cursor-pointer"
                  >
                    <option value="Announcement">Announcement</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Recruitment">Recruitment</option>
                  </select>
                </div>

                {/* Author Display */}
                <div className="space-y-1">
                  <label className="text-[10px] text-muted uppercase font-semibold">Author</label>
                  <input
                    type="text"
                    disabled
                    value={user?.fullName || "Manager"}
                    className="w-full bg-card/50 border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Attachment Images */}
              <div className="space-y-2">
                <label className="text-[10px] text-muted uppercase font-semibold">
                  Attachments
                </label>

                {/* Drag and drop zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files) {
                      const filesArray = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                      setSelectedFiles(prev => [...prev, ...filesArray]);
                    }
                  }}
                  className="border border-dashed border-border hover:border-accent/40 rounded-lg p-4 flex flex-col items-center justify-center bg-card/10 text-muted transition-colors cursor-pointer select-none text-center"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-5 text-muted-foreground mb-1" />
                  <span className="text-[11px] font-semibold text-foreground">
                    Drag and drop images here or click to select
                  </span>
                  <span className="text-[9px] text-muted-foreground mt-0.5">
                    Supports JPEG, PNG, WebP, GIF (max 10MB)
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        const filesArray = Array.from(e.target.files);
                        setSelectedFiles(prev => [...prev, ...filesArray]);
                      }
                    }}
                  />
                </div>

                {/* Thumbnail list with X button */}
                {selectedFiles.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 pt-2">
                    {selectedFiles.map((file, index) => {
                      const objectUrl = URL.createObjectURL(file);
                      return (
                        <div key={index} className="relative aspect-square rounded-md overflow-hidden border border-border/80 group bg-card/20 select-none">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={objectUrl}
                            alt={`selected-${index}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                            }}
                            className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-black text-white rounded-full transition-colors cursor-pointer border-none"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer / Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-border/40">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowCreatePostModal(false)}
                  className="px-4 py-2 rounded-lg border border-border text-muted hover:text-foreground font-semibold hover:bg-card/50 transition-colors cursor-pointer text-xs disabled:opacity-55 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-accent text-background hover:bg-accent/90 transition-colors font-semibold cursor-pointer text-xs border-none disabled:opacity-55 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Posting..." : "Post Announcement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
