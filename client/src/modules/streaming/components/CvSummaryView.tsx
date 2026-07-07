import React from "react";
import { Chip } from "@heroui/react";
import { Crown, Sparkles } from "lucide-react";

interface CvSummaryViewProps {
  report: any;
}

export const CvSummaryView: React.FC<CvSummaryViewProps> = ({ report }) => {
  if (!report?.cvSynthesis) return null;
  const cv = report.cvSynthesis;

  const getOwnershipProfileClasses = (profile: string) => {
    switch (profile) {
      case "High contribution profile":
        return "bg-success/15 text-success border border-success/20";
      case "Standard contribution profile":
        return "bg-accent/15 text-accent border border-accent/20";
      case "Low contribution profile":
        return "bg-warning/15 text-warning border border-warning/20";
      case "External contributor context":
      default:
        return "bg-danger/15 text-danger border border-danger/20";
    }
  };

  return (
    <div className="flex flex-col gap-6 text-left font-sans w-full">
      {/* CV Header Info */}
      <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
            Professional Title
          </span>
          <h3 className="text-lg font-black text-foreground capitalize flex items-center gap-2">
            <Crown className="size-4.5 text-warning shrink-0" />
            {cv.title}
          </h3>
        </div>
        {cv.ownershipProfile && (
          <div className="flex flex-col items-start md:items-end gap-1">
            <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
              Ownership Profile
            </span>
            <Chip
              size="sm"
              variant="soft"
              className={`h-6 text-[10px] font-extrabold uppercase rounded-lg px-2.5 ${getOwnershipProfileClasses(cv.ownershipProfile)}`}
            >
              {cv.ownershipProfile}
            </Chip>
          </div>
        )}
      </div>

      {/* Narrative Summary */}
      <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3">
        <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
          Executive Summary
        </span>
        <p className="text-xs text-muted leading-relaxed font-light whitespace-pre-wrap">
          {cv.summary}
        </p>
      </div>

      {/* Skills Chips */}
      {cv.skills && cv.skills.length > 0 && (
        <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3">
          <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
            Core Technical Skills
          </span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {cv.skills.map((skill: string, idx: number) => (
              <Chip
                key={`${skill}-${idx}`}
                size="sm"
                variant="soft"
                className="h-5.5 text-[10px] font-bold bg-surface-secondary text-foreground border border-border/60 rounded-md"
              >
                {skill}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* Highlights Section */}
      {cv.highlights && cv.highlights.length > 0 && (
        <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3">
          <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
            Key Contributions & Highlights
          </span>
          <ul className="space-y-3 mt-1 pl-1">
            {cv.highlights.map((highlight: any, idx: number) => (
              <li key={idx} className="flex items-start gap-2 text-xs">
                <Sparkles className="size-3.5 text-accent shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="text-foreground font-bold leading-normal block">
                    {highlight.signal}
                  </strong>
                  <p className="text-muted leading-relaxed font-light">
                    {highlight.impact}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
export default CvSummaryView;
