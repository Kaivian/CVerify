"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  MapPin,
  Briefcase,
  Clock,
  DollarSign,
  Bookmark,
  ShieldCheck,
  Lock,
  Sparkles
} from "lucide-react";
import {
  Button,
  Avatar,
  Chip,
  Spinner
} from "@heroui/react";
import { jobsApi, type PublicJobDto, type ExplainableMatchReportDto } from "@/services/jobs.service";
import { useSavedJobsStore } from "@/stores/use-saved-jobs-store";

interface JobCardProps {
  job: PublicJobDto;
  isSaved?: boolean;
  onToggleSave?: (jobId: string, event: React.MouseEvent) => void;
  isAuthenticated: boolean;
  status?: string;
  onClick?: (event: React.MouseEvent) => void;
  isSelected?: boolean;
}

export function JobCard({ job, isSaved: passedIsSaved, onToggleSave, isAuthenticated, status, onClick, isSelected }: JobCardProps) {
  const [report, setReport] = useState<ExplainableMatchReportDto | null>(null);
  const [loading, setLoading] = useState(false);

  const savedJobIds = useSavedJobsStore((state) => state.savedJobIds);
  const toggleSaveJobStore = useSavedJobsStore((state) => state.toggleSaveJob);

  const isSaved = passedIsSaved !== undefined ? passedIsSaved : savedJobIds.has(job.id);

  const handleToggleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      if (onToggleSave) {
        onToggleSave(job.id, e);
      }
      return;
    }
    toggleSaveJobStore(job.id, job);
  };

  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      jobsApi.getEligibility(job.id)
        .then((data) => setReport(data))
        .catch((err) => console.warn(`Could not load compatibility for job ${job.id}:`, err))
        .finally(() => setLoading(false));
    }
  }, [job.id, isAuthenticated]);

  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
  };

  return (
    <Link href={`/jobs/${job.id}`} onClick={onClick} className="block rounded-xl">
      <Card glow={true} className={`border transition-all duration-300 rounded-xl p-5 cursor-pointer relative overflow-hidden ${isSelected
          ? "border-accent ring-1 ring-accent/30 shadow-md bg-surface-secondary/15"
          : "border-border/60 bg-surface hover:border-accent"
        }`}>

        {/* Subtle decorative glowing corner for premium feel */}
        {isAuthenticated && report && (
          <div className="absolute top-0 right-0 w-24 h-24 bg-linear-to-bl from-success/5 via-transparent to-transparent pointer-events-none" />
        )}

        <div className="flex flex-col gap-4 w-full">
          {/* Section 1: Header (Avatar, Title, Bookmark) */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4">
              <Avatar className="w-10 h-10 rounded-lg bg-surface-secondary border border-border shrink-0">
                {job.organizationLogoUrl && <Avatar.Image src={job.organizationLogoUrl} alt={job.organizationName} />}
                <Avatar.Fallback className="font-bold text-xs text-foreground">
                  {getInitials(job.organizationName)}
                </Avatar.Fallback>
              </Avatar>
              <div className="flex flex-col">
                <h3 className="font-bold text-base text-foreground leading-tight">{job.title}</h3>
                <span className="text-xs font-semibold text-muted mt-0.5">{job.organizationName}</span>
              </div>
            </div>

            {/* Save/Bookmark Button or Application Status */}
            {status ? (
              <Chip
                size="sm"
                variant="soft"
                className="font-bold text-xs bg-surface-secondary text-foreground shrink-0 select-none"
              >
                {status}
              </Chip>
            ) : (
              <Button
                isIconOnly
                variant="ghost"
                className="rounded-lg text-muted hover:text-foreground cursor-pointer animate-none"
                onClick={handleToggleSave}
                aria-label="Save Job"
              >
                <Bookmark
                  size={18}
                  className={isSaved ? "fill-foreground text-foreground" : ""}
                />
              </Button>
            )}
          </div>

          {/* Section 2: Differentiator - CVerify Compatibility & Trust Signals */}
          <div className="border-y border-border/40 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-secondary/20 -mx-5 px-5 select-none">
            {/* Compatibility Score */}
            <div className="flex items-center gap-2">
              {isAuthenticated ? (
                loading ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <Spinner size="sm" color="warning" className="size-3.5" />
                    <span>Analyzing compatibility...</span>
                  </div>
                ) : report ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted">Match:</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold font-mono ${report.aggregateScore >= 80
                        ? "bg-success/15 text-success border border-success/20"
                        : report.aggregateScore >= 50
                          ? "bg-warning/15 text-warning border border-warning/20"
                          : "bg-danger/15 text-danger border border-danger/20"
                      }`}>
                      {report.aggregateScore}%
                    </span>
                    <span className="text-[10px] text-muted font-medium">({report.confidenceLevel} Confidence)</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted">Compatibility report unavailable</span>
                )
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <Lock size={12} className="text-muted/60" />
                  <span>Sign in to unlock Match Compatibility</span>
                </div>
              )}
            </div>

            {/* Trust Badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-mono font-bold tracking-wide uppercase bg-accent/10 text-accent border border-accent/20">
                <ShieldCheck size={10} />
                GPG Verified
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-mono font-bold tracking-wide uppercase bg-success/10 text-success border border-success/20">
                <Sparkles size={10} />
                Proof-Based
              </span>
            </div>
          </div>

          {/* Section 3: Capabilities & Skills Matches */}
          {job.skills && job.skills.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted select-none">Target Capabilities</span>
              <div className="flex flex-wrap gap-1.5">
                {job.skills.slice(0, 5).map((skill, index) => {
                  const isMatched = report?.capabilityFit?.matchedCapabilities?.some(
                    (mc) => mc.toLowerCase().includes(skill.toLowerCase())
                  );
                  return (
                    <Chip
                      key={index}
                      size="sm"
                      variant="soft"
                      className={`text-xs select-none ${isMatched
                          ? "bg-success/15 text-success border border-success/20"
                          : "bg-surface-secondary text-foreground"
                        }`}
                    >
                      {skill}
                    </Chip>
                  );
                })}
                {job.skills.length > 5 && (
                  <span className="text-muted text-xs font-semibold self-center ml-1 select-none">
                    +{job.skills.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Section 4: Secondary Metadata (Location, Type, Salary, Date) */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted pt-1 select-none">
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
            <span className="flex items-center gap-1.5 font-medium ml-auto">
              <Clock size={14} className="text-muted/70" />
              {new Date(job.createdAt).toLocaleDateString()}
            </span>
          </div>

        </div>
      </Card>
    </Link>
  );
}

export default JobCard;
