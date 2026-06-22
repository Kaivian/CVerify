"use client";

import React from "react";
import {
  MapPin,
  Briefcase,
  Clock,
  DollarSign,
  GraduationCap,
  Building2
} from "lucide-react";
import {
  Avatar,
  Chip
} from "@heroui/react";
import type { PublicJobDto } from "@/services/jobs.service";

interface JobRequirementsCardProps {
  job: PublicJobDto;
}

// Parse inline markdown: **bold** and ++bold++
const parseInlineMarkdown = (text: string): React.ReactNode => {
  if (!text) return "";
  const parts = text.split(/(\*\*[^*]+\*\*|\+\+[^+]+\+\+)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("++") && part.endsWith("++")) {
      return <strong key={index} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

// Generate a CSS-safe ID from heading text
const getSectionId = (title: string): string => {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
};

// Render markdown content to JSX (matching business-side JdDetailView pattern)
const renderMarkdown = (text: string): React.ReactNode[] | null => {
  if (!text) return null;
  return text.split("\n").map((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      const title = trimmed.substring(2).trim();
      return <h1 key={idx} id={getSectionId(title)} className="text-xl font-bold text-foreground mt-6 mb-2 border-b border-border/40 pb-1">{parseInlineMarkdown(title)}</h1>;
    }
    if (trimmed.startsWith("## ")) {
      const title = trimmed.substring(3).trim();
      return <h2 key={idx} id={getSectionId(title)} className="text-sm font-bold text-accent mt-5 mb-2">{parseInlineMarkdown(title)}</h2>;
    }
    if (trimmed.startsWith("### ")) {
      const title = trimmed.substring(4).trim();
      return <h3 key={idx} id={getSectionId(title)} className="text-xs font-semibold text-foreground mt-3 mb-1">{parseInlineMarkdown(title)}</h3>;
    }
    if (trimmed.startsWith("- ")) {
      return <li key={idx} className="text-xs text-foreground/80 list-disc ml-5 mb-1">{parseInlineMarkdown(trimmed.substring(2))}</li>;
    }
    if (trimmed.startsWith("* ")) {
      return <li key={idx} className="text-xs text-foreground/80 list-disc ml-5 mb-1">{parseInlineMarkdown(trimmed.substring(2))}</li>;
    }
    if (!trimmed) {
      return <div key={idx} className="h-2" />;
    }
    return <p key={idx} className="text-xs text-foreground/80 mb-2 leading-relaxed">{parseInlineMarkdown(trimmed)}</p>;
  });
};



export function JobRequirementsCard({ job }: JobRequirementsCardProps) {
  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
  };

  // Combine all description lines into a single markdown string
  const fullContent = job.description?.join("\n") || "";
  const hasMarkdownContent = fullContent.includes("#") || fullContent.includes("- ");

  return (
    <div className="flex flex-col gap-6">
      {/* Header Info */}
      <div className="flex items-start gap-4">
        <Avatar className="w-12 h-12 rounded-lg bg-surface-secondary border border-border shrink-0">
          {job.organizationLogoUrl && <Avatar.Image src={job.organizationLogoUrl} alt={job.organizationName} />}
          <Avatar.Fallback className="font-bold text-sm text-foreground">
            {getInitials(job.organizationName)}
          </Avatar.Fallback>
        </Avatar>
        <div className="flex flex-col text-left">
          <h1 className="text-xl font-extrabold tracking-tight text-foreground leading-tight">
            {job.title}
          </h1>
          <span className="text-sm font-semibold text-muted mt-0.5">{job.organizationName}</span>
        </div>
      </div>

      {/* Quick Metadata Row */}
      <div className="flex flex-wrap gap-x-5 gap-y-2.5 text-xs text-muted border-y border-border/40 py-4 select-none">
        <span className="flex items-center gap-1.5 font-medium">
          <MapPin size={14} className="text-muted/70" />
          {job.city} ({job.workplaceType})
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <Briefcase size={14} className="text-muted/70" />
          {job.type}
        </span>
        {job.salary && (
          <span className="flex items-center gap-1.5 font-medium text-foreground/80">
            <DollarSign size={14} className="text-muted/70" />
            {job.salary}
          </span>
        )}
        {job.experience && (
          <span className="flex items-center gap-1.5 font-medium">
            <Building2 size={14} className="text-muted/70" />
            {job.experience}
          </span>
        )}
        {job.degree && (
          <span className="flex items-center gap-1.5 font-medium">
            <GraduationCap size={14} className="text-muted/70" />
            {job.degree}
          </span>
        )}
        <span className="flex items-center gap-1.5 font-medium">
          <Clock size={14} className="text-muted/70" />
          Published {new Date(job.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* Main Content */}
      <div className="flex flex-col gap-6">
        {/* Rendered Markdown JD */}
        {hasMarkdownContent ? (
          <div className="prose prose-sm max-w-none font-sans leading-relaxed select-text">
            {renderMarkdown(fullContent)}
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-left">
            <div className="text-sm text-foreground/90 leading-relaxed flex flex-col gap-3.5 whitespace-pre-line">
              {job.description?.map((desc, idx) => (
                <p key={idx}>{desc}</p>
              ))}
            </div>
          </div>
        )}

        {/* Skills Required */}
        {job.skills && job.skills.length > 0 && (
          <div className="flex flex-col gap-3 text-left border-t border-border/40 pt-5">
            <h2 className="text-sm font-bold text-accent">Capabilities Required</h2>
            <div className="flex flex-wrap gap-1.5">
              {job.skills.map((skill, index) => (
                <Chip key={index} size="sm" variant="soft" className="text-xs bg-surface-secondary text-foreground font-semibold">
                  {skill}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* Requirements */}
        {job.requirements && job.requirements.length > 0 && (
          <div className="flex flex-col gap-3 text-left border-t border-border/40 pt-5">
            <h2 className="text-sm font-bold text-accent">Requirements & Qualifications</h2>
            <ul className="list-disc list-inside text-xs text-foreground/80 leading-relaxed flex flex-col gap-1.5">
              {job.requirements.map((req, idx) => (
                <li key={idx} className="ml-1">{req}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Benefits */}
        {job.benefits && job.benefits.length > 0 && (
          <div className="flex flex-col gap-3 text-left border-t border-border/40 pt-5">
            <h2 className="text-sm font-bold text-accent">Benefits & Perks</h2>
            <ul className="list-disc list-inside text-xs text-foreground/80 leading-relaxed flex flex-col gap-1.5">
              {job.benefits.map((ben, idx) => (
                <li key={idx} className="ml-1">{ben}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default JobRequirementsCard;
