# 10 - Runtime Observability Plan

This document details the request-tracing, cost-auditing, and structured logging architecture implemented in the `CVerify.AI` microservice.

---

## Observability Architecture

CVerify.AI uses an automated, context-aware tracing system to log, audit, and track latency and costs across the FastAPI microservice and Anthropic API.

### 1. Unified Logger Setup
Loggers are configured in `app/monitoring/observability.py` using Python's standard `logging` library. Standard loggers include:
*   `cverify-ai`: Root microservice application logger.
*   `analysis_router`: Logs router endpoints.
*   `github_analysis_orchestrator`: Logs task execution steps.
*   `claude_service`: Logs API calls and exponential backoff retry messages.
*   `hmac_auth`: Logs HMAC auth and replay checks.

### 2. Trace Context Propagation (Resolved)
Correlation IDs and trace boundaries are propagated dynamically using Python `contextvars` rather than manually passing `extra` logs.
*   **Trace Context**: Managed via `TraceContext` in `app/monitoring/observability.py`. It holds:
    *   `trace_id`: The global execution correlation ID.
    *   `span_id`: Unique ID for the current execution span.
    *   `parent_span_id`: ID of the calling parent span (from W3C traceparent headers).
    *   `pipeline_stage`: Name of the active task (e.g. `CommitIntelligence`).
    *   `is_sampled`: Sampling flag for telemetry persistence.
*   **Middleware Binding**: `add_trace_context_middleware` in `app/main.py` extracts correlation IDs or W3C `traceparent` headers from incoming requests and binds them to the async task context using context variables. All logger calls in the task's thread/coroutine automatically resolve and print these IDs.

### 3. Latency & Token Telemetry (Resolved)
*   **Latency Metrics**: Latency is tracked for each task execution and recorded in milliseconds inside `AnalysisTasks` and `AnalysisExecutions` database records.
*   **Token Metrics**: `ClaudeService` reads token usage data (`input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`) directly from the Anthropic response object stream.
*   **Cost Tracking**: Token metrics are passed to `AiCostTracker`, which calculates and registers cost metrics (USD) using the model's pricing rates. These are persisted under the correlation ID.

---

## JSON Log Formatting

Logs are structured as JSON structures for automatic parsing by cloud log ingestion engines (Datadog, Elasticsearch, AWS CloudWatch, etc.).

### Example Log Payload
```json
{
  "timestamp": "2026-06-06T18:59:51.000Z",
  "level": "INFO",
  "logger": "claude_service",
  "correlation_id": "018f6f69-d4c5-7a42-990a-5b1285311e9f",
  "duration_ms": 4210,
  "message": "Claude telemetry call successful. Tokens: In=1050 (CacheWrite=0, CacheRead=3120), Out=450, Cost=$0.00782, Duration=4210ms",
  "input_tokens": 1050,
  "output_tokens": 450,
  "cache_read_input_tokens": 3120,
  "estimated_cost_usd": 0.00782
}
```

---

## Core Logging Implementations

### 1. Observability Formatter
The application formatter extracts `trace_id`, `span_id`, and `pipeline_stage` context from `TraceContext`:
```python
class TraceContextFormatter(logging.Formatter):
    def format(self, record):
        ctx = TraceContext.get()
        record.trace_id = ctx.get("trace_id", "system")
        record.span_id = ctx.get("span_id", "system")
        record.pipeline_stage = ctx.get("pipeline_stage", "system")
        return super().format(record)
```

### 2. UI Telemetry Streaming
As tokens stream back from Claude, they are immediately broadcasted to the frontend client via `UIStreamingManager().enqueue_ui_event()`, enabling real-time feedback in the UI for the active task.

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | `setup_logging` and `TraceContext` in [app/monitoring/observability.py](../monitoring/observability.py) |
| **Dependencies** | Python: `logging`, `contextvars` |
| **Execution Flow** | Incoming HTTP ➔ middleware binds contextvars ➔ Logger formats output with trace metadata automatically. |
| **Common Failure Modes** | Context variables cleared when spawning unmanaged threads (always use `asyncio.to_thread` or context-preserving thread wrappers). |
| **Related Files** | [app/main.py](../main.py), [app/services/claude_service.py](../services/claude_service.py) |
| **Related Services** | `AiCostTracker` |
| **Related DTOs** | None |
| **Related Database Tables** | `AnalysisExecutions` |
| **Related Frontend Components** | `DetailedAnalysisModal.tsx` |
