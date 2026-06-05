# 14 - Prompt Output Contract

This document provides a technical data contract table for the repository analysis pipeline, tracing how every key field is generated, validated, stored, and rendered across all system layers.

---

## Data Contract Specifications

| Property / Path | Source / Generator | Validation Rule | Storage Format | Rendering UI Component |
|---|---|---|---|---|
| **`repo.id`** | Injected by Python Orchestrator from requested `repositoryId` | Checked by Pydantic string validation; parsed as UUID in C# | PostgreSQL: `AnalysisReport.RepositoryId` (UUID) | Renders in the modal header title context |
| **`repo.languages`** | Claude output; backfilled by Technology Detector if missing | Zod: `z.record(z.number())` (maps language names to pct ratios) | Saved inside the JSONB blob | `TechnologyTags.tsx` maps ratios to tags |
| **`classification.complexity`** | Claude output Stylistic evaluation | Zod enum: `"low"` \| `"medium"` \| `"high"` (defaults to `"medium"`) | Saved inside the JSONB blob | `AnalysisScoreCards.tsx` (badge color matches level) |
| **`trust.classification`** | Claude output stylistic analysis | Zod enum: `"personal_authentic"` \| `"fork_rebranded"` \| `"template_dump"` \| `"collaboration"` (defaults to `"personal_authentic"`) | Saved inside the JSONB blob | `VerificationSignals.tsx` (renders status badge) |
| **`trust.confidence`** | Claude output confidence percentage | Zod: `z.number().min(0).max(100)` (defaults to `100`) | Extracted in C# to calculate: `SourceCodeRepository.TrustScore = score / 100` | `AnalysisScoreCards.tsx` (gauge rendering score) |
| **`profile.skills`** | Claude output categorized skill mappings | Zod: `z.record(z.array(z.string()))` (category map) | Saved inside the JSONB blob | `SkillTreeVisualization.tsx` (collapsible tree categories) |
| **`findings`** | Claude output (max 5 critical findings, 1 sentence each) | Zod: `z.array(RepositoryEvidenceFindingSchema)` | Saved inside the JSONB blob | `VerificationSignals.tsx` and `SkillTreeVisualization.tsx` |
| **`narrative.recruiter_summary`** | Claude output summary text | Zod: `z.string().optional()` | Saved inside the JSONB blob | `DetailedAnalysisModal.tsx` (executive summary panel) |

---

## Nullability and Type Mismatch Risks

> [!CAUTION]
> **1. Zod Catches vs. DB Deserialization**:
> CVerify uses Zod's `.catch()` and `.transform()` methods extensively in the frontend (e.g., `complexity: z.enum(...).catch("medium")`, `trust.classification: z.enum(...).catch("personal_authentic")`).
>
> While this prevents the React frontend from throwing a white-screen exception if Claude returns an unexpected or invalid classification string, it silently masks LLM format drift.
>
> **2. C# Numeric Parse Risk**:
> In CVerify.Core `RepositoryAnalysisService.cs` line 348, the service uses `scoring.final_score.GetDouble()` to extract the score.
>
> If Claude returns the score as a string (e.g. `"92"` instead of `92`), or omits the score block entirely (forcing the orchestrator backfill to run, which might also default to string or fail), the C# method will throw a `JsonException` or `InvalidOperationException`, causing the background job to transition to a `Failed` state at the very last step.

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | Prompt Schema definition in [app/prompts/github_prompt_factory.py](../prompts/github_prompt_factory.py) |
| **Dependencies** | Python: `json`. C#: `System.Text.Json`. TS: `zod`. |
| **Execution Flow** | Prompt schema specification → Claude response matching → Python parser conversion → C# DB commit → Zod frontend conversion |
| **Common Failure Modes** | **JSON Schema Drift** (Claude updates format, Zod fails validation, or C# throws exceptions on missing scoring fields) |
| **Related Files** | [client/src/services/repository-analysis.service.ts](../services/repository-analysis.service.ts), `RepositoryAnalysisService.cs` |
| **Related Services** | [ClaudeService](../services/claude_service.py) |
| **Related DTOs** | `RepositoryAnalysis` |
| **Related Database Tables** | `AnalysisReports` |
| **Related Frontend Components** | `DetailedAnalysisModal.tsx` |
