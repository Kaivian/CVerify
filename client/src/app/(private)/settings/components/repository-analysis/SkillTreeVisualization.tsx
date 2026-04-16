import React from "react";
import { Chip, Typography } from "@heroui/react";
import {
  Code2,
  Database as DbIcon,
  Server,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  FileCode,
  Layers,
  Settings,
  AlertCircle,
} from "lucide-react";
import { RepositoryAnalysis } from "@/types/repository-analysis.types";

interface SkillTreeProps {
  analysis: RepositoryAnalysis;
}

export const SkillTreeVisualization: React.FC<SkillTreeProps> = ({ analysis }) => {
  const { skill_tree } = analysis;

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

  const getLevelColor = (level: "beginner" | "intermediate" | "advanced") => {
    switch (level) {
      case "advanced":
        return "success";
      case "intermediate":
        return "accent";
      case "beginner":
        return "default";
      default:
        return "default";
    }
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
    <div className="space-y-6 text-left font-sans select-none">
      {Object.entries(skill_tree).map(([category, skills]) => (
        <div key={category} className="space-y-3.5">
          {/* Category Header */}
          <div className="flex items-center gap-2 border-b border-border/20 pb-2">
            {getCategoryIcon(category)}
            <Typography type="body-sm" className="font-extrabold text-foreground tracking-wide text-xs">
              {category}
            </Typography>
            <span className="text-[10px] text-muted font-normal">
              ({Object.keys(skills).length} skills detected)
            </span>
          </div>

          {/* Skills Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(skills).map(([skillName, details]) => (
              <div
                key={skillName}
                className="flex flex-col border border-border/80 bg-surface rounded-2xl p-4 space-y-3 hover:border-accent/40 hover:shadow-xs transition-all"
              >
                {/* Header: Skill Name & Level & Confidence */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 text-left min-w-0">
                    <Typography className="text-sm font-extrabold text-foreground truncate">
                      {skillName}
                    </Typography>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Chip
                        size="sm"
                        variant="soft"
                        color={getLevelColor(details.level)}
                        className="h-4.5 px-1 text-[8.5px] uppercase font-extrabold"
                      >
                        {details.level}
                      </Chip>
                      <Chip
                        size="sm"
                        variant="soft"
                        color={details.evidence_type === "verified" ? "success" : "default"}
                        className={`h-4.5 px-1 text-[8.5px] uppercase font-extrabold ${
                          details.evidence_type === "verified"
                            ? ""
                            : "bg-foreground/5 text-muted-foreground"
                        }`}
                      >
                        <span className="flex items-center gap-0.5">
                          {details.evidence_type === "verified" ? (
                            <CheckCircle2 className="size-2 text-success shrink-0" />
                          ) : (
                            <HelpCircle className="size-2 text-muted-foreground shrink-0" />
                          )}
                          <span>{details.evidence_type}</span>
                        </span>
                      </Chip>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[8px] text-muted block uppercase tracking-wider">Confidence</span>
                    <strong className="text-sm text-foreground font-extrabold font-mono">
                      {(details.confidence * 100).toFixed(0)}%
                    </strong>
                  </div>
                </div>

                {/* Evidence List */}
                <div className="bg-surface-secondary/40 border border-border/40 rounded-xl p-2.5 space-y-2">
                  <span className="text-[8px] text-muted uppercase tracking-wider font-extrabold block">
                    Code Evidence & Signals
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {details.evidence.map((ev, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 text-[10.5px] leading-relaxed text-foreground/80 font-mono"
                      >
                        <div className="mt-0.5 shrink-0">{getEvidenceIcon(ev.type)}</div>
                        <div className="flex-1 truncate">
                          {ev.path && (
                            <span className="text-accent/95 font-semibold mr-1.5 break-all select-all">
                              {ev.path}
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
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
