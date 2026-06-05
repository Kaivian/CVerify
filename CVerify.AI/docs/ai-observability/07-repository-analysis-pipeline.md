# 07 - Repository Analysis Pipeline

This document details the step-by-step execution pipeline of the CVerify Repository Intelligence Engine, defining the inputs, outputs, duration estimates, potential failures, and log signatures for each of the 8 distinct phases.

---

## Pipeline Stage Breakdown

The entire analysis lifecycle is decomposed into 8 sequential stages, executed within `GitHubAnalysisOrchestrator.orchestrate_async()` and orchestrated from the C# core backend:

| Stage | Name | Input | Output | Est. Duration | Failures |
|---|---|---|---|---|---|
| **1** | **Prepare Job Workspace** | Job ID | Temp workspace directory structure | < 1 sec | Directory permission error |
| **2** | **Git Clone Repository** | GitHub OAuth token, Repository URL, Branch | Shallow cloned files on disk | 2 - 25 sec | Invalid token, missing branch, git host offline |
| **3** | **Technology Detection** | Cloned files list | List of detected framework/library tags | 1 - 3 sec | Missing package files |
| **4** | **Codebase File Sampling** | Local repository path, maximum file/size settings | Selected manifests, doc files, and code snippets | 2 - 5 sec | Repo size > 150MB, files count > 10,000 |
| **5** | **Prompt Generation** | Ingested manifests, technology lists, file contents | Formatted System & User Prompt strings | < 1 sec | Zipping array length mismatch |
| **6** | **Invoke Claude Analysis** | Compiled Prompt strings | Raw output Markdown JSON text block | 10 - 45 sec | Rate limits, API timeout, authentication block |
| **7** | **JSON Parsing & Backfilling** | Raw text block | Valid JSON dict structure, score & band fields | < 1 sec | Output truncated, unparseable JSON |
| **8** | **Report Streaming & Persistence** | Report JSON | Updated DB records, completed SSE closure payload | 1 - 2 sec | DB lock, Redis connection failure |

---

## Detailed Stage Analysis

### Stage 1: Prepare Job Workspace
*   **Action**: Creates a `temp_clones/` base directory (if missing) and requests a unique temporary directory via Python's standard `tempfile.TemporaryDirectory`.
*   **Failures**: File permission denials when creating folders inside the microservice root.
*   **Log Signature**: None explicitly written.

### Stage 2: Git Clone Repository
*   **Action**: Executes `subprocess.run` to call `git clone --depth 1`. If a branch is specified, it tries to clone that branch. If it fails, it deletes the folder and retries cloning the repository's default branch.
*   **Failures**: Incorrect credentials, branch name missing from remote repository, connection timeouts.
*   **Log Signature**:
    *   *Error*: `Clone failed for {repo_owner}/{repo_name}` (logged as traceback by `logger.exception`).

### Stage 3: Technology Detection
*   **Action**: Recursively walks the directory structure. Ingests the first 2,000 bytes of manifest files (e.g. `package.json`, `requirements.txt`, `.csproj`) and checks for names of common libraries/frameworks.
*   **Failures**: Inability to parse manifest text, missing encoding types.
*   **Log Signature**: None.

### Stage 4: Codebase File Sampling
*   **Action**: Iterates over files (ignoring `.git`, `node_modules`, `bin`, `obj`, etc.). Checks total files limit (>10,000) and total directory size (>150MB). Selects manifest files, key docs, and up to 10 largest source files, reading the first 100 lines of each.
*   **Failures**: Triggers size limit errors or files limit errors.
*   **Log Signature**:
    *   *Error*: `Sampling failed for {repo_owner}/{repo_name}: {error_message}` (logged via `logger.error`).

### Stage 5: Prompt Generation
*   **Action**: Synthesizes the system prompt (schema instructions) and compiles user inputs into a structured markdown-delimited string representing the file contents.
*   **Failures**: Out of memory errors for exceptionally large arrays.
*   **Log Signature**: None.

### Stage 6: Invoke Claude Analysis
*   **Action**: Sends prompts to Anthropic Claude via `AsyncAnthropic.messages.create()`.
*   **Failures**: Rate limits (HTTP 429), Context Length exceeded, Anthropic Service outages.
*   **Log Signature**:
    *   *Error*: `Error calling Anthropic Claude API for repository analysis: {error_message}`.

### Stage 7: JSON Parsing & Backfilling
*   **Action**: Trims response text, locates the outermost braces `{ ... }`, parses it into a dictionary, inserts `repository_id` and name fields, and backfills `scoring.final_score` from `trust.confidence` if scoring is missing.
*   **Failures**: Truncated completions causing syntax errors during JSON decoding.
*   **Log Signature**:
    *   *Warning*: `Failed to parse extracted JSON block: {parse_err}`
    *   *Error*: `Failed to parse Claude output as JSON. Output: ...`

### Stage 8: Report Streaming & Persistence
*   **Action**: Yields progress and report data frames over SSE connection to CVerify.Core. C# backend writes final `AnalysisReport` records and flags the repo as verified or not in the DB.
*   **Failures**: SQL Server constraints, database lock issues, Redis channel socket closed.
*   **Log Signature**:
    *   *Error*: `Error during repository analysis flow: {error_message}` (in `analysis_router.py`).
    *   *Core Error*: `Failed to run analysis job {JobId}` (in C# `RepositoryAnalysisService.cs`).

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | `orchestrate_async` in [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py) |
| **Dependencies** | Python: `TechnologyDetector`, `CodeSampler`, `GitHubPromptFactory`, `ClaudeService` |
| **Execution Flow** | Stage 1 (Temp Dir) → Stage 2 (Git Clone) → Stage 3 (Tech Scan) → Stage 4 (Sampling) → Stage 5 (Prompts) → Stage 6 (Claude) → Stage 7 (JSON Extract) → Stage 8 (SSE Return) |
| **Common Failure Modes** | Repository size limits (150MB), Git auth errors, Claude schema structural deviations. |
| **Related Files** | [app/routes/analysis_router.py](../routes/analysis_router.py), [app/github/code_sampler.py](../github/code_sampler.py), [app/github/technology_detector.py](../github/technology_detector.py) |
| **Related Services** | [ClaudeService](../services/claude_service.py) |
| **Related DTOs** | `AnalysisRequest` |
| **Related Database Tables** | `AnalysisJobs`, `AnalysisJobEvents`, `AnalysisReports`, `SourceCodeRepositories` |
| **Related Frontend Components** | `DetailedAnalysisModal.tsx` |
