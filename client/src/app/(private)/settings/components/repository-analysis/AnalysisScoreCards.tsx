import React from "react";
import { ProgressBar, Typography } from "@heroui/react";
import { Card } from "@/components/ui/card";
import { Award, Zap, Shield, Sparkles, Star } from "lucide-react";
import type { RepositoryAnalysis } from "@/types/repository-analysis.types";

interface AnalysisScoreCardsProps {
  analysis: RepositoryAnalysis;
}

export const AnalysisScoreCards: React.FC<AnalysisScoreCardsProps> = ({
  analysis,
}) => {
  const {
    evidence_points = { total: 0, breakdown: {} },
    classification = { primary_type: "Unclassified", complexity: "low", benchmark_group: "unclassified" }
  } = analysis;

  const getProgressColor = (points: number) => {
    if (points >= 200) return "success";
    if (points >= 50) return "accent";
    return "danger";
  };

  return (
    <div className="space-y-6 text-left font-sans select-none">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Large Evidence Points Card */}
        <Card className="lg:col-span-1 border border-border/80 bg-surface p-6 flex flex-col items-center justify-center text-center rounded-2xl" glow={false}>
          <Typography type="body-xs" className="text-muted font-bold uppercase tracking-wider text-[9px] mb-2">
            Evidence Strength
          </Typography>
          <div
            className={`w-24 h-24 rounded-full flex flex-col items-center justify-center border-4 border-accent/30 bg-accent/5 text-accent mb-4`}
          >
            <span className="text-3xl font-black font-display tracking-tight leading-none">
              {evidence_points.total}
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-85 mt-0.5">
              Total EP
            </span>
          </div>
          <Typography className="text-lg font-black text-foreground">
            {classification.primary_type}
          </Typography>
          <span className="text-[10px] text-muted max-w-xs mt-1 block">
            Complexity: <strong className="capitalize">{classification.complexity || "medium"}</strong>. Benchmarked against <strong>{classification.benchmark_group?.replace("_", " ") || "repositories"}</strong>.
          </span>
        </Card>

        {/* Breakdown Panel */}
        <Card className="lg:col-span-2 border border-border/80 bg-surface p-6 rounded-2xl" glow={false}>
          <div className="flex items-center gap-1.5 mb-5 border-b border-border/20 pb-3">
            <Zap className="size-4 text-accent" />
            <Typography type="body-sm" className="font-extrabold text-foreground uppercase tracking-wider text-[10px]">
              Evidence Category Breakdown
            </Typography>
          </div>

          <div className="space-y-5">
            {Object.entries(evidence_points.breakdown).map(([category, points]) => (
              <div key={category} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-foreground flex items-center gap-1 capitalize">
                    {category === "backend" && <Award className="size-3 text-primary" />}
                    {category === "frontend" && <Sparkles className="size-3 text-success" />}
                    {category === "security" && <Shield className="size-3 text-danger" />}
                    {category !== "backend" && category !== "frontend" && category !== "security" && <Star className="size-3 text-muted" />}
                    {category}
                  </span>
                  <span className="font-extrabold text-foreground font-mono">
                    {points} EP
                  </span>
                </div>
                <ProgressBar
                  aria-label={category}
                  value={Math.min(100, (points / 300) * 100)} // Scaled visually relative to 300 EP max
                  color={getProgressColor(points)}
                  size="sm"
                  className="w-full"
                >
                  <ProgressBar.Track>
                    <ProgressBar.Fill />
                  </ProgressBar.Track>
                </ProgressBar>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
export default AnalysisScoreCards;
