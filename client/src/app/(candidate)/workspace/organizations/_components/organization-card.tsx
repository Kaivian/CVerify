"use client";

import React from "react";
import Link from "next/link";
import { type OrganizationListItem } from "@/features/workspace/types/workspace.types";
import { Card } from "@/components/ui/card";
import { Chip } from "@heroui/react";
import {
  Building2,
  MapPin,
  Globe,
  Briefcase,
  Users,
  GitFork,
  ShieldCheck,
  Sparkles,
  ArrowRight
} from "lucide-react";

interface OrganizationCardProps {
  organization: OrganizationListItem;
}

export const OrganizationCard: React.FC<OrganizationCardProps> = ({ organization }) => {
  const verifiedBadgeColor = organization.verificationLevel >= 2 ? "success" : "warning";
  const verifiedBadgeText = 
    organization.verificationLevel === 3 ? "Domain Owner" :
    organization.verificationLevel === 2 ? "Domain Verified" :
    organization.verificationLevel === 1 ? "Legal Entity" :
    "Onboarding";

  // Calculate percentage of verified repositories
  const verifiedRepoRatio = organization.repositoryCount > 0
    ? Math.round((organization.verifiedRepositoryCount / organization.repositoryCount) * 100)
    : 0;

  return (
    <div className="relative overflow-hidden w-full p-5 bg-surface text-foreground border border-border/70 rounded-2xl select-none text-left flex flex-col h-full">
      {/* 1. Header Row: Logo & Details side by side */}
      <div className="flex gap-3 items-center mb-3.5 shrink-0">
        <div className="flex items-center justify-center size-11 rounded-xl bg-surface-secondary border border-border/40 overflow-hidden shrink-0 select-none">
          {organization.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={organization.logoUrl}
              alt={`${organization.organizationName} logo`}
              className="w-full h-full object-cover"
            />
          ) : (
            <Building2 className="size-5 text-muted" />
          )}
        </div>
        
        <div className="flex-1 flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-sm font-extrabold text-foreground truncate font-outfit" title={organization.organizationName}>
              {organization.organizationName}
            </h3>
            {organization.isVerified && (
              <ShieldCheck className="size-4 text-success shrink-0" />
            )}
          </div>

          <div className="flex flex-wrap gap-1 items-center">
            <Chip size="sm" variant="soft" color={verifiedBadgeColor} className="h-4 px-1 text-[8px] font-extrabold">
              {verifiedBadgeText}
            </Chip>
            {organization.companySize && (
              <Chip size="sm" variant="soft" className="h-4 px-1 text-[8px] font-bold bg-surface-secondary text-muted-foreground border-0">
                {organization.companySize}
              </Chip>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Info Block */}
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        {/* Description: Enforced fixed height wrapper for grid alignment */}
        <div className="h-9 overflow-hidden select-none">
          <p className="text-muted text-[11px] leading-relaxed line-clamp-2">
            {organization.description || "No organization description available."}
          </p>
        </div>

        {/* Industry Tags Rendering: Enforced fixed height wrapper for alignment */}
        <div className="h-6 mt-1.5 overflow-hidden flex items-center gap-1">
          {organization.industryTags && organization.industryTags.length > 0 ? (
            organization.industryTags.slice(0, 2).map((tag, idx) => (
              <span 
                key={idx} 
                className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-surface-secondary text-muted-foreground border border-border/30 whitespace-nowrap"
              >
                {tag}
              </span>
            ))
          ) : (
            <span className="text-[9px] font-bold text-muted/30 italic">No tags listed</span>
          )}
        </div>
      </div>

      {/* 3. Flat Trust & Ecosystem Signals Row */}
      <div className="grid grid-cols-3 gap-1 my-3.5 py-2.5 border-y border-border/40 select-none shrink-0 text-center">
        <div className="flex flex-col items-center justify-center">
          <div className="flex items-center gap-0.5 text-muted">
            <Sparkles className="size-2.5 text-accent" />
            <span className="text-[8px] font-bold tracking-wider uppercase">Trust</span>
          </div>
          <span className="text-[11px] font-black text-foreground mt-0.5">
            {organization.averageTrustScore > 0 
              ? `${(organization.averageTrustScore * 100).toFixed(0)}%`
              : "—"
            }
          </span>
        </div>

        <div className="flex flex-col items-center justify-center border-x border-border/20">
          <div className="flex items-center gap-0.5 text-muted">
            <Users className="size-2.5" />
            <span className="text-[8px] font-bold tracking-wider uppercase">Members</span>
          </div>
          <span className="text-[11px] font-black text-foreground mt-0.5">
            {organization.memberCount}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center">
          <div className="flex items-center gap-0.5 text-muted">
            <GitFork className="size-2.5" />
            <span className="text-[8px] font-bold tracking-wider uppercase">Repos</span>
          </div>
          <span className="text-[11px] font-black text-foreground mt-0.5" title={`${organization.verifiedRepositoryCount} of ${organization.repositoryCount} verified`}>
            {organization.repositoryCount}
            {organization.verifiedRepositoryCount > 0 && (
              <span className="text-[8px] font-bold text-success ml-0.5">
                v{verifiedRepoRatio}%
              </span>
            )}
          </span>
        </div>
      </div>

      {/* 4. Metadata & Footer Row */}
      <div className="flex flex-col gap-2 pt-2 shrink-0">
        <div className="flex items-center justify-between text-[10px] text-muted font-medium">
          <div className="flex items-center gap-1 min-w-0">
            <MapPin className="size-3 text-muted/70 shrink-0" />
            <span className="truncate">{organization.city || "Global"}</span>
          </div>
          
          <div className="flex items-center gap-1 shrink-0 text-accent font-bold">
            <Briefcase className="size-3" />
            <span>{organization.openPositionsCount} Open Roles</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-1 gap-2 select-none">
          {organization.website ? (
            <a
              href={organization.website.startsWith("http") ? organization.website : `https://${organization.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-bold text-muted hover:text-accent transition-colors duration-150 min-w-0"
            >
              <Globe className="size-3 shrink-0" />
              <span className="truncate max-w-[80px] sm:max-w-[100px]">{organization.website.replace(/(^\w+:|^)\/\/(www\.)?/, "")}</span>
            </a>
          ) : (
            <div className="size-2" />
          )}

          <Link
            href={`/business/${organization.organizationSlug}`}
            className="flex items-center justify-center gap-1 h-7 px-3 bg-accent text-accent-foreground text-[10px] font-extrabold rounded-lg cursor-pointer whitespace-nowrap"
          >
            <span>View</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  );
};
