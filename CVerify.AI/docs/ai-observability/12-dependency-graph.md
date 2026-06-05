# 12 - Dependency Graph

This document provides a comprehensive map of structural and runtime dependencies across the CVerify platform, distinguishing active production paths from dead code pathways.

---

## Active Pipeline Dependency Map

The diagram below details the active execution chain starting from the frontend trigger down to external database persistence and the Anthropic Claude API.

```mermaid
graph TD
    %% Frontend
    subgraph Client [TypeScript Frontend]
        UI[DetailedAnalysisModal.tsx] -->|Triggers| APISvc[repository-analysis.service.ts]
    end

    %% C# Core Backend
    subgraph CoreBackend [CVerify.Core C# Backend]
        CTRL[RepositoryAnalysisController.cs] -->|Invokes| CoreSvc[RepositoryAnalysisService.cs]
        CoreSvc -->|Pushes Job| Q[BackgroundRepositoryAnalysisQueue.cs]
        CoreSvc -->|Reads/Writes| DB[(PostgreSQL DBContext)]
        Q -->|Persists in| RedisQ[(Redis Lists)]
        
        Worker[BackgroundRepositoryAnalysisProcessor.cs] -->|Pops Job| Q
        Worker -->|Executes Job| CoreSvc
        CoreSvc -->|Sends HTTP POST| AIClient[FastAPI HTTP Client]
    end

    %% Python AI Microservice
    subgraph AIMicroservice [CVerify.AI Python Service]
        AI_Router[analysis_router.py] -->|Invokes| AI_Orch[github_analysis_orchestrator.py]
        AI_Orch -->|Invokes| Tech[technology_detector.py]
        AI_Orch -->|Invokes| Sampler[code_sampler.py]
        AI_Orch -->|Invokes| Prompt[github_prompt_factory.py]
        AI_Orch -->|Invokes| Claude[claude_service.py]
    end

    %% External Interfaces
    subgraph ExternalServices [External Integrations]
        Claude -->|HTTP Request| Anthropic[Anthropic Claude API]
        AI_Orch -->|Subprocess Shell| GitCLI[Local Git CLI Command]
        GitCLI -->|Queries| GitHub[GitHub API / Git Server]
    end

    %% Integrations
    APISvc -->|HTTP GET/POST| CTRL
    AIClient -->|HTTP POST + SSE Stream| AI_Router
```

---

## Inactive and Dead Dependency Chains

The codebase contains several modules, folder blocks, and files that are completely decoupled from runtime execution. The diagram below illustrates these dead-end dependency nodes:

```mermaid
graph TD
    subgraph Skeletons [Unused / Skeleton Modules]
        CV_Orch[cv_analysis_orchestrator.py]
        Match_Orch[job_matching_orchestrator.py]
        
        subgraph Agents [app/agents/ Skeletons]
            BaseAgent[base.py]
            GitHubAgent[github_agent.py]
            SkillAgent[skill_extraction_agent.py]
            CvAgent[cv_agent.py]
            VerifyAgent[verification_agent.py]
            ScoringAgent[scoring_agent.py]
            MatchingAgent[matching_agent.py]
            RecAgent[recommendation_agent.py]
        end
        
        subgraph UnusedUtils [app/parsing & app/skills]
            JSONSchema[json_schema_validator.py]
            LLMParser[llm_response_parser.py]
            SkillOnt[skill_ontology.py]
            SkillNorm[skill_normalizer.py]
        end

        subgraph UnusedServices [app/scoring & app/embedding & app/monitoring]
            Percentile[percentile_service.py]
            Weighted[weighted_scoring_engine.py]
            CostTrack[ai_cost_tracker.py]
            Metrics[pipeline_metrics.py]
            EmbedSvc[embedding_service.py]
        end
    end

    GitHubAgent -.-> BaseAgent
    SkillAgent -.-> BaseAgent
    CvAgent -.-> BaseAgent
    VerifyAgent -.-> BaseAgent
    ScoringAgent -.-> BaseAgent
    MatchingAgent -.-> BaseAgent
    RecAgent -.-> BaseAgent
```

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | None (dependency directory mapping) |
| **Dependencies** | Core C# Backend, Python FastAPI Backend, Postgres SQL, Redis Server |
| **Execution Flow** | Component structural relationships mapped in visual flowcharts. |
| **Common Failure Modes** | Broken architecture boundaries (e.g. attempting to import `app.agents` inside orchestrators, which would import skeleton classes). |
| **Related Files** | [app/main.py](../main.py), `RepositoryAnalysisService.cs` |
| **Related Services** | [ClaudeService](../services/claude_service.py), `BackgroundRepositoryAnalysisProcessor` |
| **Related DTOs** | None |
| **Related Database Tables** | `AnalysisJobs`, `AnalysisReports` |
| **Related Frontend Components** | `DetailedAnalysisModal.tsx` |
