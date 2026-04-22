# Architecture Overview

This document describes the high-level system architecture of `CVerify.AI` and its integration with the core platform services.

## System Topology

The platform separates responsibilities between a secure, stateful C# core service and a stateless Python FastAPI microservice:

1. **CVerify.Core (C# Backend)**:
   - Manages user sessions, authentication, and token encryption.
   - Triggers and manages repository analysis background jobs.
   - Exposes SSE endpoints to feed real-time progression to the React Client.
   - Handles SQL Database persistence via Entity Framework Core.
2. **CVerify.AI (Python Microservice)**:
   - Processes git clone, directory walk scans, and file code sampling.
   - Queries the Anthropic API with structured prompts.
   - Computes API execution telemetry and estimated API costs.
   - Yields step-by-step progress events back to C# Core.
3. **Redis**:
   - Shares the analysis job execution queue (`repository:analysis:queue`).
   - Acts as a pub-sub message channel for real-time progress events.
   - Retains HMAC signature nonces with a 5-minute TTL to defend against replay vectors.
4. **PostgreSQL**:
   - Stores SQL records for users, authenticated providers, jobs, and full JSONB intelligence reports.

## Architecture Diagram

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
        COST_TRK[AiCostTracker]
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
    CLAUDE_SVC -->|Record Cost| COST_TRK
    ORCH -->|SSE progress & report| WORKER
    WORKER -->|Save Report & Verify| DB
    WORKER -->|Publish Progress Event| REDIS
    CTRL -->|Subscribe Progress| REDIS
    CTRL -->|SSE progress| FE
```

## Traceability Links

* [System Overview](./01-system-overview.md)
* [Request Lifecycle](./02-request-lifecycle.md)
* [Code Path Index](./11-code-path-index.md)
