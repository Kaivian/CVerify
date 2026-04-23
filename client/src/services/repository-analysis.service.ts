import { z } from "zod";
import { axiosClient } from "./axios-client";
import { type RepositoryAnalysis, type AnalysisJob, type AnalysisJobEvent, type AnalysisTaskEvent } from "../types/repository-analysis.types";

// Runtime Validation Schemas using Zod to isolate client components from LLM schema variations.
// Uses .nullish().transform() so that missing (undefined) or null properties in legacy responses
// are converted to concrete default values, satisfying TypeScript interfaces.
const RepoInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  full_name: z.string(),
  url: z.string(),
  description: z.string().nullable(),
  fork: z.boolean().nullish().transform((val) => val ?? false),
  created_at: z.string().nullish().transform((val) => val ?? ""),
  languages: z.record(z.number()).nullish().transform((val) => val ?? {}),
  topics: z.array(z.string()).nullish().transform((val) => val ?? []),
  stars: z.number().nullish().transform((val) => val ?? 0),
  forks: z.number().nullish().transform((val) => val ?? 0),
  branches: z.number().nullish().transform((val) => val ?? 1),
  open_prs: z.number().nullish().transform((val) => val ?? 0),
  repo_type: z.string().nullish().transform((val) => val ?? "ORIGINAL_WORK"),
  confidence_ceiling: z.number().nullish().transform((val) => val ?? 1.0),
});

const RepositoryNarrativeSchema = z.object({
  recruiter_summary: z.string().nullish().transform((val) => val ?? ""),
  top_strengths: z.array(z.object({
    strength: z.string().nullish().transform((val) => val ?? ""),
    rationale: z.string().nullish().transform((val) => val ?? ""),
  })).nullish().transform((val) => val ?? []),
  limitations: z.array(z.object({
    limitation: z.string().nullish().transform((val) => val ?? ""),
    rationale: z.string().nullish().transform((val) => val ?? ""),
  })).nullish().transform((val) => val ?? []),
});

const ContributorDistributionItemSchema = z.object({
  author: z.string(),
  email: z.string(),
  commits: z.number(),
  pct: z.number(),
});

const GitMetricsSchema = z.object({
  total_commits: z.number().nullish().transform((val) => val ?? 1),
  user_commit_ratio: z.number().nullish().transform((val) => val ?? 1.0),
  is_primary_author: z.boolean().nullish().transform((val) => val ?? true),
  bus_factor: z.number().nullish().transform((val) => val ?? 1),
  active_contributors: z.number().nullish().transform((val) => val ?? 1),
  contributor_distribution: z.array(ContributorDistributionItemSchema).nullish().transform((val) => val ?? []),
});

const QualityMetricsSchema = z.object({
  files_scanned: z.number().nullish().transform((val) => val ?? 0),
  files_sampled: z.number().nullish().transform((val) => val ?? 0),
  skipped_files: z.number().nullish().transform((val) => val ?? 0),
  coverage_pct: z.number().nullish().transform((val) => val ?? 100.0),
  prompt_cache_efficiency: z.number().nullish().transform((val) => val ?? 0.0),
});

const RepositoryAnalysisFactsSchema = z.object({
  repo: RepoInfoSchema,
  git_metrics: GitMetricsSchema,
  quality_metrics: QualityMetricsSchema,
});

const UncertaintyMetricsSchema = z.object({
  variance: z.number().nullish().transform((val) => val ?? 0),
  sampling_bias_risk: z.number().nullish().transform((val) => val ?? 0),
  adversarial_manipulation_risk: z.number().nullish().transform((val) => val ?? 0),
  unverified_commits: z.number().nullish().transform((val) => val ?? 0),
  timestamp_compression_ratio: z.number().nullish().transform((val) => val ?? 0),
  uncalibrated_identities: z.number().nullish().transform((val) => val ?? 0),
});

const TrustGraphSchema = z.object({
  nodes: z.array(z.object({
    id: z.string(),
    type: z.string(),
    data: z.record(z.any()),
  })).nullish().transform((val) => val ?? []),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    label: z.string().optional(),
    weight: z.number().optional(),
  })).nullish().transform((val) => val ?? []),
});

const TrustIntelligenceSchema = z.object({
  uncertainty_metrics: UncertaintyMetricsSchema.default({
    variance: 0,
    sampling_bias_risk: 0,
    adversarial_manipulation_risk: 0,
    unverified_commits: 0,
    timestamp_compression_ratio: 0,
    uncalibrated_identities: 0,
  }),
  conflict_resolution_log: z.array(z.string()).nullish().transform((val) => val ?? []),
  trust_graph: TrustGraphSchema.default({ nodes: [], edges: [] }),
});

