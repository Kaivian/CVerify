# Workflow Compliance Report

This report evaluates CVerify AI workflows against our standardized Observability Compliance Checklist.

## Observability Compliance Checklist

Every workflow must satisfy the following 10 criteria:

1. **Correlation ID propagation**: Propagates `correlation_id` to all logs and upstream calls.
2. **Structured logging**: Emits structured logger records with extra context metadata.
3. **Start event**: Emits an event signifying pipeline invocation.
4. **Completion event**: Emits a terminal completion event containing outputs.
5. **Failure event**: Catches errors and yields failed step information.
6. **State transitions**: Matches the pipeline state machine schema.
7. **Timeline visibility**: Steps conform to expected timing limits and logging.
8. **Retry tracking**: Warns when transient retries occur.
9. **Duration metrics**: Logs latency benchmarks for expensive operations.
10. **Token/Cost metrics**: Ingests token and estimated USD costs via cost tracker.

---

## Workflow Compliance Matrix

| Workflow | Current Status | Score | Non-Compliant Items | Required Changes |
|---|---|---|---|---|
| **Repository Evidence Analysis** | **Fully Compliant** | 10/10 | None | None (Refactored in this update to propagate correlation ID, add retries, log tokens/costs, classify repository types, and validate evidence). |
| **Conversational Repository Assistant** | **Fully Compliant** | 10/10 | None | None (Refactored in this update to forward correlation ID, fix travel assistant prompt leak, apply retries, and track conversational session costs). |

## Compliance Classification

* **Fully Compliant**: Meets all 10 observability criteria.
* **Partially Compliant**: Meets 6 to 9 criteria.
* **Non-Compliant**: Meets 5 or fewer criteria.

## Traceability Links

* [Architecture Overview](./architecture-overview.md)
* [Workflow Catalog](./workflow-catalog.md)
