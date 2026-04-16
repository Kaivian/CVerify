import React from "react";
import { Typography } from "@heroui/react";
import { Card } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, Lightbulb } from "lucide-react";
import { RepositoryAnalysis } from "@/types/repository-analysis.types";

interface RecommendationPanelsProps {
  analysis: RepositoryAnalysis;
}

export const RecommendationPanels: React.FC<RecommendationPanelsProps> = ({
  analysis,
}) => {
  const { scoring } = analysis;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left font-sans select-none">
      {/* Strengths Card */}
      <Card className="border border-success/15 bg-success/5 p-6 rounded-2xl flex flex-col justify-between" glow={false}>
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-success/10 pb-3">
            <CheckCircle2 className="size-4.5 text-success shrink-0" />
            <Typography type="body-sm" className="font-extrabold text-foreground uppercase tracking-wider text-[10px]">
              Identified Strengths ({scoring.top_strengths.length})
            </Typography>
          </div>
          <ul className="space-y-2.5">
            {scoring.top_strengths.map((str, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80 leading-relaxed font-light">
                <span className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 shrink-0" />
                <span>{str}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {/* Risks Card */}
      <Card className="border border-danger/15 bg-danger/5 p-6 rounded-2xl flex flex-col justify-between" glow={false}>
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-danger/10 pb-3">
            <AlertTriangle className="size-4.5 text-danger shrink-0" />
            <Typography type="body-sm" className="font-extrabold text-foreground uppercase tracking-wider text-[10px]">
              Identified Risks & Gaps ({scoring.improvement_areas.length})
            </Typography>
          </div>
          <ul className="space-y-2.5">
            {scoring.improvement_areas.map((imp, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-foreground/80 leading-relaxed font-light">
                <span className="w-1.5 h-1.5 rounded-full bg-danger mt-1.5 shrink-0" />
                <span>{imp}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {/* Improvement Recommendations Card */}
      <Card className="md:col-span-2 border border-border/80 bg-surface p-6 rounded-2xl" glow={false}>
        <div className="flex items-center gap-2 border-b border-border/20 pb-3 mb-4">
          <Lightbulb className="size-4.5 text-warning shrink-0" />
          <Typography type="body-sm" className="font-extrabold text-foreground uppercase tracking-wider text-[10px]">
            AI-Generated Improvement Action Plan
          </Typography>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {scoring.improvement_areas.map((imp, idx) => {
            let actionTitle = "Process Improvement";
            let actionDesc = imp;
            if (imp.toLowerCase().includes("test")) {
              actionTitle = "Implement Test Suite";
              actionDesc = "Configure JUnit / JUnit5 or standard test runner and write unit tests to establish a verification baseline.";
            } else if (imp.toLowerCase().includes("ci/cd")) {
              actionTitle = "Configure CI/CD Pipelines";
              actionDesc = "Establish automated build pipelines (GitHub Actions, GitLab CI) to compile code and run tests on every pull request.";
            } else if (imp.toLowerCase().includes("commit") || imp.toLowerCase().includes("thưa")) {
              actionTitle = "Establish Git Branching Flow";
              actionDesc = "Transition from single-branch coding to feature branch workflows. Make smaller, structured commits to support contribution integrity.";
            } else if (imp.toLowerCase().includes("document")) {
              actionTitle = "Improve Documentation";
              actionDesc = "Draft comprehensive project guides, code block commentary, and API specifications to support code readability.";
            }

            return (
              <div
                key={idx}
                className="p-4 rounded-xl border border-border/60 bg-surface-secondary/40 space-y-2 text-left"
              >
                <span className="text-[9px] text-accent uppercase font-bold tracking-wide">
                  Step {idx + 1}: {actionTitle}
                </span>
                <Typography type="body-xs" className="text-foreground font-extrabold block">
                  {imp}
                </Typography>
                <Typography type="body-xs" className="text-muted leading-relaxed font-light">
                  {actionDesc}
                </Typography>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
export default RecommendationPanels;
