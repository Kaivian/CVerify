# 00 - Executive Summary

This document summarizes the forensic architectural audit of the `CVerify.AI` platform, presenting system maturity ratings, critical security/operational risks, and an engineering roadmap to resolve tech debt.

---

## Architectural Maturity Assessment

Based on our analysis of the codebase, CVerify.AI operates with a **hybrid architecture** that is partially simulated and partially concrete:
*   **Active Core Engine**: The file sampling, technology stack detection, HMAC signature validation, and Anthropic prompt caching integrations are functional, robust, and correctly mapped between the Python FastAPI service and the CVerify.Core C# background processor.
*   **Simulated Multi-Agent Layer**: The codebase contains a directory of seven individual agent subclasses (`app/agents/`) and skeleton orchestrators. These are completely inactive and bypassed in the live repository analysis lifecycle, which runs via a single-call prompt query against Claude.
*   **Generic Description Problem**: The current system prompt enforces a "1-2 sentences maximum" constraint on all narrative fields to prevent truncation. This produces analysis output that is technically valid but practically low-signal — descriptions are generic and not grounded in the specific files and patterns observed in each repository.
*   **Template / Identity Leaks**: Conversational endpoints are powered by legacy prompting instructions representing a travel assistant bot, which contradicts CVerify's talent intelligence domain.

---

## Critical Risks & Reliability Gaps

> [!CAUTION]
> **1. Generic Analysis Descriptions (High Priority — UX/Value Risk)**:
> The 1-2 sentence brevity constraint in `GitHubPromptFactory` produces descriptions indistinguishable between repositories. Recruiters and engineers cannot identify specific strengths or weaknesses because findings lack file citations and concrete evidence references. See [05-prompt-analysis.md](./05-prompt-analysis.md) and [14-prompt-output-contract.md](./14-prompt-output-contract.md) for the revised specificity standard.
>
> **2. Fork/Clone Misattribution (High Risk — New)**:
> The pipeline currently runs full skill extraction on **all repos without classification**, including forks where the user wrote zero original code. A forked React project scores "React: advanced" for the user even if they never modified a component. Repos cloned from tutorials (one large dump commit, no dev history) inflate all skills. Fix: implement `repo_classifier.py` running the 6-case decision tree before any clone or LLM call. See [17-repo-classification-cases.md](./17-repo-classification-cases.md).
>
> **3. Absence of Retry Logic in External API Calls (High Risk)**:
> `ClaudeService` calls the Anthropic API without an exponential backoff retry handler. A temporary network drop or Claude rate limit threshold (HTTP 429) will crash active background jobs instantly.
>
> **4. Broken Request Tracing (Medium Risk)**:
> In the FastAPI microservice, request correlation IDs are not forwarded to the `GitHubAnalysisOrchestrator` or `ClaudeService`. Git clone failures, shell execution bugs, or Claude API exceptions are written to logs with `CorrelationId: system`, rendering production log correlation impossible.
>
> **5. C# Scoring Parsing Vulnerability (Medium Risk)**:
> The C# worker uses `scoring.final_score` to determine verification thresholds. If Claude shifts its JSON formatting schema, or if the orchestrator fails to backfill the score structure, the C# DB query will throw exceptions, failing the job at the final step.

---

## Dead Code and Skeleton Inventory

The following files represent unused code assets that should either be implemented or pruned to optimize codebase maintenance:

1.  **Skeleton Agent Implementations**:
    *   [app/agents/github_agent.py](./03-agent-catalog.md) (GitHubAgent)
    *   [app/agents/skill_extraction_agent.py](./03-agent-catalog.md) (SkillExtractionAgent)
    *   [app/agents/cv_agent.py](./03-agent-catalog.md) (CvAgent)
    *   [app/agents/verification_agent.py](./03-agent-catalog.md) (VerificationAgent)
    *   [app/agents/scoring_agent.py](./03-agent-catalog.md) (ScoringAgent)
    *   [app/agents/matching_agent.py](./03-agent-catalog.md) (MatchingAgent)
    *   [app/agents/recommendation_agent.py](./03-agent-catalog.md) (RecommendationAgent)
