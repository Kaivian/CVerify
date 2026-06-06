# 14 - Prompt Output Contract

This document provides the technical data contract for the repository analysis pipeline, tracing how every key field is generated, validated, stored, and rendered — and specifying the **required detail level** for every descriptive text field.

---

## The Specificity Standard

All descriptive fields in the analysis report must meet the following standard:

> A description is **specific** if a reader unfamiliar with the repository could identify the specific file, pattern, or behavior being referenced. A description is **generic** if it could be copy-pasted into any repository's report without being false.

| Quality Level | Example | Acceptable? |
|---|---|---|
| **Generic** | "This repository demonstrates strong engineering practices." | ❌ Rejected |
| **Semi-specific** | "The project uses dependency injection and has good test coverage." | ⚠ Marginal |
| **Specific** | "Constructor-based dependency injection is used in `UserService.cs`, `AuthService.cs`, and `RepositoryService.cs`. Unit test coverage is visible in `tests/UserServiceTests.cs` with mocked dependencies via NSubstitute." | ✅ Required |

---

## Data Contract Specifications

| Property / Path | Source / Generator | Detail Level Required | Validation Rule | Storage Format | Rendering UI Component |
|---|---|---|---|---|---|
| **`repo.id`** | Injected by Python Orchestrator from requested `repositoryId` | N/A (identifier) | Checked by Pydantic string validation; parsed as UUID in C# | PostgreSQL: `AnalysisReport.RepositoryId` (UUID) | Renders in the modal header title context |
| **`repo.description`** | Claude output — synthesized from sampled README and code context | Specific: must reflect the actual repo purpose, not a generic label | Zod: `z.string().optional()` | Saved inside the JSONB blob | `DetailedAnalysisModal.tsx` header |
| **`repo.languages`** | Claude output; backfilled by Technology Detector if missing | N/A (numeric map) | Zod: `z.record(z.number())` (maps language names to pct ratios) | Saved inside the JSONB blob | `TechnologyTags.tsx` maps ratios to tags |
| **`classification.complexity`** | Claude output stylistic evaluation | N/A (enum) | Zod enum: `"low"` \| `"medium"` \| `"high"` (defaults to `"medium"`) | Saved inside the JSONB blob | `AnalysisScoreCards.tsx` (badge color matches level) |
| **`trust.classification`** | Claude output stylistic analysis | N/A (enum) | Zod enum: `"personal_authentic"` \| `"fork_rebranded"` \| `"template_dump"` \| `"collaboration"` (defaults to `"personal_authentic"`) | Saved inside the JSONB blob | `VerificationSignals.tsx` (renders status badge) |
| **`trust.explanation`** | Claude output — rationale for trust classification | **Specific (2-3 sentences)**: must cite specific signals that justify the classification (e.g., commit history structure, file authorship consistency, deviation from template boilerplate) | Zod: `z.string()` | Saved inside the JSONB blob | `VerificationSignals.tsx` |
| **`trust.ai_findings[]`** | Claude output — AI-observed behavioral patterns | **Specific (1 entry per pattern)**: each entry must describe one concrete observed behavior with an example (file name, class, or code construct) | Zod: `z.array(z.string())` | Saved inside the JSONB blob | `VerificationSignals.tsx` warning cards |
| **`trust.confidence`** | Claude output confidence percentage | N/A (numeric score) | Zod: `z.number().min(0).max(100)` (defaults to `100`) | Extracted in C# to calculate: `SourceCodeRepository.TrustScore = score / 100` | `AnalysisScoreCards.tsx` (gauge rendering score) |
| **`profile.skills`** | Claude output categorized skill mappings | N/A (structured map) | Zod: `z.record(z.array(z.string()))` (category map) | Saved inside the JSONB blob | `SkillTreeVisualization.tsx` (collapsible tree categories) |
| **`findings[]`** | Claude output (max 5 critical findings) | **Specific**: see Finding Contract table below | Zod: `z.array(RepositoryEvidenceFindingSchema)` | Saved inside the JSONB blob | `VerificationSignals.tsx` and `SkillTreeVisualization.tsx` |
| **`narrative.recruiter_summary`** | Claude output summary text | **Specific (3-5 sentences)**: must name specific technologies, architecture patterns, and at least one concrete quality signal observed in sampled files | Zod: `z.string().optional()` | Saved inside the JSONB blob | `DetailedAnalysisModal.tsx` (executive summary panel) |
| **`narrative.top_strengths[]`** | Claude output strength list | **Specific**: full sentence per entry, grounded in a specific technical observation (not generic labels) | Zod: `z.array(z.string())` | Saved inside the JSONB blob | `RecommendationPanels.tsx` |
| **`narrative.limitations[]`** | Claude output limitation list | **Specific**: full sentence per entry, referencing a concrete gap visible in the sampled code | Zod: `z.array(z.string())` | Saved inside the JSONB blob | `RecommendationPanels.tsx` |
| **`positioning.relative_strengths[]`** | Claude output comparative positioning | **Specific**: each strength must be evidence-backed (e.g., cite files or patterns, not generic labels) | Zod: `z.array(z.string())` | Saved inside the JSONB blob | `AnalysisScoreCards.tsx` |
| **`scoring.final_score`** | Claude output or backfilled from `trust.confidence` | N/A (numeric) | Must be a JSON number (not string). C# parses via `GetDouble()`. | `SourceCodeRepository.TrustScore`, `AnalysisJob.Status` | `AnalysisScoreCards.tsx` trust gauge |

