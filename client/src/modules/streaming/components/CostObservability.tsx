import React from "react";
import { Coins, Cpu, CpuIcon } from "lucide-react";
import { Chip, Spinner } from "@heroui/react";
import { StreamingSession, StreamingStage } from "../types";

interface CostObservabilityProps {
  activeSession: StreamingSession;
  stages: StreamingStage[];
  costs: any | null;
  isLoading: boolean;
}

const FRIENDLY_NAMES: Record<string, string> = {
  RepoStructure: "Workspace Setup & Provenance Scan",
  CommitIntelligence: "Commit Ownership & Git Trust",
  SkillExtraction: "Technical Skills Scan",
  ArchitectureAnalysis: "Architecture Design Pattern Scan",
  CodeQuality: "Code Quality & Styling Inspection",
  SecurityAnalysis: "Vulnerability & Security Audit",
  RepositoryClassification: "Repository Semantic Classification",
  RepositorySummary: "Recruiter Summary & Narrative",
  CvSynthesis: "CV Synthesis Profile",
};

export const CostObservability: React.FC<CostObservabilityProps> = ({
  activeSession,
  stages,
  costs,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] gap-4">
        <Spinner size="lg" />
        <span className="text-muted text-xs font-sans">
          Loading cost observability metrics...
        </span>
      </div>
    );
  }

  // Determine totals and ledger list
  let totalCostUsd = activeSession.totalCostUsd || 0;
  let totalTokens = (activeSession.totalInputTokens || 0) + (activeSession.totalOutputTokens || 0);
  
  let totalDurationMs = 0;
  if (activeSession.startedAt && activeSession.completedAt) {
    totalDurationMs = new Date(activeSession.completedAt).getTime() - new Date(activeSession.startedAt).getTime();
  } else {
    totalDurationMs = stages.reduce((sum, s) => sum + (s.durationMs || 0), 0);
  }

  let ledger: Array<{
    id: string;
    taskName: string;
    executionType: string;
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
    estimatedCostUsd: number;
    durationMs: number;
  }> = [];

  if (costs && costs.executions && costs.executions.length > 0) {
    totalCostUsd = costs.totalCostUsd ?? totalCostUsd;
    totalTokens = costs.totalTokens ?? totalTokens;
    totalDurationMs = costs.totalDurationMs ?? totalDurationMs;
    ledger = costs.executions.map((exec: any) => {
      const matchingStage = stages.find(s => s.stageId === exec.taskId || s.id === exec.taskId);
      const taskName = matchingStage ? (FRIENDLY_NAMES[matchingStage.stageId] || matchingStage.stageName) : exec.taskId;
      return {
        id: exec.id,
        taskName: taskName || "Core Agent Step",
        executionType: exec.executionType,
        provider: exec.provider,
        model: exec.model,
        promptTokens: exec.promptTokens,
        completionTokens: exec.completionTokens,
        cachedTokens: exec.cachedTokens,
        estimatedCostUsd: exec.estimatedCostUsd,
        durationMs: exec.durationMs
      };
    });
  } else {
    // Dynamically compile ledger from completed stages
    ledger = stages
      .filter(s => s.status === "Completed" || s.status === "Failed")
      .map(s => {
        let promptTokens = 0;
        let completionTokens = 0;
        let cachedTokens = 0;
        let estimatedCostUsd = 0;
        try {
          if (s.details) {
            const parsed = JSON.parse(s.details);
            promptTokens = parsed.promptTokens ?? parsed.inputTokens ?? parsed.prompt_tokens ?? 0;
            completionTokens = parsed.completionTokens ?? parsed.outputTokens ?? parsed.completion_tokens ?? 0;
            cachedTokens = parsed.cachedTokens ?? parsed.cacheReadTokens ?? parsed.cache_read_tokens ?? 0;
            estimatedCostUsd = parsed.estimatedCostUsd ?? parsed.costUsd ?? parsed.estimated_cost_usd ?? 0;
          }
        } catch (e) {}

        return {
          id: s.id,
          taskName: FRIENDLY_NAMES[s.stageId] || s.stageName,
          executionType: "Task Step",
          provider: activeSession.provider || "AI",
          model: activeSession.modelName || "Claude Sonnet",
          promptTokens,
          completionTokens,
          cachedTokens,
          estimatedCostUsd,
          durationMs: s.durationMs || 0
        };
      });
  }

  const hasLedger = ledger.length > 0;

  return (
    <div className="flex flex-col gap-6 text-left font-sans w-full">
      {/* Cost Metrics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col justify-between min-h-[120px]">
          <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
            Cumulative Estimated Cost
          </span>
          <strong className="text-2xl text-success font-black font-mono mt-2 block">
            ${totalCostUsd.toFixed(6)}
          </strong>
          <span className="text-[10px] text-muted-foreground mt-1">Based on exact token metrics</span>
        </div>

        <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col justify-between min-h-[120px]">
          <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
            Total Processed Tokens
          </span>
          <strong className="text-2xl text-foreground font-black font-mono mt-2 block">
            {totalTokens.toLocaleString()}
          </strong>
          <span className="text-[10px] text-muted-foreground mt-1">Prompt and Completion combined</span>
        </div>

        <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col justify-between min-h-[120px]">
          <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
            Cumulative API Duration
          </span>
          <strong className="text-2xl text-foreground font-black font-mono mt-2 block">
            {(totalDurationMs / 1000).toFixed(2)}s
          </strong>
          <span className="text-[10px] text-muted-foreground mt-1">Total model latency</span>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="border border-border/80 bg-surface rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border/80 bg-surface-secondary/40">
          <span className="text-[10px] text-foreground uppercase font-extrabold tracking-wider">
            AI Execution Ledger
          </span>
        </div>
        {!hasLedger ? (
          <div className="p-8 text-center text-xs text-muted-foreground italic font-sans">
            No detailed execution ledger available for this run.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border/80 bg-surface-secondary/20 text-muted-foreground uppercase text-[9px] font-extrabold">
                  <th className="px-5 py-3 font-sans">Task & Model</th>
                  <th className="px-5 py-3 font-sans">Type</th>
                  <th className="px-5 py-3 font-sans text-right">Prompt Tokens</th>
                  <th className="px-5 py-3 font-sans text-right">Completion Tokens</th>
                  <th className="px-5 py-3 font-sans text-right">Cached Read</th>
                  <th className="px-5 py-3 font-sans text-right font-bold">Estimated Cost</th>
                  <th className="px-5 py-3 font-sans text-right">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {ledger.map((exec) => (
                  <tr key={exec.id} className="hover:bg-surface-secondary/10 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-foreground">{exec.taskName}</div>
                      <div className="text-[10px] text-muted mt-0.5 font-mono capitalize">
                        {exec.provider} / {exec.model.replace("claude-3-", "")}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Chip size="sm" variant="soft" className="h-5 text-[8.5px] font-extrabold uppercase rounded-md">
                        {exec.executionType}
                      </Chip>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">
                      {exec.promptTokens.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">
                      {exec.completionTokens.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-success-soft">
                      {exec.cachedTokens > 0 ? exec.cachedTokens.toLocaleString() : "-"}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-success">
                      ${exec.estimatedCostUsd.toFixed(6)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">
                      {(exec.durationMs / 1000).toFixed(2)}s
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
export default CostObservability;
