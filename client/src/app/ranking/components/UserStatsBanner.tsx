"use client";

import React from "react";
import { type User } from "@/types/auth.types";
import { type RankingResponseItem } from "@/types/profile.types";
import { Info, ShieldCheck, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@heroui/react";

interface UserStatsBannerProps {
  totalCount: number;
  user: User | null;
  candidates: RankingResponseItem[];
}

export const UserStatsBanner: React.FC<UserStatsBannerProps> = ({
  totalCount,
  user,
  candidates,
}) => {
  const formatNumber = (num: number) => num.toLocaleString();

  // Find if current user profile is in the active candidates list
  const myCandidate = user
    ? candidates.find((c) => c.username === user.username || c.candidateId === user.id)
    : null;

  const content = React.useMemo(() => {
    if (user) {
      if (myCandidate) {
        return (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <ShieldCheck className="size-4 text-accent shrink-0" />
            <span>
              Your profile is currently ranked{" "}
              <strong className="text-foreground font-black font-outfit text-sm">
                #{myCandidate.globalRankPosition}
              </strong>{" "}
              of{" "}
              <strong className="text-foreground font-bold">
                {formatNumber(totalCount)}
              </strong>{" "}
              candidates. Identity Trust Score:{" "}
              <strong className="text-accent font-black font-outfit inline-flex items-center gap-1">
                {myCandidate.trustScore}%
                <Tooltip delay={0}>
                  <Tooltip.Trigger className="inline-flex items-center cursor-help">
                    <Info className="size-3 text-muted-foreground/60" />
                  </Tooltip.Trigger>
                  <Tooltip.Content className="max-w-xs bg-surface border border-border p-2.5 shadow-md rounded-xl text-[10px] font-semibold leading-relaxed text-muted-foreground normal-case font-sans">
                    Identity Trust measures verification of KYC, mobile, and domain authenticity. For CV skill verification coverage, see your 100% Evidence Trust Score under My CV.
                  </Tooltip.Content>
                </Tooltip>
              </strong>.
            </span>
          </div>
        );
      } else {
        return (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <ShieldCheck className="size-4 text-muted-foreground shrink-0" />
            <span>
              Welcome,{" "}
              <strong className="text-foreground font-bold">
                {user.fullName || user.username}
              </strong>. Complete more assessments or verify repositories to rank among the{" "}
              <strong className="text-foreground font-bold">
                {formatNumber(totalCount)}
              </strong>{" "}
              candidates.
            </span>
          </div>
        );
      }
    }

    return (
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Users className="size-4 text-accent shrink-0" />
        <span>
          CVerify indexes{" "}
          <strong className="text-foreground font-black font-outfit">
            {formatNumber(totalCount)}
          </strong>{" "}
          verified software engineers based on repository and code authorship analysis.
        </span>
      </div>
    );
  }, [user, myCandidate, totalCount]);

  return (
    <div className="w-full flex justify-center mb-6 px-2 select-none">
      <Card
        glow={false}
        rounded="full"
        className="w-full max-w-2xl px-6 py-2.5 bg-accent/5 border border-accent/25 text-center text-xs font-semibold text-muted-foreground shadow-xs flex items-center justify-center min-h-[42px]"
      >
        {content}
      </Card>
    </div>
  );
};
