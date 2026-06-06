# 16 - AI Analysis Workflow

This document traces the workflow of the repository intelligence pipeline, from the C# backend task execution loop through the Python FastAPI microservice to Claude and back.

---

## Detailed Sequence Diagram

The following diagram maps the exact step-by-step execution flow of the discrete task execution pipeline:

```mermaid
sequenceDiagram
    autonumber
    participant CoreSvc as CVerify.Core Service
    participant AI_Router as FastAPI Router
    participant AI_Orch as AI Orchestrator
    participant Claude as Claude Service
    participant Git as Git Subprocess
    participant DB as EF Core Database

    %% STEP 1: PREPARATION
    CoreSvc->>DB: Queued Job & Tasks created in SQL DB
    CoreSvc->>CoreSvc: Read pipeline_config.json for task ordering
    
    %% STEP 2: DISCRETE EXECUTION LOOP
    loop For each task (RepoStructure, CommitIntelligence, SkillExtraction, etc.)
        CoreSvc->>DB: Set Task & Job state to Running
        CoreSvc->>AI_Router: POST /api/v1/analysis/task/execute (JSON Payload + HMAC)
        activate AI_Router
        AI_Router->>AI_Router: Verify HMAC signature & bind correlation ID to TraceContext
        AI_Router->>AI_Orch: execute_task(task_type, job_id, repoOwner, repoName...)
        activate AI_Orch
        
        alt Task: RepoStructure
            AI_Orch->>AI_Orch: Classify repo (original vs fork vs clone)
            AI_Orch->>Git: git clone --branch [branch] [clone_url] (Shallow clone depth=100)
            activate Git
            alt Clone branch fails
                Git-->>AI_Orch: Return non-zero code
                deactivate Git
                AI_Orch->>Git: git clone [clone_url] (Retry default branch fallback)
                activate Git
                Git-->>AI_Orch: Return code 0
                deactivate Git
            end
            AI_Orch->>AI_Orch: Walk directories, run TechnologyDetector
        else Task: CommitIntelligence
            AI_Orch->>Git: Run git log commands
            AI_Orch->>AI_Orch: Parse commits count, user ratio, bus factor
            AI_Orch->>Claude: Invoke Claude to audit repository authenticity
        else Other Tasks (3 - 9)
            AI_Orch->>AI_Orch: Load cached results of preceding tasks from workspace files
            AI_Orch->>Claude: Invoke Claude with task prompt and code samples
            activate Claude
            Claude-->>AI_Orch: Return JSON text block
            deactivate Claude
        end
        
        AI_Orch->>AI_Orch: Cache result in temp_clones/{job_id}/{task_type}_result.json
        AI_Orch-->>AI_Router: Return Task Result & Telemetry
        deactivate AI_Orch
        AI_Router-->>CoreSvc: Return TaskExecuteResponse JSON
        deactivate AI_Router
        
        CoreSvc->>DB: Save TaskResult, update Task to Completed, update progress
    end

    %% STEP 3: RESULTS AGGREGATION
    CoreSvc->>DB: Set Job state to AggregatingResults
    CoreSvc->>AI_Router: POST /api/v1/analysis/task/aggregate (JSON Payload + HMAC)
    activate AI_Router
    AI_Router->>AI_Router: Verify HMAC
    AI_Router->>AI_Orch: aggregate_results(job_id, repository_id, partial_results...)
    activate AI_Orch
    AI_Orch->>AI_Orch: Verify CI/CD configuration files on disk
    AI_Orch->>AI_Orch: Reconcile and calibrate skills (truth calibration layer)
    AI_Orch->>AI_Orch: Calculate risk scores & adversarial metrics (compression, unverified)
    AI_Orch->>AI_Orch: Construct trust graph nodes & edges
    AI_Orch->>AI_Orch: Validate output against Pydantic ReportV2Contract model
    AI_Orch->>AI_Orch: Delete temporary clones workspace (deleteWorkspace=true)
    AI_Orch-->>AI_Router: Return aggregated Report V2 payload
    deactivate AI_Orch
    AI_Router-->>CoreSvc: Return AggregateResponse
    deactivate AI_Router
    
    %% STEP 4: PERSISTENCE
    CoreSvc->>DB: Save AnalysisReport (JSONB)
    CoreSvc->>DB: ParseV2ReportMetadata and update SourceCodeRepository flags
    CoreSvc->>DB: Set AnalysisJob status to Completed (Progress 100.0)
```

---

## Error and Cancellation Pathways

### 1. User/Timeout Cancellation
*   **Trigger**: The user cancels the job, or execution exceeds the 10-minute timeout.
*   **Workflow**:
    1.  C# `RepositoryAnalysisService` cancels the HTTP client cancellation token.
    2.  Catches `OperationCanceledException` in `ExecuteAnalysisJobAsync`.
    3.  If the job is not already `Cancelled` (user-triggered), updates status in database to `TimedOut` and records error.
    4.  Publishes progress event to Redis Pub/Sub to close any active frontend SSE progress connections.

### 2. Git Clone Fallback Path
*   **Trigger**: Subprocess clone of the designated branch fails (due to branch renaming or removal).
*   **Workflow**:
    1.  Python microservice catches `subprocess.run` clone failure.
    2.  Deletes failed directory via `shutil.rmtree(clone_dir, ignore_errors=True)`.
    3.  Attempts second `subprocess.run` cloning only the repository root *without* branch tags (remote falls back to its default branch).
    4.  If fallback fails, raises a generic Exception to halt the task.

### 3. CV Synthesis Self-Correction Retry
*   **Trigger**: Claude returns an unparseable JSON format, or Pydantic validation fails during CV Synthesis.
*   **Workflow**:
    1.  Orchestrator catches validation error.
    2.  If it is attempt 1, appends the validation error trace to the user prompt and invokes Claude again for self-correction (attempt 2).
    3.  If attempt 2 also fails, it triggers the deterministic fallback builder to prevent pipeline crashes.

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | `/api/v1/analysis/task/execute` and `/api/v1/analysis/task/aggregate` in [app/routes/analysis_router.py](../routes/analysis_router.py) |
| **Dependencies** | Python: `fastapi`, `anthropic`, `redis`, `subprocess`. C#: `HttpClient`, `EF Core`, `StackExchange.Redis`. |
| **Execution Flow** | Orchestrated sequence detailed in sequence diagram. |
| **Common Failure Modes** | Invalid HMAC headers, Claude API rate limits, Pydantic validation failures. |
| **Related Files** | [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py), `RepositoryAnalysisService.cs` |
| **Related Services** | [ClaudeService](../services/claude_service.py) |
| **Related DTOs** | `TaskExecutionRequest`, `AggregationRequest`, `TaskExecuteResponse` |
| **Related Database Tables** | `AnalysisJobs`, `AnalysisTasks`, `AnalysisTaskResults`, `AnalysisReports` |
| **Related Frontend Components** | `DetailedAnalysisModal.tsx` |
