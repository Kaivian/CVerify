# AI Debugging Guide

This guide provides developers with instructions on how to trace, validate, and debug repository analysis execution using logs and telemetry.

## 1. Tracing an Analysis Execution

Every analysis job has a unique `JobId` generated in C# Core. Follow these steps to trace a run:

1. **Locate the Job ID**: Get the `job_id` from the C# logs, the database `AnalysisJobs` table, or the frontend client request.
2. **Search Logs**: Search the microservice logs for the corresponding `CorrelationId` (which matches the `job_id`).
3. **Trace the Timeline**: Trace the sequence of logs from startup to terminal state:
   - Check the `repo_classifier` logs to verify Case classification.
   - Trace `github_analysis_orchestrator` logs for git clone duration.
   - Inspect `claude_service` logs for token volumes, cost, and latency.

---

## 2. Inspecting AI Decision Metadata

If a candidate or reviewer contests a skill score or authenticity score, you can inspect the decision metadata directly in the database:

1. Query the PostgreSQL database:
   ```sql
   SELECT "ReportData" FROM "AnalysisReports" WHERE "JobId" = 'YOUR_JOB_ID_HERE';
   ```
2. Parse the JSON payload to inspect:
   - `repo.repo_type` and `repo.confidence_ceiling`.
   - `classification.classification_rationale` explaining Case selection.
   - `classification.sampled_files` to see exactly which files were sent to Claude.
   - `classification.confidence_factors` indicating triggered red flags.
   - `findings[].evidence_signals` to check cited file paths.

---

## 3. Resolving Common Failure Scenarios

### 3.1 Git Clone Timed Out / Failed
* **Symptom**: Step is stuck on `CloningRepository` or logs show `git clone failed`.
* **Resolution**:
  - Verify that the OAuth token is valid and has not expired.
  - Verify that the target repository is not empty and the branch exists.
  - Check `git_clone_duration_ms` telemetry to see if latency bounds were exceeded.

### 3.2 Claude API Rate Limit (HTTP 429)
* **Symptom**: Logs show `Transient error in Claude call: HTTP 429`.
* **Resolution**:
  - ClaudeService automatically executes a 5-attempt exponential backoff.
  - If persistent, verify Claude platform status page or increase API quota limits.

### 3.3 Missing or Malformed JSON Report
* **Symptom**: Logs show `Failed to parse Claude output as JSON`.
* **Resolution**:
  - Inspect the raw API completion text printed in the error log context.
  - Verify if system prompt specificity instructions caused output token limits to be exceeded (8192 tokens max).

## Traceability Links

* [Debugging Guide](./09-debugging-guide.md)
* [Timeline Catalog](./timeline-catalog.md)
* [Logging Catalog](./logging-catalog.md)
* [Error Handling Catalog](./error-handling-catalog.md)
