"use client";

import React, { useEffect } from "react";
import { useWorkspaceStore } from "../store/use-workspace-store";
import { Card } from "@/components/ui/card";
import { Typography, Chip } from "@heroui/react";
import { 
  Building2, 
  Globe, 
  MapPin, 
  Briefcase, 
  Calendar, 
  ShieldCheck, 
  AlertTriangle, 
  Compass, 
  Gift, 
  Map
} from "lucide-react";
import { SkeletonLoader } from "@/components/ui/states";
import { getTagLabel } from "../types/workspace.types";
import { BusinessVerificationBadge } from "@/components/ui/cverify/verification-badges";

// Inline brand SVGs to bypass Lucide member mismatch errors
const LinkedInIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" {...props}>
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
  </svg>
);

const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" {...props}>
    <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z" />
  </svg>
);

const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface WorkspacePublicProfileViewProps {
  organizationSlug: string;
}

export const WorkspacePublicProfileView: React.FC<WorkspacePublicProfileViewProps> = ({
  organizationSlug,
}) => {
  const fetchWorkspace = useWorkspaceStore((s) => s.fetchWorkspace);
  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[organizationSlug]);
  const isDetailsLoading = useWorkspaceStore((s) => s.loading[organizationSlug]);
  const detailsError = useWorkspaceStore((s) => s.errors[organizationSlug]);

  useEffect(() => {
    if (organizationSlug) {
      fetchWorkspace(organizationSlug);
    }
  }, [organizationSlug, fetchWorkspace]);

  if (isDetailsLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 font-outfit text-foreground">
        <div className="h-10 w-48 bg-separator/50 animate-pulse rounded-lg mb-4" />
        <Card className="p-0 overflow-hidden">
          <SkeletonLoader rows={6} columns={4} />
        </Card>
      </div>
    );
  }

  if (detailsError || !workspaceDetails) {
    const isAccessDenied = detailsError?.toLowerCase().includes("forbidden") || detailsError?.toLowerCase().includes("forbid") || detailsError?.includes("403");
    return (
      <div className="max-w-xl mx-auto py-20 font-outfit text-foreground">
        <Card className="p-8 border border-border bg-surface text-center">
          <div className="size-16 rounded-2xl bg-danger/10 flex items-center justify-center border border-danger/20 mx-auto mb-5 text-danger">
            <AlertTriangle size={28} />
          </div>
          <Typography type="h4" className="font-bold text-foreground mb-2">
            {isAccessDenied ? "Access Denied" : "Workspace Loading Error"}
          </Typography>
          <Typography type="body-xs" className="text-muted leading-relaxed mb-6">
            {isAccessDenied 
              ? "You do not have permission to access this organization workspace. Please verify your membership credentials or switch accounts."
              : detailsError || "Organization not found"}
          </Typography>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-outfit max-w-7xl mx-auto text-foreground">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-surface border border-border text-foreground select-none shadow-sm">
        <div className="space-y-1">
          <Typography
            type="h2"
            className="text-2xl font-bold flex items-center gap-2 text-foreground font-outfit"
          >
            <Building2 size={24} className="text-accent" />
            {workspaceDetails.organizationName}
          </Typography>
          <Typography type="body-xs" className="text-muted font-light mt-0.5 font-outfit">
            Workspace context: <span className="font-mono text-accent">@{workspaceDetails.organizationSlug}</span>
          </Typography>
        </div>
        <div className="flex gap-2">
          <BusinessVerificationBadge level={workspaceDetails.verificationLevel} />
        </div>
      </div>

      {/* 2. Public profile details view */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* About Company Card */}
          <Card className="p-6 md:p-8 bg-surface border border-border rounded-2xl space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-separator/40">
              <Typography type="h3" className="font-bold text-foreground font-outfit">
                About the Company
              </Typography>
            </div>

            <div className="space-y-6">
              <Typography type="body-xs" className="text-muted leading-relaxed text-sm font-outfit">
                {workspaceDetails.description || "No description provided."}
              </Typography>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-separator/40">
                {workspaceDetails.website && (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                      <Globe size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted font-bold uppercase block font-outfit">Website</span>
                      <a href={workspaceDetails.website} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-accent hover:underline font-outfit">
                        {workspaceDetails.website.replace("https://", "").replace("http://", "")}
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                    <MapPin size={16} />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted font-bold uppercase block font-outfit">Headquarters</span>
                    <span className="text-xs font-bold text-foreground font-outfit">
                      {workspaceDetails.city || workspaceDetails.location || "Not specified"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                    <Briefcase size={16} />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted font-bold uppercase block font-outfit">Company Type</span>
                    <span className="text-xs font-bold text-foreground font-outfit">
                      {workspaceDetails.companyType || "Not specified"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                    <Calendar size={16} />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted font-bold uppercase block font-outfit">Founded</span>
                    <span className="text-xs font-bold text-foreground font-outfit">
                      {workspaceDetails.founded || "Not specified"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Focus Areas Card */}
          <Card className="p-6 md:p-8 bg-surface border border-border rounded-2xl space-y-4">
            <Typography type="h3" className="font-bold text-foreground font-outfit flex items-center gap-2">
              <Compass size={18} className="text-accent" />
              Focus Areas & Industry Tags
            </Typography>
            <div className="flex flex-wrap gap-2">
              {workspaceDetails.industryTags && workspaceDetails.industryTags.length > 0 ? (
                workspaceDetails.industryTags.map(tag => (
                  <Chip
                    key={tag}
                    color="accent"
                    variant="soft"
                    size="sm"
                    className="font-semibold text-xs py-1"
                  >
                    {tag}
                  </Chip>
                ))
              ) : (
                <span className="text-xs text-muted font-light italic font-outfit">No industry tags configured.</span>
              )}
            </div>
          </Card>

          {/* Employee Benefits Card */}
          <Card className="p-6 md:p-8 bg-surface border border-border rounded-2xl space-y-4">
            <Typography type="h3" className="font-bold text-foreground font-outfit flex items-center gap-2">
              <Gift size={18} className="text-accent" />
              Employee Benefits
            </Typography>
            <div className="flex flex-wrap gap-2">
              {workspaceDetails.benefitTags && workspaceDetails.benefitTags.length > 0 ? (
                workspaceDetails.benefitTags.map(tag => (
                  <Chip
                    key={tag}
                    color="accent"
                    variant="soft"
                    size="sm"
                    className="font-semibold text-xs py-1"
                  >
                    {getTagLabel(tag)}
                  </Chip>
                ))
              ) : (
                <span className="text-xs text-muted font-light italic">No benefits listed.</span>
              )}
            </div>
          </Card>

          {/* Office Location Interactive Map */}
          <Card className="p-6 md:p-8 bg-surface border border-border rounded-2xl space-y-4">
            <Typography type="h3" className="font-bold text-foreground font-outfit">
              Office HQ Location
            </Typography>
            <div className="space-y-4">
              <div className="flex gap-2 items-start text-xs font-semibold text-foreground">
                <MapPin size={14} className="text-accent shrink-0 mt-0.5" />
                <span>
                  {workspaceDetails.detailAddress 
                    ? `${workspaceDetails.detailAddress}, ${workspaceDetails.city || ""}` 
                    : workspaceDetails.city || workspaceDetails.location || "No address details specified."}
                </span>
              </div>
              {workspaceDetails.googleMapsEmbedUrl ? (
                <div className="h-64 rounded-2xl overflow-hidden border border-border/80">
                  <iframe
                    src={workspaceDetails.googleMapsEmbedUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen={false}
                    loading="lazy"
                    title="Google Maps Location Preview"
                  />
                </div>
              ) : (
                <div className="h-32 border border-dashed border-border rounded-2xl bg-surface-secondary/40 flex flex-col items-center justify-center text-muted gap-2 select-none">
                  <Map size={24} className="opacity-40" />
                  <span className="text-xs font-medium italic">No interactive map location specified.</span>
                </div>
              )}
            </div>
          </Card>

        </div>

        {/* Right Column (Span 1) */}
        <div className="space-y-6">
          
          {/* Company details list */}
          <Card className="p-6 bg-surface border border-border rounded-2xl space-y-4">
            <Typography type="h4" className="font-bold text-foreground flex items-center gap-2 font-outfit">
              <Building2 size={16} className="text-accent" />
              Company Details
            </Typography>

            <div className="space-y-4 text-xs select-none font-outfit">
              <div>
                <span className="text-[10px] text-muted-foreground font-bold uppercase block">Company Size</span>
                <span className="font-semibold text-foreground text-sm">{workspaceDetails.companySize || "Not specified"}</span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground font-bold uppercase block">Branch offices</span>
                <span className="font-semibold text-foreground text-sm">{workspaceDetails.branchCount || 0} branches</span>
              </div>

              {workspaceDetails.taxCode && (
                <div>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase block">Tax Registered Code</span>
                  <span className="font-semibold text-foreground text-sm font-mono">{workspaceDetails.taxCode}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Social Links */}
          <Card className="p-6 bg-surface border border-border rounded-2xl space-y-4">
            <Typography type="h4" className="font-bold text-foreground font-outfit">
              Social Coordinates
            </Typography>
            <div className="flex flex-col gap-2">
              {workspaceDetails.linkedinUrl && (
                <a
                  href={workspaceDetails.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-card/10 hover:bg-card/50 transition-colors text-xs font-semibold text-muted hover:text-foreground"
                >
                  <LinkedInIcon className="size-4 text-accent" />
                  LinkedIn
                </a>
              )}
              {workspaceDetails.facebookUrl && (
                <a
                  href={workspaceDetails.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-card/10 hover:bg-card/50 transition-colors text-xs font-semibold text-muted hover:text-foreground"
                >
                  <FacebookIcon className="size-4 text-accent" />
                  Facebook
                </a>
              )}
              {workspaceDetails.twitterUrl && (
                <a
                  href={workspaceDetails.twitterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-card/10 hover:bg-card/50 transition-colors text-xs font-semibold text-muted hover:text-foreground"
                >
                  <TwitterIcon className="size-4 text-accent" />
                  Twitter / X
                </a>
              )}
              {workspaceDetails.website && (
                <a
                  href={workspaceDetails.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-card/10 hover:bg-card/50 transition-colors text-xs font-semibold text-muted hover:text-foreground"
                >
                  <Globe size={14} className="text-accent" />
                  Website
                </a>
              )}
              {!workspaceDetails.linkedinUrl && 
               !workspaceDetails.facebookUrl && 
               !workspaceDetails.twitterUrl && 
               !workspaceDetails.website && (
                <span className="text-xs text-muted font-light italic">No social links configured.</span>
              )}
            </div>
          </Card>

          {/* Public Authority */}
          <Card className="p-6 bg-surface border border-border rounded-2xl space-y-4">
            <Typography type="h4" className="font-bold text-foreground flex items-center gap-2 font-outfit">
              <ShieldCheck size={18} className="text-accent" />
              Public Authority
            </Typography>
            <Typography type="body-xs" className="text-muted leading-relaxed font-outfit">
              This organization profile is publicly visible to candidates applying for active job postings and collaborating on shared evidence boards.
            </Typography>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WorkspacePublicProfileView;
