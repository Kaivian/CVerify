"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/features/workspace/store/use-workspace-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Typography, Spinner } from "@heroui/react";
import { ShieldCheck, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { BusinessVerificationBadge } from "@/components/ui/cverify/verification-badges";

export default function CompanyVerificationPage() {
  const params = useParams();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  const fetchWorkspace = useWorkspaceStore((s) => s.fetchWorkspace);
  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[organizationSlug]);
  const isDetailsLoading = useWorkspaceStore((s) => s.loading[organizationSlug]);

  useEffect(() => {
    if (organizationSlug) {
      fetchWorkspace(organizationSlug);
    }
  }, [organizationSlug, fetchWorkspace]);

  if (isDetailsLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 font-outfit text-foreground select-none">
        <div className="h-10 w-48 bg-separator/50 animate-pulse rounded-lg mb-4" />
        <Card className="p-0 overflow-hidden">
          <Spinner size="lg" className="mx-auto my-12" color="current" />
        </Card>
      </div>
    );
  }

  const isVerified = workspaceDetails?.isVerified ?? false;
  const level = workspaceDetails?.verificationLevel ?? 0;

  return (
    <div className="space-y-6 font-outfit max-w-7xl mx-auto text-foreground p-4">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-surface border border-border text-foreground select-none">
        <div className="space-y-1">
          <Typography type="h2" className="text-2xl font-bold flex items-center gap-2 text-foreground font-outfit">
            <ShieldCheck size={24} className="text-accent" />
            Company Verification
          </Typography>
          <Typography type="body-xs" className="text-muted font-medium mt-0.5 font-outfit">
            Manage your legal business identification records, domain records, and trust rating.
          </Typography>
        </div>
        <div className="flex gap-2">
          <BusinessVerificationBadge level={level} />
        </div>
      </div>

      {/* Main Verification status card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 md:p-8 bg-surface border border-border rounded-2xl space-y-6">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 ${isVerified ? "bg-success/10 border-success/20 text-success" : "bg-warning/10 border-warning/20 text-warning"}`}>
              {isVerified ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
            </div>
            <div className="space-y-1">
              <Typography type="h3" className="font-bold text-foreground font-outfit">
                {isVerified ? "Business Profile Verified" : "Verification Pending"}
              </Typography>
              <Typography type="body-xs" className="text-muted leading-relaxed font-medium">
                {isVerified 
                  ? `Your organization is verified at Level ${level}. Candidates can apply to your active job listings with complete confidence in your brand credentials.`
                  : "Submit corporate legal credentials to verify your business identity and start publishing job campaigns."
                }
              </Typography>
            </div>
          </div>

          <div className="border-t border-separator/40 pt-6 space-y-4">
            <Typography type="h4" className="font-bold text-foreground font-outfit">
              Verification Levels & Details
            </Typography>
            <div className="space-y-3 font-medium text-xs text-muted leading-relaxed select-none">
              <div className="flex justify-between border-b border-separator/35 pb-2">
                <span>Verification Status</span>
                <span className={isVerified ? "text-success font-bold" : "text-warning font-bold"}>
                  {isVerified ? "Active" : "Unverified"}
                </span>
              </div>
              <div className="flex justify-between border-b border-separator/35 pb-2">
                <span>Tax Code / Business License</span>
                <span className="text-foreground font-mono">{workspaceDetails?.taxCode || "Not provided"}</span>
              </div>
              <div className="flex justify-between border-b border-separator/35 pb-2">
                <span>Contact Email</span>
                <span className="text-foreground">{workspaceDetails?.contactEmail || "Not provided"}</span>
              </div>
              <div className="flex justify-between pb-1">
                <span>Website Domain</span>
                <span className="text-foreground">{workspaceDetails?.website || "Not provided"}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Action Panel */}
        <Card className="p-6 bg-surface border border-border rounded-2xl space-y-4">
          <Typography type="h4" className="font-bold text-foreground font-outfit select-none">
            Registry Actions
          </Typography>
          <div className="flex flex-col gap-2.5">
            <Button
              className="w-full justify-start text-xs font-bold h-10 px-3 bg-surface-secondary/40 hover:bg-surface-secondary/80 border border-border text-foreground rounded-xl flex items-center gap-2.5 cursor-pointer text-left"
              disabled
            >
              <FileText size={16} className="text-accent shrink-0" />
              Upload License Documents
            </Button>
            <Button
              className="w-full justify-start text-xs font-bold h-10 px-3 bg-surface-secondary/40 hover:bg-surface-secondary/80 border border-border text-foreground rounded-xl flex items-center gap-2.5 cursor-pointer text-left"
              disabled
            >
              <ShieldCheck size={16} className="text-accent shrink-0" />
              Verify DNS Domains
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
