import React from "react";
import { Typography } from "@heroui/react";
import {
  Server,
  ShieldCheck,
  Layers,
  CheckCircle2,
} from "lucide-react";
import type { RepositoryAnalysis } from "@/types/repository-analysis.types";

interface SkillTreeProps {
  analysis: RepositoryAnalysis;
}

export const SkillTreeVisualization: React.FC<SkillTreeProps> = ({ analysis }) => {
  const sections = analysis.sections || [];

  const getCategoryIcon = (type: string) => {
    switch (type) {
      case "engineering_practices":
        return <Server className="size-4 text-primary shrink-0" />;
      case "architecture_insights":
        return <Layers className="size-4 text-success shrink-0" />;
      case "security_findings":
        return <ShieldCheck className="size-4 text-danger shrink-0" />;
      default:
        return <Layers className="size-4 text-muted shrink-0" />;
    }
  };

  const getCategoryLabel = (type: string) => {
    switch (type) {
      case "engineering_practices":
        return "Engineering Practices & Controls";
      case "architecture_insights":
        return "Architecture Insights & Patterns";
      case "security_findings":
        return "Security Findings & Warnings";
      default:
        return type;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left font-sans select-none">
      {sections.map((section) => (
        <div key={section.type} className="space-y-3.5">
          {/* Category Header */}
          <div className="flex items-center gap-2 border-b border-border/20 pb-2">
            {getCategoryIcon(section.type)}
            <Typography type="body-sm" className="font-extrabold text-foreground tracking-wide text-xs capitalize">
              {getCategoryLabel(section.type)}
            </Typography>
            <span className="text-[10px] text-muted font-normal">
              ({section.items?.length ?? 0} signals)
            </span>
          </div>

          {/* Skills Grid */}
          <div className="grid grid-cols-1 gap-4">
            {section.items?.map((item, idx) => {
              const displayTitle = typeof item === "string" ? item : (item?.title || "Signal Detail");
              const displayContent = typeof item === "string" ? "" : (item?.content || "");
              return (
                <div
                  key={`${displayTitle}-${idx}`}
                  className="flex flex-col border border-border/80 bg-surface rounded-2xl p-4 space-y-3 hover:border-accent/40 hover:shadow-xs transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 text-left min-w-0 flex flex-col gap-1 w-full">
                      <div className="flex items-start gap-2 w-full">
                        <CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" />
                        <Typography className="text-xs font-semibold text-foreground whitespace-normal wrap-break-word">
                          {displayTitle}
                        </Typography>
                      </div>
                      {displayContent && (
                        <p className="text-[10.5px] text-muted-foreground leading-relaxed pl-6 font-light">
                          {displayContent}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {(!section.items || section.items.length === 0) && (
              <div className="text-xs text-muted-foreground italic font-light py-2">
                No signals recorded for this category.
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SkillTreeVisualization;
