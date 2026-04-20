---
trigger: model_decision
description: Apply before planning, modifying, refactoring, generating, or reviewing code. Prioritize understanding requirements, following existing project patterns, minimizing scope, preserving architecture, and avoiding assumptions or unnecessary changes.
---

# Engineering Decision Rules

## Core Philosophy

The agent's primary responsibility is to solve the requested problem while preserving project consistency, architecture, and maintainability.

The goal is not to produce the most sophisticated solution.

The goal is to produce the most appropriate solution for the existing project.

Consistency with the codebase is more valuable than introducing new patterns or personal preferences.

---

## Decision Priority

When making implementation decisions, follow this order:

1. Explicit user requirements
2. Existing project patterns
3. Existing architecture
4. Existing design system and conventions
5. Existing libraries and dependencies
6. General engineering best practices

Never prioritize personal preference or generic best practices over established project conventions.

---

## Understand Before Implement

Before making changes:

- Understand the requested outcome.
- Identify the affected areas.
- Review related code.
- Understand existing architecture.
- Understand existing implementation patterns.

Do not begin implementation before understanding how the existing system works.

---

## Existing Pattern First

Before creating:

- Components
- Services
- Hooks
- Utilities
- DTOs
- APIs
- Repositories
- Folder structures

Search the codebase for existing implementations.

Prefer extending or reusing existing solutions over creating new ones.

Do not introduce duplicate patterns.

---

## No Assumptions

Implement only what has been requested.

Do not assume:

- Additional requirements
- Future requirements
- Missing requirements
- Desired enhancements

If a requirement is ambiguous and affects implementation decisions:

- Identify the ambiguity.
- Explain the uncertainty.
- Request clarification when necessary.

Do not invent requirements.

---

## Minimal Change Principle

Modify the smallest amount of code necessary to solve the problem.

Prefer:

- Targeted fixes
- Localized changes
- Incremental improvements

Avoid:

- Large-scale rewrites
- Broad refactors
- Unrelated improvements

Changes should remain proportional to the request.

---

## Scope Protection

Restrict modifications to the requested scope.

Do not:

- Expand features
- Redesign unrelated areas
- Refactor unrelated code
- Modify neighboring systems without necessity

A request to modify one feature is not permission to modify surrounding features.

---

## Root Cause First

When fixing issues:

- Investigate the underlying cause.
- Understand why the issue exists.
- Fix the source of the problem whenever possible.

Avoid symptom-based fixes that leave the root cause unresolved.

Prefer durable solutions over temporary workarounds.

---

## Architecture Preservation

Respect the existing architecture.

Do not introduce:

- New architectural patterns
- New abstraction layers
- New service layers
- New folder structures
- New dependency directions

unless they are clearly required.

Existing architecture should remain stable unless an architectural change is explicitly requested.

---

## Simplicity First

Prefer the simplest solution that satisfies current requirements.

Avoid introducing:

- Additional abstractions
- Additional services
- Additional wrappers
- Additional configuration
- Complex design patterns

without demonstrated need.

Complexity must be justified.

---

## No Gold Plating

Do not implement features beyond the requested scope.

Example:

Request:

```text
Add pagination.
```

Acceptable:

```text
Pagination only.
```

Unacceptable:

```text
Pagination
Search
Filtering
Sorting
Infinite scrolling
Caching
```

Additional functionality requires explicit approval.

---

## Refactoring Rules

Do not perform unrelated refactors.

Avoid:

- Renaming unrelated files
- Moving unrelated code
- Reorganizing folders
- Rewriting stable implementations

unless required to complete the requested task.

Refactoring should be directly related to the requested change.

---

## Backward Compatibility

Preserve existing behavior whenever possible.

Avoid:

- Breaking APIs
- Breaking contracts
- Breaking database compatibility
- Breaking frontend integrations

unless explicitly requested.

Existing consumers should continue functioning after changes.

---

## Consistency Over Preference

If the codebase already follows a pattern:

- Continue using that pattern.
- Continue using that naming convention.
- Continue using that architectural style.

Do not introduce alternative approaches simply because they may also be valid.

Consistency is more important than individual preference.

---

## Requirement Confidence

If implementation details are unclear:

- Identify assumptions.
- State uncertainty.
- Request clarification when necessary.

Do not silently guess.

When uncertainty affects architecture, security, data integrity, or user experience, clarification is preferred over assumption.

---

## AI-Specific Requirements

Before implementing any change:

1. Understand the requirement.
2. Review existing implementations.
3. Identify affected systems.
4. Determine the minimal required change.
5. Verify consistency with project conventions.
6. Implement only what is required.

The agent should behave as a maintainer of the existing system, not as a redesign consultant.

The default behavior is preservation, consistency, and minimal change.