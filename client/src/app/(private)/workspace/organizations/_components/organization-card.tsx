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
  Sparkles
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

  return (
    <Card glow={organization.isVerified} className="flex flex-col h-full bg-surface border border-border/60 p-5 rounded-2xl select-none text-left">
      {/* Banner / Header Space */}
      <div className="relative w-full h-16 rounded-xl bg-surface-secondary border border-border/30 overflow-hidden mb-4 shrink-0">
        {organization.bannerUrl ? (
          <img
            src={organization.bannerUrl}
            alt={`${organization.organizationName} banner`}
            className="w-full h-full object-cover opacity-80"
          />
        ) : (
          <div className="w-full h-full bg-linear-to-r from-accent/5 via-accent/15 to-transparent" />
        )}

        {/* Logo Overlapping */}
        <div className="absolute bottom-2 left-3 flex items-center justify-center w-10 h-10 rounded-lg bg-surface border border-border/60 shadow-sm overflow-hidden">
          {organization.logoUrl ? (
            <img
              src={organization.logoUrl}
              alt={`${organization.organizationName} logo`}
              className="w-full h-full object-cover"
            />
          ) : (
            <Building2 className="size-5 text-muted" />
          )}
        </div>
      </div>

      {/* Main Info */}
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="text-sm font-bold text-foreground truncate font-outfit">
            {organization.organizationName}
          </h3>
          {organization.isVerified && (
            <ShieldCheck className="size-4 text-success shrink-0" />
          )}
        </div>

        <div className="flex flex-wrap gap-1 items-center">
          <Chip size="sm" variant="soft" color={verifiedBadgeColor} className="h-5 px-1.5 text-[9px] font-bold">
            {verifiedBadgeText}
          </Chip>
          {organization.companySize && (
            <Chip size="sm" variant="soft" className="h-5 px-1.5 text-[9px] font-bold bg-surface-secondary text-muted-foreground border-0">
              {organization.companySize}
            </Chip>
          )}
        </div>

        {organization.description ? (
          <p className="text-muted text-[11px] leading-relaxed line-clamp-2 mt-1">
            {organization.description}
          </p>
        ) : (
          <p className="text-muted text-[11px] italic mt-1">
            No organization description available.
          </p>
        )}
      </div>

      {/* Trust & Ecosystem Signals Grid */}
      <div className="grid grid-cols-3 gap-2 my-4 p-2.5 rounded-xl bg-surface-secondary border border-border/30 shrink-0 select-none">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1 text-muted">
            <Sparkles className="size-3 text-accent" />
            <span className="text-[9px] font-semibold tracking-wider uppercase">Trust</span>
          </div>
          <span className="text-xs font-bold text-foreground mt-0.5">
            {organization.averageTrustScore > 0 
              ? `${(organization.averageTrustScore * 100).toFixed(1)}%`
              : "—"
            }
          </span>
        </div>

        <div className="flex flex-col items-center justify-center text-center border-x border-border/30">
          <div className="flex items-center gap-1 text-muted">
            <Users className="size-3" />
            <span className="text-[9px] font-semibold tracking-wider uppercase">Members</span>
          </div>
          <span className="text-xs font-bold text-foreground mt-0.5">
            {organization.memberCount}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1 text-muted">
            <GitFork className="size-3" />
            <span className="text-[9px] font-semibold tracking-wider uppercase">Repos</span>
          </div>
          <span className="text-xs font-bold text-foreground mt-0.5">
            {organization.repositoryCount}
          </span>
        </div>
      </div>

      {/* Metadata & Footer Row */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-border/30 shrink-0">
        <div className="flex items-center justify-between text-[10px] text-muted font-medium">
          <div className="flex items-center gap-1 min-w-0">
            <MapPin className="size-3 text-muted/80 shrink-0" />
            <span className="truncate">{organization.city || "Global"}</span>
          </div>
          
          <div className="flex items-center gap-1 shrink-0 text-accent font-semibold">
            <Briefcase className="size-3" />
            <span>{organization.openPositionsCount} Open Roles</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2 gap-3 select-none">
          {organization.website ? (
            <a
              href={organization.website.startsWith("http") ? organization.website : `https://${organization.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-bold text-muted hover:text-accent transition-colors duration-150"
            >
              <Globe className="size-3" />
              <span className="truncate max-w-[100px]">{organization.website.replace(/(^\w+:|^)\/\/(www\.)?/, "")}</span>
            </a>
          ) : (
            <div className="size-2" />
          )}

          <Link
            href={`/business/${organization.organizationSlug}`}
            className="flex items-center justify-center h-7 px-3 bg-accent text-accent-foreground text-[10px] font-bold rounded-lg hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
          >
            View Workspace
          </Link>
        </div>
      </div>
    </Card>
  );
};
