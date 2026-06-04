---
trigger: model_decision
description: Apply when implementing logging, monitoring, auditing, diagnostics, telemetry, metrics, tracing, or error reporting. Ensure logs are useful for operations and debugging without exposing sensitive information.
---

# Logging & Observability Rules

## Core Philosophy

Logs exist to:

- Understand system behavior
- Troubleshoot issues
- Audit important actions
- Monitor system health

Logs should provide operational value without exposing sensitive information.

---

## Structured Logging

Prefer structured logs over free-form text.

Include meaningful fields whenever available:

- UserId
- CorrelationId
- TraceId
- ResourceId
- Action
- Duration

Good logs should be searchable and filterable.

---

## Log Business Events

Log significant business actions.

Examples:

- User registration
- Account linking
- Repository synchronization
- Verification submission
- Permission changes

Important business actions should leave an audit trail.

---

## Log Failures

Unexpected failures should be logged.

Include:

- Context
- Relevant identifiers
- Exception details
- Trace identifiers

Logs should help developers diagnose root causes.

---

## Correlation and Traceability

Every request should be traceable.

Prefer:

- CorrelationId
- TraceId
- RequestId

Cross-service operations should be traceable through a shared identifier.

---

## Monitoring

Critical workflows should expose:

- Metrics
- Error rates
- Performance data
- Availability indicators

Monitoring should detect failures before users report them.

---

## Performance Visibility

Track expensive operations.

Examples:

- Database queries
- External API calls
- Background jobs
- Repository synchronization

Long-running operations should be observable.

---

## Audit Logging

Audit logs should exist for security-sensitive actions.

Examples:

- Login events
- Password changes
- Account recovery
- Permission changes
- OAuth account linking

Audit logs should be retained according to system requirements.

---

## Sensitive Data Restrictions

Never log:

- Passwords
- Password hashes
- OTP codes
- Recovery codes
- Access tokens
- Refresh tokens
- API secrets
- OAuth secrets

Logs must never become a source of data leakage.

---

## Environment Awareness

Development:

- Verbose logging allowed.
- Detailed exception information allowed.
- Debug information allowed.

Production:

- Log useful diagnostics.
- Avoid excessive noise.
- Protect sensitive information.
- Prefer structured logging over raw exception dumps.

---

## AI-Specific Requirements

When adding logs:

- Log meaningful events, not every code path.
- Prefer business context over implementation details.
- Avoid duplicate logging.
- Never log sensitive information.
- Ensure every unexpected failure can be traced through logs.