const RepositoryClassificationSchema = z.object({
  primaryDomain: z.string().nullish().transform((val) => val ?? "Unknown"),
  subDomain: z.string().nullish().transform((val) => val ?? "General"),
  confidence: z.number().nullish().transform((val) => val ?? 0.0),
  isVerified: z.boolean().nullish().transform((val) => val ?? false),
  trustScore: z.number().nullish().transform((val) => val ?? 0.0),
});

const RepositorySectionSchema = z.object({
  type: z.enum(["engineering_practices", "security_findings", "architecture_insights"]),
  items: z.array(
    z.union([
      z.string(),
      z.object({
        title: z.string().nullish().transform((val) => val ?? ""),
        content: z.string().nullish().transform((val) => val ?? ""),
      }),
    ])
  ).nullish().transform((val) => val ?? []),
});

const RepositoryRiskSchema = z.object({
  score: z.number().nullish().transform((val) => val ?? 0.0),
  level: z.enum(["low", "medium", "high"]).catch("low"),
  reasons: z.array(z.string()).nullish().transform((val) => val ?? []),
});

const CvHighlightSchema = z.object({
  signal: z.string().nullish().transform((val) => val ?? ""),
  impact: z.string().nullish().transform((val) => val ?? ""),
});

const CvSynthesisSchema = z.object({
  schemaVersion: z.string().nullish().transform((val) => val ?? "v2"),
  title: z.string().nullish().transform((val) => val ?? "Software Developer"),
  summary: z.string().nullish().transform((val) => val ?? ""),
  skills: z.array(z.string()).nullish().transform((val) => val ?? []),
  highlights: z.array(CvHighlightSchema).nullish().transform((val) => val ?? []),
  ownershipProfile: z.string().nullish().transform((val) => val ?? ""),
});

export const RepositoryAnalysisSchema = z.preprocess((val: unknown) => {
  const v = val as Record<string, any>;
  if (!v) return v;

  // Support V2 structure where fields might be nested inside ai_conclusions
  let classification = v.classification || v.ai_conclusions?.classification || v.classificationV2;
  let sections = v.sections || v.ai_conclusions?.sections || v.sectionsV2;
  let risk = v.risk || v.ai_conclusions?.risk || v.riskV2;
  const cvSynthesis = v.cvSynthesis || v.ai_conclusions?.cvSynthesis || v.cvSynthesisV2;
  const narrative = v.narrative || v.ai_conclusions?.narrative;
  const repo = v.repo || v.facts?.repo;
  const repoId = v.repoId || v.repositoryId || "";

  // Map classification properties to satisfy RepositoryClassificationSchema
  if (classification) {
    classification = {
      primaryDomain: classification.primaryDomain || classification.primary_type || "Unknown",
      subDomain: classification.subDomain || classification.sub_type || classification.benchmark_group || "General",
      confidence: classification.confidence !== undefined ? classification.confidence : 0.0,
      isVerified: classification.isVerified !== undefined ? classification.isVerified : false,
      trustScore: classification.trustScore !== undefined ? classification.trustScore : (classification.confidence || 0.0)
    };
  } else {
    classification = {
      primaryDomain: "Unknown",
      subDomain: "General",
      confidence: 0.0,
      isVerified: false,
      trustScore: 0.0
    };
  }

  // Map sections or fallback
  if (!sections || !Array.isArray(sections)) {
    sections = [];
  }

  // Map risk properties to satisfy RepositoryRiskSchema
  if (risk) {
    risk = {
      score: risk.score !== undefined ? risk.score : 0.0,
      level: risk.level || risk.risk_level || "low",
      reasons: risk.reasons || (risk.explanation ? [risk.explanation] : [])
    };
  } else {
    risk = {
      score: 0.0,
      level: "low",
      reasons: []
    };
  }

  // Ensure facts has a valid structure
  const facts = v.facts || {
    repo,
    git_metrics: {
      total_commits: 1,
      user_commit_ratio: 1.0,
      is_primary_author: true,
      bus_factor: 1,
      active_contributors: 1,
      contributor_distribution: []
    },
    quality_metrics: {
      files_scanned: 0,
      files_sampled: 0,
      skipped_files: 0,
      coverage_pct: 100.0,
      prompt_cache_efficiency: 0.0
    }
  };

  return {
    ...v,
    repoId,
    repo,
    classification,
    sections,
    risk,
    facts,
    narrative,
    cvSynthesis
  };
}, z.object({
  jobId: z.string().optional(),
  schemaVersion: z.string().nullish().transform((val) => val ?? "v2"),
  repoId: z.string().nullish().transform((val) => val ?? ""),
  repo: RepoInfoSchema,
  classification: RepositoryClassificationSchema,
  sections: z.array(RepositorySectionSchema).nullish().transform((val) => val ?? []),
  risk: RepositoryRiskSchema,
  facts: RepositoryAnalysisFactsSchema,
  trust_intelligence: TrustIntelligenceSchema.nullable().optional(),
  narrative: RepositoryNarrativeSchema.nullable().optional(),
  cvSynthesis: CvSynthesisSchema.nullable().optional(),
}));

