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
  primaryDomain: string;
  subDomain: string;
  confidence: number;
  isVerified: boolean;
  trustScore: number;
}

export interface RepositorySectionItem {
  title: string;
  content: string;
}

export interface RepositorySection {
  type: "engineering_practices" | "security_findings" | "architecture_insights";
  items: Array<string | RepositorySectionItem>;
}

export interface RepositoryRisk {
  score: number;
  level: "low" | "medium" | "high";
  reasons: string[];
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

export interface RepositoryAnalysis {
  jobId?: string;
  schemaVersion: string;
  repoId: string;
  repo: RepoInfo;
  classification: RepositoryClassification;
  sections: RepositorySection[];
  risk: RepositoryRisk;
  facts: RepositoryAnalysisFacts;
  trust_intelligence?: {
    uncertainty_metrics: {
      variance: number;
      sampling_bias_risk: number;
      adversarial_manipulation_risk: number;
      unverified_commits: number;
      timestamp_compression_ratio: number;
      uncalibrated_identities: number;
    };
    conflict_resolution_log: string[];
    trust_graph: {
      nodes: Array<{ id: string; type: string; data: Record<string, any> }>;
      edges: Array<{ id: string; source: string; target: string; label?: string; weight?: number }>;
    };
  };
  narrative?: RepositoryNarrative;
  cvSynthesis?: CvSynthesisDetail;
}

export interface CvHighlightItem {
  signal: string;
  impact: string;
}

export interface CvSynthesisDetail {
  schemaVersion?: string;
  title: string;
  summary: string;
  skills: string[];
  highlights: CvHighlightItem[];
  ownershipProfile: string;
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

