---
trigger: model_decision
description: Apply when handling exceptions, validation failures, API errors, background job failures, or user-facing error states. Ensure errors are actionable, environment-aware, consistently reported, and appropriate for both users and developers.
---

# Error Handling Rules

## Core Philosophy

Errors should help the appropriate audience.

- Users should receive information they can act upon.
- Developers should receive information they can diagnose.
- Systems should fail safely and predictably.

Error handling should improve usability without exposing internal implementation details.

---

## Error Categories

All errors should be classified into one of the following categories:

### User-Fixable Errors

The user can resolve the issue themselves.

Examples:

- Invalid input
- Missing required fields
- Password policy violations
- Invalid verification code
- Email already exists
- Repository already linked
- Expired OAuth session

Users should receive clear and actionable feedback.

Example:

```text
Repository already linked to your account.
```

Avoid:

```text
RepositoryLinkException
```

---

### User-Actionable Errors

The issue requires user action but is not necessarily caused by invalid input.

Examples:

- Expired authentication
- Expired OAuth token
- Session timeout
- Permission requirements

Users should be informed what action to take.

Example:

```text
Your GitHub connection has expired. Please reconnect your account.
```

---

### System Errors

The issue cannot be resolved by the user.

Examples:

- Database failures
- Cache failures
- Network outages
- Third-party service failures
- Unexpected exceptions
- Internal infrastructure problems

Users should not receive technical details.

---

## User-Facing Error Messages

Messages shown to users should be:

- Clear
- Human-readable
- Actionable when possible
- Free of technical terminology

Avoid:

```text
NullReferenceException
EntityFrameworkConcurrencyException
SocketTimeoutException
```

Prefer:

```text
Something went wrong. Please try again later.
```

---

## Toast Notification Rules

### Actionable Errors

If the user can fix the problem:

Show a specific toast message.

Examples:

```text
Email address is already in use.
```

```text
Verification code is invalid.
```

```text
Repository has already been linked.
```

---

### System Errors

If the user cannot fix the problem:

Show a generic error toast.

Example:

```text
Something went wrong. Please try again later.
```

or

```text
An unexpected error occurred. If the issue persists, please contact support.
```

Do not expose implementation details.

---

## Development Environment

Development prioritizes debugging.

When running in Development:

- Detailed exception messages may be shown.
- Stack traces may be visible.
- Raw backend error details may be displayed.
- Diagnostic information may be surfaced.

The objective is rapid troubleshooting.

---

## Production Environment

Production prioritizes security and user experience.

When running in Production:

Never expose:

- Stack traces
- Internal exception names
- Database details
- Infrastructure details
- Service implementation details

Users should only receive information relevant to resolving the issue.

---

## Traceability

Unexpected failures should be traceable.

Backend responses may include:

```json
{
  "errorCode": "UNEXPECTED_ERROR",
  "traceId": "abc123"
}
```

Frontend may display:

```text
An unexpected error occurred.

Reference ID: abc123
```

This allows developers to locate the corresponding logs without exposing technical details.

---

## API Error Consistency

All APIs should return a consistent error format.

Example:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed."
  }
}
```

Unexpected errors should use standardized error codes.

Example:

```json
{
  "success": false,
  "error": {
    "code": "UNEXPECTED_ERROR",
    "traceId": "abc123"
  }
}
```

---

## Exception Handling

Never silently ignore exceptions.

Avoid:

```csharp
catch (Exception)
{
}
```

Every unexpected exception should:

- Be logged
- Be traceable
- Produce a consistent response

---

## Frontend Error States

Every data-driven UI should consider:

- Loading state
- Empty state
- Error state

Do not assume requests always succeed.

Error states should remain consistent across the application.

---

## Logging Requirements

Unexpected failures should always be logged.

Logs should contain:

- TraceId
- CorrelationId (if available)
- UserId (if available)
- Request context
- Exception details

Detailed diagnostics belong in logs, not in user-facing messages.

---

## AI-Specific Requirements

When implementing error handling:

- Determine whether the error is user-fixable or system-generated.
- Show specific messages only when they help the user resolve the issue.
- Hide technical details in Production.
- Prefer standardized error responses and toast patterns.
- Ensure all unexpected failures are traceable through logs and trace identifiers.