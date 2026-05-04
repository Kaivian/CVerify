"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Typography, Chip } from "@heroui/react";
import { Heart, Share2, MessageSquare, ShieldCheck, User } from "lucide-react";

interface Post {
  id: string;
  title: string;
  category: "Announcement" | "Engineering" | "Recruitment";
  author: string;
  date: string;
  content: string;
  likes: number;
  commentsCount: number;
}

export default function WorkspacePostsTab() {
  const params = useParams();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  // Mock Posts
  const [posts, setPosts] = useState<Post[]>([
    {
      id: "post-1",
      title: "CVerify integration successfully deployed!",
      category: "Engineering",
      author: "Hoang Nguyen (Tech Lead)",
      date: "2 days ago",
      content: "We are thrilled to announce that our developer screening workflow has integrated credential hashing, achieving 100% automated skill verification. Candidates can now link their source code repositories directly and verify their experience in seconds.",
      likes: 42,
      commentsCount: 5,
    },
    {
      id: "post-2",
      title: "We are hiring! Join our growing team.",
      category: "Recruitment",
      author: "Trang Pham (HR Lead)",
      date: "5 days ago",
      content: "DreamHost is seeking passionate developers, designers, and automated QA engineers to work on modern tech stacks. Check out our 'Jobs' tab for all details and apply directly! We offer hybrid working, competitive packages, and top-tier devices.",
      likes: 89,
      commentsCount: 12,
    },
    {
      id: "post-3",
      title: "Achieved Verified Enterprise Level 3 Status",
      category: "Announcement",
      author: "Minh Le (CEO)",
      date: "1 week ago",
      content: "We have finalized our security and domain ownership compliance checks, successfully obtaining Level 3 verification from CVerify authorities. This ensures highest degree of transparency and cryptographic trust for all future contracts.",
      likes: 56,
      commentsCount: 3,
    },
  ]);

  const [likedPosts, setLikedPosts] = useState<string[]>([]);

  const handleLike = (postId: string) => {
    if (likedPosts.includes(postId)) {
      setLikedPosts(likedPosts.filter((id) => id !== postId));
      setPosts(
        posts.map((p) => (p.id === postId ? { ...p, likes: p.likes - 1 } : p))
      );
    } else {
      setLikedPosts([...likedPosts, postId]);
      setPosts(
        posts.map((p) => (p.id === postId ? { ...p, likes: p.likes + 1 } : p))
      );
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {posts.map((post) => {
        const isLiked = likedPosts.includes(post.id);
        return (
          <Card key={post.id} className="p-6 bg-surface border border-border rounded-2xl space-y-4">
            {/* Author / Metadata */}
            <div className="flex justify-between items-start select-none">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/10 border border-border flex items-center justify-center text-accent">
                  <User size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Typography type="body-sm" className="font-bold text-foreground text-sm">
                      {post.author}
                    </Typography>
                    <ShieldCheck size={14} className="text-success" />
                  </div>
                  <span className="text-[10px] text-muted-foreground block -mt-0.5">
                    {post.date}
                  </span>
                </div>
              </div>
              <Chip
                size="sm"
                variant="soft"
                color={
                  post.category === "Engineering"
                    ? "accent"
                    : post.category === "Recruitment"
                    ? "warning"
                    : "success"
                }
                className="text-[9px] font-bold"
              >
                {post.category}
              </Chip>
            </div>

            {/* Post Title & Content */}
            <div className="space-y-2">
              <Typography type="body-sm" className="font-extrabold text-foreground text-base leading-tight">
                {post.title}
              </Typography>
              <Typography type="body-xs" className="text-muted text-xs leading-relaxed whitespace-pre-line">
                {post.content}
              </Typography>
            </div>

            {/* Actions (Like, Comment, Share) */}
            <div className="flex items-center gap-4 pt-3 border-t border-border/60 text-xs text-muted-foreground select-none">
              <button
                onClick={() => handleLike(post.id)}
                className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-card/40 transition-colors cursor-pointer font-bold ${
                  isLiked ? "text-danger" : "text-muted hover:text-foreground"
                }`}
              >
                <Heart size={14} className={isLiked ? "fill-danger" : ""} />
                <span>{post.likes}</span>
              </button>

              <button className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-card/40 transition-colors text-muted hover:text-foreground cursor-pointer font-bold">
                <MessageSquare size={14} />
                <span>{post.commentsCount}</span>
              </button>

              <button className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-card/40 transition-colors text-muted hover:text-foreground cursor-pointer font-bold ml-auto">
                <Share2 size={14} />
                <span>Share</span>
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