export const logSchemaAnomaly = (error: z.ZodError, rawData: any) => {
  console.error("[Schema Observability Anomaly]", {
    message: "API payload failed to satisfy the contract",
    issues: error.issues.map(i => ({
      path: i.path.join("."),
      message: i.message,
      code: i.code
    })),
    jobId: rawData?.jobId,
    repoId: rawData?.repoId || rawData?.facts?.repo?.id,
    timestamp: new Date().toISOString()
  });
};

export const repositoryAnalysisApi = {
  getActiveJobs: async (): Promise<Array<{ id: string; repositoryId: string; status: string; progress: number; currentStep?: string }>> => {
    const response = await axiosClient.get<Array<{ id: string; repositoryId: string; status: string; progress: number; currentStep?: string }>>("/repository-analyses/active");
    return response.data;
  },

  triggerAnalysis: async (repositoryId: string): Promise<{ jobId: string; status: string }> => {
    const response = await axiosClient.post<{ jobId: string; status: string }>(`/repositories/${repositoryId}/analyses`);
    return response.data;
  },

  getJobStatus: async (jobId: string): Promise<AnalysisJob> => {
    const response = await axiosClient.get<AnalysisJob>(`/repository-analyses/jobs/${jobId}`);
    return response.data;
  },

  getJobSnapshot: async (jobId: string): Promise<RepositoryAnalysis> => {
    const response = await axiosClient.get<unknown>(`/repository-analyses/jobs/${jobId}/snapshot`);
    const parseResult = RepositoryAnalysisSchema.safeParse(response.data);
    if (!parseResult.success) {
      logSchemaAnomaly(parseResult.error, response.data);
      throw parseResult.error;
    }
    return parseResult.data as RepositoryAnalysis;
  },

  getJobEvents: async (jobId: string): Promise<AnalysisJobEvent[]> => {
    const response = await axiosClient.get<AnalysisJobEvent[]>(`/repository-analyses/jobs/${jobId}/events`);
    return response.data;
  },

  cancelJob: async (jobId: string): Promise<{ message: string }> => {
    const response = await axiosClient.post<{ message: string }>(`/repository-analyses/jobs/${jobId}/cancel`);
    return response.data;
  },

  getLatestReport: async (repositoryId: string): Promise<RepositoryAnalysis> => {
    const response = await axiosClient.get<unknown>(`/repositories/${repositoryId}/analyses/latest`);
    const parseResult = RepositoryAnalysisSchema.safeParse(response.data);
    if (!parseResult.success) {
      logSchemaAnomaly(parseResult.error, response.data);
      throw parseResult.error;
    }
    return parseResult.data as RepositoryAnalysis;
  },

  retryTask: async (jobId: string, taskId: string): Promise<{ message: string }> => {
    const response = await axiosClient.post<{ message: string }>(`/repository-analyses/jobs/${jobId}/tasks/${taskId}/retry`);
    return response.data;
  },

  getTaskEvents: async (jobId: string, taskId: string): Promise<AnalysisTaskEvent[]> => {
    const response = await axiosClient.get<AnalysisTaskEvent[]>(`/repository-analyses/jobs/${jobId}/tasks/${taskId}/events`);
    return response.data;
  },

  getAnalysisCosts: async (jobId: string): Promise<{
    jobId: string;
    totalCostUsd: number;
    totalTokens: number;
    totalDurationMs: number;
    executions: Array<{
      id: string;
      jobId: string;
      taskId: string;
      executionType: string;
      provider: string;
      model: string;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      cachedTokens: number;
      estimatedCostUsd: number;
      durationMs: number;
      createdAtUtc: string;
    }>;
  }> => {
    const response = await axiosClient.get<any>(`/repository-analyses/jobs/${jobId}/costs`);
    return response.data;
  },

  getPlatformCostSummary: async (): Promise<{
    costPerRepository: Array<{ repositoryName: string; totalCostUsd: number; totalTokens: number }>;
    costPerUser: Array<{ userEmail: string; totalCostUsd: number; totalTokens: number }>;
    costPerModel: Array<{ modelName: string; totalCostUsd: number; totalTokens: number }>;
    costPerProvider: Array<{ providerName: string; totalCostUsd: number; totalTokens: number }>;
    monthlyTrends: Array<{ year: number; month: number; totalCostUsd: number; totalTokens: number }>;
  }> => {
    const response = await axiosClient.get<any>('/repository-analyses/costs/platform-summary');
    return response.data;
  }
};
