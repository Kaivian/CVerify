import React from "react";
import { ProgressBar, Typography } from "@heroui/react";
import { Card } from "@/components/ui/card";
import { Award, Zap, Shield, Sparkles, Star } from "lucide-react";
import { RepositoryAnalysis } from "@/types/repository-analysis.types";

interface AnalysisScoreCardsProps {
  analysis: RepositoryAnalysis;
}

export const AnalysisScoreCards: React.FC<AnalysisScoreCardsProps> = ({
  analysis,
}) => {
  const { scoring } = analysis;

  const getBandColor = (band: string) => {
    switch (band.toUpperCase()) {
      case "A":
      case "B":
        return "text-success border-success/30 bg-success/5";
      case "C":
        return "text-warning border-warning/30 bg-warning/5";
      case "D":
      case "F":
        return "text-danger border-danger/30 bg-danger/5";
      default:
        return "text-muted border-border bg-foreground/5";
    }
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return "success";
    if (score >= 50) return "accent";
    return "danger";
  };

  return (
    <div className="space-y-6 text-left font-sans select-none">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Large Grade Card */}
        <Card className="lg:col-span-1 border border-border/80 bg-surface p-6 flex flex-col items-center justify-center text-center rounded-2xl" glow={false}>
          <Typography type="body-xs" className="text-muted font-bold uppercase tracking-wider text-[9px] mb-2">
            Overall AI Quality Grade
          </Typography>
          <div
            className={`w-24 h-24 rounded-full flex flex-col items-center justify-center border-4 ${getBandColor(
              scoring.band
            )} mb-4`}
          >
            <span className="text-4xl font-black font-display tracking-tight leading-none">
              {scoring.band}
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-85 mt-0.5">
              Grade
            </span>
          </div>
          <Typography className="text-lg font-black text-foreground">
            {scoring.final_score} / 100
          </Typography>
          <span className="text-[10px] text-muted max-w-xs mt-1 block">
            Calculated from raw score of <strong>{scoring.raw_score}</strong> scaled by integrity multipliers.
          </span>
        </Card>

        {/* Breakdown Panel */}
        <Card className="lg:col-span-2 border border-border/80 bg-surface p-6 rounded-2xl" glow={false}>
          <div className="flex items-center gap-1.5 mb-5 border-b border-border/20 pb-3">
            <Zap className="size-4 text-accent" />
            <Typography type="body-sm" className="font-extrabold text-foreground uppercase tracking-wider text-[10px]">
              Core Scoring Dimensions
            </Typography>
          </div>

          <div className="space-y-5">
            {/* Technical Depth */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-foreground flex items-center gap-1">
                  <Award className="size-3 text-primary" /> Technical Depth
                </span>
                <span className="font-extrabold text-foreground font-mono">
                  {scoring.dimension_breakdown.technical_depth.score}%
                </span>
              </div>
              <ProgressBar
                aria-label="Technical Depth"
                value={scoring.dimension_breakdown.technical_depth.score}
                color={getProgressColor(scoring.dimension_breakdown.technical_depth.score)}
                size="sm"
                className="w-full"
              >
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
              <span className="text-[10px] text-muted block leading-relaxed font-light">
                {scoring.dimension_breakdown.technical_depth.note}
              </span>
            </div>

            {/* Code Quality Signals */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-foreground flex items-center gap-1">
                  <Sparkles className="size-3 text-success" /> Code Quality Signals
                </span>
                <span className="font-extrabold text-foreground font-mono">
                  {scoring.dimension_breakdown.code_quality_signals.score}%
                </span>
              </div>
              <ProgressBar
                aria-label="Code Quality Signals"
                value={scoring.dimension_breakdown.code_quality_signals.score}
                color={getProgressColor(scoring.dimension_breakdown.code_quality_signals.score)}
                size="sm"
                className="w-full"
              >
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
              <span className="text-[10px] text-muted block leading-relaxed font-light">
                {scoring.dimension_breakdown.code_quality_signals.note}
              </span>
            </div>

            {/* Contribution Quality */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-foreground flex items-center gap-1">
                  <Shield className="size-3 text-warning" /> Contribution Quality
                </span>
                <span className="font-extrabold text-foreground font-mono">
                  {scoring.dimension_breakdown.contribution_quality.score}%
                </span>
              </div>
              <ProgressBar
                aria-label="Contribution Quality"
                value={scoring.dimension_breakdown.contribution_quality.score}
                color={getProgressColor(scoring.dimension_breakdown.contribution_quality.score)}
                size="sm"
                className="w-full"
              >
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
              <span className="text-[10px] text-muted block leading-relaxed font-light">
                {scoring.dimension_breakdown.contribution_quality.note}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
export default AnalysisScoreCards;