---

## Finding Detail Contract

Each entry in the `findings[]` array must conform to the following structure:

| Sub-field | Type | Detail Requirement | Example (Good) | Example (Bad) |
|---|---|---|---|---|
| `title` | string | Short category label (3-6 words) | `"Layered Architecture Detected"` | `"Architecture"` |
| `explanation` | string | **2-4 sentences.** Must reference at least one specific file path or method name visible in the sampled code. | `"The repository separates concerns into Controllers, Services, and Repositories layers. RepositoryAnalysisController.cs delegates all business logic to RepositoryAnalysisService.cs, which in turn calls IAnalysisJobRepository for data access. This pattern reduces coupling and aligns with standard ASP.NET MVC conventions."` | `"The project follows a layered architecture with good separation of concerns."` |
| `evidence_signals[]` | string[] | List of 1-5 specific file paths, class names, or code patterns that support the finding | `["RepositoryAnalysisController.cs", "RepositoryAnalysisService.cs", "IAnalysisJobRepository.cs"]` | `["controllers", "services"]` |
| `category` | string | Enum tag for grouping | `"architecture"` \| `"security"` \| `"testing"` \| `"quality"` \| `"ownership"` | Free text |
| `impact` | string | Enum severity of the finding | `"positive"` \| `"warning"` \| `"critical"` | Boolean |

---

## Recruiter Summary Contract

The `narrative.recruiter_summary` field is the most visible output in the UI (renders in the executive summary panel). It must follow this structure:

1. **Sentence 1 — What the repo is**: State the primary purpose and domain of the repository, grounded in the README or entry-point files.
2. **Sentence 2 — Tech stack highlight**: Name the detected primary language, framework, and 1-2 notable libraries.
3. **Sentence 3 — Architecture signal**: Describe the observable architecture pattern with a specific file reference.
4. **Sentence 4 — Quality signal**: Call out one concrete quality indicator (test coverage, CI/CD presence, error handling patterns, etc.) with a file or directory reference.
5. **Sentence 5 (optional) — Red flag or standout**: Note one notable concern or exceptional positive that distinguishes this repository.

**Example of an acceptable recruiter_summary:**
```
"CVerify is an AI-powered developer verification platform built around a microservice architecture.
The backend runs on ASP.NET Core 10 (C#) with a Python FastAPI microservice (CVerify.AI) handling
all Anthropic Claude integrations. Service communication follows an event-driven pattern via Redis
Pub/Sub, as visible in RepositoryAnalysisService.cs and BackgroundRepositoryAnalysisProcessor.cs.
Unit and integration tests are present in the CVerify.Tests project, targeting the service layer
with xUnit and Moq. The repository is actively maintained with consistent commit cadence and no
evidence of template-dumped scaffolding."
```

**Example of a rejected recruiter_summary (too generic):**
```
"This repository demonstrates strong engineering practices and shows a skilled developer with
experience in modern web technologies. The code is well-organized and follows industry standards."
```

---

## Nullability and Type Mismatch Risks

> [!CAUTION]
> **1. Zod Catches vs. DB Deserialization**:
> CVerify uses Zod's `.catch()` and `.transform()` methods in the frontend (e.g., `complexity: z.enum(...).catch("medium")`). While this prevents React from throwing a white-screen exception, it silently masks LLM format drift. Monitor for silent fallbacks in Zod validation logs.
>
> **2. C# Numeric Parse Risk**:
> In `RepositoryAnalysisService.cs` line 348, the service uses `scoring.final_score.GetDouble()`. If Claude returns the score as a string (e.g. `"92"` instead of `92`), the C# method will throw a `JsonException`, failing the job at the final step.
>
> **3. Evidence Hallucination Risk (New)**:
> With specificity requirements, Claude may fabricate plausible-sounding file names not present in the sampled set. The `evidence_signals[]` array should be cross-validated against the `file_names` list injected into the prompt. A future validation step in the orchestrator should flag signals referencing files not in the sampled set.

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | Prompt Schema definition in [app/prompts/github_prompt_factory.py](../prompts/github_prompt_factory.py) |
| **Dependencies** | Python: `json`. C#: `System.Text.Json`. TS: `zod`. |
| **Execution Flow** | Prompt schema specification (with inline specificity directives) → Claude response matching → Python parser conversion → C# DB commit → Zod frontend conversion |
| **Common Failure Modes** | **JSON Schema Drift** (Claude updates format, Zod fails), **C# Score Parse Failure** (missing or string-typed `scoring.final_score`), **Evidence Hallucination** (cited files not in sampled set) |
| **Related Files** | [client/src/services/repository-analysis.service.ts](../services/repository-analysis.service.ts), `RepositoryAnalysisService.cs` |
| **Related Services** | [ClaudeService](../services/claude_service.py) |
| **Related DTOs** | `RepositoryAnalysis` |
| **Related Database Tables** | `AnalysisReports` |
| **Related Frontend Components** | `DetailedAnalysisModal.tsx` |
