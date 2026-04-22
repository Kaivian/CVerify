# 15 - Analysis Pipeline Playbook

This document is a forensic debugging playbook for engineers and AI coding agents to diagnose, isolate, and recover from failures in each phase of the repository analysis pipeline.

---

## Playbook: Phase-by-Phase Diagnosis

### Phase 1: Queue Processing (Redis & Background Workers)
*   **Entry Point**: `BackgroundRepositoryAnalysisProcessor.ExecuteAsync()` (lines 27-70)
*   **Files Involved**:
    *   `BackgroundRepositoryAnalysisProcessor.cs` (Core background worker loop)
    *   `BackgroundRepositoryAnalysisQueue.cs` (Redis List queue operations)
*   **Methods Involved**:
    *   `BackgroundRepositoryAnalysisQueue.DequeueJobAsync()`
    *   `RepositoryAnalysisService.ExecuteAnalysisJobAsync()`
*   **Expected Logs**:
    *   *Core Worker*: `"Background Repository Analysis Processor started."`
    *   *Core Worker*: `"Background processor picked up analysis job {JobId}."`
*   **Expected Outputs**: Job ID Guid retrieved from Redis.
*   **Failure Symptoms**:
    *   Jobs remain stuck in `Queued` state in the SQL database indefinitely.
    *   No CPU activity or log emissions from the background worker.
*   **Root Causes**:
    *   Redis service is offline, preventing `ListRightPopAsync` queries.
    *   The background service `BackgroundRepositoryAnalysisProcessor` is not registered or crashed on startup.
*   **Recovery Steps**:
    1.  Verify Redis is running: `redis-cli ping` (should respond `PONG`).
    2.  Check CVerify.Core startup logs to confirm the singleton is registered:
        `builder.Services.AddHostedService<BackgroundRepositoryAnalysisProcessor>();`
    3.  Restart the CVerify.Core service to reboot the background worker loop.

---

### Phase 2: Repository Workspace & Cloning
*   **Entry Point**: `GitHubAnalysisOrchestrator.orchestrate_async()` (lines 39-104)
*   **Files Involved**:
    *   [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py)
*   **Methods Involved**:
    *   `orchestrate_async()`
    *   `subprocess.run()` calls to local `git` CLI.
*   **Expected Logs**:
    *   *SSE Progress Update*: `{"status": "CloningRepository", "progress": 20.0}`
*   **Expected Outputs**: Shallow cloned repository files downloaded into `temp_clones/{temp_directory}/repo`.
*   **Failure Symptoms**:
    *   Job fails during `CloningRepository` step with a `"Failed to clone repository"` exception.
*   **Root Causes**:
    *   The GitHub token is invalid or expired.
    *   The Git command is not available in the microservice container PATH.
    *   Network firewall blocks outbound HTTPS traffic to `github.com`.
*   **Recovery Steps**:
    1.  Test git execution inside the microservice hosting environment: `git --version`.
    2.  Check the token expiration status in the developer's GitHub developer settings.
    3.  Confirm local workspace write permissions for `temp_clones/`.

---

### Phase 3: File Walk & Sampling
*   **Entry Point**: `CodeSampler.sample_async()` (lines 25-106)
*   **Files Involved**:
    *   [app/github/code_sampler.py](../github/code_sampler.py)
    *   [app/github/technology_detector.py](../github/technology_detector.py)
*   **Methods Involved**:
    *   `CodeSampler.sample_async()`
    *   `TechnologyDetector.detect_from_package_files()`
*   **Expected Logs**:
    *   *SSE Progress Update*: `{"status": "DetectingTechnologyStack", "progress": 40.0}`
    *   *SSE Progress Update*: `{"status": "SamplingCode", "progress": 60.0}`
*   **Expected Outputs**: `CodeSample` instance filled with lists of names and text contents.
*   **Failure Symptoms**:
    *   Pipeline fails with message: `"Repository exceeds the maximum limit of 10,000 files."` or `"Repository exceeds the maximum limit of 150MB in size."`
*   **Root Causes**:
    *   Monorepo or extremely large codebase triggered safety guards.
    *   Ignored folders (e.g. `node_modules`, `venv`, `bin`) were scanned because they were renamed or had unique naming structures.
*   **Recovery Steps**:
    1.  Verify the size of the repository on GitHub.
    2.  If the repo is legitimate, adjust size bounds in `code_sampler.py` (lines 73-76) to allow larger projects.

