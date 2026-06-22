"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { profileApi } from "@/services/profile.service";
import { type RankingStats } from "@/types/profile.types";
import { Card } from "@/components/ui/card";
import {
  Skeleton,
  Chip,
  Tooltip
} from "@heroui/react";
import {
  Users,
  GitFork,
  MapPin,
  Sparkles,
  Layers,
  TrendingUp,
  Lightbulb,
  ArrowUp,
  ArrowRight,
  Calendar,
  Globe,
  HelpCircle
} from "lucide-react";

export function InsightsView() {
  const router = useRouter();
  const [stats, setStats] = useState<RankingStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await profileApi.fetchRankingStats();
      setStats(res);
    } catch (err) {
      console.error("Failed to fetch insights stats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const isStatsLoading = loading && !stats;

  // Real data from stats
  const totalTalents = stats?.totalTalents ?? 0;
  const totalRepos = stats?.totalRepositories ?? 0;
  const totalCountries = stats?.totalCountries ?? 0;
  const topTechnologies = stats?.topTechnologies ?? [];
  const fastestRisingSkills = stats?.fastestRisingSkills ?? [];
  const trendingEngineers = stats?.trendingEngineers ?? [];
  const averageTrustScore = stats?.averageTrustScore ?? 0;
  const averageCapabilityScore = stats?.averageCapabilityScore ?? 0;
  const averageRepositoryImpact = stats?.averageRepositoryImpact ?? 0;
  const verificationRate = stats?.verificationRate ?? 0;
  const averageCompositeScore = stats?.averageCompositeScore ?? 0;

  // Render Skeletons during Loading
  if (isStatsLoading) {
    return (
      <div className="w-full flex flex-col gap-6 select-none pb-12 text-left">
        {/* Banner Title Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4 mb-2">
          <div className="space-y-2">
            <Skeleton className="h-9 w-64 rounded-xl" />
            <Skeleton className="h-4 w-96 rounded-lg" />
          </div>
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>

        {/* Grid Skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 w-full items-stretch">
          {[1, 2, 3].map((i) => (
            <Card key={i} glow={false} className="border border-border/60 bg-surface rounded-2xl p-5 flex flex-col justify-between min-h-[220px] shadow-sm">
              <Skeleton className="size-11 rounded-2xl" />
              <div className="mt-6 space-y-3">
                <Skeleton className="h-9 w-20 rounded-md" />
                <Skeleton className="h-4 w-36 rounded-md" />
                <Skeleton className="h-3 w-48 rounded-md" />
              </div>
            </Card>
          ))}
          
          {/* Top Tech Skeleton */}
          <Card glow={false} className="border border-border/60 bg-surface rounded-2xl p-5 shadow-sm xl:row-span-2 flex flex-col justify-between min-h-[464px]">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
              </div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-3.5 w-16 rounded" />
                    <Skeleton className="h-3.5 w-8 rounded" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
            <Skeleton className="h-8 w-full rounded mt-4" />
          </Card>

          {/* Fastest Rising Skills Skeleton */}
          <Card glow={false} className="border border-border/60 bg-surface rounded-2xl p-5 shadow-sm">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-36 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
              </div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-5 rounded" />
                    <Skeleton className="h-3.5 w-24 rounded" />
                  </div>
                  <Skeleton className="h-3.5 w-12 rounded" />
                </div>
              ))}
            </div>
          </Card>

          {/* Trending Engineers Skeleton */}
          <Card glow={false} className="border border-border/60 bg-surface rounded-2xl p-5 shadow-sm">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-36 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
              </div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-7 rounded-full" />
                    <Skeleton className="h-3.5 w-20 rounded" />
                  </div>
                  <Skeleton className="h-3.5 w-8 rounded" />
                </div>
              ))}
            </div>
          </Card>

          {/* Design Notes Skeleton */}
          <Card glow={false} className="border border-border/60 bg-surface rounded-2xl p-5 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Skeleton className="size-9 rounded-xl" />
                <Skeleton className="h-4 w-28 rounded" />
              </div>
              <div className="space-y-2.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-3 w-full rounded" />
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 select-none pb-12 text-left">
      {/* Banner Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4 mb-2">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-outfit text-foreground flex items-center gap-2">
            <TrendingUp className="text-accent size-8 shrink-0" />
            Top Stats & Market Insights
          </h1>
          <p className="text-muted text-sm mt-1 max-w-2xl leading-relaxed">
            Key metrics about the CVerify ecosystem and engineering talent market.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 bg-surface-secondary hover:bg-surface-tertiary border border-border/60 px-3.5 py-2 rounded-xl text-xs font-bold text-foreground cursor-pointer select-none">
            <Calendar className="size-4 text-muted" />
            <span>Last 30 days</span>
          </div>
        </div>
      </div>

      {/* Main Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 w-full items-stretch">
        
        {/* CARD 1: Verified Engineers */}
        <Card glow={false} className="border border-border/60 bg-surface rounded-2xl p-5 flex flex-col justify-between min-h-[220px] shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start w-full">
            <div className="size-11 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 font-bold border border-orange-500/20 shadow-xs">
              <Users className="size-5" />
            </div>
          </div>
          <div className="mt-4 flex-1 flex flex-col justify-end">
            <div className="text-4xl font-black font-outfit text-foreground leading-none">{totalTalents}</div>
            <div className="text-sm font-bold text-foreground mt-2">Verified Engineers</div>
            <div className="text-[11px] text-muted-foreground font-medium mt-1 leading-tight">Engineers with high trust & verified profiles</div>
            {totalTalents === 0 && (
              <div className="mt-3 text-[10px] font-semibold text-muted-foreground">No verified engineers yet</div>
            )}
          </div>
        </Card>

        {/* CARD 2: Verified Repositories */}
        <Card glow={false} className="border border-border/60 bg-surface rounded-2xl p-5 flex flex-col justify-between min-h-[220px] shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start w-full">
            <div className="size-11 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold border border-blue-500/20 shadow-xs">
              <GitFork className="size-5" />
            </div>
          </div>
          <div className="mt-4 flex-1 flex flex-col justify-end">
            <div className="text-4xl font-black font-outfit text-foreground leading-none">{totalRepos}</div>
            <div className="text-sm font-bold text-foreground mt-2">Verified Repositories</div>
            <div className="text-[11px] text-muted-foreground font-medium mt-1 leading-tight">High-quality, verified code repositories</div>
            {totalRepos === 0 && (
              <div className="mt-3 text-[10px] font-semibold text-muted-foreground">No verified repositories yet</div>
            )}
          </div>
        </Card>

        {/* CARD 3: Represented Geographies */}
        <Card glow={false} className="border border-border/60 bg-surface rounded-2xl p-5 flex flex-col justify-between min-h-[220px] shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start w-full">
            <div className="size-11 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500 font-bold border border-green-500/20 shadow-xs">
              <MapPin className="size-5" />
            </div>
          </div>
          <div className="mt-4 flex-1 flex flex-col justify-end">
            <div className="text-4xl font-black font-outfit text-foreground leading-none">{totalCountries}</div>
            <div className="text-sm font-bold text-foreground mt-2">Represented Geographies</div>
            <div className="text-[11px] text-muted-foreground font-medium mt-1 leading-tight">Countries with active verified talent</div>
            {totalCountries > 0 ? (
              <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground bg-surface-secondary/60 border border-border/40 px-2.5 py-1.5 rounded-xl self-start">
                <Globe className="size-3.5 text-success" />
                <span>Global talent distribution</span>
              </div>
            ) : (
              <div className="mt-3 text-[10px] font-semibold text-muted-foreground">No geographical distribution yet</div>
            )}
          </div>
        </Card>

        {/* CARD 4: Top Technologies (Spans full height of 2 rows on XL) */}
        <Card glow={false} className="border border-border/60 bg-surface rounded-2xl p-5 shadow-sm xl:row-span-2 flex flex-col justify-between min-h-[464px]">
          <div className="w-full">
            <div className="flex justify-between items-center mb-5 select-none">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Layers className="size-4 text-purple-500" />
                Top Technologies
              </h3>
              <button onClick={() => router.push("/ranking")} className="text-[11px] font-bold text-accent hover:opacity-85 flex items-center gap-0.5 cursor-pointer">
                View all <ArrowRight className="size-3" />
              </button>
            </div>

            {topTechnologies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center select-none">
                <Layers className="size-8 text-muted/30 mb-2" />
                <span className="text-xs font-bold text-muted-foreground">No technology data</span>
                <span className="text-[10px] text-muted/65 mt-1 max-w-[180px] leading-relaxed">
                  Verify repositories to populate stats.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-5 pt-1">
                {topTechnologies.slice(0, 5).map((tech, index) => {
                  const relativePercentage = 100 - index * 15; // Proportional visualization based on rank order
                  return (
                    <div key={tech} className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs font-bold text-foreground select-none">
                        <span>{tech}</span>
                        <span className="text-muted font-semibold">#{index + 1}</span>
                      </div>
                      <div className="w-full bg-surface-secondary h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-purple-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${relativePercentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-border/40 pt-4 mt-6 text-[10px] text-muted-foreground font-semibold leading-normal select-none">
            Relative popularity scale represents the rank order of language/framework capabilities verified across candidate repositories.
          </div>
        </Card>

        {/* CARD 5: Fastest Rising Skills */}
        <Card glow={false} className="border border-border/60 bg-surface rounded-2xl p-5 shadow-sm text-left">
          <div className="flex justify-between items-center mb-4 select-none">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Sparkles className="size-4 text-warning" />
              Fastest Rising Skills
            </h3>
            <button onClick={() => router.push("/ranking")} className="text-[11px] font-bold text-accent hover:opacity-85 flex items-center gap-0.5 cursor-pointer">
              View all <ArrowRight className="size-3" />
            </button>
          </div>

          {fastestRisingSkills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center select-none">
              <Sparkles className="size-7 text-muted/30 mb-2" />
              <span className="text-xs font-bold text-muted-foreground">No rising skills</span>
              <span className="text-[10px] text-muted/65 mt-1 max-w-[180px] leading-relaxed">
                Assess capability scores to track trends.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {fastestRisingSkills.slice(0, 5).map((skill, index) => (
                <div key={skill} className="flex items-center justify-between text-xs font-semibold select-none py-0.5">
                  <div className="flex items-center gap-2.5">
                    <span className={`size-5 rounded-md flex items-center justify-center text-[10px] font-black border ${
                      index === 0 ? "bg-warning/15 text-warning border-warning/35" :
                      index === 1 ? "bg-purple-500/15 text-purple-400 border-purple-500/35" :
                      index === 2 ? "bg-blue-500/15 text-blue-400 border-blue-500/35" :
                      index === 3 ? "bg-success/15 text-success border-success/35" :
                      "bg-surface-secondary text-muted-foreground border-border/40"
                    }`}>
                      {index + 1}
                    </span>
                    <span className="text-foreground font-bold hover:text-accent cursor-pointer" onClick={() => router.push(`/ranking?skills=${skill}`)}>
                      {skill}
                    </span>
                  </div>
                  <span className="text-success text-[10px] font-black tracking-wider flex items-center gap-0.5 bg-success/10 border border-success/20 px-2 py-0.5 rounded-lg select-none">
                    <ArrowUp className="size-2.5 stroke-3" />
                    <span>Rising</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* CARD 6: Trending Engineers */}
        <Card glow={false} className="border border-border/60 bg-surface rounded-xl p-5 shadow-sm text-left">
          <div className="flex justify-between items-center mb-4 select-none">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Users className="size-4 text-primary" />
              Trending Engineers
            </h3>
            <button onClick={() => router.push("/ranking?category=Trending")} className="text-[11px] font-bold text-accent hover:opacity-85 flex items-center gap-0.5 cursor-pointer">
              View all <ArrowRight className="size-3" />
            </button>
          </div>

          {trendingEngineers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center select-none">
              <Users className="size-7 text-muted/30 mb-2" />
              <span className="text-xs font-bold text-muted-foreground">No trending talent</span>
              <span className="text-[10px] text-muted/65 mt-1 max-w-[180px] leading-relaxed">
                Rank changes will indicate active trends.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {trendingEngineers.slice(0, 5).map((eng, index) => {
                const rankVal = index + 1;
                const hasDelta = (eng.rankDelta ?? 0) > 0;
                return (
                  <div key={eng.candidateId} className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-bold text-muted-foreground w-3 select-none text-center">
                        {rankVal}
                      </span>
                      {eng.avatarUrl ? (
                        <img
                          src={eng.avatarUrl}
                          alt={eng.fullName}
                          className="size-7 rounded-full object-cover border border-border/40 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${eng.fullName}`;
                          }}
                        />
                      ) : (
                        <div className="size-7 rounded-full bg-surface-secondary border border-border/40 flex items-center justify-center text-foreground font-black font-outfit text-[9px] shrink-0">
                          {eng.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span
                        className="text-foreground hover:text-accent cursor-pointer truncate font-bold"
                        onClick={() => router.push(`/${eng.username || eng.candidateId}`)}
                      >
                        {eng.fullName}
                      </span>
                    </div>
                    {hasDelta ? (
                      <span className="text-success text-[10px] font-black flex items-center gap-0.5 select-none shrink-0">
                        <ArrowUp className="size-2.5 stroke-3" />
                        <span>{eng.rankDelta}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-[10px] font-bold select-none shrink-0">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* CARD 7: Talent Quality Index */}
        <Card glow={false} className="border border-border/60 bg-surface rounded-2xl p-5 flex flex-col justify-between min-h-[220px] shadow-sm relative overflow-hidden select-none">
          <div className="flex justify-between items-start w-full">
            <div className="size-11 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 font-bold border border-purple-500/20 shadow-xs">
              <Lightbulb className="size-5" />
            </div>
            {totalTalents > 0 && (
              <Tooltip delay={0}>
                <Tooltip.Trigger>
                  <div className="cursor-help text-muted-foreground hover:text-foreground shrink-0 p-1">
                    <HelpCircle className="size-4" />
                  </div>
                </Tooltip.Trigger>
                <Tooltip.Content showArrow placement="bottom end" className="max-w-xs bg-surface border border-border p-3 shadow-md rounded-xl text-left">
                  <div className="text-xs font-bold text-foreground mb-2">Methodology & Signals</div>
                  <ul className="flex flex-col gap-2 text-[10px] text-muted-foreground list-none pl-0">
                    <li className="flex items-start gap-1.5">
                      <span className="size-1 rounded-full bg-accent mt-1.5 shrink-0" />
                      <span><strong>Composite score</strong>: Aggregated from repository impact, code quality, and AI evaluation.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="size-1 rounded-full bg-accent mt-1.5 shrink-0" />
                      <span><strong>Trust score</strong>: Measures identity verification, security practices, and code authorship.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="size-1 rounded-full bg-accent mt-1.5 shrink-0" />
                      <span><strong>AI profiling</strong>: Uses deep learning pipelines to extract capability levels and tendencies.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="size-1 rounded-full bg-accent mt-1.5 shrink-0" />
                      <span><strong>Background refresh</strong>: Platform metrics and ranking positions are updated continuously.</span>
                    </li>
                  </ul>
                </Tooltip.Content>
              </Tooltip>
            )}
          </div>
          <div className="mt-4 flex-1 flex flex-col justify-end">
            {totalTalents > 0 ? (
              <>
                <div className="text-4xl font-black font-outfit text-foreground leading-none">
                  {averageCompositeScore}
                </div>
                <div className="text-sm font-bold text-foreground mt-2">Talent Quality Index</div>
                <div className="text-[11px] text-muted-foreground font-medium mt-1 leading-tight mb-3">
                  Ecosystem quality and maturity based on platform intelligence.
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1 border-t border-border/40 mt-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-black font-outfit text-foreground leading-none">
                      {averageTrustScore}
                    </span>
                    <span className="text-[9px] font-bold text-muted-foreground mt-1">Average Trust Score</span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-sm font-black font-outfit text-foreground leading-none">
                      {averageCapabilityScore}
                    </span>
                    <span className="text-[9px] font-bold text-muted-foreground mt-1">Average Capability Score</span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-sm font-black font-outfit text-foreground leading-none">
                      {averageRepositoryImpact}
                    </span>
                    <span className="text-[9px] font-bold text-muted-foreground mt-1">Repository Impact</span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-sm font-black font-outfit text-foreground leading-none">
                      {verificationRate}%
                    </span>
                    <span className="text-[9px] font-bold text-muted-foreground mt-1">Verification Rate</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-bold text-foreground mt-2">Talent Quality Index</div>
                <div className="text-[11px] text-muted-foreground font-medium mt-1 leading-tight">
                  Ecosystem quality and maturity based on platform intelligence.
                </div>
                <div className="mt-3 flex flex-col gap-1 text-[10px] font-semibold text-muted-foreground">
                  <div>No quality metrics available</div>
                  <div className="text-[9px] font-medium text-muted/65 leading-relaxed">
                    Platform intelligence metrics will appear once verified talent and repositories are available.
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
}
