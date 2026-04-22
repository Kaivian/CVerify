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
  explanation: string;
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
      detail: string;
    };
    observability: {
      logging_configured: boolean;
      metrics_configured: boolean;
      detail: string;
    };
    cicd: {
      configured: boolean;
      providers: string[];
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

export interface RepositoryAnalysis {
  repo: RepoInfo;
  classification: RepositoryClassification;
  evidence_points: EvidencePoints;
  ownership: OwnershipDetails;
  trust: TrustProfile;
  positioning: ComparativePositioning;
  profile: RepositoryProfileDetail;
  findings: RepositoryEvidenceFinding[];
  narrative?: RepositoryNarrative; // Decoupled and loaded dynamically
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

