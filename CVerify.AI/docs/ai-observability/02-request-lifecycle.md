# 02 - Request Lifecycle

This document traces the path of a repository analysis request end-to-end, detailing the DTOs, database actions, Redis Pub/Sub operations, and Server-Sent Event (SSE) message contracts exchanged at each stage.

## End-to-End Request Sequence

The request lifecycle is split into two phases: **Asynchronous Enqueuing & Scheduling** and **Background Execution & Real-Time SSE Streaming**.

```mermaid
sequenceDiagram
    autonumber
    actor User as Developer/Recruiter
    participant FE as React Frontend
    participant Core_Ctrl as Core Controller
    participant Core_Svc as Core Service
    participant Redis as Redis Queue / PubSub
    participant Worker as Background Worker
    participant AI_Router as FastAPI Router
    participant AI_Orch as AI Orchestrator
    participant Claude as Anthropic API
    participant DB as Postgres SQL DB

    %% PHASE 1: ENQUEUING
    Note over User, Redis: Phase 1: Asynchronous Enqueuing & Scheduling
    User->>FE: Click "Trigger Analysis"
    FE->>Core_Ctrl: POST /api/repositories/{repoId}/analyses (JWT Auth)
    Core_Ctrl->>Core_Svc: EnqueueAnalysisJobAsync(UserId, RepoId)
    activate Core_Svc
    Core_Svc->>DB: Query Repo & Active Job Count
    Core_Svc->>DB: Save new AnalysisJob (Status: "Queued", Progress: 0.0)
    Core_Svc->>DB: Save 9 sequential AnalysisTasks (Status: "Queued")
    Core_Svc->>Redis: LPUSH "repository:analysis:queue" [JobId]
    Core_Svc-->>Core_Ctrl: Return JobId
    deactivate Core_Svc
    Core_Ctrl-->>FE: HTTP 202 Accepted (JobId, Status: "Queued")

    %% PHASE 2: BACKGROUND EXECUTION & SSE STREAMING
    Note over FE, Claude: Phase 2: Background Execution & Real-Time SSE Streaming
    FE->>Core_Ctrl: GET /api/repository-analyses/jobs/{JobId}/progress-stream
    Core_Ctrl->>Core_Svc: GetJobEventsAsync(JobId) (Returns history if any)
    Core_Ctrl->>FE: Establishes HTTP Connection (text/event-stream)
    Core_Ctrl->>Redis: Subscribe "repository:analysis:progress:{JobId}"

    Worker->>Redis: RPOP "repository:analysis:queue"
    Redis-->>Worker: Return [JobId]
    Worker->>Core_Svc: ExecuteAnalysisJobAsync(JobId, CancellationToken)
    activate Core_Svc
    Core_Svc->>DB: Query Repo details & OAuth Token
    Core_Svc->>Core_Svc: Decrypt Access Token (AES-256)
    
    %% SEQ LOOP OVER TASKS
    loop For Each of the 9 Tasks (RepoStructure, CommitIntelligence, etc.)
        Core_Svc->>DB: Update Task & Job status to "Running"
        Core_Svc->>Redis: PUBLISH progress update event
        Redis-->>Core_Ctrl: Push progress to frontend SSE
        
        Core_Svc->>Core_Svc: Generate HMAC Headers for AI Task Endpoint
        Core_Svc->>AI_Router: POST /api/v1/analysis/task/execute (JSON Payload + HMAC)
        activate AI_Router
        AI_Router->>AI_Orch: execute_task(task_type, job_id, repo...)
        activate AI_Orch
        
        %% Disk Caching
        alt First Task: RepoStructure
            AI_Orch->>AI_Orch: Git Clone (shallow depth=100) & Tech Scan
        else Downstream Tasks
            AI_Orch->>AI_Orch: Load preceding task results from workspace cache files
        end
        
        opt Requires LLM Analysis
            AI_Orch->>Claude: POST /v1/messages (System + User Prompt with code samples)
            Claude-->>AI_Orch: Return JSON text block
        end
        
        AI_Orch->>AI_Orch: Cache Task Result to temp_clones/{job_id}/{task_type}_result.json
        AI_Orch-->>AI_Router: Return Task Result Data & Telemetry
        deactivate AI_Orch
        AI_Router-->>Core_Svc: Return TaskExecuteResponse JSON
        deactivate AI_Router
        
        Core_Svc->>DB: Save AnalysisTaskResult, update Task to "Completed", update Job progress
        Core_Svc->>Redis: PUBLISH task completed event
        Redis-->>Core_Ctrl: Push progress
    end
    
    %% AGGREGATION PHASE
    Core_Svc->>DB: Update Job status to "AggregatingResults"
    Core_Svc->>Core_Svc: Generate HMAC Headers for AI Aggregation Endpoint
    Core_Svc->>AI_Router: POST /api/v1/analysis/task/aggregate (JSON Payload + HMAC)
    activate AI_Router
    AI_Router->>AI_Orch: aggregate_results(job_id, repository_id, partial_results...)
    activate AI_Orch
    AI_Orch->>AI_Orch: Truth Calibration (Git vs API, Skills vs Package manifests)
    AI_Orch->>AI_Orch: Adversarial Risk & Uncertainty metrics calculation
    AI_Orch->>AI_Orch: Calibrated Trust Graph construction
    AI_Orch->>AI_Orch: Pydantic ReportV2Contract validation
    AI_Orch->>AI_Orch: Cleanup temporary clone directory (deleteWorkspace=true)
    AI_Orch-->>AI_Router: Return Aggregated Report V2 JSON
    deactivate AI_Orch
    AI_Router-->>Core_Svc: Return AggregateResponse JSON
    deactivate AI_Router

    %% Save Report & Complete
    Core_Svc->>DB: Save AnalysisReport (JSONB)
    Core_Svc->>DB: ParseV2ReportMetadata and update SourceCodeRepository (IsVerified, TrustScore, Classification, Risk)
    Core_Svc->>DB: Update AnalysisJob (Status: "Completed", Progress: 100.0)
    Core_Svc->>Redis: PUBLISH "repository:analysis:progress:{JobId}" {"status": "Completed"}
    Redis-->>Core_Ctrl: Push Done
    Core_Ctrl-->>FE: Stream data: [DONE] (closes client SSE)
    deactivate Core_Svc
```

