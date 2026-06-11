"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useWorkspaceStore } from "@/features/workspace/store/use-workspace-store";
import { Card } from "@/components/ui/card";
import { Typography } from "@heroui/react";
import { Globe, MapPin, Briefcase, Calendar, Info, Heart, Target, Eye } from "lucide-react";

// Inline brand SVGs to bypass Lucide member mismatch errors
const GitHubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" {...props}>
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const LinkedInIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" {...props}>
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
  </svg>
);

const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export default function WorkspaceAboutTab() {
  const params = useParams();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";
  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[organizationSlug]);

  if (!workspaceDetails) return null;

  // Mock Locations
  const mockOffices = [
    { name: "Hanoi HQ", address: "Tech Park, Cau Giay, Hanoi, Vietnam" },
    { name: "Saigon Office", address: "District 1, Ho Chi Minh City, Vietnam" },
  ];

  // Mock Social Links
  const mockSocials = [
    { icon: <LinkedInIcon className="size-4" />, label: "LinkedIn", href: "https://linkedin.com/company/cverify" },
    { icon: <TwitterIcon className="size-4" />, label: "Twitter", href: "https://twitter.com/cverify_dev" },
    { icon: <GitHubIcon className="size-4" />, label: "GitHub", href: "https://github.com/cverify" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* Main Corporate Details (Left 2 columns) */}
      <div className="lg:col-span-2 space-y-6">
        {/* Detailed Description */}
        <Card className="p-6 md:p-8 bg-surface border border-border rounded-2xl space-y-4">
          <Typography type="h3" className="font-bold text-foreground">
            About {workspaceDetails.organizationName}
          </Typography>
          <Typography type="body-xs" className="text-muted leading-relaxed text-sm">
            {workspaceDetails.description}
          </Typography>
        </Card>

        {/* Mission, Vision, and Values */}
        <Card className="p-6 md:p-8 bg-surface border border-border rounded-2xl space-y-6">
          <Typography type="h3" className="font-bold text-foreground">
            Corporate Pillars
          </Typography>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {workspaceDetails.mission && (
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center select-none">
                  <Target size={18} />
                </div>
                <Typography type="body-sm" className="font-bold text-foreground text-sm">
                  Mission
                </Typography>
                <Typography type="body-xs" className="text-muted text-xs leading-relaxed">
                  {workspaceDetails.mission}
                </Typography>
              </div>
            )}

            {workspaceDetails.vision && (
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center select-none">
                  <Eye size={18} />
                </div>
                <Typography type="body-sm" className="font-bold text-foreground text-sm">
                  Vision
                </Typography>
                <Typography type="body-xs" className="text-muted text-xs leading-relaxed">
                  {workspaceDetails.vision}
                </Typography>
              </div>
            )}

            {workspaceDetails.coreValues && (
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center select-none">
                  <Heart size={18} />
                </div>
                <Typography type="body-sm" className="font-bold text-foreground text-sm">
                  Core Values
                </Typography>
                <Typography type="body-xs" className="text-muted text-xs leading-relaxed">
                  {workspaceDetails.coreValues}
                </Typography>
              </div>
            )}
          </div>
        </Card>

        {/* Office Locations */}
        <Card className="p-6 md:p-8 bg-surface border border-border rounded-2xl space-y-4">
          <Typography type="h3" className="font-bold text-foreground">
            Office Locations
          </Typography>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockOffices.map((office, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-border bg-card/10 space-y-1 select-none">
                <div className="flex items-center gap-2 font-bold text-xs text-foreground">
                  <MapPin size={14} className="text-accent" />
                  {office.name}
                </div>
                <Typography type="body-xs" className="text-muted text-xs leading-relaxed pl-5">
                  {office.address}
                </Typography>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Side Meta Details Column */}
      <div className="space-y-6">
        {/* Specifications */}
        <Card className="p-6 bg-surface border border-border rounded-2xl space-y-4">
          <Typography type="h4" className="font-bold text-foreground flex items-center gap-2">
            <Info size={16} className="text-accent" />
            Company details
          </Typography>

          <div className="space-y-4 text-xs select-none">
            <div>
              <span className="text-[10px] text-muted-foreground font-bold uppercase block">Website</span>
              <a
                href={workspaceDetails.website}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-accent hover:underline break-all"
              >
                {workspaceDetails.website}
              </a>
            </div>

            <div>
              <span className="text-[10px] text-muted-foreground font-bold uppercase block">Industry</span>
              <span className="font-semibold text-foreground">{workspaceDetails.industry}</span>
            </div>

            <div>
              <span className="text-[10px] text-muted-foreground font-bold uppercase block">Company size</span>
              <span className="font-semibold text-foreground">{workspaceDetails.companySize} employees</span>
            </div>

            <div>
              <span className="text-[10px] text-muted-foreground font-bold uppercase block">Headquarters</span>
              <span className="font-semibold text-foreground">{workspaceDetails.location}</span>
            </div>

            <div>
              <span className="text-[10px] text-muted-foreground font-bold uppercase block">Founded</span>
              <span className="font-semibold text-foreground">{workspaceDetails.founded}</span>
            </div>
          </div>
        </Card>

        {/* Social Links */}
        <Card className="p-6 bg-surface border border-border rounded-2xl space-y-4">
          <Typography type="h4" className="font-bold text-foreground">
            Social Coordinates
          </Typography>
          <div className="flex flex-col gap-2">
            {mockSocials.map((social, idx) => (
              <a
                key={idx}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-card/10 hover:bg-card/50 transition-colors text-xs font-semibold text-muted hover:text-foreground"
              >
                <span className="text-accent">{social.icon}</span>
                {social.label}
              </a>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
