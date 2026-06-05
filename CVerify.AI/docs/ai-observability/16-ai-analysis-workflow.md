# 16 - AI Analysis Workflow

This document traces the workflow of the repository intelligence pipeline, from the C# backend invocation through the Python FastAPI microservice to Claude and back.

---

## Detailed Sequence Diagram

The following diagram maps the exact step-by-step execution flow, including error fallbacks, correlation ID propagation, and cancellations.

```mermaid
sequenceDiagram
    autonumber
    participant CoreSvc as CVerify.Core Service
    participant AI_Router as FastAPI Router
    participant AI_Orch as AI Orchestrator
    participant Claude as Claude Service
    participant Git as Git Subprocess
    participant DB as EF Core Database

    %% STEP 1: REST API CALL WITH HMAC
    CoreSvc->>AI_Router: POST /api/v1/analysis/orchestrate/stream (JSON Payload + HMAC)
    Note over CoreSvc, AI_Router: Correlation ID passed in header X-Correlation-Id
    
    activate AI_Router
    AI_Router->>AI_Router: Verify HMAC, Client ID, Timestamp & Nonce
    AI_Router->>AI_Router: Bind Correlation ID to Request state
    AI_Router->>AI_Orch: orchestrate_async(repository_id, name, owner, token, branch)
    activate AI_Orch
    
    %% STEP 2: GIT CLONE WITH RETRY BRANCH FALLBACK
    AI_Orch-->>AI_Router: Yield status: "CloningRepository" (progress 20.0)
    AI_Router-->>CoreSvc: Stream SSE: CloningRepository
    AI_Orch->>Git: git clone --branch [branch] [clone_url] [clone_dir]
    activate Git
    
    alt Git Clone Succeeds
        Git-->>AI_Orch: Return code 0
    else Git Clone Fails (Branch mismatch)
        Git-->>AI_Orch: Return code != 0
        deactivate Git
        AI_Orch->>AI_Orch: Delete failed clone_dir
        AI_Orch->>Git: git clone [clone_url] [clone_dir] (Retry default branch fallback)
        activate Git
        alt Fallback Succeeds
            Git-->>AI_Orch: Return code 0
        else Fallback Fails
            Git-->>AI_Orch: Return code != 0
            deactivate Git
            AI_Orch-->>AI_Router: Raise Exception("Git clone failed")
            AI_Router-->>CoreSvc: Stream SSE: {"status": "Failed", "step": "Failed", "message": "Git clone failed..."}
        end
    end

    %% STEP 3: TECHNOLOGY DETECTION
    AI_Orch-->>AI_Router: Yield status: "DetectingTechnologyStack" (progress 40.0)
    AI_Router-->>CoreSvc: Stream SSE: DetectingTechnologyStack
    AI_Orch->>AI_Orch: Walk directories, read manifests (first 2000 bytes)
    
    %% STEP 4: FILE SAMPLING
    AI_Orch-->>AI_Router: Yield status: "SamplingCode" (progress 60.0)
    AI_Router-->>CoreSvc: Stream SSE: SamplingCode
    AI_Orch->>AI_Orch: Check size limit (150MB) and file count limit (10k)
    alt Size Exceeded
        AI_Orch-->>AI_Router: Raise Exception("Repository exceeds limit")
        AI_Router-->>CoreSvc: Stream SSE: {"status": "Failed", "message": "Repository exceeds..."}
    end
    AI_Orch->>AI_Orch: Sort code files by size, extract largest 10 files (first 100 lines each)

    %% STEP 5: PROMPT GENERATION
    AI_Orch->>AI_Orch: Build System Prompt & User Prompt (inject manifests & code snippets)

    %% STEP 6: CLAUDE INVOCATION
    AI_Orch-->>AI_Router: Yield status: "RunningAgents" (progress 80.0)
    AI_Router-->>CoreSvc: Stream SSE: RunningAgents
    AI_Orch->>Claude: analyze_repo(system_prompt, user_prompt)
    activate Claude
    
    alt Claude API Call Succeeds
        Claude-->>AI_Orch: Return text response
    else Claude API Call Fails (Rate limit / Connection)
        Claude-->>AI_Orch: Log & Re-raise Exception
        deactivate Claude
        AI_Orch-->>AI_Router: Raise Exception("Claude analysis service failure")
        AI_Router-->>CoreSvc: Stream SSE: {"status": "Failed", "message": "Claude analysis service failure..."}
    end

    %% STEP 7: JSON PARSING AND SCORING BACKFILL
    AI_Orch->>AI_Orch: Extract braces { ... } from Claude response text
    alt JSON Parsing Fails
        AI_Orch-->>AI_Router: Raise Exception("Claude output did not return valid JSON")
        AI_Router-->>CoreSvc: Stream SSE: {"status": "Failed"}
    else JSON Parsing Succeeds
        AI_Orch->>AI_Orch: Inject repo details (id, name, full_name, url)
        AI_Orch->>AI_Orch: Backfill scoring.final_score if missing
    end

    %% STEP 8: FINAL AGGREGATION & TERMINATION
    AI_Orch-->>AI_Router: Yield status: "AggregatingResults" (progress 90.0)
    AI_Router-->>CoreSvc: Stream SSE: AggregatingResults
    AI_Orch-->>AI_Router: Yield final {"reportData": "JSON string"}
    deactivate AI_Orch
    AI_Router-->>CoreSvc: Stream SSE: reportData payload
    AI_Router-->>CoreSvc: Stream SSE: [DONE] (closes HTTP stream)
    deactivate AI_Router
    
    %% STEP 9: persistence
    CoreSvc->>DB: Save AnalysisReport (JSONB)
    CoreSvc->>DB: Set SourceCodeRepository.IsVerified and TrustScore
    CoreSvc->>DB: Update AnalysisJob (Status: Completed, Progress: 100.0)
```

