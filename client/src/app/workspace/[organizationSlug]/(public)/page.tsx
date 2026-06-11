"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/features/workspace/store/use-workspace-store";
import { Card } from "@/components/ui/card";
import { Typography, Chip } from "@heroui/react";
import { Button } from "@/components/ui/button";
import { Globe, MapPin, Briefcase, Calendar, ShieldCheck, ArrowRight, FileText, Share2, Users } from "lucide-react";

export default function WorkspaceHomeTab() {
  const params = useParams();
  const router = useRouter();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";
  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[organizationSlug]);

  if (!workspaceDetails) return null;

  // Mock Jobs for Preview
  const mockJobs = [
    {
      id: "job-1",
      title: "Senior Full-Stack Developer (.NET & React)",
      department: "Engineering",
      location: "Hanoi, Vietnam (Hybrid)",
      type: "Full-Time",
    },
    {
      id: "job-2",
      title: "Automated Verification QA Engineer",
      department: "Quality Assurance",
      location: "Remote",
      type: "Contract",
    },
  ];

  // Mock Updates for Preview
  const mockPosts = [
    {
      id: "post-1",
      title: "CVerify integration successfully deployed!",
      summary: "We are thrilled to announce that our development workflows have integrated credential hashing, achieving 100% automated skill verification.",
      date: "2 days ago",
    }
  ];

  const baseRoute = `/workspace/${organizationSlug}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* Main Column */}
      <div className="lg:col-span-2 space-y-6">
        {/* About Card Overview */}
        <Card className="p-6 md:p-8 bg-surface border border-border rounded-2xl space-y-4">
          <Typography type="h3" className="font-bold text-foreground">
            Overview
          </Typography>
          <Typography type="body-xs" className="text-muted leading-relaxed text-sm">
            {workspaceDetails.description}
          </Typography>
          {workspaceDetails.website && (
            <div className="pt-2 select-none">
              <a
                href={workspaceDetails.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline"
              >
                <Globe size={14} />
                Visit website
                <ArrowRight size={12} />
              </a>
            </div>
          )}
        </Card>

        {/* Jobs Preview Card */}
        <Card className="p-6 md:p-8 bg-surface border border-border rounded-2xl space-y-6">
          <div className="flex justify-between items-center select-none">
            <Typography type="h3" className="font-bold text-foreground flex items-center gap-2">
              <Briefcase size={20} className="text-accent" />
              Open Jobs Preview
            </Typography>
            <Button
              onClick={() => router.push(`${baseRoute}/jobs`)}
              variant="bordered"
              size="sm"
              className="font-bold text-xs border-border text-muted hover:text-foreground cursor-pointer"
            >
              See all jobs
            </Button>
          </div>

          <div className="space-y-4">
            {mockJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => router.push(`${baseRoute}/jobs`)}
                className="p-4 rounded-xl border border-border bg-card/20 hover:bg-card/50 transition-colors cursor-pointer flex justify-between items-center gap-4"
              >
                <div className="space-y-1">
                  <Typography type="body-sm" className="font-bold text-foreground text-sm">
                    {job.title}
                  </Typography>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground select-none">
                    <span>{job.department}</span>
                    <span>•</span>
                    <span>{job.location}</span>
                  </div>
                </div>
                <Chip size="sm" variant="soft" color="accent" className="text-[10px] font-semibold">
                  {job.type}
                </Chip>
              </div>
            ))}
          </div>
        </Card>

        {/* Latest Activity Preview */}
        <Card className="p-6 md:p-8 bg-surface border border-border rounded-2xl space-y-6">
          <div className="flex justify-between items-center select-none">
            <Typography type="h3" className="font-bold text-foreground flex items-center gap-2">
              <FileText size={20} className="text-accent" />
              Latest Announcements
            </Typography>
            <Button
              onClick={() => router.push(`${baseRoute}/posts`)}
              variant="bordered"
              size="sm"
              className="font-bold text-xs border-border text-muted hover:text-foreground cursor-pointer"
            >
              See all posts
            </Button>
          </div>

          <div className="space-y-4">
            {mockPosts.map((post) => (
              <div
                key={post.id}
                onClick={() => router.push(`${baseRoute}/posts`)}
                className="p-5 rounded-xl border border-border bg-card/20 hover:bg-card/50 transition-colors cursor-pointer space-y-2"
              >
                <div className="flex justify-between items-start gap-4">
                  <Typography type="body-sm" className="font-bold text-foreground text-sm leading-tight">
                    {post.title}
                  </Typography>
                  <span className="text-[10px] text-muted-foreground select-none shrink-0">{post.date}</span>
                </div>
                <Typography type="body-xs" className="text-muted text-xs leading-relaxed line-clamp-2">
                  {post.summary}
                </Typography>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Side Widget Column */}
      <div className="space-y-6">
        {/* Corporate Stats Card */}
        <Card className="p-6 bg-surface border border-border rounded-2xl space-y-4">
          <Typography type="h4" className="font-bold text-foreground">
            Key Statistics
          </Typography>

          <div className="space-y-3.5 select-none">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                <Globe size={14} />
              </div>
              <div>
                <span className="text-[9px] text-muted-foreground font-bold uppercase block">Website</span>
                <a
                  href={workspaceDetails.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-foreground hover:underline"
                >
                  {workspaceDetails.website?.replace("https://", "")}
                </a>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                <MapPin size={14} />
              </div>
              <div>
                <span className="text-[9px] text-muted-foreground font-bold uppercase block">Headquarters</span>
                <span className="text-xs font-semibold text-foreground">{workspaceDetails.location}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                <Briefcase size={14} />
              </div>
              <div>
                <span className="text-[9px] text-muted-foreground font-bold uppercase block">Industry</span>
                <span className="text-xs font-semibold text-foreground">{workspaceDetails.industry}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                <Calendar size={14} />
              </div>
              <div>
                <span className="text-[9px] text-muted-foreground font-bold uppercase block">Founded</span>
                <span className="text-xs font-semibold text-foreground">{workspaceDetails.founded}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Verification Highlights */}
        <Card className="p-6 bg-surface border border-border rounded-2xl space-y-4">
          <Typography type="h4" className="font-bold text-foreground flex items-center gap-2">
            <ShieldCheck size={18} className="text-success" />
            Verification Badging
          </Typography>
          <Typography type="body-xs" className="text-muted leading-relaxed">
            This workspace holds a Level 3 Domain & Ownership verification status. All corporate information has been cryptographic-hashed and signed by CVerify Authorities.
          </Typography>
          <div className="pt-2 select-none">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-foreground font-medium">
                <ShieldCheck size={14} className="text-success" />
                Legal Authority Verified
              </div>
              <div className="flex items-center gap-2 text-xs text-foreground font-medium">
                <ShieldCheck size={14} className="text-success" />
                Representative Signature Matches
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
