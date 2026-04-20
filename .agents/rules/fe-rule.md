---
trigger: model_decision
description: Apply before creating or modifying frontend code. Review and follow the project's ESLint, TypeScript, formatting, and code-quality configurations to ensure generated code passes existing linting and static analysis rules.
---

# Linting & Code Quality Rules

## Core Philosophy

Generated code must comply with the project's existing linting, formatting, and static analysis standards.

The agent should adapt to the project's rules rather than expecting the project to adapt to generated code.

Code should be lint-clean by default.

---

## Configuration First

Before modifying frontend code, review applicable configuration files.

Examples:

```text
eslint.config.js
eslint.config.mjs
.eslintrc
.eslintrc.json
biome.json
prettier.config.js
.prettierrc
tsconfig.json
```

Project configuration is the source of truth.

Do not assume default ESLint or TypeScript behavior.

---

## Follow Existing Rules

Generated code must comply with:

- ESLint rules
- TypeScript rules
- Import ordering rules
- Formatting rules
- React rules
- Next.js rules
- Project-specific linting requirements

If a project rule conflicts with a general best practice, follow the project rule.

---

## No Lint Debt

Do not introduce:

- New lint errors
- New lint warnings
- TypeScript errors
- Formatting violations

Generated code should not require additional cleanup after implementation.

Lint compliance is part of the implementation.

---

## Type Safety

Respect the project's TypeScript configuration.

Avoid:

```ts
any
unknown as any
as any
```

unless absolutely necessary and explicitly justified.

Prefer:

- Strong typing
- Existing interfaces
- Existing DTOs
- Existing type definitions

Do not bypass type safety to silence errors.

---

## React Hooks Compliance

Follow all hook-related lint rules.

Examples:

- exhaustive-deps
- rules-of-hooks

Do not suppress hook warnings without clear justification.

Fix the root cause rather than disabling lint checks.

---

## Import Organization

Follow existing import conventions.

Respect:

- Import ordering
- Grouping
- Aliases
- Path conventions

Do not introduce inconsistent import patterns.

---

## Unused Code

Do not introduce:

- Unused imports
- Unused variables
- Unused functions
- Dead code

Remove temporary implementation artifacts before completion.

---

## Lint Rule Suppression

Avoid disabling lint rules.

Do not introduce:

```ts
// eslint-disable
// eslint-disable-next-line
// @ts-ignore
// @ts-nocheck
```

unless there is a documented and justified reason.

Suppression should be a last resort.

---

## Existing Project Conventions

Before implementing:

1. Read lint configuration.
2. Read TypeScript configuration.
3. Read formatting configuration.
4. Identify project-specific rules.
5. Generate code that complies with those rules.

Do not assume configuration values.

Verify them from the project.

---

## Validation Before Completion

Before considering a task complete:

- Ensure generated code follows project lint rules.
- Ensure generated code follows project type rules.
- Ensure generated code follows project formatting rules.
- Ensure no avoidable warnings or errors are introduced.

Implementation is not complete until it complies with project quality standards.

---

## AI-Specific Requirements

When working on frontend code:

- Always inspect linting and code-quality configuration before implementation.
- Treat linting rules as requirements, not suggestions.
- Prefer fixing violations over suppressing them.
- Generate code that integrates cleanly into the existing codebase without introducing lint or type errors.