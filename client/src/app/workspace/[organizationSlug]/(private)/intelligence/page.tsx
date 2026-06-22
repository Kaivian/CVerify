"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useIntelligenceStore } from "@/stores/use-intelligence-store";
import { Card } from "@/components/ui/card";
import { Chip, InputGroup, Slider } from "@heroui/react";
import { Button } from "@/components/ui/button";
import { Search, MapPin, ShieldCheck, UserCheck, AlertTriangle } from "lucide-react";
import { SkeletonLoader } from "@/components/ui/states";
import { TrustScoreBadge } from "@/components/ui/cverify/trust-score-indicator";

export default function TalentDiscoveryPage() {
  const params = useParams();
  const router = useRouter();
  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  const {
    searchQuery,
    searchLocation,
    minTrustScore,
    searchResults,
    isLoading,
    error,
    setSearchQuery,
    setSearchLocation,
    setMinTrustScore,
    searchCandidates
  } = useIntelligenceStore();

  useEffect(() => {
    searchCandidates();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchCandidates();
  };

  return (
    <div className="space-y-6 font-outfit max-w-7xl mx-auto text-foreground">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-surface border border-border text-foreground select-none">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <UserCheck size={24} className="text-accent" />
            Graph-Based Talent Discovery
          </h2>
          <p className="text-muted text-xs font-light mt-0.5">
            Search candidates using semantic technology queries, verified evidence graphs, and dynamic trust profiles.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-6 bg-surface border border-border rounded-2xl">
        <form onSubmit={handleSearchSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-medium text-foreground/80">Capability Query</label>
              <InputGroup>
                <InputGroup.Prefix>
                  <Search size={16} className="text-muted" />
                </InputGroup.Prefix>
                <InputGroup.Input
                  placeholder="e.g. React developer with WebSockets..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="h-10 text-xs"
                />
              </InputGroup>
            </div>
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-medium text-foreground/80">Location Filter</label>
              <InputGroup>
                <InputGroup.Prefix>
                  <MapPin size={16} className="text-muted" />
                </InputGroup.Prefix>
                <InputGroup.Input
                  placeholder="e.g. Remote, Vietnam..."
                  value={searchLocation}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchLocation(e.target.value)}
                  className="h-10 text-xs"
                />
              </InputGroup>
            </div>
            <div className="flex flex-col justify-center px-1">
              <span className="text-xs text-muted mb-1 font-medium">Minimum Trust Score: {minTrustScore}%</span>
              <Slider
                step={5}
                maxValue={100}
                minValue={0}
                value={minTrustScore}
                onChange={(val) => setMinTrustScore(val as number)}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="submit"
              isLoading={isLoading}
              className="px-6 py-2.5 bg-foreground text-background font-bold rounded-xl text-xs cursor-pointer"
            >
              Search Registry
            </Button>
          </div>
        </form>
      </Card>

      {/* Results Section */}
      {error && (
        <Card className="p-6 border border-danger/20 bg-danger/5 text-danger flex items-center gap-3">
          <AlertTriangle size={20} />
          <span className="text-xs font-semibold">{error}</span>
        </Card>
      )}

      {isLoading ? (
        <Card className="p-6 overflow-hidden">
          <SkeletonLoader rows={6} columns={4} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {searchResults.length === 0 ? (
            <div className="col-span-full border border-dashed border-border/80 rounded-2xl p-12 text-center select-none bg-surface">
              <p className="font-bold text-foreground mb-1">No Verified Developers Found</p>
              <p className="text-muted text-xs max-w-md mx-auto">
                No search profiles match the capability query and trust metrics. Try expanding your query terms.
              </p>
            </div>
          ) : (
            searchResults.map((candidate) => {
              let capabilities: Array<{ Name: string; ProficiencyScore: number; ExpertiseLevel: string }> = [];
              try {
                capabilities = JSON.parse(candidate.capabilitiesJson);
              } catch {}

              return (
                <Card
                  key={candidate.candidateId}
                  onClick={() => router.push(`/workspace/${organizationSlug}/intelligence/${candidate.candidateId}`)}
                  className="p-6 bg-surface border border-border hover:border-accent/40 transition-colors rounded-2xl cursor-pointer flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-foreground text-base">{candidate.fullName}</h4>
                        <p className="text-muted text-xs">{candidate.headline || "Software Engineer"}</p>
                      </div>
                      <TrustScoreBadge score={candidate.trustScore} />
                    </div>
                    {candidate.location && (
                      <p className="text-xs text-muted flex items-center gap-1.5">
                        <MapPin size={12} />
                        {candidate.location}
                      </p>
                    )}
                  </div>

                  {/* Skills badges */}
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {capabilities.slice(0, 5).map((cap, i) => (
                      <Chip key={i} size="sm" variant="soft" className="text-xs font-medium">
                        {cap.Name} ({cap.ExpertiseLevel})
                      </Chip>
                    ))}
                    {capabilities.length > 5 && (
                      <Chip size="sm" variant="soft" className="text-xs font-light">
                        +{capabilities.length - 5} more
                      </Chip>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
