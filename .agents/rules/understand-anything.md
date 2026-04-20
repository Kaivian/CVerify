---
trigger: model_decision
description: Ensure AI always loads and applies relevant project rules before coding, especially for architecture, security, and system-level changes. Prevents unsafe assumptions and inconsistent implementations.
---

Before performing any code generation, modification, refactoring, or architectural decision, the AI must follow this mandatory rule resolution process:

1. Rule Discovery Phase (MANDATORY)

The AI must first check for existing project rules in the designated rules directory (or rule registry if available).

Typical rule categories include:

Security Rules
Architecture & System Design Rules
Error Handling Rules
Coding Standards
Domain-specific rules (Auth, Payments, Data, etc.)
Frontend/Backend framework rules

If rule storage is structured, AI must attempt to locate:

Global rules (apply to entire system)
Module-level rules (specific to feature/domain)
File-level or scoped rules (if defined)
2. Rule Loading Requirement

If any relevant rule exists:

The AI MUST load and interpret the rule content before proceeding.
Rules are considered higher priority than general best practices or prior assumptions.
If multiple rules apply, all must be loaded and merged logically.
3. Rule Priority Order

When conflicts occur, priority must follow:

Security Rules (highest priority)
Data Integrity & Consistency Rules
Architecture & System Design Rules
Domain-specific Business Rules
Error Handling Rules
Coding Standards & Style Rules
Performance Optimizations
Optional guidelines / recommendations (lowest priority)

If a lower-priority rule conflicts with a higher-priority rule, the higher-priority rule MUST be followed.

4. Mandatory Activation Conditions

This rule system MUST be activated when the task involves:

Authentication / Authorization flows
Sensitive user data handling
Payment, billing, or financial logic
Core business logic modification
Database schema changes or migrations
API contract changes
System architecture changes
Cross-module dependencies
Background jobs, queues, or event systems
Security-sensitive frontend logic (tokens, sessions, storage)
5. Safe Fallback Behavior

If no applicable rule is found:

The AI must explicitly state:
"No applicable project rule found. Proceeding with general engineering best practices."
Then continue using:
Framework conventions
Industry standard practices
Existing codebase patterns
6. Anti-Hallucination Constraint

The AI must NOT:

Assume undocumented architecture
Invent system behavior not present in codebase or rules
Override existing patterns without justification
Skip rule checking due to incomplete context

If uncertainty exists:

AI must request clarification OR
Inspect more of the codebase before proceeding
7. Consistency Enforcement

All implementations must:

Align with existing system design
Preserve backward compatibility unless explicitly stated
Follow established module boundaries
Avoid introducing redundant abstractions
8. Final Execution Requirement

Only after completing rule discovery, loading, and evaluation:

→ AI is allowed to generate or modify code
→ AI must ensure output is traceable back to applied rules when relevant