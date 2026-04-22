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
  repo_type?: string;
  confidence_ceiling?: number;
}

export interface RepositoryEvidenceItem {
  id?: string;
  type: "file" | "dependency" | "structure" | "commit";
  path: string | null;
  line_range: string | null;
  signal: string;
}

export interface RepositoryEvidenceFinding {
  id?: string;
  category: string;
  finding: string;
  confidence: number;
  evidence: RepositoryEvidenceItem[];
  evidence_signals?: string[];
  explanation: string;
  impact?: "positive" | "warning" | "critical";
}

export interface RepositoryClassification {
  primary_type: string; // e.g. "SaaS Platform"
  all_types: string[];  // e.g. ["SaaS Platform", "AI Project"]
  complexity: "low" | "medium" | "high";
  benchmark_group: string; // e.g. "saas_platforms"
}

export interface EvidencePoints {
  total: number;
  breakdown: Record<string, number>;
}

export interface OwnershipDetails {
  user_commit_ratio: number;
  total_commits: number;
  is_primary_author: boolean;
  architectural_ownership_pct: number;
  critical_path_ownership_pct: number;
  maintenance_duration_months: number;
  explanation: string;
}

export interface TrustProfile {
  classification: "personal_authentic" | "fork_rebranded" | "template_dump" | "collaboration";
  confidence: number;
  rule_flags: string[];
  ai_findings: string[];
  explanation: string;
}

export interface ComparativePositioning {
  benchmark_group: string;
  percentile_rank: number;
  peer_group_size: number;
  relative_strengths: string[];
}

export interface TechnologyItem {
  name: string;
  type: "language" | "framework" | "database" | "library" | "infrastructure";
}

export interface RepositoryProfileDetail {
  technologies: TechnologyItem[];
  skills: Record<string, string[]>;
  architecture: {
    patterns: string[];
    explanation: string;
  };
  engineering_practices: {
    testing: {
      frameworks: string[];
      has_tests: boolean;
      confidence: number;
      evidence: string[];
      detail: string;
    };
    observability: {
      logging_configured: boolean;
      metrics_configured: boolean;
      confidence: number;
      evidence: string[];
      detail: string;
    };
    cicd: {
      configured: boolean;
      providers: string[];
      confidence: number;
      evidence: string[];
    };
  };
}

export interface RepositoryNarrative {
  recruiter_summary: string;
  top_strengths: Array<{
    strength: string;
    rationale: string;
  }>;
  limitations: Array<{
    limitation: string;
    rationale: string;
  }>;
}

export interface ConfidenceMetadata {
  confidence_score: number;       // 0 to 100
  completeness_ratio: number;     // 0.0 to 1.0
  evidence_coverage_count: number;// number of citations/references
}

export interface ContributorDistributionItem {
  author: string;
  email: string;
  commits: number;
  pct: number;
}

export interface GitMetrics {
  total_commits: number;
  user_commit_ratio: number;
  is_primary_author: boolean;
  bus_factor: number;
  active_contributors: number;
  contributor_distribution: ContributorDistributionItem[];
}

export interface QualityMetrics {
  files_scanned: number;
  files_sampled: number;
  skipped_files: number;
  coverage_pct: number;
  prompt_cache_efficiency: number;
}

export interface RepositoryAnalysisFacts {
  repo: RepoInfo;
  git_metrics: GitMetrics;
  quality_metrics: QualityMetrics;
}

export interface RiskAssessment {
  risk_level: "Low" | "Medium" | "High";
  risk_score: number;
  critical_findings_count: number;
  warning_findings_count: number;
  explanation: string;
}

export interface RepositoryAnalysisAiConclusions {
  classification: RepositoryClassification & {
    classification_rationale?: string;
    sampled_files?: string[];
    ignored_files_count?: number;
    confidence_factors?: string[];
  };
  evidence_points: EvidencePoints;
  trust: TrustProfile;
  risk_assessment?: RiskAssessment;
  positioning: ComparativePositioning;
  profile: RepositoryProfileDetail;
  findings: RepositoryEvidenceFinding[];
  narrative?: RepositoryNarrative;
}

export interface RepositoryAnalysis {
  jobId?: string;
  schemaVersion?: string;
  facts?: RepositoryAnalysisFacts;
  ai_conclusions?: RepositoryAnalysisAiConclusions;
  
  // For backwards compatibility:
  repo: RepoInfo;
  classification: RepositoryClassification;
  evidence_points: EvidencePoints;
  ownership: OwnershipDetails;
  trust: TrustProfile;
  positioning: ComparativePositioning;
  profile: RepositoryProfileDetail;
  findings: RepositoryEvidenceFinding[];
  narrative?: RepositoryNarrative;
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
  tasks?: AnalysisTask[];
}

export interface AnalysisJobEvent {
  id: string;
  jobId: string;
  step: string;
  progress: number;
  message: string;
  createdAtUtc: string;
}

export interface AnalysisTask {
  id: string;
  jobId: string;
  taskType: string;
  status: string; // Queued, Running, Completed, Failed, Retrying
  progress: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  retryCount: number;
  errorMessage?: string;
  promptTokens?: number;
  completionTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  estimatedCostUsd?: number;
  modelName?: string;
  schemaVersion?: string;
  resultData?: string;
  confidence_meta?: ConfidenceMetadata;
  createdAtUtc: string;
}

export interface AnalysisTaskEvent {
  id: string;
  taskId: string;
  timestamp: string;
  level: string; // Info, Warning, Error, Debug
  eventType: string; // StepStarted, ProgressUpdate, FileAnalyzed, SystemLog, ErrorOccurred
  message: string;
  metadata?: string;
}

