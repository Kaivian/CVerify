import { z } from "zod";
import { axiosClient } from "./axios-client";
import { type RepositoryAnalysis, type AnalysisJob, type AnalysisJobEvent } from "../types/repository-analysis.types";

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
});

const RepositoryClassificationSchema = z.object({
  primary_type: z.string().nullish().transform((val) => val ?? "Unclassified"),
  all_types: z.array(z.string()).nullish().transform((val) => val ?? []),
  complexity: z.enum(["low", "medium", "high"]).catch("medium"),
  benchmark_group: z.string().nullish().transform((val) => val ?? "unclassified"),
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
      detail: z.string().nullish().transform((val) => val ?? ""),
    }).default({ frameworks: [], has_tests: false, detail: "" }),
    observability: z.object({
      logging_configured: z.boolean().nullish().transform((val) => val ?? false),
      metrics_configured: z.boolean().nullish().transform((val) => val ?? false),
      detail: z.string().nullish().transform((val) => val ?? ""),
    }).default({ logging_configured: false, metrics_configured: false, detail: "" }),
    cicd: z.object({
      configured: z.boolean().nullish().transform((val) => val ?? false),
      providers: z.array(z.string()).nullish().transform((val) => val ?? []),
    }).default({ configured: false, providers: [] }),
  }).default({
    testing: { frameworks: [], has_tests: false, detail: "" },
    observability: { logging_configured: false, metrics_configured: false, detail: "" },
    cicd: { configured: false, providers: [] }
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
  category: z.string(),
  finding: z.string(),
  confidence: z.number().nullish().transform((val) => val ?? 100),
  evidence: z.array(RepositoryEvidenceItemSchema).nullish().transform((val) => val ?? []),
  explanation: z.string().nullish().transform((val) => val ?? ""),
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

export const RepositoryAnalysisSchema = z.object({
  schemaVersion: z.string().default("legacy"),
  repo: RepoInfoSchema,
  classification: RepositoryClassificationSchema.default({}),
  evidence_points: EvidencePointsSchema.default({}),
  ownership: OwnershipDetailsSchema.default({}),
  trust: TrustProfileSchema.default({}),
  positioning: ComparativePositioningSchema.default({}),
  profile: RepositoryProfileDetailSchema.default({}),
  findings: z.array(RepositoryEvidenceFindingSchema).nullish().transform((val) => val ?? []),
  narrative: RepositoryNarrativeSchema.optional(),
});

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
  }
};
