# 08 - Data Model Map

This document charts the data contracts across the entire CVerify architecture, tracing field definitions from the raw JSON produced by Anthropic's Claude to Python dataclasses, C# database entities, and TypeScript Zod validation schemas.

---

## The Core Data Flow

The repository analysis system uses a store-and-forward pattern for report payloads. Instead of deserializing the entire JSON report in C#, CVerify.Core stores the raw JSON payload in a Postgres `jsonb` column and proxies it directly to the React client.

```text
[Raw Claude JSON Response]
         ↓
[Python Orchestrator Dict]  <-- Injects repo metadata, backfills missing scoring parameters
         ↓
[FastAPI SSE Stream Chunks]
         ↓
[C# RepositoryAnalysisService] <-- Parses scoring.final_score for IsVerified flag
         ↓
[PostgreSQL Database]       <-- Saved in AnalysisReport.ReportData (JSONB column)
         ↓
[React client SPA]          <-- Parses and validates via TypeScript Zod Schema
```

---

## Layer-by-Layer Class Mapping

### 1. Python Models (FastAPI & Orchestrator)
*   **`AnalysisRequest`** (`app/routes/analysis_router.py`): Ingests trigger variables.
*   **`CodeSample`** (`app/github/code_sampler.py`): Contains list of contents and relative filenames.
*   **`CodeSamplingOptions`** (`app/github/code_sampler.py`): Holds config thresholds.

### 2. C# Entities (CVerify.Core Database Models)
*   **`AnalysisJob`** (`Modules/SourceCode/Entities/AnalysisJob.cs`): Records job state (`Status`, `Progress`, `CurrentStep`, `ErrorMessage`).
*   **`AnalysisJobEvent`** (`Modules/SourceCode/Entities/AnalysisJobEvent.cs`): Logging table for historical progress tracking.
*   **`AnalysisReport`** (`Modules/SourceCode/Entities/AnalysisReport.cs`): Stores the raw JSON report in the `ReportData` (`jsonb` type) column.
*   **`SourceCodeRepository`** (`Modules/SourceCode/Entities/SourceCodeRepository.cs`): Store metadata and intelligence flags (`IsVerified`, `TrustScore`).

### 3. TypeScript UI Types (React Frontend)
*   **`RepositoryAnalysis`** (`client/src/types/repository-analysis.types.ts`): Top-level report container.
*   **`RepositoryAnalysisSchema`** (`client/src/services/repository-analysis.service.ts`): Zod runtime schema converter.

---

## Detailed Field Mapping & Mismatch Risks

The table below traces the data contract for key fields across all architectural boundaries:

| Field / Concept | Claude JSON Path | Python Orchestrator | C# Database Entity / Field | Frontend TS Type |
|---|---|---|---|---|
| **Repository ID** | `repo.id` | Injected from request payload (`report_dict["repo"]["id"] = str(repository_id)`) | `AnalysisReport.RepositoryId` (UUID) | `RepoInfo.id` (string) |
| **Trust Score / Percentile** | `scoring.final_score` | Injected or backfilled from `trust.confidence` | Extracted via `JsonDocument` to set `SourceCodeRepository.TrustScore = finalScore / 100` | `RepositoryAnalysis.trust.confidence` (number) |
| **Verification Status** | Not present | Not present | Evaluated in Service: `repo.IsVerified = finalScore >= 50.0` | Frontend checks `IsVerified` flag on the repository list |
| **Repo Description** | `repo.description` | Parsed directly | Saved in `SourceCodeRepository.Description` | `RepoInfo.description` (string \| null) |
| **Technologies** | `profile.technologies` | Injected in payload | Saved as part of JSONB blob | `RepositoryProfileDetail.technologies` |
| **Recruiter Narrative** | `narrative.recruiter_summary` | Optional in Claude prompt | Saved as part of JSONB blob | `RepositoryNarrative.recruiter_summary` (optional) |

---

## Key Mismatches and Nullability Risks

> [!WARNING]
> **1. C# Scoring Parsing Vulnerability**:
> Although CVerify.Core does not deserialize the entire JSON report, it uses a lightweight C# JSON parser in `RepositoryAnalysisService.ExecuteAnalysisJobAsync` to read `scoring.final_score` (to update `IsVerified` and `TrustScore` values).
>
> If the Claude prompt output format changes, and `scoring.final_score` is missing or renamed, the C# service will fail to update the repository's verification status, leaving it unverified (defaults to false) even if the analysis successfully finishes.
>
> **2. Decoupled Narrative / Schema Versions**:
> In the frontend, `analysis.narrative` is classified as optional. The Python prompt factory always requests it. If Claude omits the narrative key, the frontend falls back to the trust description (`analysis.narrative?.recruiter_summary || trust.explanation`).

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | Zod Schema: `RepositoryAnalysisSchema` in [client/src/services/repository-analysis.service.ts](../services/repository-analysis.service.ts) |
| **Dependencies** | Python: `pydantic`. C#: `System.Text.Json`, `EF Core`. TS: `zod`. |
| **Execution Flow** | Claude output text → extracted JSON dictionary → HTTP stream transited → Saved in EF Core PostgreSQL DB as `jsonb` string → Queried by React Client → Validated via Zod parser |
| **Common Failure Modes** | **Zod Parsing Crash** (Claude returned integer instead of array, or invalid enum key), **C# Parse Fail** (missing `scoring` block causing DB commit exception) |
| **Related Files** | [client/src/types/repository-analysis.types.ts](../types/repository-analysis.types.ts), `AnalysisReport.cs` |
| **Related Services** | `RepositoryAnalysisService.cs` in C# |
| **Related DTOs** | `AnalysisRequest` in Python, `AnalysisJobDto` in C# |
| **Related Database Tables** | `AnalysisReports`, `SourceCodeRepositories` |
| **Related Frontend Components** | `DetailedAnalysisModal.tsx` |
