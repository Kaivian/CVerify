# 01 - System Overview

This document provides a high-level technical overview of the `CVerify.AI` microservice architecture, its relationship with the C# `CVerify.Core` backend, external integrations (Anthropic Claude), and storage boundaries.

## Overall AI Architecture

CVerify.AI is built as a stateless, lightweight Python microservice powered by FastAPI. Its primary role is to serve as the **CVerify Repository Intelligence Engine**, performing static code analysis, detecting technologies, sampling source code, validating Git log histories, and executing task-specific prompts via Anthropic's Claude.

The system is designed with a clear separation of concerns:
1.  **CVerify.Core (C# Backend)** manages user authentication, repository metadata, job scheduling, database persistence, and SSE progress client streaming. It orchestrates the analysis job by sequentially executing each task and finally calling the aggregator.
2.  **CVerify.AI (Python Microservice)** executes resource-intensive git operations (cloning), code analysis, technology detection, file sampling, task-specific prompt logic, and interacts with the Claude API.
3.  **Redis** serves as the distributed state and security store (shared queue, pub-sub messaging for real-time progress, and HMAC nonce replay protection).
4.  **Database (PostgreSQL via EF Core)** acts as the source of truth for jobs, tasks, reports, and repository configuration.

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
    
    %% Loop of execute calls
    WORKER -->|1. Loop POST execute_task| API
    API -->|Orchestrate Task| ORCH
    ORCH -->|Clone / Read| GITHUB
    ORCH -->|Detect Stack| DET
    ORCH -->|Sample Code| SAMP
    ORCH -->|Send Task Prompt| CLAUDE_SVC
    CLAUDE_SVC -->|API Calls (Caching)| CLAUDE
    ORCH -->|Cache Task JSON| WORKSPACE[Local Temp Workspace]
    API -->|Return Task Result| WORKER
    
    %% Final aggregate call
    WORKER -->|2. POST aggregate| API
    API -->|Aggregate Cache| ORCH
    ORCH -->|Read Caches| WORKSPACE
    ORCH -->|Calibrate & Validate| ORCH
    API -->|Return ReportV2 JSON| WORKER
    
    WORKER -->|Save Report & Verify| DB
    WORKER -->|Publish Progress Event| REDIS
    CTRL -->|Subscribe Progress| REDIS
    CTRL -->|SSE progress| FE
```

---

## Repository Analysis Lifecycle

The repository analysis lifecycle follows a background processing pattern with discrete sequential tasks:

1.  **Trigger (Client)**: A logged-in user requests analysis of an authenticated GitHub repository.
2.  **Scheduling (Core)**: C# backend verifies access, validates user limits (max 2 active jobs), creates a SQL record for the `AnalysisJob` in `Queued` status, creates the 9 `AnalysisTask` records matching `pipeline_config.json`, and pushes the job ID into Redis list `repository:analysis:queue`.
3.  **Pickup (Worker)**: The background worker `BackgroundRepositoryAnalysisProcessor` pops the job from the queue and triggers execution in `RepositoryAnalysisService`.
4.  **Sequential Task Loop (Core to AI)**: For each task, the C# service signs a request containing job metadata and access tokens with an HMAC SHA-256 signature, invoking the FastAPI endpoint `/api/v1/analysis/task/execute`:
    *   **RepoStructure**: Performs initial repo classification and clone. Walks the directory structure to scan files and detect languages/frameworks.
    *   **CommitIntelligence**: Analyzes local Git log histories to calculate total commits, bus factor, active contributors, and user authorship ratio. Feeds these factual metrics to Claude to analyze repository authenticity.
    *   **SkillExtraction**: Extracts technical skill signatures and tech stack details from code samples.
    *   **ArchitectureAnalysis**: Identifies architecture patterns (MVC, Clean Architecture, etc.) and file layouts.
    *   **CodeQuality**: Inspects code quality, style, testing configuration, and logging setup.
    *   **SecurityAnalysis**: Audits dependencies and code for potential vulnerabilities.
    *   **RepositoryClassification**: Categorizes the repository's semantic domain (e.g. SaaS, CLI tool, CRUD App).
    *   **RepositorySummary**: Compiles recruiter summaries and recommendations.
    *   **CvSynthesis**: Refines and formats contribution highlights and developer profiles.
5.  **Workspace File Caching**: The Python orchestrator saves each task result inside the workspace directory (`temp_clones/{job_id}/{task_type}_result.json`) so subsequent tasks can load prior results.
6.  **Results Aggregation (Core to AI)**: The C# service calls `/api/v1/analysis/task/aggregate` with the partial task results. CVerify.AI loads the caches, runs truth calibration (reconciling Git logs vs. API stats), calculates adversarial risks, constructs a trust graph, and outputs the final `ReportV2Contract` JSON.
7.  **SSE Streaming & Persistence**:
    *   The C# background worker updates job/task progress in the DB and publishes events to Redis Pub/Sub.
    *   The client UI listens to C# controller SSE streaming (`progress-stream`), rendering the real-time progress bar based on configured task weights.
    *   Once aggregated, CVerify.Core saves the final report to `AnalysisReports` in PostgreSQL, parses `IsVerified`/`TrustScore` using `ParseV2ReportMetadata`, and updates the repository state.

---

## FastAPI Entrypoints

*   `GET /health`: Basic health check. Returns `{"status": "healthy"}`.
*   `GET /health/ready` / `GET /readiness`: Validates the existence of `ANTHROPIC_API_KEY` and tests connection to Redis.
*   `POST /api/v1/chat/stream`: Streams conversational completions from Claude. Authenticated via HMAC.
*   `POST /api/v1/analysis/task/execute`: Runs a specific repository intelligence task. Authenticated via HMAC.
*   `POST /api/v1/analysis/task/aggregate`: Combines partial task results, runs calibration and adversarial algorithms, and returns the final V2 report. Authenticated via HMAC.
*   `POST /api/v1/analysis/orchestrate/stream`: Legacy monolithic stream endpoint. Kept as a backward compatibility fallback (short-circuits classification).

---

## Service & Agent Boundaries

*   **Technology Detection Service**: Implemented inside `app/github/technology_detector.py`. Scans directory structures and files to identify libraries and frameworks.
*   **Code Sampler Service**: Implemented inside `app/github/code_sampler.py`. Inspects and filters file lists, loading up to 10 source files and package manifests while truncating files to 100 lines each to prevent prompt bloating.
*   **Claude Service**: Implemented inside `app/services/claude_service.py`. Handles Anthropic Async client connections, manages prompt caching configurations, and wraps calls in `retry_with_exponential_backoff`.
*   **Agent boundaries**: While the directory `app/agents/` contains class skeletons for multiple agents (e.g., `SkillExtractionAgent`, `VerificationAgent`), they are not active. The orchestrator executes task-specific prompts via Claude directly during each execution step.

---

## Storage & Streaming Interactions

*   **FastAPI Local Workspace**: Shallow clones git repositories and caches task result JSONs inside `CVerify.AI/temp_clones/{job_id}/`. Workspace lifecycle cleanup is triggered at the final aggregation step (`deleteWorkspace=true`) to delete the folder.
*   **Redis Nonce Cache**: The HMAC security middleware verification uses a Redis connection (`redis.from_url`) to store transaction nonces with a 5-minute TTL to prevent replay attacks.
*   **SSE Streaming**: Progress is streamed continuously using chunked responses (`StreamingResponse`) with `media_type="text/event-stream"` during chat streaming.

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | [app/main.py](../main.py) (FastAPI app configuration and endpoints) |
| **Dependencies** | FastAPI, Uvicorn, Redis (python client), Anthropic SDK, Git CLI, Pydantic |
| **Execution Flow** | Incoming HTTP Request → HMAC Auth Middleware → API Router → `/task/execute` or `/task/aggregate` → Orchestrator → Git Workspace / Claude Call |
| **Common Failure Modes** | Invalid API keys (HTTP 500/503), Git clone auth failure, Redis timeout, Claude rate-limits (recovered via exponential backoff retries), schema contract validation errors |
| **Related Files** | [app/routes/analysis_router.py](../routes/analysis_router.py), [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py), [app/middleware/hmac_auth.py](../middleware/hmac_auth.py) |
| **Related Services** | [ClaudeService](../services/claude_service.py), [TechnologyDetector](../github/technology_detector.py), [CodeSampler](../github/code_sampler.py) |
| **Related DTOs** | `TaskExecutionRequest`, `AggregationRequest`, `AnalysisRequest` |
| **Related Database Tables** | `AnalysisJobs`, `AnalysisTasks`, `AnalysisTaskResults`, `AnalysisReports`, `SourceCodeRepositories` |
| **Related Frontend Components** | `DetailedAnalysisModal`, `AnalysisStatusBadge`, `repositoryAnalysisApi` service |
