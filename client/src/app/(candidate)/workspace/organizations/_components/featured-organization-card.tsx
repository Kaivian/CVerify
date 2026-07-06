"use client";

import React from "react";
import Link from "next/link";
import { type OrganizationListItem } from "@/features/workspace/types/workspace.types";
import { Card } from "@/components/ui/card";
import { Chip } from "@heroui/react";
import {
  Building2,
  MapPin,
  ShieldCheck,
  Sparkles,
  ArrowRight
} from "lucide-react";

interface FeaturedOrganizationCardProps {
  organization: OrganizationListItem;
}

export const FeaturedOrganizationCard: React.FC<FeaturedOrganizationCardProps> = ({ organization }) => {
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
    <div className="relative w-full bg-surface border border-border/70 rounded-2xl p-0 flex flex-col h-full select-none text-left overflow-hidden">
      {/* 1. Header Banner: Solid color, no gradient */}
      <div className="relative w-full h-24 bg-surface-secondary shrink-0 overflow-hidden">
        {organization.bannerUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={organization.bannerUrl}
            alt={`${organization.organizationName} banner`}
            className="w-full h-full object-cover opacity-90"
          />
        ) : (
          <div className="w-full h-full bg-surface-tertiary" />
        )}

        {/* Featured Partner Badge */}
        <div className="absolute top-3 right-3 z-20">
          <Chip
            size="sm"
            variant="soft"
            color="accent"
            className="h-5 px-2 text-[8px] font-extrabold uppercase tracking-wider bg-accent/15 text-accent border border-accent/25 shrink-0"
          >
            <div className="flex items-center gap-0.5">
              <Sparkles className="size-2 text-accent" />
              <span>Featured Partner</span>
            </div>
          </Chip>
        </div>
      </div>

      {/* 2. Overlapping Logo & Content Area */}
      <div className="relative px-5 pb-5 pt-12 flex-1 flex flex-col">
        {/* Logo Container */}
        <div className="absolute -top-10 left-5 flex items-center justify-center w-16 h-16 rounded-xl bg-surface border-2 border-surface shadow-md overflow-hidden z-10">
          {organization.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={organization.logoUrl}
              alt={`${organization.organizationName} logo`}
              className="w-full h-full object-cover"
            />
          ) : (
            <Building2 className="size-8 text-muted/65" />
          )}
        </div>

        {/* Company Name & Verification Badge */}
        <div className="flex items-center gap-1.5 min-w-0 mt-1">
          <h3 className="text-base font-extrabold text-foreground truncate font-outfit">
            {organization.organizationName}
          </h3>
          {organization.isVerified && (
            <ShieldCheck className="size-4.5 text-success shrink-0" />
          )}

          <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-surface-secondary text-muted-foreground border border-border/40 ml-1.5">
            {verifiedBadgeText}
          </span>
        </div>

        {/* Meta Row: Industry • Size • City */}
        <p className="text-[11px] text-muted font-bold mt-1 select-none">
          {organization.industryTags?.[0] || "Technology"} • {organization.companySize || "Unknown scale"} • {organization.city || "Global"}
        </p>

        {/* Description */}
        <p className="text-muted text-[11px] leading-relaxed line-clamp-2 mt-3 select-none flex-1">
          {organization.description || "No organization description available."}
        </p>

        {/* Trust Score & Stats (Aligned bottom) */}
        <div className="mt-4 pt-3 border-t border-border/30 flex flex-col gap-2 shrink-0">
          {/* Trust Score */}
          {organization.averageTrustScore > 0 ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-muted text-[9px] font-bold uppercase tracking-wider">
                  <Sparkles className="size-3 text-accent" />
                  <span>Trust Score</span>
                </div>
                <span className="font-extrabold text-[11px] text-foreground font-outfit">
                  {(organization.averageTrustScore * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-1 bg-border/40 rounded-full overflow-hidden w-full">
                <div
                  className="h-full bg-accent rounded-full"
                  style={{ width: `${organization.averageTrustScore * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs py-0.5">
              <div className="flex items-center gap-1 text-muted text-[9px] font-bold uppercase tracking-wider">
                <Sparkles className="size-3 text-muted/40" />
                <span>Trust Score</span>
              </div>
              <span className="text-[10px] text-muted/40 font-bold italic">Unscored</span>
            </div>
          )}

          {/* LinkedIn Style Flat Stats Row */}
          <div className="text-[11px] text-muted font-semibold mt-1">
            <span>{organization.memberCount} engineers</span>
            <span className="mx-1.5 text-muted/40">•</span>
            <span title={`${organization.verifiedRepositoryCount} of ${organization.repositoryCount} verified`}>
              {organization.repositoryCount} repos
              {organization.verifiedRepositoryCount > 0 && (
                <span className="text-success ml-0.5">({verifiedRepoRatio}% verified)</span>
              )}
            </span>
            <span className="mx-1.5 text-muted/40">•</span>
            <span className="text-accent">{organization.openPositionsCount} active jobs</span>
          </div>
        </div>

        {/* Explore Button */}
        <Link
          href={`/business/${organization.organizationSlug}`}
          className="flex items-center justify-center gap-1.5 w-full h-8.5 border border-accent text-accent text-xs font-extrabold rounded-full cursor-pointer mt-3 bg-transparent"
        >
          <span>Explore Workspace</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
};