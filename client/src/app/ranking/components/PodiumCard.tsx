"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { type RankingResponseItem } from "@/types/profile.types";
import { Avatar } from "@heroui/react";
import { Trophy, ShieldCheck, GitFork, Clock } from "lucide-react";

interface PodiumCardProps {
  candidate: RankingResponseItem;
  rank: 1 | 2 | 3;
}

export const PodiumCard: React.FC<PodiumCardProps> = ({ candidate, rank }) => {
  const router = useRouter();

  const isFirst = rank === 1;
  const isSecond = rank === 2;
  const isThird = rank === 3;

  // Rank badge color tokens based on place
  const badgeColorClass = isFirst
    ? "bg-warning text-warning-foreground border-warning/30"
    : isSecond
    ? "bg-default-300 text-default-foreground border-default-400/30"
    : "bg-amber-700 text-amber-50 border-amber-800/30";

  // Pedestal height and border styling
  const heightClass = isFirst ? "min-h-[170px]" : isSecond ? "min-h-[140px]" : "min-h-[125px]";
  const borderGlowClass = isFirst
    ? "border-warning/30 shadow-warning/5"
    : isSecond
    ? "border-default-400/20 shadow-default-400/5"
    : "border-amber-800/20 shadow-amber-800/5";

  const handleProfileNavigation = () => {
    router.push(`/${candidate.username || candidate.candidateId}`);
  };

  // Format last updated timestamp gracefully
  const formatLastUpdated = (dateString?: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      if (diffHours < 1) return "Just updated";
      if (diffHours < 24) return `Updated ${diffHours}h ago`;
      if (diffDays === 1) return "Updated yesterday";
      return `Updated ${diffDays}d ago`;
    } catch {
      return null;
    }
  };

  const lastUpdated = formatLastUpdated(candidate.lastUpdatedAt);

  const initials = candidate.fullName
    ? candidate.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  return (
    <div className="flex flex-col items-center justify-end w-full group relative">
      {/* Candidate identity & Avatar */}
      <div className="flex flex-col items-center gap-2 mb-3 relative z-10 w-full px-2">
        <div 
          className="relative cursor-pointer select-none transition-transform duration-200 hover:scale-105" 
          onClick={handleProfileNavigation}
        >
          <Avatar
            className={`${
              isFirst ? "w-24 h-24 text-2xl" : isSecond ? "w-20 h-20 text-xl" : "w-16 h-16 text-lg"
            } rounded-2xl border-2 font-black font-outfit ${
              isFirst ? "border-warning" : isSecond ? "border-default-400" : "border-amber-700"
            }`}
          >
            {candidate.avatarUrl && (
              <Avatar.Image src={candidate.avatarUrl} alt={candidate.fullName} />
            )}
            <Avatar.Fallback className="font-black text-xs">
              {initials}
            </Avatar.Fallback>
          </Avatar>
          {/* Rank Badge */}
          <span 
            className={`absolute -top-2 -left-2 text-xs font-black rounded-md w-6 h-6 flex items-center justify-center border shadow-sm ${badgeColorClass}`}
          >
            {rank}
          </span>
        </div>

        {/* Name and Professional Headline */}
        <div className="flex flex-col items-center min-w-0 w-full text-center">
          <span
            className="font-black text-foreground hover:text-accent cursor-pointer truncate w-full text-xs md:text-sm"
            onClick={handleProfileNavigation}
          >
            {candidate.fullName}
          </span>
          <span className="text-[10px] text-muted-foreground font-semibold truncate w-full">
            {candidate.headline || candidate.primaryDomain || "Verified Software Engineer"}
          </span>
        </div>
      </div>

      {/* Pedestal Structure */}
      <div className="w-full relative mt-1 flex flex-col items-center">
        {/* Top slanted face (perspective effect) */}
        <div 
          className={`h-6 w-full bg-linear-to-r from-surface-secondary to-surface border-t ${
            isFirst ? "border-warning/30" : isSecond ? "border-default-400/30" : "border-amber-700/30"
          } opacity-85`}
          style={{ clipPath: "polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%)" }}
        />
        
        {/* Front rectangular face */}
        <div 
          className={`w-full bg-linear-to-b from-surface-secondary/40 to-transparent border-x border-b border-border/40 rounded-b-2xl flex flex-col items-center justify-center p-4 gap-2.5 shadow-md ${heightClass} ${borderGlowClass}`}
        >
          {/* Composite Score (Primary Metric) */}
          <div className="flex items-center gap-1.5 bg-surface/40 px-2.5 py-1 rounded-lg border border-border/20 w-full justify-center">
            <Trophy className="size-3.5 text-warning" />
            <div className="flex flex-col items-start leading-none">
              <span className="text-xs font-bold text-muted uppercase tracking-wider text-[8px]">Score</span>
              <span className="text-sm font-black font-outfit text-foreground">{candidate.compositeScore.toFixed(0)}</span>
            </div>
          </div>

          {/* Trust Score */}
          <div className="flex items-center gap-1.5 bg-surface/40 px-2.5 py-1 rounded-lg border border-border/20 w-full justify-center">
            <ShieldCheck className="size-3.5 text-accent" />
            <div className="flex flex-col items-start leading-none">
              <span className="text-xs font-bold text-muted uppercase tracking-wider text-[8px]">Trust</span>
              <span className="text-sm font-black font-outfit text-foreground">{candidate.trustScore}%</span>
            </div>
          </div>

          {/* Verified Repos (Additional highlight on taller first-place pedestal) */}
          {isFirst && (
            <div className="flex items-center gap-1.5 bg-surface/40 px-2.5 py-1 rounded-lg border border-border/20 w-full justify-center">
              <GitFork className="size-3.5 text-primary" />
              <div className="flex flex-col items-start leading-none">
                <span className="text-xs font-bold text-muted uppercase tracking-wider text-[8px]">Repos</span>
                <span className="text-xs font-black font-outfit text-foreground">{candidate.verifiedRepoCount} Verified</span>
              </div>
            </div>
          )}

          {/* Last updated footer inside first place pedestal */}
          {isFirst && lastUpdated && (
            <div className="flex items-center gap-1 text-[8px] text-muted-foreground font-semibold mt-1">
              <Clock className="size-2.5" />
              <span>{lastUpdated}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
