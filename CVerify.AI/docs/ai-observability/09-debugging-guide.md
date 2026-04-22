# 09 - Debugging Guide

This document is a practical troubleshooting manual for engineers and AI agents diagnosing failures across the CVerify.AI pipeline.

---

## 1. Repository Clone Failure
*   **Where**: [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py) in `orchestrate_async` (lines 70-100)
*   **Symptoms**: UI progress indicator hangs on `CloningRepository` and then transitions to a red `Failed` state. The user receives a message such as: `"Failed to clone repository (Exception): ..."` or `"Git clone failed: ..."`.
*   **Expected Logs**:
    *   *Microservice*: `CorrelationId: system - Clone failed for {repo_owner}/{repo_name}` (logged as traceback by `logger.exception`).
*   **Resolution Steps**:
    1.  Confirm that the Git CLI is installed and added to the PATH on the host running the FastAPI service.
    2.  Verify the repository branch exists on the remote Git server.
    3.  Confirm the GitHub Personal Access Token is valid, active, and has read scope permissions for the target repository.
    4.  Verify that `GIT_TERMINAL_PROMPT="0"` is set in the environment variables (the orchestrator sets this, but verify system-level overrides) to prevent Git subprocesses from prompting for credentials in stdin.

---

## 2. Claude API Failure
*   **Where**: [app/services/claude_service.py](../services/claude_service.py) in `analyze_repo` (lines 53-73) and [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py) in `orchestrate_async` (lines 162-167)
*   **Symptoms**: Job fails at step `RunningAgents`. Error displayed: `"Claude analysis service failure: ..."` or `"Claude analysis service failure: APIConnectionError"`.
*   **Expected Logs**:
    *   *Microservice*: `CorrelationId: system - Error calling Anthropic Claude API for repository analysis: {exception}`
    *   *Microservice*: `CorrelationId: system - Claude analysis failed for {owner}/{name}: {exception}`
*   **Resolution Steps**:
    1.  Verify the `ANTHROPIC_API_KEY` is loaded by checking microservice console startup output: `"Anthropic API Key Configured: True"`.
    2.  Confirm that the credit balance on the Anthropic Developer Console is positive.
    3.  Check if `CLAUDE_MODEL` is configured to a valid, supported Anthropic model tag (e.g. `claude-3-5-sonnet-20241022`).

---

## 3. Server-Sent Events (SSE) Streaming Failure
*   **Where**: `RepositoryAnalysisService.cs` in `ExecuteAnalysisJobAsync` (lines 269-318)
*   **Symptoms**: UI spinner hangs indefinitely, or the connection terminates early without displaying report details.
*   **Expected Logs**:
    *   *C# Core Service*: `Failed to parse SSE event chunk from AI microservice: {Chunk}`
    *   *C# Core Service*: `AI microservice stream ended without returning final report data.`
*   **Resolution Steps**:
    1.  Confirm that the FastAPI server is running and is reachable from the CVerify.Core container/host via curl or ping.
    2.  Check for intervening proxy servers (e.g., Nginx, IIS) that might buffer chunked HTTP responses. Ensure proxies have `X-Accel-Buffering: no` or `proxy_buffering off` configured.

---

## 4. JSON Schema Parsing Failure
*   **Where**: [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py) in `orchestrate_async` (lines 170-189)
*   **Symptoms**: Job completes Claude analysis but fails in `RunningAgents`. Error message: `"Claude output did not return a valid JSON format."`
*   **Expected Logs**:
    *   *Microservice*: `CorrelationId: system - Failed to parse extracted JSON block: {parse_err}`
    *   *Microservice*: `CorrelationId: system - Failed to parse Claude output as JSON. Output: {raw_report}`
*   **Resolution Steps**:
    1.  Inspect the raw text output logged from Claude.
    2.  Identify if Claude truncated its output mid-object due to token limits. If so, reduce `max_files` (default 10) or `max_lines_per_file` (default 100) inside `github_analysis_orchestrator.py` to reduce context size.
    3.  Verify that the sampled codebase contents do not contain nested escape characters that break JSON boundaries.

---

## 5. Redis Connectivity and Nonce Replay Failures
*   **Where**: [app/middleware/hmac_auth.py](../middleware/hmac_auth.py) in `verify_hmac_signature` (lines 43-57)
*   **Symptoms**: C# Core receives HTTP 503 `"Signature store unavailable."` or `"Distributed security store offline."` when POSTing trigger requests.
*   **Expected Logs**:
    *   *Microservice*: `Redis connection error during nonce validation: {re}`
    *   *Microservice*: `Redis client is offline. Signature verification failed closed.`
*   **Resolution Steps**:
    1.  Verify the Redis server is online and responding.
    2.  Confirm that the connection string `REDIS_URL` (in Python) and `REDIS_HOST` / `REDIS_PORT` (in C#) point to the same Redis instance.
    3.  Check Docker network configurations if running inside containers.

---

## 6. Database Persistence Failures
*   **Where**: `RepositoryAnalysisService.cs` in `ExecuteAnalysisJobAsync` (lines 330-365)
*   **Symptoms**: Microservice successfully completes report aggregation, but Core worker fails at step `SavingReport`.
*   **Expected Logs**:
    *   *C# Core Service*: `Failed to run analysis job {JobId} - Microsoft.EntityFrameworkCore.DbUpdateException: ...`
*   **Resolution Steps**:
    1.  Check DB storage spaces.
    2.  Verify the Postgres `AnalysisReports` schema columns.
    3.  Ensure database migrations have been successfully run (specifically verifying that JSONB column attributes are supported).

---

## 7. Analysis Timeout Failure
*   **Where**: `RepositoryAnalysisService.cs` in `ExecuteAnalysisJobAsync` (lines 366-384)
*   **Symptoms**: Job switches status to `TimedOut` exactly 10 minutes after starting. Error message: `"The analysis exceeded the maximum execution timeout of 10 minutes."`
*   **Expected Logs**:
    *   *C# Core Service*: `Repository analysis job {JobId} timed out or was cancelled.`
*   **Resolution Steps**:
    1.  Determine which stage was executing when the timeout occurred. If git cloning is slow, review network links to GitHub.
    2.  If Claude API latency is high, check Anthropic status pages for performance degradation.

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | None (troubleshooting manual) |
| **Dependencies** | Python: `fastapi`, `redis`, `anthropic`, `git`. C#: `EF Core`, `StackExchange.Redis`. |
| **Execution Flow** | Diagnostic manuals map errors to specific line numbers and troubleshooting steps. |
| **Common Failure Modes** | Invalid environment variables, blocked network ports, stale security tokens. |
| **Related Files** | [app/middleware/hmac_auth.py](../middleware/hmac_auth.py), [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py) |
| **Related Services** | [ClaudeService](../services/claude_service.py), `RepositoryAnalysisService.cs` |
| **Related DTOs** | None |
| **Related Database Tables** | `AnalysisJobs`, `AnalysisJobEvents`, `AnalysisReports` |
| **Related Frontend Components** | `DetailedAnalysisModal.tsx` |
