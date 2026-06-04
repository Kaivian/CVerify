---
trigger: model_decision
description: Apply when generating commit messages, commit descriptions, pull request summaries, changelog entries, or explaining repository changes. Ensure commits clearly communicate intent, scope, impact, and reasoning.
---

# Commit Message Rules

## Purpose

Commit messages are historical records, not task logs.

A commit message must explain:

1. What changed
2. Why the change was necessary
3. The resulting impact

A reviewer should understand the purpose of the change without reading the entire diff.

---

## Required Format

```text
type(scope): concise summary

Why:
- Business or technical reason for the change

Changes:
- Key implementation changes
- Architectural changes
- Behavioral changes

Impact:
- User-facing impact
- Developer impact
- Compatibility considerations
```

---

## Conventional Commit Types

Allowed types:

```text
feat
fix
refactor
perf
test
docs
chore
build
ci
```

Examples:

```text
feat(repository): add repository ownership verification
fix(auth): prevent refresh token replay
refactor(profile): simplify profile completion calculation
perf(search): reduce repository query latency
```

---

## Summary Rules

The first line should:

- Be under 72 characters when possible
- Describe the result, not the implementation steps
- Use present tense
- Avoid vague wording

Good:

```text
feat(profile): add skill verification workflow
fix(auth): prevent duplicate refresh token usage
refactor(repository): centralize repository mapping logic
```

Bad:

```text
feat: update code
fix: bug fixes
refactor: cleanup
feat: add service and update controller and fix tests
```

---

## Description Rules

The description should explain intent and outcome.

Focus on:

- Problem being solved
- Architectural decisions
- Business rationale
- Important implementation details

Do not write a chronological development diary.

Bad:

```text
Created service.
Added endpoint.
Updated DTO.
Fixed tests.
```

Good:

```text
Why:
- Repository ownership could be claimed without verification.

Changes:
- Introduce ownership verification service.
- Validate repository ownership before linking.
- Reject unverified repository claims.

Impact:
- Improves trust score integrity.
- Prevents fraudulent repository attribution.
```

---

## Scope Rules

Use the most specific scope available.

Examples:

```text
feat(auth): ...
fix(repository): ...
refactor(profile): ...
test(search): ...
docs(api): ...
```

Avoid:

```text
feat(system): ...
fix(app): ...
refactor(code): ...
```

unless no better scope exists.

---

## Multi-Area Changes

If a commit touches multiple unrelated areas:

Split into multiple commits whenever possible.

Good:

```text
fix(auth): prevent token replay
test(auth): add replay protection tests
```

Bad:

```text
fix(auth): prevent token replay and redesign profile page
```

---

## Refactor Commits

Refactor commits should explicitly state that behavior is unchanged.

Example:

```text
refactor(repository): extract synchronization workflow

Why:
- Synchronization logic was duplicated across services.

Changes:
- Extract orchestration into RepositorySyncService.
- Consolidate mapping and validation logic.

Impact:
- Improves maintainability.
- No functional behavior changes.
```

---

## Bug Fix Commits

Bug fix commits should identify the root cause.

Example:

```text
fix(email): prevent duplicate verification delivery

Why:
- Repeated requests could create multiple active verification records.

Changes:
- Add idempotency validation.
- Reuse existing pending verification requests.

Impact:
- Eliminates duplicate emails.
- Reduces email provider usage.
```

---

## Feature Commits

Feature commits should describe capability, not implementation.

Good:

```text
feat(repository): support GitHub organization repositories
```

Bad:

```text
feat(repository): add endpoint and service
```

---

## AI-Specific Requirements

When generating commit messages:

- Describe outcomes, not coding actions.
- Describe intent, not file modifications.
- Infer the business or technical objective from the changes.
- Include rationale whenever it can be determined from context.
- Avoid generic phrases such as:
- update code
  - fix issue
  - cleanup
  - improvements
  - miscellaneous changes
  - update files

Every commit should remain understandable six months later without requiring access to the original task, ticket, or conversation.