---

## Error and Cancellation Pathways

### 1. User/Timeout Cancellation
*   **Trigger**: The user clicks "Cancel" in the UI, or the CVerify.Core background processor surpasses the 10-minute timeout limit.
*   **Workflow**:
    1.  C# `RepositoryAnalysisService` cancels the asynchronous http client query task (triggers `CancellationToken` cancellation).
    2.  `RepositoryAnalysisService` catches `OperationCanceledException`.
    3.  If the status of the job in the SQL database is not already `Cancelled` (user-triggered), the worker updates it to `TimedOut` and sets the error message.
    4.  The service logs `Repository analysis job {JobId} timed out or was cancelled.`
    5.  The worker publishes a progress event payload to Redis Pub/Sub with status `Cancelled` or `TimedOut` to close any open client browser SSE streams.

### 2. Git Clone Fallback Retry Path
*   **Trigger**: Subprocess clone of the designated branch fails (due to branch renaming or removal).
*   **Workflow**:
    1.  Python microservice catches `subprocess.run` failure.
    2.  Executes `shutil.rmtree(clone_dir, ignore_errors=True)` to clean the workspace.
    3.  Fires a second `subprocess.run` cloning only the repository root *without* branch tags.
    4.  If this succeeds, execution proceeds normally to technology stack scans.

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | `/api/v1/analysis/orchestrate/stream` in [app/routes/analysis_router.py](../routes/analysis_router.py) |
| **Dependencies** | Python: `fastapi`, `anthropic`, `redis`, `subprocess`. C#: `HttpClient`, `EF Core`, `StackExchange.Redis`. |
| **Execution Flow** | Orchestrated sequence detailed in sequence diagram. |
| **Common Failure Modes** | Invalid HMAC headers (clock skew), Claude parser crash (invalid text formatting), DB write timeout. |
| **Related Files** | [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py), `RepositoryAnalysisService.cs` |
| **Related Services** | [ClaudeService](../services/claude_service.py) |
| **Related DTOs** | `AnalysisRequest` |
| **Related Database Tables** | `AnalysisJobs`, `AnalysisJobEvents`, `AnalysisReports` |
| **Related Frontend Components** | `DetailedAnalysisModal.tsx` |
