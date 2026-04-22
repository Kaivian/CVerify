# Error Handling Catalog

This catalog defines the failure taxonomy, retry policies, and error diagnostics guidelines for `CVerify.AI`.

## 1. Failure Taxonomy Model

All pipeline and service errors are classified into five operational categories to facilitate consistent alerting, dashboards, and automated triage.

### 1.1 System Failures
Critical platform or infrastructure level issues that prevent the microservice from executing tasks.
* **Examples**:
  - Redis database connection failures during nonce checks.
  - Python FastAPI microservice offline or crashed.
  - Database concurrency conflicts during C# save operations.
* **Triage Policy**: Generate immediate alerts. Require developer intervention.

### 1.2 External Dependency Failures
Errors originating from upstream external APIs or third-party networks.
* **Examples**:
  - Anthropic API rate limits (HTTP 429) or gateway drops (HTTP 500/502/503/504).
  - GitHub API token scope limitations or rate limits.
  - Outbound git clone network errors or firewall blocks.
* **Triage Policy**: Attempt exponential backoff retries. If persistent, log as critical dependency faults.

### 1.3 User Errors
Issues caused by invalid input parameters, configurations, or credentials provided by the candidate.
* **Examples**:
  - Invalid repository URL or missing OAuth scope.
  - Expired user authentication session or revoked token.
  - Target repository branch does not exist.
* **Triage Policy**: Return clear, actionable user-facing messages. Do not alert developer channels.

### 1.4 Data Validation Errors
Input payloads or files that violate structured constraints or sizes.
* **Examples**:
  - Repository exceeds maximum file count limit (>10,000 files).
  - Repository size exceeds bounds (>150MB).
  - Malformed JSON body in FastAPI analysis request.
* **Triage Policy**: Reject immediately with structured validation responses (HTTP 422).

### 1.5 AI Quality Failures
Hallucinations, parsing errors, or quality anomalies in the generated intelligence outputs.
* **Examples**:
  - Claude returns unparseable markdown blocks instead of raw JSON.
  - Claude response lacks required JSON schema parameters.
  - Cites hallucinated file paths that are absent from the sampled file list.
* **Triage Policy**: Log warnings (e.g. for evidence signal mismatch) or throw retry exceptions (for unparseable JSON).

---

## 2. API Retry & Backoff Configuration

To mitigate transient rate limits and gateway drops, `ClaudeService` executes an exponential backoff routine:

* **Initial Delay**: 1.0 seconds
* **Backoff Factor**: 2.0x multiplier
* **Max Retries**: 5 attempts
* **Jitter**: Random noise added to prevent synchronized thundering herds.
* **Applicable Exceptions**: Catch and retry on HTTP 429, 500, 502, 503, 504 and generic network timeout/connections drops.

## Traceability Links

* [Debugging Guide](./09-debugging-guide.md)
* [Analysis Pipeline Playbook](./15-analysis-pipeline-playbook.md)
