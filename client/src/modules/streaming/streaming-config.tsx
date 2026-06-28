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
    { id: "TechnologyStackDetection", name: "Technology Stack Detection", description: "Mapping languages, libraries, and frameworks across linked codebases." },
    { id: "CommitActivityIntelligence", name: "Commit Intelligence", description: "Analyzing Git historical velocity, authorship weight, and contributions." },
    { id: "SkillExtraction", name: "Skill Extraction", description: "Extracting specific programming paradigms, tools, and technical competencies." },
    { id: "ArchitectureAnalysis", name: "Architecture Analysis", description: "Verifying system designs, modularity, patterns, and component structures." },
    { id: "CodeQuality", name: "Code Quality Assessment", description: "Measuring test coverage, static analysis violations, complexity indices, and performance." },
    { id: "SecurityAnalysis", name: "Security Auditing", description: "Scanning dependencies for CVE vulnerabilities and checking codebase secrets." },
    { id: "RepositoryClassification", name: "Repository Classification", description: "Categorizing repo types (e.g. library, tool, app, scripts, forks)." },
    { id: "RepositorySummary", name: "Repository Summarization", description: "Synthesizing codebase-level architectural and quality metrics." },
    { id: "CvSynthesis", name: "CV Profile Synthesis", description: "Cross-referencing codebase telemetry against declared professional experience." },
    { id: "ExecutiveSummaryGeneration", name: "Executive Summary", description: "Generating recruiter-friendly evaluation narratives and overall alignment scores." },
    { id: "SkillTreeGeneration", name: "Skill Tree Compilation", description: "Building interactive capability hierarchy validated by repository evidence." },
    { id: "CandidateProfileComposer", name: "Profile Composition", description: "Assembling final verified profile and publishing results." }
  ],
  renderers: {},
  actions: {
    fetchReport: async (assessmentId: string) => {
      const res = await profileApi.fetchCandidateAssessmentDetails(assessmentId);
      return res;
    },
    cancelSession: async (sessionId: string) => {
      await profileApi.cancelCandidateAssessment(sessionId);
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
