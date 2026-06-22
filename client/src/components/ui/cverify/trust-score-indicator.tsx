import React from "react";
import { ShieldCheck } from "lucide-react";

interface TrustScoreBadgeProps {
  score: number;
  className?: string;
  showTier?: boolean;
  tier?: string;
}

export const TrustScoreBadge: React.FC<TrustScoreBadgeProps> = ({
  score,
  className = "",
  showTier = false,
  tier,
}) => {
  // Determine color coding based on score
  let colorClasses = "bg-default/45 text-muted-foreground border border-default";
  if (score >= 80) {
    colorClasses = "bg-success/10 text-success border border-success/20";
  } else if (score >= 50) {
    colorClasses = "bg-warning/15 text-warning border border-warning/20";
  }

  const label = showTier && tier ? tier : `${score}% Trust`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase font-sans select-none transition-colors duration-300 ${colorClasses} ${className}`}
    >
      <ShieldCheck className="size-3 shrink-0" />
      <span>{label}</span>
    </span>
  );
};

interface TrustScoreDialProps {
  score: number;
  className?: string;
}

export const TrustScoreDial: React.FC<TrustScoreDialProps> = ({
  score,
  className = "",
}) => {
  // Safe math bounds
  const boundedScore = Math.min(Math.max(score, 0), 100);
  const normalizedScore = boundedScore % 1 === 0 ? boundedScore : boundedScore.toFixed(1);
  const strokeDashoffset = 314 - (314 * boundedScore) / 100;

  return (
    <div className={`flex flex-col items-center gap-1 select-none shrink-0 ${className}`}>
      <div className="relative w-20 h-20 flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 112 112">
          <circle
            cx="56"
            cy="56"
            r="50"
            className="stroke-border/20 fill-none"
            strokeWidth="5"
          />
          <circle
            cx="56"
            cy="56"
            r="50"
            className="transition-all duration-500 fill-none stroke-accent"
            strokeWidth="5"
            strokeDasharray="314"
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <div className="flex flex-col items-center">
          <span className="text-xl font-black font-outfit leading-none">{normalizedScore}</span>
          <span className="text-[7px] font-bold text-muted uppercase tracking-widest mt-0.5">SCORE</span>
        </div>
      </div>
    </div>
  );
};
