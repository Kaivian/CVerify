# Logging Catalog

This catalog documents the logging configuration, logger instances, correlation ID mapping, and structured JSON logs standard for `CVerify.AI`.

## 1. Logger Instances

The Python microservice configures and registers distinct logger instances using the standard Python `logging` library:

* `cverify-ai`: Root application logger handles startup validations and lifespans.
* `analysis_router`: Logs router entry, execution parameters, and final SSE outcomes.
* `github_analysis_orchestrator`: Logs git clone, technology stack scan, and file sampling.
* `claude_service`: Logs Anthropic API transits, errors, and token/cost telemetry.
* `hmac_auth`: Logs authentication events, signatures, and nonce protections.
* `repo_classifier`: Logs repository decision cases, commits lists, and red flags.
* `ai_cost_tracker`: Logs calculated token USD costs and registries.

---

## 2. Request Correlation

* **Correlation ID**: The header `X-Correlation-Id` is passed in all requests from C# Core (which matches the Job ID database record).
* **Middleware Ingestion**: The security middleware (`hmac_auth.py`) extracts `X-Correlation-Id` and assigns it to `request.state.correlation_id`.
* **Logging Formatter**: A custom `CorrelationIdFormatter` (defined in `main.py`) formats all log entries to output `CorrelationId: %(correlation_id)s`.
* **Manual Propagation**: The correlation ID string must be propagated through signatures of all down-funnel calls:
  - `analysis_router` -> `GitHubAnalysisOrchestrator.orchestrate_async(..., correlation_id)`
  - `GitHubAnalysisOrchestrator` -> `ClaudeService.analyze_repo(..., correlation_id)`
  - `ClaudeService` -> Logs and `AiCostTracker` usage recordings.

---

## 3. Structured JSON Schema Proposal

For indexing and search inside cloud collectors, all logs should follow this structured JSON schema:

```json
{
  "timestamp": "2026-06-06T04:06:52.000Z",
  "level": "INFO",
  "logger": "claude_service",
  "correlation_id": "018f6f69-d4c5-7a42-990a-5b1285311e9f",
  "duration_ms": 12450,
  "input_tokens": 15400,
  "output_tokens": 1200,
  "estimated_cost_usd": 0.06325,
  "message": "Claude call successful. Tokens: In=15400, Out=1200, Cost=$0.063250"
}
```

## Traceability Links

* [Runtime Observability Plan](./10-runtime-observability-plan.md)
* [Debugging Guide](./09-debugging-guide.md)
