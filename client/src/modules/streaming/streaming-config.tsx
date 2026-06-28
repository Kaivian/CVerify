import { pipelineRegistry } from "./registry";
import { PipelineConfig } from "./types";
import { repositoryAnalysisApi } from "@/services/repository-analysis.service";
import { profileApi } from "@/services/profile.service";
import { hiringRequirementService } from "@/services/hiring-requirement.service";

// 1. Register Candidate CV Assessment Pipeline
pipelineRegistry.register({
  pipelineId: "candidate-assessment",
  displayName: "Candidate Profile Evaluation",
  description: "Evaluates candidate code contributions and CV profile to calibrate trust scores, verify technical capabilities, and generate executive summaries.",
  enabledTabs: ["dashboard", "logs", "costs", "cv"],
  stages: [
    { id: "Initialize", name: "Initialization", description: "Spinning up secure assessment environment and fetching workspace context." },
    { id: "FetchLine1", name: "Retrieve Repository Artifacts", description: "Fetches verified static analysis, provenance, and git telemetry artifacts for the candidate's active repositories." },
    { id: "ConsolidateLine1", name: "Consolidate Repository Signals", description: "Merges multidimensional capability signals, code quality scores, and commit telemetry across all repositories." },
    { id: "L2-001", name: "Skill Taxonomy Mapping", description: "Normalizes raw project-level skills against the global CVerify technical skill taxonomy." },
    { id: "L2-002", name: "Skill Proficiency Estimation", description: "Estimates the depth, scope, and capability bands for each extracted skill using commit frequency and syntax patterns." },
    { id: "L2-003", name: "Capabilities & Gaps Diagnostics", description: "Pinpoints key architectural strengths and potential engineering development areas from the codebase history." },
    { id: "L2-004", name: "Career Level Assessment", description: "Maps codebase scope, ownership ratio, and engineering complexity to career-level thresholds." },
    { id: "L2-005", name: "Career Level Calibration", description: "Calibrates career level alignment across multiple repositories using weighted developer experience metrics." },
    { id: "L2-006", name: "Career Level Evaluation Gate", description: "Applies validation constraints and overrides to finalize candidate level classifications." },
    { id: "L2-007", name: "Engineering Maturity Evaluation", description: "Evaluates project hygiene, logging practices, test coverage, and structural organization." },
    { id: "L2-008", name: "Problem Solving Complexity Analyzer", description: "Analyzes diagnostic intent, recovery patterns, and bug-fix cycles in git commit messages." },
    { id: "L2-009", name: "Technical Tendency Classification", description: "Classifies developer affinity towards backend, frontend, devops, or fullstack development." },
    { id: "L2-010", name: "Working Style Classification", description: "Infers collaboration density, velocity consistency, and code review compliance from git metadata." },
    { id: "L2-011", name: "Experience Confidence Calibration", description: "Adjusts assessment confidence scores based on codebase age, volume, and contributor density." },
    { id: "L2-012", name: "Role Recommendation Engine", description: "Computes alignment percentages for classic industry roles (e.g. Backend, Tech Lead, DevOps, Architect)." },
    { id: "L2-013", name: "Executive Summary Generation", description: "Generates a comprehensive recruiter-friendly assessment narrative and executive summary." },
    { id: "L2-016", name: "Skill Tree Generation", description: "Constructs a validated, hierarchical taxonomy of skills and capabilities based on code and profile evidence." },
    { id: "L2-014", name: "AI Profile Composition", description: "Assembles and serializes the final verified candidate profile and calibrated score index." },
    { id: "L2-015", name: "Candidate Improvement Engine", description: "Generates personalized capability improvement plans and score optimization pathways." }
  ],
  renderers: {},
  actions: {
    fetchReport: async (assessmentId: string) => {
      const res = await profileApi.fetchCandidateAssessmentDetails(assessmentId);
      return res;
    },
    cancelSession: async (sessionId: string) => {
      await profileApi.cancelCandidateAssessment(sessionId);
    },
    fetchCosts: async (sessionId: string) => {
      const sseBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5247/api";
      const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
      const res = await fetch(`${sseBaseUrl}/v1/streaming/sessions/${sessionId}/costs`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Failed to fetch assessment costs");
      return res.json();
    }
  }
});

// 2. Register Repository Codebase Analysis Pipeline
pipelineRegistry.register({
  pipelineId: "repository-analysis",
  displayName: "Repository Codebase Analysis",
  description: "Performs deep analysis of a specific Git repository to extract capabilities, verify authorship, and calibrate trust scores.",
  enabledTabs: ["dashboard", "graph", "logs", "costs", "cv"],
  stages: [
    { id: "RepoStructure", name: "Structure Parsing", description: "Scanning directory tree to map project structure and configuration files." },
    { id: "CommitIntelligence", name: "Authorship & Git History", description: "Analyzing Git commits to verify identity and code volume contributions." },
    { id: "SkillExtraction", name: "Code Capability Extraction", description: "Running semantic parser to extract technical skills and patterns." },
    { id: "ArchitectureAnalysis", name: "Architecture & Modularity", description: "Mapping package relationships and architectural patterns." },
    { id: "CodeQuality", name: "Code Quality & Complexity", description: "Calculating cyclomatic complexity, code smells, and quality score." },
    { id: "SecurityAnalysis", name: "Security & Vulnerability", description: "Auditing dependency files and secrets leakages." },
    { id: "RepositoryClassification", name: "Classification", description: "Determining project type, framework, and utility class." },
    { id: "RepositorySummary", name: "Summarization", description: "Generating codebase overview, stats, and highlights." },
    { id: "CvSynthesis", name: "Relational Mapping", description: "Aligning repository findings with candidate career orientation." }
  ],
  gitMetricsSupported: true,
  reanalyzeSupported: true,
  renderers: {},
  actions: {
    fetchReport: (repoId: string) => repositoryAnalysisApi.getLatestReport(repoId),
    fetchSnapshot: (jobId: string) => repositoryAnalysisApi.getJobSnapshot(jobId),
    fetchCosts: (jobId: string) => repositoryAnalysisApi.getAnalysisCosts(jobId),
    retryStage: (jobId: string, stageId: string) => repositoryAnalysisApi.retryTask(jobId, stageId),
    cancelSession: (jobId: string) => repositoryAnalysisApi.cancelJob(jobId),
    triggerReanalyze: async (repoId: string) => {
      const res = await repositoryAnalysisApi.triggerAnalysis(repoId);
      return res.jobId;
    }
  }
});

// 3. Register Job Description Generation Pipeline
pipelineRegistry.register({
  pipelineId: "jd-generation",
  displayName: "Job Description Generation",
  description: "Generates calibrated, performance-driven job descriptions based on organizational requirements and market telemetry.",
  enabledTabs: ["dashboard", "logs", "costs"],
  stages: [
    { id: "AnalyzeRequirements", name: "Requirement Profiling", description: "Ingesting core hiring constraints and target profile criteria." },
    { id: "VerifyMarketRates", name: "Market Calibration", description: "Retrieving industry salary bounds and active role descriptions." },
    { id: "ComposeDraft", name: "Draft Composition", description: "Composing structured job description segments (responsibilities, skills)." },
    { id: "CalibrateScoring", name: "Score Rubric Calibration", description: "Configuring the evaluation rubric that candidates will be graded against." },
    { id: "FinalizeJd", name: "Verification & Release", description: "Validating description completeness and preparing final draft." }
  ],
  renderers: {},
  actions: {
    fetchReport: async (requirementId: string) => {
      return hiringRequirementService.getById(requirementId);
    },
    cancelSession: async (sessionId: string) => {
      await hiringRequirementService.cancelArtifactGeneration(sessionId, "JobDescription");
    }
  }
});

// 4. Register Candidate Discovery Match Pipeline
pipelineRegistry.register({
  pipelineId: "candidate-discovery",
  displayName: "Candidate Match Discovery",
  description: "Discovers and ranks verified talent against a hiring requirement based on capability alignment.",
  enabledTabs: ["dashboard", "logs", "costs"],
  stages: [
    { id: "IndexRequirements", name: "Requirement Vector Indexing", description: "Transforming hiring description into capability vectors." },
    { id: "QueryTalentGraph", name: "Talent Graph Querying", description: "Filtering candidate pool by baseline skill requirements." },
    { id: "ComputeAlignment", name: "Authorship Fit Matching", description: "Calculating alignment scores based on validated repository evidence." },
    { id: "RankCandidates", name: "Scored Ranking Compilation", description: "Generating ranked candidate cohort and calibration diagnostics." }
  ],
  renderers: {},
  actions: {
    fetchReport: async (requirementId: string) => {
      return hiringRequirementService.getCandidateMatches(requirementId);
    },
    cancelSession: async (sessionId: string) => {
      await hiringRequirementService.cancelDiscovery(sessionId);
    }
  }
});

// Export legacy CONFIGS for backward compatibility
export const PIPELINE_CONFIGS: Record<string, PipelineConfig> = {
  "candidate-assessment": pipelineRegistry.get("candidate-assessment")!,
  "repository-analysis": pipelineRegistry.get("repository-analysis")!,
  "jd-generation": pipelineRegistry.get("jd-generation")!,
  "candidate-discovery": pipelineRegistry.get("candidate-discovery")!,
};
