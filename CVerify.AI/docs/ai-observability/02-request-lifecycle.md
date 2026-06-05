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
    Core_Svc->>Core_Svc: Generate HMAC Headers for AI Service
    Core_Svc->>AI_Router: POST /api/v1/analysis/orchestrate/stream (JSON Payload + HMAC)
    activate AI_Router

    AI_Router->>AI_Orch: orchestrate_async(...)
    activate AI_Orch
    
    %% AI Pipeline Progress Events
    AI_Orch-->>AI_Router: Yield Status: "CloningRepository"
    AI_Router-->>Core_Svc: SSE Event: {"status": "CloningRepository", "progress": 20.0}
    Core_Svc->>DB: Log Event & Update Job status/progress
    Core_Svc->>Redis: PUBLISH "repository:analysis:progress:{JobId}" [Event JSON]
    Redis-->>Core_Ctrl: Push real-time event message
    Core_Ctrl-->>FE: Stream Event chunk (data: {JSON})

    AI_Orch->>AI_Orch: Git Clone (shallow depth=1)
    AI_Orch-->>AI_Router: Yield Status: "DetectingTechnologyStack"
    AI_Router-->>Core_Svc: SSE Event: {"status": "DetectingTechnologyStack", "progress": 40.0}
    Core_Svc->>Redis: PUBLISH "repository:analysis:progress:{JobId}"
    Redis-->>Core_Ctrl: Push
    Core_Ctrl-->>FE: Stream Event chunk

    AI_Orch->>AI_Orch: Technology Scan & Code File Sampling
    AI_Orch-->>AI_Router: Yield Status: "SamplingCode"
    AI_Router-->>Core_Svc: SSE Event: {"status": "SamplingCode", "progress": 60.0}
    Core_Svc->>Redis: PUBLISH "repository:analysis:progress:{JobId}"
    Redis-->>Core_Ctrl: Push
    Core_Ctrl-->>FE: Stream Event chunk

    AI_Orch-->>AI_Router: Yield Status: "RunningAgents"
    AI_Router-->>Core_Svc: SSE Event: {"status": "RunningAgents", "progress": 80.0}
    Core_Svc->>Redis: PUBLISH "repository:analysis:progress:{JobId}"
    Redis-->>Core_Ctrl: Push
    Core_Ctrl-->>FE: Stream Event chunk

    AI_Orch->>Claude: POST /v1/messages (System + User Prompt with code samples)
    Claude-->>AI_Orch: Return Markdown JSON Report block
    
    AI_Orch->>AI_Orch: Parse & Clean JSON, backfill "scoring" structure
    AI_Orch-->>AI_Router: Yield Status: "AggregatingResults"
    AI_Router-->>Core_Svc: SSE Event: {"status": "AggregatingResults", "progress": 90.0}
    Core_Svc->>Redis: PUBLISH
    Core_Ctrl-->>FE: Stream Event chunk

    AI_Orch-->>AI_Router: Yield Final JSON Payload {"reportData": "..."}
    deactivate AI_Orch
    deactivate AI_Router
    
    %% Save Report & Complete
    Core_Svc->>DB: Save AnalysisReport (JSONB)
    Core_Svc->>DB: Update SourceCodeRepository (IsVerified, TrustScore, LastSyncedAt)
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

### 2. Core to AI Microservice Request Payload (HTTP POST)
*   **Path**: `POST /api/v1/analysis/orchestrate/stream`
*   **Headers**:
    *   `X-Client-Id`: `cverify-core`
    *   `X-Timestamp`: Unix epoch string (e.g. `1717650000`)
    *   `X-Nonce`: Cryptographic unique string (e.g. `4f0bde1536...`)
    *   `X-Correlation-Id`: Matches the Job ID (e.g. `018f6f69-d4c5-7a42-990a-5b1285311e9f`)
    *   `X-Signature`: SHA-256 HMAC signature hex string.
*   **Body Request DTO (Python Pydantic)**:
    ```json
    {
      "repositoryId": "018f6f69-d4c5-7a42-990a-5b1285311e9e",
      "repoName": "CVerify",
      "repoOwner": "Kaivian",
      "encryptedToken": "gho_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "defaultBranch": "main"
    }
    ```

### 3. AI to Core Progress Event SSE Frames (Text/Event-Stream)
Events generated by the Python microservice use standard Server-Sent Events formatting.
*   **Intermediate Event**:
    ```text
    data: {"status": "CloningRepository", "step": "CloningRepository", "progress": 20.0, "message": "Cloning repository branch 'main'..."}

    ```
*   **Final Report Event**:
    ```text
    data: {"reportData": "{\"schemaVersion\": \"evidence-intelligence-v1\", \"repo\": {...}, \"scoring\": {\"final_score\": 92.0, \"band\": \"A\"}, ...}"}

    ```
*   **Closure Frame**:
    ```text
    data: [DONE]

    ```

### 4. Redis Pub/Sub Broadcast Payload
Core publishes updates to the channel `repository:analysis:progress:{JobId}`:
```json
{
  "jobId": "018f6f69-d4c5-7a42-990a-5b1285311e9f",
  "status": "CloningRepository",
  "step": "CloningRepository",
  "progress": 20.0,
  "message": "Cloning repository branch 'main'...",
  "timestamp": "2026-06-06T04:06:52.0000000Z"
}
```

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | `/api/v1/analysis/orchestrate/stream` in [app/routes/analysis_router.py](../routes/analysis_router.py) |
| **Dependencies** | Python: `fastapi`, `pydantic`. C#: `RepositoryAnalysisController.cs`, `RepositoryAnalysisService.cs` |
| **Execution Flow** | React client triggers C# → C# saves job, enqueues to Redis queue → C# Background Processor pops, decrypts token, builds HMAC, POSTs to Python FastAPI → Python streams progress SSEs → C# saves SQL records and publishes SSE to client. |
| **Common Failure Modes** | **HMAC Failure** (skewed clock, wrong secrets, yielding HTTP 401), **Redis Queue Jam** (worker offline, causing status to hang on "Queued"), **Connection Timeout** (git clone takes >10 minutes, C# cancels loop), **Failed Stream** (FastAPI crashes, C# yields HTTP 500 error payload). |
| **Related Files** | `RepositoryAnalysisController.cs` in Core, `RepositoryAnalysisService.cs` in Core, `BackgroundRepositoryAnalysisProcessor.cs` in Core |
| **Related Services** | [GitHubAnalysisOrchestrator](../orchestrators/github_analysis_orchestrator.py) |
| **Related DTOs** | `AnalysisRequest` in Python, `AnalysisJobDto` in C# |
| **Related Database Tables** | `AnalysisJobs`, `AnalysisJobEvents`, `AnalysisReports` |
| **Related Frontend Components** | `DetailedAnalysisModal.tsx`, `AnalysisStatusBadge.tsx` |
