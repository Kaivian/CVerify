# Queue Catalog

This catalog documents the shared Redis queues and background job scheduling contracts.

## 1. Analysis Job Queue (`repository:analysis:queue`)

Coordinates asynchronous background pickup of scheduled repository analyses.

* **Queue Type**: Redis List
* **Command Sequence**:
  - Enqueue (Producer): `LPUSH repository:analysis:queue [jobId]` (invoked by C# CVerify.Core api service).
  - Dequeue (Consumer): `RPOP repository:analysis:queue` (blocked or periodically popped by C# `BackgroundRepositoryAnalysisProcessor`).
* **Contract**: The queue stores raw Guid strings (representing the `AnalysisJob` database record ID).
* **Payload Example**:
  ```text
  "018f6f69-d4c5-7a42-990a-5b1285311e9f"
  ```

## 2. Real-Time progress events Pub-Sub Channel (`repository:analysis:progress:{jobId}`)

Broadcasts execution progress events synchronously to listening client streams.

* **Queue Type**: Redis Pub-Sub Channel
* **Contract**: Receives a JSON-serialized progress event detailing active stage and progress metrics.
* **Payload Example**:
  ```json
  {
    "jobId": "018f6f69-d4c5-7a42-990a-5b1285311e9f",
    "status": "RunningAgents",
    "step": "RunningAgents",
    "progress": 80.0,
    "message": "Running multi-agent code intelligence analysis...",
    "timestamp": "2026-06-06T04:06:52.000Z"
  }
  ```

## Error Conditions and Queue Handlers

* **Queue Jam**: If the background worker fails or crashes, jobs remain queued. Alert rules monitor if the queue size > 10.
* **Dead Letter Queue (DLQ)**: If a job fails repeatedly (e.g. hits max 3 retries or throws unexpected infrastructure exceptions), it is marked as `DeadLettered` in the C# database, and an alert notification is dispatched to support channels.

## Traceability Links

* [System Overview](./01-system-overview.md)
* [Request Lifecycle](./02-request-lifecycle.md)