2.  **Skeleton Orchestrators**:
    *   [app/orchestrators/cv_analysis_orchestrator.py](./04-orchestrator-analysis.md) (CvAnalysisOrchestrator)
    *   [app/orchestrators/job_matching_orchestrator.py](./04-orchestrator-analysis.md) (JobMatchingOrchestrator)
3.  **Unused Parsers & Skills Ontology**:
    *   [app/parsing/json_schema_validator.py](./11-code-path-index.md) (JsonSchemaValidator)
    *   [app/parsing/llm_response_parser.py](./11-code-path-index.md) (LlmResponseParser)
    *   [app/skills/skill_normalizer.py](./11-code-path-index.md) / [app/skills/skill_ontology.py](./11-code-path-index.md)
4.  **Skeleton Services**:
    *   [app/monitoring/ai_cost_tracker.py](./11-code-path-index.md) (AiCostTracker)
    *   [app/monitoring/pipeline_metrics.py](./11-code-path-index.md) (PipelineMetrics)
    *   [app/scoring/percentile_service.py](./11-code-path-index.md) (PercentileService)
    *   [app/embedding/embedding_service.py](./11-code-path-index.md) (OpenAiEmbeddingService)

---

## Actionable Refactoring Roadmap

### Step 1: Fix Generic Analysis Descriptions ⬅ **New / Highest Priority**
*   **Problem**: The system prompt's brevity constraint (`"keep all narrative fields to 1-2 sentences maximum"`) is producing low-signal, non-specific descriptions that undermine CVerify's core value proposition.
*   **Action**: Update `GitHubPromptFactory.get_system_prompt()` with the revised **specificity-first** instructions:
    *   Remove the "1-2 sentences maximum" constraint from the system prompt.
    *   Add inline specificity directives to the JSON schema in the user prompt: each descriptive field must cite at least one specific file path, class name, or code pattern from the sampled code.
    *   Add `evidence_signals[]` sub-field to each `findings[]` entry — a list of specific file paths or patterns that support the finding.
    *   Expand `narrative.recruiter_summary` to 3-5 sentences following the structured contract defined in [14-prompt-output-contract.md](./14-prompt-output-contract.md).
*   **Reference**: [05-prompt-analysis.md](./05-prompt-analysis.md) (revised prompt strategy) and [14-prompt-output-contract.md](./14-prompt-output-contract.md) (field-level detail contracts).
*   **Risk**: More verbose output increases token count. Verify that the 8192 max token limit is not exceeded for the typical repository size (10 files × 100 lines). Add token budget awareness to `GitHubPromptFactory` if needed.
*   **Validation**: After deploying, run analyses on 3-5 known repositories and verify that `findings[].explanation` and `narrative.recruiter_summary` cite specific file names present in the sampled set.

### Step 2: Address Prompt Brand Leak
*   **Action**: Replace the legacy travel planning prompts in `ClaudeService.stream_chat` with the canonical **CVerify Repository Intelligence Engine** system prompt detailed in [05-prompt-analysis.md](./05-prompt-analysis.md).

### Step 3: Implement Exponential API Retries
*   **Action**: Integrate a retry utility (e.g., `tenacity` or `backoff` libraries) within `claude_service.py` to gracefully catch and retry transient rate limits (HTTP 429) or gateway drops (HTTP 502/503/504) before failing the pipeline.

### Step 4: Repair Log Correlation IDs
*   **Action**: Update the orchestrator and Claude service signatures to accept and propagate the incoming `correlation_id` string, passing it as an `extra={"correlation_id": ...}` parameter to all log emissions as mapped in [10-runtime-observability-plan.md](./10-runtime-observability-plan.md).

