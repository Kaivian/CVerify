# 01 - System Overview

This document provides a high-level technical overview of the `CVerify.AI` microservice architecture, its relationship with the C# `CVerify.Core` backend, external integrations (Anthropic Claude), and storage boundaries.

## Overall AI Architecture

CVerify.AI is built as a stateless, lightweight Python microservice powered by FastAPI. Its primary role is to serve as the **CVerify Repository Intelligence Engine**, performing static code analysis, detecting technologies, sampling source code, and executing advanced prompting flows via Anthropic's Claude.

The system is designed with a clear separation of concerns:
1.  **CVerify.Core (C# Backend)** manages user authentication, repository metadata, job scheduling, database persistence, and SSE client streaming.
2.  **CVerify.AI (Python Microservice)** executes resource-intensive git operations (cloning), code analysis, technology detection, file sampling, and interacts with the Claude API.
3.  **Redis** serves as the distributed state and security store (shared queue, pub-sub messaging, and HMAC nonce replay protection).
4.  **Database (PostgreSQL via EF Core)** acts as the source of truth for jobs, reports, and repository configuration.

```mermaid
graph TD
    subgraph Frontend Client
        FE[React SPA]
    end

    subgraph CVerify.Core (C# API)
        CTRL[RepositoryAnalysisController]
        SVC[RepositoryAnalysisService]
        WORKER[BackgroundRepositoryAnalysisProcessor]
        DB[(PostgreSQL Database)]
    end

    subgraph Distributed Cache & Queue
        REDIS[(Redis)]
    end

    subgraph CVerify.AI (Python Microservice)
        API[FastAPI Router]
        ORCH[GitHubAnalysisOrchestrator]
        DET[TechnologyDetector]
        SAMP[CodeSampler]
        CLAUDE_SVC[ClaudeService]
    end

    subgraph External
        CLAUDE[Anthropic Claude API]
        GITHUB[GitHub API / Git Server]
    end

    FE -->|HTTP Trigger| CTRL
    CTRL -->|Enqueue Job| SVC
    SVC -->|LPUSH job_id| REDIS
    WORKER -->|RPOP job_id| REDIS
    WORKER -->|HTTP Stream (HMAC Auth)| API
    API -->|Orchestrate| ORCH
    ORCH -->|Git Clone / Read| GITHUB
    ORCH -->|Detect Stack| DET
    ORCH -->|Sample Code| SAMP
    ORCH -->|Send Prompts| CLAUDE_SVC
    CLAUDE_SVC -->|API Calls (Caching)| CLAUDE
    ORCH -->|SSE progress & report| WORKER
    WORKER -->|Save Report & Verify| DB
    WORKER -->|Publish Progress Event| REDIS
    CTRL -->|Subscribe Progress| REDIS
    CTRL -->|SSE progress| FE
```

---

## Repository Analysis Lifecycle

The repository analysis lifecycle follows a deferred background processing pattern to handle long-running git and AI operations asynchronously:

1.  **Trigger (Client)**: A logged-in user requests analysis of an authenticated GitHub repository.
2.  **Scheduling (Core)**: C# backend verifies access, validates user limits (max 2 active jobs), creates a SQL record for the `AnalysisJob` in `Queued` status, and pushes the job ID into Redis list `repository:analysis:queue`.
3.  **Pickup (Worker)**: The background worker `BackgroundRepositoryAnalysisProcessor` pops the job from the queue and triggers execution.
4.  **HTTP SSE Request (Core to AI)**: The C# service signs a request payload containing repository metadata and OAuth access tokens with an HMAC SHA-256 signature, invoking the FastAPI endpoint `/api/v1/analysis/orchestrate/stream`.
5.  **Execution (AI)**:
    *   **Clone**: Clones the repo locally using depth-1 shallow clone into a temporary directory inside the workspace.
    *   **Tech Detection**: Scans filenames and scans contents of package files (e.g. `package.json`, `requirements.txt`) for frameworks.
    *   **Sampling**: Checks folder sizes (rejects >150MB or >10k files) and extracts up to 10 largest source code files + package files + documentation (readme.md).
    *   **Analysis**: Builds system and user prompts matching a rigid JSON schema, calling Claude.
    *   **Parsing/Backfilling**: Parses JSON output, backfills missing scoring parameters.
6.  **Streaming & Persistence**:
    *   CVerify.AI yields step-by-step progress SSE events (e.g., `CloningRepository`, `DetectingTechnologyStack`, `RunningAgents`, `AggregatingResults`).
    *   CVerify.Core reads these SSE chunks in real time, updates the SQL database state, and broadcasts events via Redis Pub/Sub.
    *   The client UI listens to C# controller SSE streaming (`progress-stream`), rendering the real-time progress bar.
    *   Once the Python service yields the final JSON report, CVerify.Core saves the payload to the database (`AnalysisReports` table), flags the repo as `IsVerified` (if score >= 50%), and updates `TrustScore`.

---

## FastAPI Entrypoints

*   `GET /health`: Basic health check. Returns `{"status": "healthy", "service": "CVerify.AI"}`.
*   `GET /health/ready` / `GET /readiness`: Validates the existence of `ANTHROPIC_API_KEY` and tests connection to Redis.
*   `POST /api/v1/chat/stream`: Streams conversational chat completions from Claude (currently hardcoded as an legacy Travel Planner bot). Authenticated via HMAC.
*   `POST /api/v1/analysis/orchestrate/stream`: The core analysis orchestration path. Processes repository analysis metadata and streams progress events and the final JSON analysis report. Authenticated via HMAC.

---

## Service & Agent Boundaries

*   **Technology Detection Service**: Implemented inside `app/github/technology_detector.py`. Scans directory structures and files to identify libraries and frameworks.
*   **Code Sampler Service**: Implemented inside `app/github/code_sampler.py`. Inspects and filters file lists, loading up to 10 source files and package manifests while truncating files to 100 lines each to prevent prompt bloating.
*   **Claude Service**: Implemented inside `app/services/claude_service.py`. Handles Anthropic client connections, sets up prompt caching headers (`cache_control: {"type": "ephemeral"}`), and issues HTTP calls.
*   **Agent boundaries**: While the directory `app/agents/` contains class skeletons for multiple agents (e.g., `SkillExtractionAgent`, `VerificationAgent`), **no agents are actively executed at runtime**. The Python orchestrator performs a direct single-call execution against Claude to analyze and structure the entire report.

---

## Storage & Streaming Interactions

*   **FastAPI Local Disk**: Shallow clones git repositories to temporary folders inside `CVerify.AI/temp_clones`. These temporary directories are managed via Python's `tempfile.TemporaryDirectory` context manager, which automatically cleans up the folder when execution leaves the block or fails.
*   **Redis Nonce Cache**: The HMAC security middleware verification uses a synchronous Redis connection (`redis.from_url`) to store transaction nonces with a 5-minute (300-second) TTL, preventing replay attacks.
*   **SSE Streaming**: Progress is streamed continuously using chunked responses (`StreamingResponse`) with `media_type="text/event-stream"`.

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | [app/main.py](../main.py) (FastAPI app configuration and endpoints) |
| **Dependencies** | FastAPI, Uvicorn, Redis (python client), Anthropic SDK, Git CLI, Pydantic |
| **Execution Flow** | Incoming HTTP Request → HMAC Auth Middleware → API Router → Orchestrator → Temporary Git Clone → File Walk Scan → Anthropic API call → SSE yield |
| **Common Failure Modes** | Invalid API keys (HTTP 500/503), Git clone authentication failure (HTTP 500), Redis timeout/offline causing signature check fail (HTTP 503), Claude JSON parse errors (yields `Failed` state) |
| **Related Files** | [app/routes/analysis_router.py](../routes/analysis_router.py), [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py), [app/middleware/hmac_auth.py](../middleware/hmac_auth.py) |
| **Related Services** | [ClaudeService](../services/claude_service.py), [TechnologyDetector](../github/technology_detector.py), [CodeSampler](../github/code_sampler.py) |
| **Related DTOs** | `AnalysisRequest` (FastAPI input DTO), `ChatStreamRequest` (FastAPI input DTO) |
| **Related Database Tables** | `AnalysisJobs`, `AnalysisJobEvents`, `AnalysisReports`, `SourceCodeRepositories` (Core DB tables) |
| **Related Frontend Components** | `DetailedAnalysisModal`, `AnalysisStatusBadge`, `repositoryAnalysisApi` service |
