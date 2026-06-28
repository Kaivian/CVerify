"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useIntelligenceStore } from "@/stores/use-intelligence-store";
import { Card } from "@/components/ui/card";
import { Chip, ProgressBar } from "@heroui/react";
import { Button } from "@/components/ui/button";
import {
  Building2,
  ShieldCheck,
  MapPin,
  Code,
  GitCommit,
  History,
  UserCheck,
  AlertTriangle,
  ArrowLeft,
  FileCheck2,
  Lock
} from "lucide-react";
import { SkeletonLoader } from "@/components/ui/states";
import { TrustScoreBadge } from "@/components/ui/cverify/trust-score-indicator";

export default function CandidateIntelligenceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";
  const candidateId = typeof params?.id === "string" ? params.id : "";

  const {
    selectedCandidate,
    isLoading,
    error,
    fetchCandidateProfile
  } = useIntelligenceStore();

  useEffect(() => {
    if (candidateId) {
      fetchCandidateProfile(candidateId);
    }
  }, [candidateId, fetchCandidateProfile]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 font-outfit text-foreground">
        <div className="h-10 w-48 bg-separator/50 animate-pulse rounded-lg mb-4" />
        <Card className="p-0 overflow-hidden">
          <SkeletonLoader rows={8} columns={4} />
        </Card>
      </div>
    );
  }

  if (error || !selectedCandidate) {
    return (
      <div className="max-w-xl mx-auto py-20 font-outfit text-foreground">
        <Card className="p-8 border border-border bg-surface text-center">
          <div className="size-16 rounded-2xl bg-danger/10 flex items-center justify-center border border-danger/20 mx-auto mb-5 text-danger">
            <AlertTriangle size={28} />
          </div>
          <h4 className="font-bold text-foreground mb-2 text-lg">
            Intelligence Profile Error
          </h4>
          <p className="text-muted text-xs leading-relaxed mb-6">
            {error || "Candidate profile details could not be loaded."}
          </p>
          <Button
            onClick={() => router.push(`/business/${organizationSlug}/intelligence`)}
            className="px-4 py-2 bg-foreground text-background font-bold rounded-xl text-xs cursor-pointer"
          >
            <ArrowLeft size={12} className="mr-1.5" />
            Back to Search
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-outfit max-w-7xl mx-auto text-foreground">
      {/* Back navigation */}
      <div className="flex justify-between items-center">
        <Button
          onClick={() => router.push(`/business/${organizationSlug}/intelligence`)}
          variant="light"
          size="sm"
          className="text-muted hover:text-foreground text-xs cursor-pointer"
        >
          <ArrowLeft size={14} className="mr-1.5" />
          Back to Candidate Directory
        </Button>
      </div>

      {/* Candidate Top Summary Card */}
      <Card className="p-6 bg-surface border border-border rounded-2xl flex flex-col md:flex-row justify-between md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-foreground">{selectedCandidate.fullName}</h2>
            <TrustScoreBadge score={selectedCandidate.trustScore} showTier tier={selectedCandidate.trustTier} />
          </div>
          <p className="text-muted text-sm font-light">
            {selectedCandidate.headline || "Verified Software Engineer"}
          </p>
          {selectedCandidate.location && (
            <p className="text-xs text-muted flex items-center gap-1.5 mt-1">
              <MapPin size={12} />
              {selectedCandidate.location}
            </p>
          )}
        </div>
        <div className="p-4 rounded-xl border border-border bg-surface/50 text-center min-w-[140px] select-none">
          <span className="text-xs text-muted font-medium block mb-1">Aggregate Trust</span>
          <span className="text-3xl font-extrabold text-foreground">{selectedCandidate.trustScore}%</span>
        </div>
      </Card>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Columns - Capabilities and Trust Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          {/* Capabilities Card */}
          <Card className="p-6 bg-surface border border-border rounded-2xl space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Code size={20} className="text-accent" />
              <h3 className="font-bold text-foreground text-lg">Verified Skill Tree</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedCandidate.capabilities.map((cap) => (
                <div key={cap.id} className="p-4 rounded-xl border border-border/80 bg-surface/30 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-sm text-foreground block">{cap.capabilityName}</span>
                      <span className="text-muted text-[10px] uppercase font-semibold">{cap.category}</span>
                    </div>
                    {cap.score && (
                      <Chip size="sm" variant="soft" className="font-bold text-[10px]">
                        {cap.score.expertiseLevel}
                      </Chip>
                    )}
                  </div>
                  {cap.score && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-muted">
                        <span>Proficiency</span>
                        <span>{Math.round(cap.score.proficiencyScore)}%</span>
                      </div>
                      <ProgressBar
                        size="sm"
                        value={cap.score.proficiencyScore}
                        color="success"
                        className="w-full"
                      />
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[11px] text-muted pt-1">
                    <span className="flex items-center gap-1">
                      <FileCheck2 size={12} />
                      {cap.evidenceCount} verified claims
                    </span>
                    {cap.score && (
                      <span>Recency: {Math.round(cap.score.recencyIndex * 100)}%</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Trust breakdown card */}
          {selectedCandidate.trustComponents && (
            <Card className="p-6 bg-surface border border-border rounded-2xl space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={20} className="text-accent" />
                <h3 className="font-bold text-foreground text-lg">Trust Vector Breakdown</h3>
              </div>

              <div className="space-y-4">
                {selectedCandidate.trustComponents.map((c, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-foreground">{c.componentName}</span>
                      <span className="text-muted">{c.componentScore}% (Weight: {Math.round(c.weight * 100)}%)</span>
                    </div>
                    <ProgressBar
                      size="md"
                      value={c.componentScore}
                      color={c.componentScore >= 80 ? "success" : c.componentScore >= 50 ? "warning" : "default"}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column - Evidence Timeline */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-6 bg-surface border border-border rounded-2xl space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <GitCommit size={20} className="text-accent" />
              <h3 className="font-bold text-foreground text-lg">Evidence Graph Timeline</h3>
            </div>

            <div className="space-y-6 relative pl-3 border-l border-border/80">
              {selectedCandidate.evidence.map((ev) => {
                let payload: any = {};
                try {
                  payload = JSON.parse(ev.artifact.payload);
                } catch { }

                const isVerified = ev.verifications.some(v => v.status === "Verified");

                return (
                  <div key={ev.id} className="space-y-2 relative">
                    {/* timeline bullet */}
                    <div className="absolute left-[-19px] top-1.5 size-2.5 rounded-full bg-accent border border-surface" />

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground">{ev.artifact.artifactType}</span>
                        <Chip
                          color={isVerified ? "success" : "default"}
                          size="sm"
                          variant="soft"
                          className="font-bold text-[9px] scale-90"
                        >
                          {isVerified ? "Verified" : "Pending"}
                        </Chip>
                      </div>
                      <p className="text-muted text-[11px] font-mono break-all leading-tight">
                        {ev.artifact.externalIdentifier}
                      </p>
                      {payload.Name && (
                        <p className="text-[11px] text-muted">
                          Repository: <span className="font-semibold text-foreground">{payload.Name}</span>
                          {payload.PrimaryLanguage && ` • ${payload.PrimaryLanguage}`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
