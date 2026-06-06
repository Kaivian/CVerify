# 09 - Debugging Guide

This document is a diagnostic guide for engineers to troubleshoot, isolate, and resolve common runtime errors within the CVerify AI microservice.

---

## 1. Git Clone & Authentication Failures
*   **Where**: [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py) in `analyze_structure` (invoked during `RepoStructure` task).
*   **Symptom**: Job fails during the first task (`RepoStructure`) with `"Git clone failed: Exit code 128"` or authentication prompts in stdout.
*   **Causes**:
    *   GitHub OAuth token has expired or lacks repo permissions.
    *   Git command is missing from the system path.
    *   Network timeouts when accessing `github.com`.
*   **Diagnostics**:
    1.  Verify the decrypted token is valid by testing it via curl:
        ```bash
        curl -H "Authorization: token gho_xxx" https://api.github.com/user
        ```
    2.  Check if `git` is callable: `git --version`.
    3.  Confirm local file write access to the `temp_clones/` directory.

## 2. Claude API Outages & Rate Limits
*   **Where**: [app/services/claude_service.py](../services/claude_service.py) in `retry_with_exponential_backoff`.
*   **Symptom**: Task execution hangs or logs multiple `Transient error in Claude call` warnings.
*   **Causes**:
    *   Anthropic API rate-limits hit (HTTP 429).
    *   Out of API credits on the Anthropic console.
    *   Anthropic service outage (HTTP 502/503/504).
*   **Diagnostics**:
    1.  Check stdout logs for the retry warnings. The system retries transient errors up to **5 times** using exponential delay.
    2.  Check Anthropic Status: `status.anthropic.com`.
    3.  Verify the environment variable `ANTHROPIC_API_KEY` is loaded and active.

## 3. JSON Parsing Exceptions
*   **Where**: [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py) in `_extract_json`.
*   **Symptom**: Task completes with an error: `"Claude output did not return a valid JSON format."` or `"Sanitization failed"`.
*   **Causes**:
    *   Claude response was truncated due to output token constraints (`max_tokens` limit).
    *   Claude included conversational wrapping text (e.g. "Here is the JSON:") despite strict formatting instructions.
*   **Diagnostics**:
    1.  If debug logging is active (`AI_DEBUG_MODE=true`), inspect the raw prompt response in the logs.
    2.  Verify the Pydantic schemas in `github_prompt_factory.py` are compact and do not exceed Claude's output buffer limit.
    3.  `_extract_json` uses brace boundary scanning (`find('{')` and `rfind('}')`) to bypass markdown fences. Check if nested braces are correctly balanced in the LLM's response.

## 4. Aggregator Schema Violations
*   **Where**: [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py) in `aggregate_results`.
*   **Symptom**: Aggregator returns HTTP 400 with `Report V2 Contract validation failure`.
*   **Causes**:
    *   A discrete task cached unparseable or corrupted JSON results on disk.
    *   Pydantic validation rules failed (e.g. `confidence` was outside `0.0 - 1.0`, or `schemaVersion` did not match `"v2"`).
*   **Diagnostics**:
    1.  Inspect the workspace directory `temp_clones/{job_id}/` for cached task outputs:
        *   `RepoStructure_result.json`
        *   `CommitIntelligence_result.json`
        *   `SkillExtraction_result.json`
        *   `ArchitectureAnalysis_result.json`
        *   `CodeQuality_result.json`
        *   `SecurityAnalysis_result.json`
        *   `RepositoryClassification_result.json`
        *   `RepositorySummary_result.json`
        *   `CvSynthesis_result.json`
    2.  Check the error trace to see which field violated the Pydantic type constraints.

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | Logs located at `app.log` or standard stdout streams |
| **Dependencies** | Python standard `logging` setup in [app/monitoring/observability.py](../monitoring/observability.py) |
| **Execution Flow** | Diagnostic procedure mapping exceptions back to the 9 discrete task nodes and final aggregator. |
| **Common Failure Modes** | Workspace cleanup occurred (`deleteWorkspace=true`), erasing cached files before debugging could begin. For debugging, set `deleteWorkspace` to `false` in tests. |
| **Related Files** | [app/services/claude_service.py](../services/claude_service.py), [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py) |
| **Related Services** | None |
| **Related DTOs** | None |
| **Related Database Tables** | `AnalysisJobEvents` (holds SQL server copy of logs) |
| **Related Frontend Components** | `DetailedAnalysisModal.tsx` (displays error messages) |
