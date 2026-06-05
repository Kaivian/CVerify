# 10 - Runtime Observability Plan

This document audits the current logging and request-tracing architecture of the `CVerify.AI` microservice, identifies critical observability gaps, and proposes a structured logging strategy to optimize debugging and auditing.

---

## Observability Audit

### 1. Logger Instances in Python Service
The microservice registers five distinct loggers using Python's standard `logging` library:
*   `cverify-ai` (configured in [app/main.py](../main.py)): Root application logger.
*   `analysis_router` (configured in [app/routes/analysis_router.py](../routes/analysis_router.py)): Logs router invocations.
*   `github_analysis_orchestrator` (configured in [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py)): Logs clone and sampling operations.
*   `claude_service` (configured in [app/services/claude_service.py](../services/claude_service.py)): Logs API exceptions.
*   `hmac_auth` (configured in [app/middleware/hmac_auth.py](../hmac_auth.py)): Logs authentication events and nonce validation.

### 2. Request Correlation Gaps

> [!WARNING]
> **Critical Observability Defect: Broken Correlation ID Propagation**
>
> While `main.py` configures a custom `CorrelationIdFormatter` that outputs `CorrelationId: %(correlation_id)s`, it relies on the developer manually passing `extra={"correlation_id": ...}` on every log call.
>
> *   **Where it works**: The middleware (`hmac_auth.py`) extracts `X-Correlation-Id` and assigns it to `request.state.correlation_id`. The router (`analysis_router.py`) retrieves this and calls logger methods with `extra={"correlation_id": correlation_id}`.
> *   **Where it fails**: The `GitHubAnalysisOrchestrator` and the `ClaudeService` have **no knowledge of the correlation ID**.
> *   *Result*: Any log messages or tracebacks emitted during Git cloning, technology scans, file sampling, or Claude API invocations default to `CorrelationId: system`. This makes it impossible to link exceptions in these core execution phases to specific job records in a production environment.

### 3. Missing Observability Metrics
*   **No Latency Audits**: There are no duration metrics tracked or logged for git clones, scans, or Anthropic API transits.
*   **No Token Tracking**: Claude's token usage data (`response.usage.input_tokens` and `response.usage.output_tokens`) is completely discarded in `ClaudeService.py`.

---

## Propose Structured JSON Logging Strategy

We recommend replacing the standard text formatter with a structured JSON logger (e.g. using `python-json-logger` or custom formatting) so that logs can be parsed by ingestion utilities like Datadog, Elasticsearch, or AWS CloudWatch.

### JSON Log Schema Proposal
```json
{
  "timestamp": "2026-06-06T04:06:52.000Z",
  "level": "ERROR",
  "logger": "github_analysis_orchestrator",
  "correlation_id": "018f6f69-d4c5-7a42-990a-5b1285311e9f",
  "stage": "CloningRepository",
  "duration_ms": 15400,
  "message": "Git clone failed: Exit code 128",
  "exception": "Traceback (most recent call last):\n..."
}
```

---

## Concrete Log Placement Recommendations

To restore correlation ID continuity and capture missing pipeline metrics, apply the following code changes:

### 1. In `GitHubAnalysisOrchestrator.orchestrate_async`
*   **Recommendation**: Modify the signature of `orchestrate_async` to accept a `correlation_id` parameter (forwarded from the router) and pass it to all logger calls.
*   **Code Implementation Pattern**:
    ```python
    # In analysis_router.py:
    async for progress_event in orchestrator.orchestrate_async(
        ...,
        correlation_id=correlation_id # ← Forwarded here
    ):
    
    # In github_analysis_orchestrator.py:
    async def orchestrate_async(self, ..., correlation_id: str) -> AsyncGenerator[dict, None]:
        extra_log = {"correlation_id": correlation_id}
        logger.info("Starting repository analysis", extra=extra_log)
        
        start_time = time.perf_counter()
        # execution block ...
        duration = int((time.perf_counter() - start_time) * 1000)
        logger.info("Repository analysis completed", extra={**extra_log, "duration_ms": duration})
    ```

### 2. In `ClaudeService.analyze_repo`
*   **Recommendation**: Pass the correlation ID to `analyze_repo` and capture input/output token usages from the Anthropic response object.
*   **Code Implementation Pattern**:
    ```python
    async def analyze_repo(self, system_prompt: str, user_prompt: str, correlation_id: str) -> str:
        extra_log = {"correlation_id": correlation_id}
        logger.info("Invoking Claude analysis", extra=extra_log)
        start_time = time.perf_counter()
        
        response = await self.client.messages.create(...)
        
        duration = int((time.perf_counter() - start_time) * 1000)
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        
        logger.info(
            f"Claude call successful. Tokens: In={input_tokens}, Out={output_tokens}",
            extra={**extra_log, "duration_ms": duration, "input_tokens": input_tokens, "output_tokens": output_tokens}
        )
        return response.content[0].text
    ```

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | `CorrelationIdFormatter` in [app/main.py](../main.py), `verify_hmac_signature` in [app/middleware/hmac_auth.py](../middleware/hmac_auth.py) |
| **Dependencies** | Python: `logging` module |
| **Execution Flow** | Incoming request triggers HMAC middleware → correlation ID stored in `request.state` → Router reads correlation ID → Manual passing of ID as `extra` parameter |
| **Common Failure Modes** | **Stale Correlation Context** (forgetting to pass `extra` parameters, yielding default `"system"` correlation records). |
| **Related Files** | [app/routes/analysis_router.py](../routes/analysis_router.py), [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py) |
| **Related Services** | [ClaudeService](../services/claude_service.py) |
| **Related DTOs** | None |
| **Related Database Tables** | `AnalysisJobEvents` (stores DB copies of structured logs) |
| **Related Frontend Components** | None |