---

## Data Contracts and DTOs

### 1. Frontend Trigger Request (C# Backend API)
*   **Path**: `POST /api/repositories/{repoId}/analyses`
*   **Response DTO (C#)**:
    ```json
    {
      "jobId": "018f6f69-d4c5-7a42-990a-5b1285311e9f",
      "status": "Queued"
    }
    ```

### 2. Task Execution Request Payload (Core to AI - HTTP POST)
*   **Path**: `POST /api/v1/analysis/task/execute`
*   **Headers**:
    *   `X-Client-Id`: `cverify-core`
    *   `X-Timestamp`: Unix epoch string (e.g. `1717650000`)
    *   `X-Nonce`: Cryptographic unique string
    *   `X-Correlation-Id`: Matches the Job ID
    *   `X-Signature`: SHA-256 HMAC signature
*   **Body Request DTO (Python Pydantic)**:
    ```json
    {
      "jobId": "018f6f69-d4c5-7a42-990a-5b1285311e9f",
      "taskType": "CommitIntelligence",
      "repositoryId": "018f6f69-d4c5-7a42-990a-5b1285311e9e",
      "repoName": "CVerify",
      "repoOwner": "Kaivian",
      "encryptedToken": "gho_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "defaultBranch": "main"
    }
    ```

### 3. Task Execution Response Payload (AI to Core)
*   **Response Body DTO**:
    ```json
    {
      "status": "Completed",
      "errorMessage": null,
      "schemaVersion": "2.0.0",
      "resultData": "{\"...JSON string of task results...\"}",
      "telemetry": {
        "promptTokens": 1050,
        "completionTokens": 450,
        "cacheReadTokens": 3120,
        "cacheWriteTokens": 0,
        "estimatedCostUsd": 0.00782,
        "modelName": "claude-3-5-sonnet-20241022",
        "provider": "Anthropic",
        "durationMs": 4210
      },
      "events": [
        {
          "timestamp": "2026-06-06T18:59:51Z",
          "level": "Info",
          "eventType": "StepCompleted",
          "message": "Commit intelligence and Git trust analysis complete."
        }
      ]
    }
    ```

### 4. Aggregation Request Payload (Core to AI - HTTP POST)
*   **Path**: `POST /api/v1/analysis/task/aggregate`
*   **Body Request DTO (Python Pydantic)**:
    ```json
    {
      "jobId": "018f6f69-d4c5-7a42-990a-5b1285311e9f",
      "repositoryId": "018f6f69-d4c5-7a42-990a-5b1285311e9e",
      "repoOwner": "Kaivian",
      "repoName": "CVerify",
      "partialResults": {
        "RepoStructure": { "...result data..." },
        "CommitIntelligence": { "...result data..." },
        "SkillExtraction": { "...result data..." },
        "ArchitectureAnalysis": { "...result data..." },
        "CodeQuality": { "...result data..." },
        "SecurityAnalysis": { "...result data..." },
        "RepositoryClassification": { "...result data..." },
        "RepositorySummary": { "...result data..." },
        "CvSynthesis": { "...result data..." }
      },
      "deleteWorkspace": true
    }
    ```

### 5. Aggregation Response Payload (AI to Core)
*   **Response Body**:
    ```json
    {
      "status": "Success",
      "reportData": "{\"...escaped JSON string matching ReportV2Contract...\"}"
    }
    ```

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | `/api/v1/analysis/task/execute` and `/api/v1/analysis/task/aggregate` in [app/routes/analysis_router.py](../routes/analysis_router.py) |
| **Dependencies** | Python: `fastapi`, `pydantic`. C#: `RepositoryAnalysisService.cs` |
| **Execution Flow** | React triggers C# -> C# Background worker loops over `/task/execute` calls -> Python performs work and caches local JSONs -> C# invokes `/task/aggregate` -> Python builds trust graph and validates schema -> C# saves report. |
| **Common Failure Modes** | **HMAC Failures** (clock skew or wrong client credentials), **Interrupted Task Execution** (one task fails, C# halts execution and marks the job as Failed), **Pydantic Validation Failures** (during aggregate validation, if any schema rules are violated). |
| **Related Files** | `RepositoryAnalysisService.cs` in Core, `analysis_router.py` in AI, `github_analysis_orchestrator.py` |
| **Related Services** | [GitHubAnalysisOrchestrator](../orchestrators/github_analysis_orchestrator.py) |
| **Related DTOs** | `TaskExecutionRequest`, `AggregationRequest`, `TaskExecuteResponse` |
| **Related Database Tables** | `AnalysisJobs`, `AnalysisTasks`, `AnalysisTaskResults`, `AnalysisReports` |
| **Related Frontend Components** | `DetailedAnalysisModal.tsx` |
