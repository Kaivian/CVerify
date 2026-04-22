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

const RepositoryAuthenticitySchema = z.object({
  type: z.string().nullish().transform((val) => val ?? "ORIGINAL_WORK"),
  confidence_ceiling: z.number().nullish().transform((val) => val ?? 1.0),
  confidence_modifier: z.number().nullish().transform((val) => val ?? 1.0),
  rationale: z.string().nullish().transform((val) => val ?? ""),
  red_flags: z.array(z.string()).nullish().transform((val) => val ?? []),
});

const RepositoryClassificationSchema = z.object({
  primary_type: z.string().nullish().transform((val) => val ?? "Unclassified"),
  all_types: z.array(z.string()).nullish().transform((val) => val ?? []),
  confidence: z.number().nullish().transform((val) => val ?? 0.8),
  evidence: z.array(z.string()).nullish().transform((val) => val ?? []),
  schema_version: z.string().nullish().transform((val) => val ?? "1.0"),
  classifier_version: z.string().nullish().transform((val) => val ?? "2026.06"),
  complexity: z.enum(["low", "medium", "high"]).catch("medium").optional(),
  benchmark_group: z.string().nullish().transform((val) => val ?? "unclassified").optional(),
});

const EvidencePointsSchema = z.object({
  total: z.number().nullish().transform((val) => val ?? 0),
  breakdown: z.record(z.number()).nullish().transform((val) => val ?? {}),
});

const OwnershipDetailsSchema = z.object({
  user_commit_ratio: z.number().nullish().transform((val) => val ?? 1.0),
  total_commits: z.number().nullish().transform((val) => val ?? 1),
  is_primary_author: z.boolean().nullish().transform((val) => val ?? true),
  architectural_ownership_pct: z.number().nullish().transform((val) => val ?? 100),
  critical_path_ownership_pct: z.number().nullish().transform((val) => val ?? 100),
  maintenance_duration_months: z.number().nullish().transform((val) => val ?? 1),
  explanation: z.string().nullish().transform((val) => val ?? ""),
});

const TrustProfileSchema = z.object({
  classification: z.enum(["personal_authentic", "fork_rebranded", "template_dump", "collaboration"]).catch("personal_authentic"),
  confidence: z.number().nullish().transform((val) => val ?? 100),
  rule_flags: z.array(z.string()).nullish().transform((val) => val ?? []),
  ai_findings: z.array(z.string()).nullish().transform((val) => val ?? []),
  explanation: z.string().nullish().transform((val) => val ?? ""),
});

const ComparativePositioningSchema = z.object({
  benchmark_group: z.string().nullish().transform((val) => val ?? "unclassified"),
  percentile_rank: z.number().nullish().transform((val) => val ?? 0),
  peer_group_size: z.number().nullish().transform((val) => val ?? 1),
  relative_strengths: z.array(z.string()).nullish().transform((val) => val ?? []),
});

const TechnologyItemSchema = z.object({
  name: z.string(),
  type: z.enum(["language", "framework", "database", "library", "infrastructure"]).catch("library"),
});

const RepositoryProfileDetailSchema = z.object({
  technologies: z.array(TechnologyItemSchema).nullish().transform((val) => val ?? []),
  skills: z.record(z.array(z.string())).nullish().transform((val) => val ?? {}),
  architecture: z.object({
    patterns: z.array(z.string()).nullish().transform((val) => val ?? []),
    explanation: z.string().nullish().transform((val) => val ?? ""),
  }).default({ patterns: [], explanation: "" }),
  engineering_practices: z.object({
    testing: z.object({
      frameworks: z.array(z.string()).nullish().transform((val) => val ?? []),
      has_tests: z.boolean().nullish().transform((val) => val ?? false),
      confidence: z.number().nullish().transform((val) => val ?? 100),
      evidence: z.array(z.string()).nullish().transform((val) => val ?? []),
      detail: z.string().nullish().transform((val) => val ?? ""),
    }).default({ frameworks: [], has_tests: false, confidence: 100, evidence: [], detail: "" }),
    observability: z.object({
      logging_configured: z.boolean().nullish().transform((val) => val ?? false),
      metrics_configured: z.boolean().nullish().transform((val) => val ?? false),
      confidence: z.number().nullish().transform((val) => val ?? 100),
      evidence: z.array(z.string()).nullish().transform((val) => val ?? []),
      detail: z.string().nullish().transform((val) => val ?? ""),
    }).default({ logging_configured: false, metrics_configured: false, confidence: 100, evidence: [], detail: "" }),
    cicd: z.object({
      configured: z.boolean().nullish().transform((val) => val ?? false),
      providers: z.array(z.string()).nullish().transform((val) => val ?? []),
      confidence: z.number().nullish().transform((val) => val ?? 100),
      evidence: z.array(z.string()).nullish().transform((val) => val ?? []),
    }).default({ configured: false, providers: [], confidence: 100, evidence: [] }),
  }).default({
    testing: { frameworks: [], has_tests: false, confidence: 100, evidence: [], detail: "" },
    observability: { logging_configured: false, metrics_configured: false, confidence: 100, evidence: [], detail: "" },
    cicd: { configured: false, providers: [], confidence: 100, evidence: [] }
  }),
});

const RepositoryEvidenceItemSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["file", "dependency", "structure", "commit"]).catch("file"),
  path: z.string().nullable(),
  line_range: z.string().nullable(),
  signal: z.string(),
});

const RepositoryEvidenceFindingSchema = z.object({
  id: z.string().optional(),
  category: z.string().nullish().transform((val) => val ?? "quality"),
  finding: z.string(),
  confidence: z.number().nullish().transform((val) => val ?? 100),
  evidence: z.array(RepositoryEvidenceItemSchema).nullish().transform((val) => val ?? []),
  explanation: z.string().nullish().transform((val) => val ?? ""),
  impact: z.enum(["positive", "warning", "critical"]).optional(),
});

const RepositoryNarrativeSchema = z.object({
  recruiter_summary: z.string().nullish().transform((val) => val ?? ""),
  top_strengths: z.array(z.object({
    strength: z.string(),
    rationale: z.string(),
  })).nullish().transform((val) => val ?? []),
  limitations: z.array(z.object({
    limitation: z.string(),
    rationale: z.string(),
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

const RiskAssessmentSchema = z.object({
  risk_level: z.enum(["Low", "Medium", "High"]),
  risk_score: z.number(),
  critical_findings_count: z.number(),
  warning_findings_count: z.number(),
  explanation: z.string(),
});

const RepositoryAnalysisAiConclusionsSchema = z.object({
  authenticity: RepositoryAuthenticitySchema.optional(),
  classification: RepositoryClassificationSchema.extend({
    classification_rationale: z.string().optional(),
    sampled_files: z.array(z.string()).optional(),
    ignored_files_count: z.number().optional(),
    confidence_factors: z.array(z.string()).optional(),
  }).default({}),
  evidence_points: EvidencePointsSchema.default({}),
  trust: TrustProfileSchema.default({}),
  risk_assessment: RiskAssessmentSchema.optional(),
  positioning: ComparativePositioningSchema.default({}),
  profile: RepositoryProfileDetailSchema.default({}),
  findings: z.array(RepositoryEvidenceFindingSchema).nullish().transform((val) => val ?? []),
  narrative: RepositoryNarrativeSchema.optional(),
}).strict();

export const RepositoryAnalysisSchema = z.preprocess((val: unknown) => {
  const v = val as Record<string, any>;
  if (v) {
    if ("scoring" in v || (v.ai_conclusions && "scoring" in v.ai_conclusions)) {
      console.warn(
        `[DEPRECATED SCORING WARNING] Legacy scoring payload detected for job ${v.jobId || "unknown"}. Intercepting and pruning legacy fields.`
      );
      if ("scoring" in v) delete v.scoring;
      if (v.ai_conclusions && "scoring" in v.ai_conclusions) delete v.ai_conclusions.scoring;
    }
  }

  if (v && (v.facts || v.ai_conclusions)) {
    const facts = v.facts || {};
    const ai = v.ai_conclusions || {};

    // Auto-backfill authenticity if missing
    if (!ai.authenticity) {
      ai.authenticity = {
        type: facts.repo?.repo_type ?? v.repo?.repo_type ?? "ORIGINAL_WORK",
        confidence_ceiling: facts.repo?.confidence_ceiling ?? v.repo?.confidence_ceiling ?? 1.0,
        confidence_modifier: 1.0,
        rationale: ai.classification?.classification_rationale ?? "",
        red_flags: ai.classification?.confidence_factors ?? []
      };
    }
    
    return {
      schemaVersion: v.schemaVersion || "evidence-intelligence-v2",
      jobId: v.jobId,
      facts,
      ai_conclusions: ai,
      authenticity: ai.authenticity,
      repo: facts.repo || v.repo,
      classification: ai.classification || v.classification,
      evidence_points: ai.evidence_points || v.evidence_points,
      ownership: {
        total_commits: facts.git_metrics?.total_commits ?? v.ownership?.total_commits ?? 1,
        user_commit_ratio: facts.git_metrics?.user_commit_ratio ?? v.ownership?.user_commit_ratio ?? 1.0,
        is_primary_author: facts.git_metrics?.is_primary_author ?? v.ownership?.is_primary_author ?? true,
        architectural_ownership_pct: v.ownership?.architectural_ownership_pct ?? 100,
        critical_path_ownership_pct: v.ownership?.critical_path_ownership_pct ?? 100,
        maintenance_duration_months: v.ownership?.maintenance_duration_months ?? 1,
        explanation: v.ownership?.explanation ?? ai.trust?.explanation ?? ""
      },
      trust: ai.trust || v.trust,
      positioning: ai.positioning || v.positioning,
      profile: ai.profile || v.profile,
      findings: ai.findings || v.findings,
      narrative: ai.narrative || v.narrative,
    };
  } else if (v) {
    const legacyAuthenticity = {
      type: v.repo?.repo_type ?? "ORIGINAL_WORK",
      confidence_ceiling: v.repo?.confidence_ceiling ?? 1.0,
      confidence_modifier: 1.0,
      rationale: v.classification?.classification_rationale ?? "",
      red_flags: v.classification?.confidence_factors ?? []
    };

    return {
      schemaVersion: "legacy",
      jobId: v.jobId,
      repo: v.repo,
      classification: v.classification,
      evidence_points: v.evidence_points,
      ownership: v.ownership,
      trust: v.trust,
      positioning: v.positioning,
      profile: v.profile,
      findings: v.findings,
      narrative: v.narrative,
      authenticity: legacyAuthenticity,
      facts: {
        repo: v.repo,
        git_metrics: {
          total_commits: v.ownership?.total_commits ?? 1,
          user_commit_ratio: v.ownership?.user_commit_ratio ?? 1.0,
          is_primary_author: v.ownership?.is_primary_author ?? true,
          bus_factor: 1,
          active_contributors: 1,
          contributor_distribution: [],
        },
        quality_metrics: {
          files_scanned: 0,
          files_sampled: 0,
          skipped_files: 0,
          coverage_pct: 100.0,
          prompt_cache_efficiency: 0.0,
        }
      },
      ai_conclusions: {
        classification: v.classification,
        evidence_points: v.evidence_points,
        trust: v.trust,
        positioning: v.positioning,
        profile: v.profile,
        findings: v.findings,
        narrative: v.narrative,
        authenticity: legacyAuthenticity,
      }
    };
  }
  return val;
}, z.object({
  jobId: z.string().optional(),
  schemaVersion: z.string().default("legacy"),
  facts: RepositoryAnalysisFactsSchema.optional(),
  ai_conclusions: RepositoryAnalysisAiConclusionsSchema.optional(),
  authenticity: RepositoryAuthenticitySchema.optional(),
  repo: RepoInfoSchema,
  classification: RepositoryClassificationSchema.default({}),
  evidence_points: EvidencePointsSchema.default({}),
  ownership: OwnershipDetailsSchema.default({}),
  trust: TrustProfileSchema.default({}),
  positioning: ComparativePositioningSchema.default({}),
  profile: RepositoryProfileDetailSchema.default({}),
  findings: z.array(RepositoryEvidenceFindingSchema).nullish().transform((val) => val ?? []),
  narrative: RepositoryNarrativeSchema.optional(),
}).strict());

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
    const parsed = RepositoryAnalysisSchema.parse(response.data);
    return parsed as RepositoryAnalysis;
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
    const parsed = RepositoryAnalysisSchema.parse(response.data);
    return parsed as RepositoryAnalysis;
  },

  retryTask: async (jobId: string, taskId: string): Promise<{ message: string }> => {
    const response = await axiosClient.post<{ message: string }>(`/repository-analyses/jobs/${jobId}/tasks/${taskId}/retry`);
    return response.data;
  },

  getTaskEvents: async (jobId: string, taskId: string): Promise<AnalysisTaskEvent[]> => {
    const response = await axiosClient.get<AnalysisTaskEvent[]>(`/repository-analyses/jobs/${jobId}/tasks/${taskId}/events`);
    return response.data;
  }
};
