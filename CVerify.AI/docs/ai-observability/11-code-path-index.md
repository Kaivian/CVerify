# 11 - Code Path Index

This document is a searchable, master directory of all source files in the `CVerify.AI` project. It maps the purpose of each file and lists its runtime consumers.

---

## Master Code Directory Index

| File | Component / Type | Technical Purpose | Used By (Consumers) |
|---|---|---|---|
| [app/main.py](../main.py) | Entry Point | Configures FastAPI app, lifespan setup, and root HTTP/SSE endpoints | System Startup / Uvicorn |
| [app/config.py](../config.py) | Configuration | Loads `.env` file and defines Pydantic validation settings | Entire Application |
| [app/middleware/hmac_auth.py](../middleware/hmac_auth.py) | Middleware Security | Validates client signatures and extracts transaction nonces | [app/main.py](../main.py), [app/routes/analysis_router.py](../routes/analysis_router.py) |
| [app/routes/analysis_router.py](../routes/analysis_router.py) | Router / HTTP | Exposes repository analysis orchestration endpoint | [app/main.py](../main.py) |
| [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py) | Orchestrator | Coordinates git clones, tech scans, sampling, and Claude requests | [app/routes/analysis_router.py](../routes/analysis_router.py) |
| [app/github/technology_detector.py](../github/technology_detector.py) | Analyzer Utility | Scans filenames and reads manifests to identify languages/frameworks | [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py) |
| [app/github/code_sampler.py](../github/code_sampler.py) | Analyzer Utility | Limits repo sizes and extracts representative source code snippets | [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py) |
| [app/prompts/github_prompt_factory.py](../prompts/github_prompt_factory.py) | Prompt Factory | Generates system instructions and formats code sample templates | [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py) |
| [app/services/claude_service.py](../services/claude_service.py) | Client Service | Wraps Anthropic client and executes prompt caching API calls | [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py), [app/main.py](../main.py) |
| [app/agents/base.py](../agents/base.py) | Agent Base | Declares standard `IAgent` execution interface | [app/agents/](../agents/) modules |
| [app/agents/github_agent.py](../agents/github_agent.py) | Dead Agent / Skeleton | Skeleton class for repo analysis | Unused |
| [app/agents/skill_extraction_agent.py](../agents/skill_extraction_agent.py) | Dead Agent / Skeleton | Skeleton class for profile parsing | Unused |
| [app/agents/cv_agent.py](../agents/cv_agent.py) | Dead Agent / Skeleton | Skeleton class for CV parsing | Unused |
| [app/agents/verification_agent.py](../agents/verification_agent.py) | Dead Agent / Skeleton | Skeleton class for cross-matching CV/git | Unused |
| [app/agents/scoring_agent.py](../agents/scoring_agent.py) | Dead Agent / Skeleton | Skeleton class for rating calculations | Unused |
| [app/agents/matching_agent.py](../agents/matching_agent.py) | Dead Agent / Skeleton | Skeleton class for job alignment | Unused |
| [app/agents/recommendation_agent.py](../agents/recommendation_agent.py) | Dead Agent / Skeleton | Skeleton class for learning suggestions | Unused |
| [app/orchestrators/cv_analysis_orchestrator.py](../orchestrators/cv_analysis_orchestrator.py) | Dead Orch / Skeleton | Skeleton class for resume pipelines | Unused |
| [app/orchestrators/job_matching_orchestrator.py](../orchestrators/job_matching_orchestrator.py) | Dead Orch / Skeleton | Skeleton class for job matching | Unused |
| [app/parsing/json_schema_validator.py](../parsing/json_schema_validator.py) | Unused Parser | Type-based structured parser stub | Unused |
| [app/parsing/llm_response_parser.py](../parsing/llm_response_parser.py) | Unused Parser | Regular expression JSON text blocks block extractor | Unused |
| [app/monitoring/ai_cost_tracker.py](../monitoring/ai_cost_tracker.py) | Unused Monitoring | Tracks financial cost estimates per candidate | Unused |
| [app/monitoring/pipeline_metrics.py](../monitoring/pipeline_metrics.py) | Unused Monitoring | Records latency and token usage metrics | Unused |
| [app/scoring/percentile_service.py](../scoring/percentile_service.py) | Unused Scoring | Calculates rank comparisons | Unused |
| [app/scoring/weighted_scoring_engine.py](../scoring/weighted_scoring_engine.py) | Unused Scoring | Executes arithmetic formulas for rating averages | Unused |
| [app/skills/skill_normalizer.py](../skills/skill_normalizer.py) | Unused Skills | Resolves skills against predefined dictionary | Unused |
| [app/skills/skill_ontology.py](../skills/skill_ontology.py) | Unused Skills | Dictionary matching system | Unused |
| [app/embedding/embedding_service.py](../embedding/embedding_service.py) | Unused Embeddings | OpenAI text embeddings client | Unused |

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | [app/main.py](../main.py) |
| **Dependencies** | FastAPI framework, Pydantic configuration |
| **Execution Flow** | Navigation guide index of all source files. |
| **Common Failure Modes** | Broken import statements if file directories are moved. |
| **Related Files** | None |
| **Related Services** | None |
| **Related DTOs** | None |
| **Related Database Tables** | None |
| **Related Frontend Components** | None |
