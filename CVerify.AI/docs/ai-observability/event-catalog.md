# Event Catalog

This catalog documents the payload schemas, contracts, and versioning strategies for all progress and completion events emitted during the repository analysis lifecycle.

## Event Versioning Strategy

All events follow standard JSON schema versioning.
* **Schema Version Indicator**: Each event payload includes a `version` field (e.g. `1.0.0`).
* **Backward Compatibility**: Backward-compatible changes (adding optional fields) increment the patch or minor version. Breaking changes (removing fields, changing types) increment the major version and require corresponding updates in the consumer parsing logic (e.g. in C# Core or Zod schemas).

---

## 1. Intermediate Progress Event

Emitted by the Python microservice to notify the C# Core service of active pipeline stages.

* **Producer**: CVerify.AI (`GitHubAnalysisOrchestrator`)
* **Consumer**: CVerify.Core (`BackgroundRepositoryAnalysisProcessor` -> Redis Pub/Sub -> React Frontend Client)
* **Required Fields**:
  - `status`: String. Current active status enum (e.g. `"CloningRepository"`, `"DetectingTechnologyStack"`, `"SamplingCode"`, `"RunningAgents"`, `"AggregatingResults"`).
  - `step`: String. Sub-step identifier.
  - `progress`: Number. Floating-point percentage completed (0.0 to 100.0).
  - `message`: String. Human-readable progress detail.
* **Optional Fields**:
  - `timestamp`: String. ISO 8601 formatted timestamp.
* **Payload Schema (v1.0.0)**:
  ```json
  {
    "status": "CloningRepository",
    "step": "CloningRepository",
    "progress": 20.0,
    "message": "Cloning repository branch 'main'..."
  }
  ```

---

## 2. Internal Claude API Telemetry Event

Log-only event documenting token usage, cost, and execution duration.

* **Producer**: CVerify.AI (`ClaudeService`)
* **Consumer**: Log Ingestion Systems (Datadog / AWS CloudWatch)
* **Required Fields**:
  - `correlation_id`: String (UUID). Correlates logs with the execution job.
  - `duration_ms`: Number. Request round-trip execution latency in milliseconds.
  - `input_tokens`: Number. Total input tokens.
  - `output_tokens`: Number. Total output tokens.
  - `estimated_cost_usd`: Number. Calculated USD cost of the request.
* **Optional Fields**:
  - `cache_creation_input_tokens`: Number. Tokens written to ephemeral cache.
  - `cache_read_input_tokens`: Number. Tokens read from ephemeral cache.
* **Payload Schema (v1.0.0)**:
  ```json
  {
    "correlation_id": "018f6f69-d4c5-7a42-990a-5b1285311e9f",
    "duration_ms": 12450,
    "input_tokens": 15400,
    "output_tokens": 1200,
    "cache_creation_input_tokens": 14000,
    "cache_read_input_tokens": 0,
    "estimated_cost_usd": 0.063250
  }
  ```

---

## 3. Final Report Event

Emitted at successful completion, containing the fully aggregated repository intelligence report.

* **Producer**: CVerify.AI (`GitHubAnalysisOrchestrator`)
* **Consumer**: CVerify.Core (`BackgroundRepositoryAnalysisProcessor` -> Database `AnalysisReports` table)
* **Required Fields**:
  - `reportData`: String. Escaped string representation of the full repository intelligence report matching the `RepositoryAnalysisSchema` contract.
* **Optional Fields**: None.
* **Payload Schema (v1.0.0)**:
  ```json
  {
    "reportData": "{\"schemaVersion\": \"evidence-intelligence-v1\", \"repo\": {...}, \"classification\": {...}, \"scoring\": {\"final_score\": 92.0, \"band\": \"A\"}, ...}"
  }
  ```

---

## 4. Redis Progress Event (Broadcaster)

Published to the Redis channel to update SSE clients.

* **Producer**: CVerify.Core (`RepositoryAnalysisService`)
* **Consumer**: React Frontend SSE Subscribers
* **Required Fields**:
  - `jobId`: String (UUID). Identifies the target job.
  - `status`: String. Job status.
  - `step`: String. Sub-step identifier.
  - `progress`: Number. Floating-point percentage.
  - `message`: String. Human-readable progress.
  - `timestamp`: String. ISO 8601 string.
* **Payload Schema (v1.0.0)**:
  ```json
  {
    "jobId": "018f6f69-d4c5-7a42-990a-5b1285311e9f",
    "status": "CloningRepository",
    "step": "CloningRepository",
    "progress": 20.0,
    "message": "Cloning repository branch 'main'...",
    "timestamp": "2026-06-06T04:06:52.000Z"
  }
  ```

## Traceability Links

* [Request Lifecycle](./02-request-lifecycle.md)
* [Runtime Observability Plan](./10-runtime-observability-plan.md)
