# Logging Catalog

This catalog documents the logging configuration, logger instances, correlation ID mapping, and structured JSON logs standard for `CVerify.AI`.

## 1. Logger Instances

The Python microservice configures and registers distinct logger instances using the standard Python `logging` library:

* `cverify-ai`: Root application logger handles startup validations and lifespans.
* `analysis_router`: Logs router entry, execution parameters, and task outcomes.
* `github_analysis_orchestrator`: Logs task-specific steps, workspace caching, and truth calibrations.
* `claude_service`: Logs Anthropic API transits, errors, backoff retries, and token/cost telemetry.
* `hmac_auth`: Logs authentication events, signatures, and nonce protections.
* `repo_classifier`: Logs repository decision cases, commits lists, and red flags.
* `ai_cost_tracker`: Logs calculated token USD costs and registries.

---

## 2. Request Correlation & Contextvars

* **Correlation ID**: The header `X-Correlation-Id` is passed in all requests from C# Core (which matches the Job ID database record).
* **Middleware Ingestion**: The request middleware extracts `X-Correlation-Id` and binds it to `TraceContext` context variables.
* **Trace Context Formatter**: A custom formatter (defined in `observability.py`) formats all log entries to automatically output `CorrelationId: %(correlation_id)s` and span data without manually passing extra dictionaries.
* **Context-Local Trace Context**: Correlation and span details are automatically stored inside `TraceContext` coroutine-local context variables and resolved by the log formatter.
* **Propagation Path**:
  - `analysis_router` -> `GitHubAnalysisOrchestrator.execute_task(..., correlation_id)` and `aggregate_results(..., correlation_id)`
  - `GitHubAnalysisOrchestrator` -> `ClaudeService.analyze_repo_with_telemetry(..., correlation_id)`
  - `ClaudeService` -> Logs and `AiCostTracker` usage recordings.

---

## 3. Structured JSON Schema Standard

For indexing and search inside cloud collectors, all logs follow this structured JSON schema:

```json
{
  "timestamp": "2026-06-06T18:59:51.000Z",
  "level": "INFO",
  "logger": "claude_service",
  "correlation_id": "018f6f69-d4c5-7a42-990a-5b1285311e9f",
  "duration_ms": 4210,
  "input_tokens": 1050,
  "output_tokens": 450,
  "estimated_cost_usd": 0.00782,
  "message": "Claude call successful. Tokens: In=1050, Out=450, Cost=$0.007820"
}
```

## Traceability Links

* [Runtime Observability Plan](./10-runtime-observability-plan.md)
* [Debugging Guide](./09-debugging-guide.md)
