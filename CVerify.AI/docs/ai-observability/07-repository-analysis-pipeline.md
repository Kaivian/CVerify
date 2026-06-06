# 07 - Repository Analysis Pipeline

This document details the step-by-step execution pipeline of the CVerify Repository Intelligence Engine, defining the inputs, outputs, configuration weights, and expected outcomes for each of the 9 discrete tasks and the final aggregation stage.

---

## Pipeline Stage Breakdown

The analysis lifecycle is decomposed into 9 sequential task executions followed by a final calibration and aggregation stage. These tasks are orchestrated from the C# core backend (`RepositoryAnalysisService.ExecuteAnalysisJobAsync`) and run on the Python FastAPI service:

| Stage | Task Type | Weight | Technical Purpose | Input | Output |
|---|---|---|---|---|---|
| **1** | **RepoStructure** | 10.0 | Classifies repository metadata, shallow clones branch, and scans file directories. | Repo URL, branch, credentials | Technology tags list, directories walk metadata |
| **2** | **CommitIntelligence** | 20.0 | Audits local git log history to calculate factual authorship ratios, bus factor, and trust classifications. | Local Git repository history | Factual git metrics and authenticity evaluation |
| **3** | **SkillExtraction** | 15.0 | Scans code snippets and walks manifests to extract tech skill signatures. | Code samples, manifests | Categorized skills list with evidence citations |
| **4** | **ArchitectureAnalysis** | 15.0 | Maps codebase design patterns and structural layouts. | Code samples, file directories | Identified architectural patterns (e.g. MVC, layered) |
| **5** | **CodeQuality** | 15.0 | Checks test frameworks, logging configurations, and CI/CD pipelines. | Code samples, file directory checks | Test coverage, observability, and quality findings |
| **6** | **SecurityAnalysis** | 10.0 | Audits dependencies and code snippets for vulnerabilities. | Code samples, manifest file imports | Vulnerabilities list and security findings |
| **7** | **RepositoryClassification** | 10.0 | Classifies semantic domains (SaaS platform, CLI tool, CRUD application, Library, etc.). | Code samples, README context | Categorized primary and sub-domains |
| **8** | **RepositorySummary** | 5.0 | Compiles recruiter narratives, strengths, and recommendations. | Code samples, previous task caches | Recruiter executive summaries, strengths list |
| **9** | **CvSynthesis** | 5.0 | Refines narrative summary and formats findings into recruiter-ready CV elements. | Manifest details, preceding results | Formatted CV profile title, summary, and highlights |
| **10** | **Aggregation** | N/A | Performs truth calibration, risk modeling, adversarial checks, trust graph compilation, and Pydantic validation. | Workspace file caches | Final Report V2 JSON payload |

---

## Detailed Stage Analysis

### 1. RepoStructure
*   **Action**: Pre-classifies the repository, generates the local temporary directory in `temp_clones/`, and performs a shallow clone of the target branch (depth=100). Walks directories to detect technologies from filenames and manifests.
*   **Failures**: Git authentication errors, remote branch missing, workspace permission errors.
*   **Logs**: `Cloning branch '{default_branch}' from GitHub...`

### 2. CommitIntelligence
*   **Action**: Runs shell commands to parse local Git logs (`git log --format=%ae|%an --all`). Calculates user commit ratios, active authors, and bus factor. Calls Claude to evaluate commit history authenticity.
*   **Failures**: Empty git logs, missing credentials.
*   **Logs**: `Reading local Git history logs...`

### 3. SkillExtraction
*   **Action**: Calls Claude using `get_skills_user_prompt` on sampled manifests and files, returning skills mapped to categories (frontend, backend, devops, database) with evidence.
*   **Failures**: Out of token budgets, unparseable LLM output.
*   **Logs**: `Extracting skill signatures and technology stack details...`

### 4. ArchitectureAnalysis
*   **Action**: Evaluates patterns and directory structure layouts using Claude (`get_architecture_user_prompt`).
*   **Failures**: Claude rate limits.
*   **Logs**: `Scanning codebase layout for architectural patterns...`

### 5. CodeQuality
*   **Action**: Audits test files (xUnit, pytest, Jest), checks logging/metrics configuration, and walks manifest files.
*   **Failures**: Codebase size limit errors (>150MB or >10k files).
*   **Logs**: `Inspecting code styling, testing configurations, and observability hooks...`

### 6. SecurityAnalysis
*   **Action**: Walks code directories to audit configuration files, packages, and dependency versions for vulnerabilities.
*   **Failures**: Token limits.
*   **Logs**: `Auditing dependencies and code for potential vulnerabilities...`

### 7. RepositoryClassification
*   **Action**: Classifies repository's semantic domain (e.g. SaaS Platform, CLI Tool) while excluding 'Fork' classifications to prevent skill inflation.
*   **Failures**: Rate limits.
*   **Logs**: `Classifying repository's semantic domain...`

### 8. RepositorySummary
*   **Action**: Compiles Narrative recruiter summaries using preceding cached tasks for context.
*   **Failures**: Claude timeouts.
*   **Logs**: `Compiling repository narrative summary and suggestions...`

### 9. CvSynthesis
*   **Action**: Compiles title, skills, recruiter-ready summary, highlights, and contribution profiles.
*   **Failures**: Validation failures (triggers a retry or fallback).
*   **Logs**: `Synthesizing professional CV content from repository intelligence...`

### 10. Aggregation
*   **Action**: Calibrates skills and authorship, checks for CI/CD files (Jenkinsfile, `.github/workflows`), runs risk and adversarial algorithms, constructs trust graph, validates V2 schema, and cleans up the temporary directory.
*   **Failures**: Pydantic validation failures.
*   **Logs**: `Workspace lifecycle audit: Cleaned up workspace folder for job {job_id}`

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | `execute_task` and `aggregate_results` in [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py) |
| **Dependencies** | Python: `TechnologyDetector`, `CodeSampler`, `GitHubPromptFactory`, `CvPromptFactory`, `ClaudeService` |
| **Execution Flow** | C# Worker loops through 9 `execute_task` calls ➔ Python saves results to workspace disk ➔ C# calls `aggregate_results` ➔ Python cleans up and returns validated Report V2. |
| **Common Failure Modes** | Invalid API keys, task execution interruption, missing pipeline config on server, workspace disk space limit. |
| **Related Files** | [app/routes/analysis_router.py](../routes/analysis_router.py), `RepositoryAnalysisService.cs` |
| **Related Services** | [ClaudeService](../services/claude_service.py) |
| **Related DTOs** | `TaskExecutionRequest`, `AggregationRequest`, `ReportV2Contract` |
| **Related Database Tables** | `AnalysisJobs`, `AnalysisTasks`, `AnalysisTaskResults`, `AnalysisReports` |
| **Related Frontend Components** | `DetailedAnalysisModal.tsx` |
