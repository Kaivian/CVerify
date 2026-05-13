"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/features/workspace/store/use-workspace-store";
import { Card } from "@/components/ui/card";
import { Typography, Chip } from "@heroui/react";
import { Button } from "@/components/ui/button";
import { getTagLabel } from "@/features/workspace/types/workspace.types";

export default function WorkspaceHomeTab() {
  const params = useParams();
  const router = useRouter();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";
  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[organizationSlug]);

  if (!workspaceDetails) return null;

  const baseRoute = `/workspace/${organizationSlug}`;

  // Mock job cards
  const mockJobs = [
    {
      id: "job-1",
      title: "Senior Full-Stack Developer (.NET & React)",
      department: "Engineering",
      location: "Hanoi, Vietnam (Hybrid)",
      type: "Full-Time",
      date: "3d ago",
    },
    {
      id: "job-2",
      title: "Automated Verification QA Engineer",
      department: "Quality Assurance",
      location: "Remote",
      type: "Contract",
      date: "1w ago",
    },
    {
      id: "job-3",
      title: "DevOps & Infrastructure Engineer",
      department: "Platform",
      location: "Da Nang, Vietnam",
      type: "Full-Time",
      date: "2w ago",
    },
  ];

  // Mock post cards
  const mockPosts = [
    {
      id: "post-1",
      title: "CVerify integration successfully deployed!",
      summary: "Our development workflows now include automated credential hashing and 100% skill verification.",
      date: "2d ago",
      tag: "Announcement",
    },
    {
      id: "post-2",
      title: "FPTU Summer Jamboree 2026 â€” Join us!",
      summary: "We are sponsoring the annual summer tech event. Register now for workshops, networking, and more.",
      date: "5d ago",
      tag: "Event",
    },
  ];

  const hasAboutContent =
    workspaceDetails.description ||
    workspaceDetails.mission ||
    workspaceDetails.vision ||
    workspaceDetails.coreValues ||
    (workspaceDetails.industryTags && workspaceDetails.industryTags.length > 0) ||
    (workspaceDetails.benefitTags && workspaceDetails.benefitTags.length > 0);

  // Shared logo component used inside highlight cards
  const LogoMark = () =>
    workspaceDetails.logoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={workspaceDetails.logoUrl} alt="logo" className="w-full h-full object-cover" />
    ) : (
      <span className="font-semibold text-sm text-foreground">
        {workspaceDetails.organizationName?.substring(0, 1)}
      </span>
    );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* â”€â”€ Main Column â”€â”€ */}
      <div className="lg:col-span-2 space-y-6">

        {/* â”€â”€ About Us â”€â”€ */}
        {hasAboutContent && (
          <Card className="p-6 bg-surface border border-border rounded-xl">
            {/* Card title */}
            <Typography type="h3" className="font-semibold text-foreground text-base mb-5">
              About Us
            </Typography>

            <div className="space-y-6">
              {/* Description */}
              {workspaceDetails.description && (
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider block">
                    Overview
                  </span>
                  <p className="text-sm text-foreground font-normal leading-relaxed">
                    {workspaceDetails.description}
                  </p>
                </div>
              )}

              {/* Corporate Pillars */}
              {(workspaceDetails.mission || workspaceDetails.vision || workspaceDetails.coreValues) && (
                <div className="space-y-3">
                  <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider block">
                    Corporate Pillars
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {workspaceDetails.mission && (
                      <div className="p-4 rounded-xl border border-border bg-card/20 space-y-2">
                        <span className="text-[10px] text-accent font-semibold uppercase tracking-wider block">
                          Mission
                        </span>
                        <p className="text-xs text-foreground font-normal leading-relaxed">
                          {workspaceDetails.mission}
                        </p>
                      </div>
                    )}
                    {workspaceDetails.vision && (
                      <div className="p-4 rounded-xl border border-border bg-card/20 space-y-2">
                        <span className="text-[10px] text-accent font-semibold uppercase tracking-wider block">
                          Vision
                        </span>
                        <p className="text-xs text-foreground font-normal leading-relaxed">
                          {workspaceDetails.vision}
                        </p>
                      </div>
                    )}
                    {workspaceDetails.coreValues && (
                      <div className="p-4 rounded-xl border border-border bg-card/20 space-y-2">
                        <span className="text-[10px] text-accent font-semibold uppercase tracking-wider block">
                          Core Values
                        </span>
                        <p className="text-xs text-foreground font-normal leading-relaxed">
                          {workspaceDetails.coreValues}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}



              {/* Focus Areas */}
              {workspaceDetails.industryTags && workspaceDetails.industryTags.length > 0 && (
                <div className="space-y-3">
                  <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider block">
                    Focus Areas
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {workspaceDetails.industryTags.map((tag) => (
                      <Chip key={tag} color="accent" variant="soft" size="sm" className="font-medium text-xs py-1">
                        {tag}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {/* Perks & Benefits */}
              {workspaceDetails.benefitTags && workspaceDetails.benefitTags.length > 0 && (
                <div className="space-y-3">
                  <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider block">
                    Perks & Benefits
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {workspaceDetails.benefitTags.map((tag) => (
                      <Chip key={tag} color="default" variant="soft" size="sm" className="font-normal text-xs py-1">
                        {getTagLabel(tag)}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* â”€â”€ Job Highlights â”€â”€ */}
        <Card className="p-6 bg-surface border border-border rounded-xl space-y-4">
          <div className="flex items-center justify-between select-none">
            <Typography type="h3" className="font-semibold text-foreground text-base">
              Job Highlights
            </Typography>
            <Button
              onClick={() => router.push(`${baseRoute}/jobs`)}
              variant="bordered"
              size="sm"
              className="font-medium text-[11px] h-8 border-border text-muted hover:text-foreground cursor-pointer px-3 rounded-lg"
            >
              See more jobs
            </Button>
          </div>

          {/* Horizontal scroll */}
          <div
            className="flex gap-4 overflow-x-auto pb-1 snap-x snap-mandatory scroll-smooth"
            style={{ scrollbarWidth: "none" }}
          >
            {mockJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => router.push(`${baseRoute}/jobs`)}
                className="snap-start shrink-0 w-56 rounded-xl border border-border bg-card/10 hover:bg-card/25 cursor-pointer overflow-hidden flex flex-col"
              >
                {/* Cover */}
                <div className="h-24 w-full flex flex-col items-center justify-center gap-2 bg-linear-to-br from-indigo-500/20 to-accent/15 select-none">
                  <div className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden shadow-sm">
                    <LogoMark />
                  </div>
                  <span className="text-[9px] text-indigo-400 uppercase tracking-wider">Open Position</span>
                </div>
                {/* Body */}
                <div className="p-3 flex flex-col gap-1.5 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-muted font-normal truncate">{workspaceDetails.organizationName}</span>
                    <span className="text-[9px] text-muted-foreground shrink-0">{job.date}</span>
                  </div>
                  <p className="text-xs font-semibold text-foreground leading-snug line-clamp-2">{job.title}</p>
                  <p className="text-[10px] text-muted font-normal">
                    {job.department} · {job.location}
                  </p>
                  <div className="mt-auto pt-1">
                    <Chip size="sm" variant="soft" color="accent" className="text-[9px] font-medium h-5 px-1.5">
                      {job.type}
                    </Chip>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* â”€â”€ Post Highlights â”€â”€ */}
        <Card className="p-6 bg-surface border border-border rounded-xl space-y-4">
          <div className="flex items-center justify-between select-none">
            <Typography type="h3" className="font-semibold text-foreground text-base">
              Post Highlights
            </Typography>
            <Button
              onClick={() => router.push(`${baseRoute}/posts`)}
              variant="bordered"
              size="sm"
              className="font-medium text-[11px] h-8 border-border text-muted hover:text-foreground cursor-pointer px-3 rounded-lg"
            >
              See more posts
            </Button>
          </div>

          {/* Horizontal scroll */}
          <div
            className="flex gap-4 overflow-x-auto pb-1 snap-x snap-mandatory scroll-smooth"
            style={{ scrollbarWidth: "none" }}
          >
            {mockPosts.map((post) => (
              <div
                key={post.id}
                onClick={() => router.push(`${baseRoute}/posts`)}
                className="snap-start shrink-0 w-56 rounded-xl border border-border bg-card/10 hover:bg-card/25 cursor-pointer overflow-hidden flex flex-col"
              >
                {/* Cover */}
                <div className="h-24 w-full flex flex-col items-center justify-center gap-2 bg-linear-to-br from-accent/25 to-indigo-700/20 select-none">
                  <div className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden shadow-sm">
                    <LogoMark />
                  </div>
                  <span className="text-[9px] text-accent uppercase tracking-wider">Announcement</span>
                </div>
                {/* Body */}
                <div className="p-3 flex flex-col gap-1.5 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-muted font-normal truncate">{workspaceDetails.organizationName}</span>
                    <span className="text-[9px] text-muted-foreground shrink-0">{post.date}</span>
                  </div>
                  <p className="text-xs font-semibold text-foreground leading-snug line-clamp-2">{post.title}</p>
                  <p className="text-[10px] text-muted font-normal leading-relaxed line-clamp-2">{post.summary}</p>
                  <div className="mt-auto pt-1">
                    <Chip size="sm" variant="soft" color="default" className="text-[9px] font-medium h-5 px-1.5">
                      {post.tag}
                    </Chip>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* â”€â”€ Side Widget Column â”€â”€ */}
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
                  {workspaceDetails.companySize.toLowerCase().includes("employee") ||
                    workspaceDetails.companySize.toLowerCase().includes("nhÃ¢n viÃªn")
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
                  ? workspaceDetails.city.toLowerCase().includes("vietnam") ||
                    workspaceDetails.city.toLowerCase().includes("viá»‡t nam")
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
              <span>â€¢</span>
              Legal Authority Verified
            </div>
            <div className="flex items-center gap-1.5">
              <span>â€¢</span>
              Representative Signature Matches
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
