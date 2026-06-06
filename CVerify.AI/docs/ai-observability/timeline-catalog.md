# Timeline Catalog

This catalog documents the chronological execution timeline, expected duration limits, and performance thresholds for the repository analysis pipeline.

## Timeline Sequence Map

For a standard repository analysis execution, the lifecycle proceeds chronologically through the following steps:

```text
Queued [0%]
  │
  ▼
Preparing [10%]
  │
  ▼
CloningRepository [20%]
  │
  ▼
DetectingTechnologyStack [40%]
  │
  ▼
SamplingCode [60%]
  │
  ▼
RunningAgents [80%] (Claude API invocation starts)
  │
  ▼
AggregatingResults [90%] (Claude API response received)
  │
  ▼
SavingReport [95%]
  │
  ▼
Completed [100%]
```

---

## Chronological Timing Boundaries

This table provides the timing limits for each step. Latency exceeding these bounds flags potential performance bottlenecks.

| Step / Status | Expected Timing | Timeout Boundary | Diagnostic Check |
|---|---|---|---|
| **`Queued`** | 100ms – 5,000ms | 30,000ms | Check if background worker is offline or queue list is jammed. |
| **`Preparing`** | 100ms – 1,000ms | 5,000ms | Check for OAuth credential decryption delay. |
| **`CloningRepository`** | 2,000ms – 20,000ms | 120,000ms (2 mins) | Check repository size, network speed, or git credentials failure. |
| **`DetectingTechnologyStack`** | 100ms – 2,000ms | 10,000ms | Walk scan optimization issues. Check directory walk filters. |
| **`SamplingCode`** | 100ms – 2,000ms | 10,000ms | Large file scanning or directory depth filters. |
| **`RunningAgents`** | 5,000ms – 30,000ms | 90,000ms | Anthropic API latency or token volume overhead. |
| **`AggregatingResults`** | 100ms – 500ms | 5,000ms | JSON parse validation logic or evidence check latency. |
| **`SavingReport`** | 100ms – 1,000ms | 10,000ms | Postgres DB write locks or connection pool saturation. |
| **`Total Pipeline`** | **10,000ms – 60,000ms** | **600,000ms (10 mins)** | Overall timeout bound enforced by C# Worker. |

## Timeline Latency Diagnostics

If a step exceeds its Timeout Boundary:
1. Extract the request `correlation_id` from logs.
2. Filter the trace logs by `correlation_id` to inspect durations.
3. If `CloningRepository` timed out, verify repo size and token validity.
4. If `RunningAgents` timed out, verify Claude API status and retry loops.

## Traceability Links

* [Request Lifecycle](./02-request-lifecycle.md)
* [Repository Analysis Pipeline](./07-repository-analysis-pipeline.md)
* [Telemetry Catalog](./telemetry-catalog.md)
