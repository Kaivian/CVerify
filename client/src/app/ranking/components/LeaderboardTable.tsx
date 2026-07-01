"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { type User } from "@/types/auth.types";
import { type RankingResponseItem } from "@/types/profile.types";
import {
  Trophy,
  GitFork,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Minus,
  Plus,
  Check,
  ChevronRight,
  Info
} from "lucide-react";
import { Avatar, Button, Chip, Spinner, Tooltip } from "@heroui/react";
import { TrustScoreBadge, TrustScoreDial } from "@/components/ui/cverify/trust-score-indicator";

interface LeaderboardTableProps {
  candidates: RankingResponseItem[];
  user: User | null;
  followLoading: Record<string, boolean>;
  handleFollowToggle: (candidate: RankingResponseItem) => void;
  selectedSkills: string[];
  pushFiltersToUrl: (updates: { skills: string[]; page: number }) => void;
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  candidates,
  user,
  followLoading,
  handleFollowToggle,
  selectedSkills,
  pushFiltersToUrl,
}) => {
  const router = useRouter();

  // Helper: Rank Movement Delta
  const renderRankDelta = (current: number, previous: number) => {
    if (!previous || previous === 0) {
      return (
        <span className="bg-success/15 text-success border border-success/35 px-1.5 py-0.5 rounded-md text-[8px] font-black tracking-widest leading-none select-none">
          NEW
        </span>
      );
    }

    if (current === previous) {
      return (
        <Tooltip delay={0}>
          <Tooltip.Trigger className="inline-flex items-center cursor-help">
            <Minus className="size-3.5 text-muted-foreground/60" />
          </Tooltip.Trigger>
          <Tooltip.Content className="max-w-xs bg-surface border border-border p-2 shadow-md rounded-lg text-[9px] font-semibold leading-relaxed text-muted-foreground normal-case">
            Rank unchanged
          </Tooltip.Content>
        </Tooltip>
      );
    }

    if (current < previous) {
      const diff = previous - current;
      return (
        <div className="flex items-center gap-0.5 text-success font-black text-[10px]">
          <ArrowUp className="size-3 stroke-3" />
          <span>{diff}</span>
        </div>
      );
    } else {
      const diff = current - previous;
      return (
        <div className="flex items-center gap-0.5 text-danger font-black text-[10px]">
          <ArrowDown className="size-3 stroke-3" />
          <span>{diff}</span>
        </div>
      );
    }
  };

  const handleSkillSelect = (skillName: string | null) => {
    if (!skillName) return;
    if (!selectedSkills.includes(skillName)) {
      pushFiltersToUrl({ skills: [...selectedSkills, skillName], page: 1 });
    }
  };

  return (
    <div className="w-full flex flex-col gap-3 select-none">
      {/* Header labels - Hidden on small screen viewports */}
      <div className="hidden md:grid grid-cols-[60px_2.6fr_1.8fr_1.7fr_0.9fr_1fr_0.8fr_150px] items-center px-6 py-2.5 gap-4 text-[10px] font-bold text-muted uppercase tracking-wider">
        <span className="whitespace-nowrap">Rank</span>
        <span className="whitespace-nowrap">Engineer</span>
        <span className="whitespace-nowrap">Capabilities</span>
        <span className="whitespace-nowrap">Evidence</span>
        <span className="text-center whitespace-nowrap flex items-center justify-center gap-1">
          <span>CV Score</span>
          <Tooltip delay={0}>
            <Tooltip.Trigger className="inline-flex items-center cursor-help">
              <Info className="size-3 text-muted-foreground/60" />
            </Tooltip.Trigger>
            <Tooltip.Content className="max-w-xs bg-surface border border-border p-2.5 shadow-md rounded-xl text-[10px] font-semibold leading-relaxed text-muted-foreground normal-case">
              AI-derived capability score (0-100) based on repository complexity and CV depth.
            </Tooltip.Content>
          </Tooltip>
        </span>
        <span className="text-center whitespace-nowrap flex items-center justify-center gap-1">
          <span>Rank Score</span>
          <Tooltip delay={0}>
            <Tooltip.Trigger className="inline-flex items-center cursor-help">
              <Info className="size-3 text-muted-foreground/60" />
            </Tooltip.Trigger>
            <Tooltip.Content className="max-w-xs bg-surface border border-border p-2.5 shadow-md rounded-xl text-[10px] font-semibold leading-relaxed text-muted-foreground normal-case">
              Composite ranking score (0-100) combining CV capability (35%), Identity Trust (35%), completeness (15%), and OSS impact (15%).
            </Tooltip.Content>
          </Tooltip>
        </span>
        <span className="text-center whitespace-nowrap flex items-center justify-center gap-1">
          <span>Trust</span>
          <Tooltip delay={0}>
            <Tooltip.Trigger className="inline-flex items-center cursor-help">
              <Info className="size-3 text-muted-foreground/60" />
            </Tooltip.Trigger>
            <Tooltip.Content className="max-w-xs bg-surface border border-border p-2.5 shadow-md rounded-xl text-[10px] font-semibold leading-relaxed text-muted-foreground normal-case">
              Identity Trust Score (0-100%) validating candidate authenticity (KYC, OTP, DNS match, and commit signatures).
            </Tooltip.Content>
          </Tooltip>
        </span>
        <span className="text-right whitespace-nowrap">Actions</span>
      </div>

      {/* Row List */}
      <div className="flex flex-col gap-3">
        {candidates.map((candidate, index) => {
          const isMe = user && (candidate.username === user.username || candidate.candidateId === user.id);
          const initials = candidate.fullName
            ? candidate.fullName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()
            : "U";

          return (
            <div
              key={candidate.candidateId ?? `candidate-${index}`}
              className={`grid grid-cols-1 md:grid-cols-[60px_2.6fr_1.8fr_1.7fr_0.9fr_1fr_0.8fr_150px] items-center gap-4 px-6 py-4 rounded-2xl border transition-all duration-200 ${isMe
                ? "bg-accent/5 border-accent/70 shadow-xs"
                : "bg-surface border-border/60 hover:border-border"
                }`}
            >
              {/* CELL 1: Rank Position & delta */}
              <div className="flex items-center md:flex-col md:justify-center md:items-center justify-between border-b md:border-b-0 border-border/20 pb-2.5 md:pb-0">
                <span className="text-sm font-black text-muted-foreground uppercase tracking-wider text-[10px] md:hidden">
                  Leaderboard Rank
                </span>
                <div className="flex md:flex-col items-center justify-center gap-1.5 md:gap-1">
                  <span className="text-xl font-black font-outfit text-foreground leading-none">
                    #{candidate.globalRankPosition}
                  </span>
                  <div className="flex items-center justify-center min-h-[14px]">
                    {renderRankDelta(candidate.globalRankPosition, candidate.previousGlobalRankPosition)}
                  </div>
                </div>
              </div>

              {/* CELL 2: Engineer identity */}
              <div className="flex items-center gap-3.5 min-w-0">
                <Avatar
                  className="size-11 rounded-xl border border-border/40 font-black font-outfit text-sm shrink-0"
                >
                  {candidate.avatarUrl && (
                    <Avatar.Image src={candidate.avatarUrl} alt={candidate.fullName} />
                  )}
                  <Avatar.Fallback className="font-bold text-xs">
                    {initials}
                  </Avatar.Fallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className="text-sm font-black text-foreground hover:text-accent cursor-pointer line-clamp-2 break-words"
                      onClick={() => router.push(`/${candidate.username || candidate.candidateId}`)}
                    >
                      {candidate.fullName}
                    </span>
                    {isMe && (
                      <span className="bg-accent/15 text-accent border border-accent/35 px-1.5 py-0.5 rounded-md text-[8px] font-black tracking-widest leading-none">
                        Your Profile
                      </span>
                    )}
                  </div>
                  {candidate.username && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      @{candidate.username}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground font-semibold line-clamp-2 break-words mt-0.5 leading-normal">
                    {candidate.headline || "Verified Talent"}
                  </span>
                </div>
              </div>

              {/* CELL 3: Capabilities (top skill badges) - Collapsed or styled layout */}
              <div className="flex flex-col md:flex-row flex-wrap gap-1.5">
                <span className="text-sm font-black text-muted-foreground uppercase tracking-wider text-[10px] md:hidden">
                  Primary Skills
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.topCapabilities && candidate.topCapabilities.filter((c) => c.name).length > 0 ? (
                    candidate.topCapabilities.filter((c) => c.name).slice(0, 3).map((cap) => (
                      <Chip
                        key={cap.name}
                        size="sm"
                        aria-label={`${cap.name} ${cap.score}%`}
                        className="bg-surface-secondary text-foreground border border-border/40 font-bold hover:border-border/80 cursor-pointer scale-90 origin-left"
                        onClick={() => handleSkillSelect(cap.name)}
                      >
                        <Chip.Label>
                          {cap.name} <span className="text-muted ml-0.5">{cap.score}%</span>
                        </Chip.Label>
                      </Chip>
                    ))
                  ) : (
                    <span className="text-[10px] text-muted font-medium italic">No verified skills listed</span>
                  )}
                </div>
              </div>

              {/* CELL 4: Evidence indicators */}
              <div className="flex items-center md:flex-col md:items-start md:justify-center justify-between gap-1 text-[10px] text-muted-foreground font-semibold">
                <span className="text-sm font-black text-muted-foreground uppercase tracking-wider text-[10px] md:hidden">
                  Engineering Evidence
                </span>
                <div className="flex flex-col gap-1.5 w-full md:w-auto">
                  {candidate.verifiedRepoCount > 0 && (
                    <div className="flex items-center gap-1.5 text-primary">
                      <GitFork className="size-3.5 animate-pulse" />
                      <span className="whitespace-nowrap">{candidate.verifiedRepoCount} Verified Repos</span>
                    </div>
                  )}
                  {candidate.verifiedContributionCount > 0 && (
                    <div className="flex items-center gap-1.5 text-success">
                      <CheckCircle className="size-3.5" />
                      <span className="whitespace-nowrap">{candidate.verifiedContributionCount} Verifications</span>
                    </div>
                  )}
                  {candidate.totalStarsCount > 0 && (
                    <div className="flex items-center gap-1.5 text-warning">
                      <Trophy className="size-3.5" />
                      <span className="whitespace-nowrap">{candidate.totalStarsCount} Stars Count</span>
                    </div>
                  )}
                  {candidate.verifiedRepoCount === 0 && candidate.verifiedContributionCount === 0 && (
                    <span className="text-[10px] text-muted font-medium italic whitespace-nowrap">No public evidence verified</span>
                  )}
                </div>
              </div>

              {/* CELL 5: CV Score */}
              <div className="flex items-center md:justify-center justify-between border-t md:border-t-0 border-border/20 pt-2.5 md:pt-0">
                <span className="text-sm font-black text-muted-foreground uppercase tracking-wider text-[10px] md:hidden">
                  CV Score
                </span>
                <div className="flex items-center gap-1.5">
                  <Trophy className="size-3.5 text-accent" />
                  <span className="text-lg font-black font-outfit text-foreground leading-none">
                    {candidate.aiScore ? candidate.aiScore.toFixed(0) : "—"}
                  </span>
                </div>
              </div>

              {/* CELL 5.5: Rank Score (Composite Score) */}
              <div className="flex items-center md:justify-center justify-between border-t md:border-t-0 border-border/20 pt-2.5 md:pt-0">
                <span className="text-sm font-black text-muted-foreground uppercase tracking-wider text-[10px] md:hidden">
                  Rank Score
                </span>
                <div className="flex items-center gap-1.5">
                  <Trophy className="size-3.5 text-warning" />
                  <span className="text-lg font-black font-outfit text-foreground leading-none">
                    {candidate.compositeScore.toFixed(0)}
                  </span>
                </div>
              </div>

              {/* CELL 6: Trust score (Badge on mobile, dial on desktop) */}
              <div className="flex items-center md:justify-center justify-between border-t md:border-t-0 border-border/20 pt-2.5 md:pt-0">
                <span className="text-sm font-black text-muted-foreground uppercase tracking-wider text-[10px] md:hidden">
                  Trust Indicator
                </span>
                <div>
                  <div className="hidden md:block">
                    <TrustScoreDial score={candidate.trustScore} className="scale-75" />
                  </div>
                  <div className="md:hidden">
                    <TrustScoreBadge score={candidate.trustScore} />
                  </div>
                </div>
              </div>

              {/* CELL 6: Profile Actions */}
              <div className="flex md:justify-end justify-between items-center gap-2 border-t md:border-t-0 border-border/20 pt-2.5 md:pt-0">
                <span className="text-sm font-black text-muted-foreground uppercase tracking-wider text-[10px] md:hidden">
                  Profile Operations
                </span>
                <div className="flex items-center gap-2 shrink-0 select-none w-full md:w-auto justify-end">
                  <Button
                    size="sm"
                    isIconOnly
                    className={`rounded-xl h-8 w-8 min-w-0 p-0 cursor-pointer border ${candidate.isFollowedByCurrentUser
                      ? "bg-surface-secondary text-foreground hover:bg-surface-tertiary border-border"
                      : "bg-accent/10 text-accent border-accent/20 hover:bg-accent/20"
                      }`}
                    aria-label={candidate.isFollowedByCurrentUser ? "Unfollow" : "Follow"}
                    isDisabled={followLoading[candidate.candidateId]}
                    onClick={() => handleFollowToggle(candidate)}
                  >
                    {followLoading[candidate.candidateId] ? (
                      <Spinner size="sm" color="current" className="size-3.5" />
                    ) : candidate.isFollowedByCurrentUser ? (
                      <Check className="size-4 stroke-[2.5]" />
                    ) : (
                      <Plus className="size-4 stroke-[2.5]" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="font-bold border border-border/60 hover:bg-surface-secondary rounded-xl py-1.5 px-3.5 text-xs h-8 cursor-pointer"
                    onClick={() => router.push(`/${candidate.username || candidate.candidateId}`)}
                  >
                    <span className="hidden md:inline">View Profile</span>
                    <ChevronRight className="size-4 md:hidden" />
                  </Button>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};
