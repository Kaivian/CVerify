# Observability Gap Analysis

This document audits the legacy observability defects in `CVerify.AI` and highlights how the refactored architecture resolves them.

## Identified Gaps and Resolutions

### Gap 1: Request Correlation ID Propagation
* **Defect**: The correlation ID formatter existed in `main.py` but required manual `extra={"correlation_id": ...}` propagation. Down-funnel components like `GitHubAnalysisOrchestrator` and `ClaudeService` had no correlation ID argument.
* **Impact**: Git clones, sampler walks, and Claude API exceptions were logged as `CorrelationId: system`, rendering production traceability impossible.
* **Resolution**: Implemented contextvars-based trace context (`TraceContext`) inside `observability.py`. Incoming request correlation IDs are bound to the coroutine context, ensuring all logger calls automatically format with the correct trace ID. Forwarded the correlation ID through parameters to individual tasks and ClaudeService to log usage telemetry and calculate costs.

### Gap 2: Claude Token & Cost Analytics
* **Defect**: Response token metadata was discarded, and the `AiCostTracker` was a dead skeleton.
* **Impact**: Total cost per analysis, user, or platform was completely unobserved.
* **Resolution**: Refactored `AiCostTracker` to calculate Claude 3.5 Sonnet costs (handling base, cached creation, and cached read input tokens) and record it thread-safely per correlation ID.

### Gap 3: API Retry Logic
* **Defect**: Anthropic client calls lacked retry mechanisms.
* **Impact**: Transient rate limit exceptions (HTTP 429) or gateway drops (HTTP 502/503/504) crashed background jobs instantly.
* **Resolution**: Implemented custom `retry_with_exponential_backoff` in `claude_service.py` to handle transient server and rate limit errors.

### Gap 4: Case-Based Decision Traceability
* **Defect**: Repository classification did not exist.
* **Impact**: Forked repositories, suspicous clones, or org private code dumps could not be audited, leading to skill score inflation.
* **Resolution**: Implemented `repo_classifier.py` deterministic case selection and injected decision auditability metadata (`repo_type`, `confidence_ceiling`, `sampled_files`, `ignored_files_count`, `confidence_factors`, `classification_rationale`) directly into report JSON payloads.

### Gap 5: Evidence signal verification
* **Defect**: No checking was performed on cited evidence file paths.
* **Impact**: Hallucinated file citations passed undetected to frontend components.
* **Resolution**: Added orchestrator validation checking `findings[].evidence_signals` against the sampled file names, logging warning alerts on anomalies.

## Traceability Links

* [Runtime Observability Plan](./10-runtime-observability-plan.md)
* [Logging Catalog](./logging-catalog.md)
* [Telemetry Catalog](./telemetry-catalog.md)
