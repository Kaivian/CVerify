export type AnalysisStatus = "idle" | "analyzing" | "success" | "error";

export interface RepoInfo {
  id: string;
  name: string;
  full_name: string;
  url: string;
  description: string | null;
  fork: boolean;
  created_at: string;
  languages: Record<string, number>;
  topics: string[];
  stars: number;
  forks: number;
  branches: number;
  open_prs: number;
}

export interface SourceClassification {
  case: string;
  fork: boolean;
  confidence_base: number;
}

export interface ContributionStats {
  total_commits: number;
  user_commits: number;
  user_commit_pct: number;
  contributors_count: number;
  lines_owned_pct: number | null;
  prs_authored: number;
  prs_merged: number;
  issues_count: number;
  branches_count: number;
}

export interface FraudFlag {
  type: string;
  severity: "high" | "medium" | "low";
  detail: string;
  confidence_penalty: number;
}

export interface SkillEvidence {
  type: "language_stat" | "file" | "dependency" | "structure";
  path?: string;
  signal: string;
}

export interface SkillDetails {
  level: "beginner" | "intermediate" | "advanced";
  confidence: number;
  evidence_type: "verified" | "inferred";
  evidence: SkillEvidence[];
}

export type SkillTreeCategory = Record<string, SkillDetails>;

export type SkillTree = Record<string, SkillTreeCategory>;

export interface ScoreDetail {
  score: number;
  note: string;
}

export interface DimensionBreakdown {
  technical_depth: ScoreDetail;
  code_quality_signals: ScoreDetail;
  contribution_quality: ScoreDetail;
}

export interface Scoring {
  raw_score: number;
  fraud_multiplier: number;
  final_score: number;
  band: string;
  verdict: string;
  dimension_breakdown: DimensionBreakdown;
  top_strengths: string[];
  improvement_areas: string[];
  recruiter_summary: string;
}

export interface UIHints {
  show_fraud_warning: boolean;
  fraud_badge: string;
  show_skill_tree: boolean;
  show_score: boolean;
  prompt_recruiter_note: string;
}

export interface RepositoryAnalysis {
  repo: RepoInfo;
  source_classification: SourceClassification;
  contribution_stats: ContributionStats;
  fraud_flags: FraudFlag[];
  fraud_multiplier: number;
  skill_tree: SkillTree;
  scoring: Scoring;
  ui_hints: UIHints;
}

export interface AnalysisJob {
  id: string;
  repositoryId: string;
  userId: string;
  status: string;
  progress: number;
  currentStep?: string;
  commitSha?: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  createdAtUtc: string;
  lastUpdatedUtc: string;
}

export interface AnalysisJobEvent {
  id: string;
  jobId: string;
  step: string;
  progress: number;
  message: string;
  createdAtUtc: string;
}
