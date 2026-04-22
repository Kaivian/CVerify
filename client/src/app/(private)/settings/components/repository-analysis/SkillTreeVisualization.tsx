import React from "react";
import { Chip, Typography } from "@heroui/react";
import {
  Code2,
  Database as DbIcon,
  Server,
  Terminal,
  ShieldCheck,
  FileCode,
  Layers,
  Settings,
  AlertCircle,
} from "lucide-react";
import type { RepositoryAnalysis, RepositoryEvidenceFinding } from "@/types/repository-analysis.types";

interface SkillTreeProps {
  analysis: RepositoryAnalysis;
}

export const SkillTreeVisualization: React.FC<SkillTreeProps> = ({ analysis }) => {
  const { findings = [] } = analysis;

  // Group findings by category
  const findingsByCategory = findings.reduce<Record<string, RepositoryEvidenceFinding[]>>((acc, f) => {
    const cat = f.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {});

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "backend":
        return <Server className="size-4 text-primary shrink-0" />;
      case "database":
        return <DbIcon className="size-4 text-success shrink-0" />;
      case "devops":
        return <Terminal className="size-4 text-warning shrink-0" />;
      case "frontend":
        return <Code2 className="size-4 text-accent shrink-0" />;
      case "security":
        return <ShieldCheck className="size-4 text-danger shrink-0" />;
      default:
        return <Layers className="size-4 text-muted shrink-0" />;
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) {
      return { label: "Verified Evidence", color: "success" as const };
    }
    if (confidence >= 50) {
      return { label: "Medium Confidence", color: "accent" as const };
    }
    return { label: "Inferred Finding", color: "default" as const };
  };

  const getEvidenceIcon = (type: string) => {
    switch (type) {
      case "file":
        return <FileCode className="size-3 text-muted-foreground shrink-0" />;
      case "dependency":
        return <Settings className="size-3 text-warning shrink-0" />;
      case "structure":
        return <Layers className="size-3 text-accent shrink-0" />;
      default:
        return <AlertCircle className="size-3 text-success shrink-0" />;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left font-sans select-none">
      {Object.entries(findingsByCategory).map(([category, list]) => (
        <div key={category} className="space-y-3.5">
          {/* Category Header */}
          <div className="flex items-center gap-2 border-b border-border/20 pb-2">
            {getCategoryIcon(category)}
            <Typography type="body-sm" className="font-extrabold text-foreground tracking-wide text-xs capitalize">
              {category}
            </Typography>
            <span className="text-[10px] text-muted font-normal">
              ({list.length} findings detected)
            </span>
          </div>

          {/* Skills Grid */}
          <div className="grid grid-cols-1 gap-4">
            {list.map((finding, idx) => {
              const badge = getConfidenceBadge(finding.confidence);
              return (
                <div
                  key={`${finding.finding}-${idx}`}
                  className="flex flex-col border border-border/80 bg-surface rounded-2xl p-4 space-y-3 hover:border-accent/40 hover:shadow-xs transition-all"
                >
                  {/* Header: Skill Name & Level & Confidence */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 text-left min-w-0">
                      <Typography className="text-sm font-extrabold text-foreground whitespace-normal wrap-break-word">
                        {finding.finding}
                      </Typography>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Chip
                          size="sm"
                          variant="soft"
                          color={badge.color}
                          className="h-4.5 px-1 text-[8.5px] uppercase font-extrabold"
                        >
                          {badge.label}
                        </Chip>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[8px] text-muted block uppercase tracking-wider">Confidence</span>
                      <strong className="text-sm text-foreground font-extrabold font-mono">
                        {finding.confidence}%
                      </strong>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed text-left font-light">
                    {finding.explanation}
                  </p>

                  {/* Evidence List */}
                  <div className="bg-surface-secondary/40 border border-border/40 rounded-xl p-2.5 space-y-2">
                    <span className="text-[8px] text-muted uppercase tracking-wider font-extrabold block">
                      Code Evidence & Signals
                    </span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {((finding.evidence && finding.evidence.length > 0)
                        ? finding.evidence
                        : (finding.evidence_signals || []).map((sig: string) => ({
                            type: "file" as const,
                            path: null as string | null,
                            line_range: null as string | null,
                            signal: sig,
                          }))
                      ).map((ev, evIdx: number) => (
                        <div
                          key={evIdx}
                          className="flex items-start gap-2 text-[10.5px] leading-relaxed text-foreground/80 font-mono"
                        >
                          <div className="mt-0.5 shrink-0">{getEvidenceIcon(ev.type)}</div>
                          <div className="flex-1 text-left whitespace-normal wrap-break-word">
                            {ev.path && (
                              <span className="text-accent/95 font-semibold mr-1.5 break-all select-all">
                                {ev.path}
                                {ev.line_range ? `:${ev.line_range}` : ""}
                              </span>
                            )}
                            <span className="text-muted-foreground font-light break-all select-all">
                              {ev.signal}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
