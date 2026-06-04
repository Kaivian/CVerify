---
trigger: model_decision
description: Apply when implementing authentication, authorization, data access, APIs, integrations, validation, file handling, secrets management, or user-facing features. Prioritize least privilege, data protection, and secure-by-default behavior.
---

# Security Rules

## Core Philosophy

Security is the default behavior.

Every feature, API, service, and integration should assume:

- Input can be malicious.
- Clients cannot be trusted.
- External systems can fail.
- Sensitive data must be protected.

Security should be designed into the system, not added afterward.

---

## Never Trust Client Data

Client-provided data must always be treated as untrusted.

Always validate:

- Request bodies
- Query parameters
- Route parameters
- Uploaded files
- External integration responses

Never trust:

```json
{
  "userId": "123",
  "role": "Admin"
}
```

if the authenticated user context already exists.

User identity must come from the authentication context.

---

## Authentication

Authentication must be enforced by the backend.

Never rely on frontend checks.

Examples:

- JWT validation
- Session validation
- OAuth token validation

Protected endpoints must require authenticated access unless explicitly public.

---

## Authorization

Authentication does not imply authorization.

Every protected operation must verify:

- Ownership
- Roles
- Permissions
- Resource access rights

Never assume access because a user is authenticated.

---

## Least Privilege

Grant the minimum permissions necessary.

Avoid:

- Excessive OAuth scopes
- Excessive API permissions
- Overly broad role assignments

Users, services, and integrations should receive only the permissions they require.

---

## Secrets Management

Never hardcode:

- API keys
- OAuth secrets
- Access tokens
- Refresh tokens
- Encryption keys
- SMTP credentials

Use secure configuration providers and environment variables.

Secrets must never be committed to source control.

---

## Sensitive Data Protection

Never expose:

- Passwords
- Password hashes
- Tokens
- Recovery codes
- Internal secrets
- Security answers

Sensitive data should only be accessible where explicitly required.

---

## Error Information Disclosure

Production systems must never expose:

- Stack traces
- Internal exceptions
- Database details
- Infrastructure details

Technical details belong in logs, not user-facing responses.

---

## File Upload Security

Validate:

- File size
- File type
- File extension

Never trust file metadata provided by clients.

Reject unsupported uploads.

---

## External Integrations

Treat external services as untrusted.

Validate:

- API responses
- Webhook payloads
- OAuth claims

Never assume third-party data is correct.

---

## Secure Defaults

Default behavior should be restrictive.

Prefer:

```text
deny by default
allow explicitly
```

instead of:

```text
allow by default
block exceptions
```

---

## AI-Specific Requirements

When implementing features:

- Assume user input is untrusted.
- Assume permissions must be validated.
- Assume sensitive data should remain private.
- Prefer secure defaults when requirements are unclear.
- Never introduce security-sensitive behavior without explicit justification.