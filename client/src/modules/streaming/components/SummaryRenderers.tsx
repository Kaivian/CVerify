import React from "react";
import { 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  TrendingUp, 
  Gauge, 
  Activity, 
  Coins, 
  AlertTriangle 
} from "lucide-react";
import { Chip, Card } from "@heroui/react";

interface SummaryRendererProps {
  summaryData?: string;
  errorMessage?: string | null;
}

export function CandidateAssessmentSummary({ summaryData, errorMessage }: SummaryRendererProps) {
  if (errorMessage) {
    return (
      <div className="p-4 border border-danger/30 bg-danger/5 rounded-xl text-danger text-sm">
        <p className="font-bold flex items-center gap-2 mb-1">
          <AlertTriangle className="size-4" /> Assessment Execution Failed
        </p>
        <p className="text-xs font-mono">{errorMessage}</p>
      </div>
    );
  }

  let data: any = null;
  if (summaryData) {
    try {
      data = JSON.parse(summaryData);
    } catch (e) {
      console.error("Failed to parse assessment summaryData:", e);
    }
  }

  if (!data) {
    return (
      <div className="p-4 border border-border/10 bg-content2/50 rounded-xl text-center text-sm text-muted">
        No assessment summary data available.
      </div>
    );
  }

  // Extract variables
  const overallScore = data.overallScore ?? data.score ?? 0;
  const careerLevel = data.careerLevel ?? "Mid-Level";
  const primaryTendency = data.primaryTendency ?? "Full Stack";
  const recommendations = data.keyRecommendations ?? data.recommendations ?? [];
  const dimensions = data.competencyDimensions ?? {};

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 bg-content2/50 border border-border/10 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">Overall Score</span>
          <span className="text-2xl font-black text-primary mt-1">{overallScore.toFixed(0)}/100</span>
        </Card>
        <Card className="p-3 bg-content2/50 border border-border/10 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">Career Level</span>
          <span className="text-sm font-extrabold text-foreground mt-2">{careerLevel}</span>
        </Card>
        <Card className="p-3 bg-content2/50 border border-border/10 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">Engineering Focus</span>
          <span className="text-sm font-extrabold text-foreground mt-2">{primaryTendency}</span>
        </Card>
      </div>

      {/* Competency Dimensions */}
      {Object.keys(dimensions).length > 0 && (
        <Card className="p-4 border border-border/10 bg-content1">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider mb-2 block">
            Competency Dimensions
          </span>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(dimensions).map(([key, val]: any) => (
              <div key={key} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-foreground">{key}</span>
                  <span className="text-primary">{val}%</span>
                </div>
                <div className="h-1.5 w-full bg-content2 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary" 
                    style={{ width: `${val}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card className="p-4 border border-border/10 bg-content1 flex flex-col gap-2">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider mb-1">
            Key Recommendations
          </span>
          <div className="flex flex-col gap-2">
            {recommendations.slice(0, 3).map((rec: string, idx: number) => (
              <div key={idx} className="flex gap-2 items-start text-xs leading-relaxed text-foreground/90">
                <CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export function RepositoryAnalysisSummary({ summaryData, errorMessage }: SummaryRendererProps) {
  if (errorMessage) {
    return (
      <div className="p-4 border border-danger/30 bg-danger/5 rounded-xl text-danger text-sm">
        <p className="font-bold flex items-center gap-2 mb-1">
          <AlertTriangle className="size-4" /> Codebase Scan Failed
        </p>
        <p className="text-xs font-mono">{errorMessage}</p>
      </div>
    );
  }

  let data: any = null;
  if (summaryData) {
    try {
      data = JSON.parse(summaryData);
    } catch (e) {
      console.error("Failed to parse repo summaryData:", e);
    }
  }

  if (!data) {
    return (
      <div className="p-4 border border-border/10 bg-content2/50 rounded-xl text-center text-sm text-muted">
        No repository analysis report available.
      </div>
    );
  }

  const qualityScore = data.qualityScore ?? 0;
  const complexityScore = data.complexityScore ?? 0;
  const riskClassification = data.cloneRiskClassification ?? "clean";
  const verifiedPatterns = data.verifiedPatterns ?? [];
  const primaryLanguages = data.primaryLanguages ?? {};

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 bg-content2/50 border border-border/10 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-muted font-semibold uppercase tracking-wider flex items-center gap-1">
            <Gauge className="size-3 text-primary" /> Quality Score
          </span>
          <span className="text-2xl font-black text-primary mt-1">{qualityScore.toFixed(0)}%</span>
        </Card>
        <Card className="p-3 bg-content2/50 border border-border/10 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-muted font-semibold uppercase tracking-wider flex items-center gap-1">
            <Activity className="size-3 text-warning" /> Complexity
          </span>
          <span className="text-2xl font-black text-warning mt-1">{complexityScore.toFixed(0)}</span>
        </Card>
        <Card className="p-3 bg-content2/50 border border-border/10 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-muted font-semibold uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="size-3 text-secondary" /> Risk Rating
          </span>
          <span className="text-sm font-extrabold text-foreground mt-2 uppercase tracking-wide">
            {riskClassification}
          </span>
        </Card>
      </div>

      {/* Primary Languages */}
      {Object.keys(primaryLanguages).length > 0 && (
        <Card className="p-4 border border-border/10 bg-content1">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider mb-2 block">
            Primary Tech Stack
          </span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(primaryLanguages).map(([lang, percentage]: any) => (
              <Chip key={lang} variant="soft" size="sm" className="font-extrabold">
                {lang}: {percentage}%
              </Chip>
            ))}
          </div>
        </Card>
      )}

      {/* Verified Design Patterns */}
      {verifiedPatterns.length > 0 && (
        <Card className="p-4 border border-border/10 bg-content1 flex flex-col gap-2">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider mb-1">
            Verified Design Patterns
          </span>
          <div className="flex flex-wrap gap-1.5">
            {verifiedPatterns.slice(0, 8).map((pattern: string, idx: number) => (
              <Chip key={idx} variant="soft" color="success" size="sm" className="font-semibold text-foreground/90">
                {pattern}
              </Chip>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export function JdGenerationSummary({ summaryData, errorMessage }: SummaryRendererProps) {
  return (
    <div className="p-4 border border-border/10 bg-content2/50 rounded-xl flex flex-col gap-2 text-center">
      <Sparkles className="size-6 text-primary mx-auto" />
      <span className="text-sm font-extrabold text-foreground">Job Description Calibration Completed</span>
      <p className="text-xs text-muted leading-relaxed">
        The organization requirement model was analyzed and calibrated. A tailored candidate evaluation rubric is generated.
      </p>
    </div>
  );
}

export function CandidateDiscoverySummary({ summaryData, errorMessage }: SummaryRendererProps) {
  return (
    <div className="p-4 border border-border/10 bg-content2/50 rounded-xl flex flex-col gap-2 text-center">
      <Layers className="size-6 text-primary mx-auto" />
      <span className="text-sm font-extrabold text-foreground">Talent Graph Calibrated & Ranked</span>
      <p className="text-xs text-muted leading-relaxed">
        Match scores calculated across the organization's verified candidate pools based on codebase telemetry.
      </p>
    </div>
  );
}

export function SummaryRenderer({ pipelineId, summaryData, errorMessage }: { pipelineId: string } & SummaryRendererProps) {
  switch (pipelineId) {
    case "candidate-assessment":
      return <CandidateAssessmentSummary summaryData={summaryData} errorMessage={errorMessage} />;
    case "repository-analysis":
      return <RepositoryAnalysisSummary summaryData={summaryData} errorMessage={errorMessage} />;
    case "jd-generation":
      return <JdGenerationSummary summaryData={summaryData} errorMessage={errorMessage} />;
    case "candidate-discovery":
      return <CandidateDiscoverySummary summaryData={summaryData} errorMessage={errorMessage} />;
    default:
      return (
        <div className="p-4 border border-border/10 bg-content2/50 rounded-xl text-center text-xs text-muted">
          Pipeline completed successfully.
        </div>
      );
  }
}