---

### Phase 4: Claude API Integration
*   **Entry Point**: `ClaudeService.analyze_repo()` (lines 53-73)
*   **Files Involved**:
    *   [app/services/claude_service.py](../services/claude_service.py)
*   **Methods Involved**:
    *   `ClaudeService.analyze_repo()`
    *   `AsyncAnthropic.messages.create()`
*   **Expected Logs**:
    *   *SSE Progress Update*: `{"status": "RunningAgents", "progress": 80.0}`
*   **Expected Outputs**: Raw markdown-style JSON block returned from Claude.
*   **Failure Symptoms**:
    *   Pipeline crashes at `RunningAgents` step with a `"Claude analysis service failure"` exception.
*   **Root Causes**:
    *   Anthropic service outage or rate-limiting block (HTTP 429).
    *   Invalid `ANTHROPIC_API_KEY` configuration.
*   **Recovery Steps**:
    1.  Confirm API status at `status.anthropic.com`.
    2.  Check API credit levels on the Anthropic console dashboard.
    3.  Verify the api key is correct: `echo %ANTHROPIC_API_KEY%` or `echo $ANTHROPIC_API_KEY`.

---

### Phase 5: Server-Sent Events (SSE) Streaming & Redis Pub/Sub
*   **Entry Point**: `RepositoryAnalysisController.GetProgressStream()` (lines 145-242)
*   **Files Involved**:
    *   `RepositoryAnalysisController.cs`
    *   `RepositoryAnalysisService.cs`
*   **Methods Involved**:
    *   `RepositoryAnalysisController.GetProgressStream()`
    *   `RepositoryAnalysisService.PublishProgressEventAsync()`
*   **Expected Logs**:
    *   *Core Logs*: `Failed to publish progress event to Redis Pub/Sub for job {JobId}` (in error scenarios).
*   **Expected Outputs**: Chunked HTTP response blocks streamed to the React browser client.
*   **Failure Symptoms**:
    *   The frontend displays an infinite loading spinner.
    *   No progress update events are written to the database `AnalysisJobEvents` table.
*   **Root Causes**:
    *   Redis Pub/Sub channel connection was dropped.
    *   The HTTP connection was closed or buffered by intermediate proxies.
*   **Recovery Steps**:
    1.  Confirm the frontend client is subscribing to the correct Job ID stream.
    2.  Check for Nginx or IIS buffering settings, adding `X-Accel-Buffering: no` headers if needed.

---

### Phase 6: Result Persistence
*   **Entry Point**: `RepositoryAnalysisService.ExecuteAnalysisJobAsync()` (lines 330-365)
*   **Files Involved**:
    *   `RepositoryAnalysisService.cs`
    *   `AnalysisReport.cs`
    *   `SourceCodeRepository.cs`
*   **Expected Logs**:
    *   *Core Logs*: `Successfully processed analysis job {JobId}.`
*   **Expected Outputs**: New row written in `AnalysisReports` table with `Completed` status in `AnalysisJobs`.
*   **Failure Symptoms**:
    *   Analysis completes, but status in SQL database remains at `SavingReport` or changes to `Failed` during saving.
*   **Root Causes**:
    *   PostgreSQL database connection timed out or is locked.
    *   `scoring.final_score` field missing from the JSON payload, causing C# parse errors.
*   **Recovery Steps**:
    1.  Verify PostgreSQL status.
    2.  Inspect the `AnalysisJobs` table error column (`ErrorMessage`) to retrieve the SQL or JSON exception trace.

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | None (operational playbook) |
| **Dependencies** | Core C# Backend, Python FastAPI Backend, Postgres SQL, Redis Server |
| **Execution Flow** | Procedural diagnostic steps mapping error symptoms to root causes and recovery actions. |
| **Common Failure Modes** | Redis offline, Claude rate limits, database write timeouts, credential expiration. |
| **Related Files** | [app/main.py](../main.py), `RepositoryAnalysisService.cs` |
| **Related Services** | [ClaudeService](../services/claude_service.py), `BackgroundRepositoryAnalysisProcessor` |
| **Related DTOs** | None |
| **Related Database Tables** | `AnalysisJobs`, `AnalysisJobEvents`, `AnalysisReports` |
| **Related Frontend Components** | `DetailedAnalysisModal.tsx` |
