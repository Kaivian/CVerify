# 15 - Analysis Pipeline Playbook

This document is a forensic debugging playbook for engineers and AI coding agents to diagnose, isolate, and recover from failures in each phase of the repository analysis pipeline under the discrete tasks model.

---

## Playbook: Phase-by-Phase Diagnosis

### Phase 1: Queue Processing (Redis & Background Workers)
*   **Entry Point**: `BackgroundRepositoryAnalysisProcessor.ExecuteAsync()`
*   **Files Involved**:
    *   `BackgroundRepositoryAnalysisProcessor.cs` (Core background worker loop)
    *   `BackgroundRepositoryAnalysisQueue.cs` (Redis List queue operations)
*   **Expected Logs**:
    *   *Core Worker*: `"Background processor picked up analysis job {JobId}."`
*   **Expected Outputs**: Job ID Guid retrieved from Redis.
*   **Failure Symptoms**: Jobs remain stuck in `Queued` state in the SQL database indefinitely.
*   **Recovery Steps**:
    1.  Verify Redis is running: `redis-cli ping` (should respond `PONG`).
    2.  Check C# Core startup logs to confirm the singleton is registered:
        `builder.Services.AddHostedService<BackgroundRepositoryAnalysisProcessor>();`
    3.  Restart the CVerify.Core service to reboot the background worker loop.

---

### Phase 2: Repository Workspace, Classification & Cloning (`RepoStructure`)
*   **Entry Point**: `/api/v1/analysis/task/execute` (taskType: `RepoStructure`)
*   **Files Involved**:
    *   [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py) (method `analyze_structure`)
    *   [app/github/repo_classifier.py](../github/repo_classifier.py) (method `classify_repository`)
*   **Expected Logs**:
    *   *CVerify.AI*: `Classifying repository: checking stats (stars, forks) and history...`
    *   *CVerify.AI*: `Cloning branch 'main' from GitHub...`
*   **Expected Outputs**: Repository classified. Workspace folder `temp_clones/{job_id}/` created containing metadata `meta.json` and cloned files inside `/repo`.
*   **Failure Symptoms**: Job fails during `RepoStructure` with git clone failures.
*   **Recovery Steps**:
    1.  Confirm the GitHub OAuth token is valid and decrypted correctly.
    2.  Test git execution inside the microservice container: `git --version`.
    3.  Check local disk permissions inside `temp_clones/`.

---

### Phase 3: Factual Git log Parsing (`CommitIntelligence`)
*   **Entry Point**: `/api/v1/analysis/task/execute` (taskType: `CommitIntelligence`)
*   **Files Involved**:
    *   [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py) (method `analyze_commits`)
*   **Expected Logs**:
    *   *CVerify.AI*: `Reading local Git history logs...`
    *   *CVerify.AI*: `Parsed local Git log: 120 total commits found. Computing distributions...`
*   **Expected Outputs**: Authorship ratios, active authors, and bus factor computed and cached.
*   **Failure Symptoms**: Task fails with git parse or subprocess issues.
*   **Recovery Steps**:
    1.  Verify the Git repository has active commits.
    2.  Check for author identity mismatches in Git config vs user profile.

---

### Phase 4: Discrete Task Execution (Tasks 3 - 9)
*   **Entry Point**: `/api/v1/analysis/task/execute` (for `SkillExtraction`, `ArchitectureAnalysis`, `CodeQuality`, `SecurityAnalysis`, `RepositoryClassification`, `RepositorySummary`, `CvSynthesis`)
*   **Expected Logs**:
    *   *CVerify.AI*: `Invoking AI Skill Extraction model...`
    *   *CVerify.AI*: `Invoking AI CV Synthesis model (Attempt 1)...`
*   **Expected Outputs**: Cached JSON results written to disk: `temp_clones/{job_id}/{task_type}_result.json`.
*   **Failure Symptoms**: Task fails on Claude invocation, rate-limits, or CV synthesis schema validation.
*   **Recovery Steps**:
    1.  Confirm Anthropic API status (`status.anthropic.com`) and credit balance.
    2.  Verify `ClaudeService` has the retry utility enabled. It retries rate limits (HTTP 429) and gateway errors up to **5 times**.
    3.  `CvSynthesis` implements a single-retry logic: if the LLM output fails contract validation on attempt 1, it appends the error trace to the user prompt and retries (attempt 2). If that also fails, it triggers a deterministic fallback builder. Check logs for validation failures.

---

### Phase 5: Results Aggregation (`aggregate_results`)
*   **Entry Point**: `/api/v1/analysis/task/aggregate`
*   **Expected Logs**:
    *   *CVerify.AI*: `Workspace lifecycle audit: Cleaned up workspace folder for job {job_id}`
*   **Expected Outputs**: Final Report V2 JSON containing calibrated skills, adversarial scores, and the trust graph. Workspace directory deleted if `deleteWorkspace = true`.
*   **Failure Symptoms**: Aggregator throws HTTP 400 with schema validation exceptions.
*   **Recovery Steps**:
    1.  Inspect task result cache files on disk to identify which task cached invalid JSON shapes.
    2.  Check Pydantic `ReportV2Contract` model properties to ensure no type mismatches (such as string vs float) occurred.

---

### Phase 6: Result Persistence
*   **Entry Point**: C# `RepositoryAnalysisService.ExecuteAnalysisJobAsync()` (final stages)
*   **Expected Logs**:
    *   *Core Logs*: `"Saving repository report..."`
    *   *Core Logs*: `"Analysis completed successfully."`
*   **Expected Outputs**: Row inserted in SQL table `AnalysisReports`, `SourceCodeRepository` metadata updated via `ParseV2ReportMetadata`, and `AnalysisJob` status set to `Completed`.
*   **Failure Symptoms**: Database write timeouts, or `JsonException` during metadata extraction.
*   **Recovery Steps**:
    1.  Verify PostgreSQL database connectivity.
    2.  If `ParseV2ReportMetadata` failed, check the exception message in the job's `ErrorMessage` database column to pinpoint the unparseable property.

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | Logs located at `app.log` or standard stdout streams |
| **Dependencies** | Core C# Backend, Python FastAPI Backend, Postgres SQL, Redis Server |
| **Execution Flow** | Diagnostic steps mapping errors back to discrete task stages. |
| **Common Failure Modes** | Workspace cleanup occurred, erasing cached result files. To preserve directories for debugging, test with `deleteWorkspace=false`. |
| **Related Files** | [app/main.py](../main.py), `RepositoryAnalysisService.cs` |
| **Related Services** | [ClaudeService](../services/claude_service.py), `BackgroundRepositoryAnalysisProcessor` |
| **Related DTOs** | None |
| **Related Database Tables** | `AnalysisJobs`, `AnalysisTasks`, `AnalysisTaskResults`, `AnalysisReports` |
| **Related Frontend Components** | `DetailedAnalysisModal.tsx` |