### Step 5: Add Evidence Signal Validation
*   **Action**: After JSON parsing in the orchestrator, add a lightweight validation pass that cross-references each `findings[].evidence_signals` entry against the list of `file_names` injected into the prompt. Log a warning (not a failure) if a cited file is not in the sampled set — this flags potential hallucinations without breaking the job.

### Step 6: Implement Repository Classification (Pre-Pipeline)
*   **Problem**: The current pipeline runs the same analysis on all repos indiscriminately — a forked repo with zero original contribution is treated identically to an original work, inflating skill confidence scores for code the user never wrote.
*   **Action**: Create `app/github/repo_classifier.py` implementing the decision tree defined in [17-repo-classification-cases.md](./17-repo-classification-cases.md). Classification runs **before** any clone or LLM call using GitHub API metadata only (< 2s). It outputs a `RepoClassification` object carrying `repo_type`, `confidence_ceiling`, and `analysis_target` (parent repo for Case 3). The orchestrator passes this classification into the system prompt and applies the confidence modifier to all output scores.
*   **Cases covered**:
    *   Case 1 — Original work: full pipeline, no cap.
    *   Case 2 — Fork with no upstream contribution: exclude from skill scoring, ecosystem tag only (confidence ≤ 0.35).
    *   Case 3 — Fork with merged upstream contribution: highest-value evidence, analyze parent repo, 1.15× confidence bonus.
    *   Case 4 — Cloned/dumped repo: red flag detection via 6 API signals, 0.50–0.90× penalty, warning badge.
    *   Org public: full pipeline scoped to user's commits only (confidence ≤ 0.90).
    *   Org private: self-declare (≤ 0.40) or user-provided export (≤ 0.70).
*   **Reference**: [17-repo-classification-cases.md](./17-repo-classification-cases.md) for full API query patterns, confidence tables, and per-case AI prompt instructions.

### Step 7: Prune or Activate Agents
*   **Action**: If the system is designed to migrate to a multi-agent structure, integrate the skeleton classes into the analysis router path. Otherwise, prune the skeleton directories to reduce developer and AI agent navigation noise.

---

## Documentation Index

Explore the complete AI observability documentation suite using the relative links below:

*   [01 - System Overview](./01-system-overview.md)
*   [02 - Request Lifecycle](./02-request-lifecycle.md)
*   [03 - Agent Catalog](./03-agent-catalog.md)
*   [04 - Orchestrator Analysis](./04-orchestrator-analysis.md)
*   [05 - Prompt Analysis](./05-prompt-analysis.md) ← **Updated: specificity-first prompt design**
*   [06 - Claude Integration](./06-claude-integration.md)
*   [07 - Repository Analysis Pipeline](./07-repository-analysis-pipeline.md)
*   [08 - Data Model Map](./08-data-model-map.md)
*   [09 - Debugging Guide](./09-debugging-guide.md)
*   [10 - Runtime Observability Plan](./10-runtime-observability-plan.md)
*   [11 - Code Path Index](./11-code-path-index.md)
*   [12 - Dependency Graph](./12-dependency-graph.md)
*   [13 - Frontend AI Consumption Map](./13-frontend-ai-consumption-map.md)
*   [14 - Prompt Output Contract](./14-prompt-output-contract.md) ← **Updated: detail-level contracts per field**
*   [15 - Analysis Pipeline Playbook](./15-analysis-pipeline-playbook.md)
*   [16 - AI Analysis Workflow](./16-ai-analysis-workflow.md)
*   [17 - Repository Classification Cases](./17-repo-classification-cases.md) ← **New: fork/clone/org decision tree + per-case AI prompt instructions**

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | None (documentation suite index) |
| **Dependencies** | CVerify.AI documentation files |
| **Execution Flow** | Structural and operational roadmap index. |
| **Common Failure Modes** | Broken relative markdown links. |
| **Related Files** | [01-system-overview.md](./01-system-overview.md), [11-code-path-index.md](./11-code-path-index.md) |
| **Related Services** | None |
| **Related DTOs** | None |
| **Related Database Tables** | None |
| **Related Frontend Components** | None |
