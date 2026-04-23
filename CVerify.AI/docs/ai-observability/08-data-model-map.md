# 08 - Data Model Map

This document charts the data contracts across the entire CVerify architecture, tracing field definitions from the raw JSON produced by Anthropic's Claude to Python dataclasses, C# database entities, and TypeScript React structures under the v2 schema.

---

## The Core Data Flow

The repository analysis system uses a sequential task execution and aggregation pattern. Results are cached locally in the Python workspace, and then aggregated into the final report payload conforming to **`ReportV2Contract`** (with backward compatibility maps for legacy properties).

```text
[Discrete Task Results Caches]
              ↓
   [FastAPI Aggregator]        <-- Runs truth calibration & adversarial risk checks
              ↓
    [ReportV2Contract JSON]    <-- Enforces Pydantic V2 schema structures
              ↓
  [C# RepositoryAnalysisSvc]   <-- Parses schema via ParseV2ReportMetadata()
              ↓
   [PostgreSQL Database]       <-- Saved in AnalysisReport.ReportData (JSONB column)
              ↓
     [React client SPA]        <-- Renders v2 nodes & trust graph visual maps
```

---

## Layer-by-Layer Class Mapping

### 1. Python Models (FastAPI & Orchestrator)
*   **`TaskExecutionRequest`** (`app/routes/analysis_router.py`): Ingests task orchestration variables.
*   **`AggregationRequest`** (`app/routes/analysis_router.py`): Ingests cached results list.
*   **`ReportV2Contract`** (`app/orchestrators/github_analysis_orchestrator.py`): Primary schema validator.
    *   `classification`: `ClassificationV2`
    *   `sections`: `List[SectionV2]` (groups practices, security, and architecture)
    *   `risk`: `RiskV2`
    *   `cvSynthesis`: `Optional[CvSynthesisContract]`

### 2. C# Entities (CVerify.Core Database Models)
*   **`AnalysisJob`** (`Modules/SourceCode/Entities/AnalysisJob.cs`): Records job state.
*   **`AnalysisTask`** (`Modules/SourceCode/Entities/AnalysisTask.cs`): Records individual task state, durations, token usage, and costs.
*   **`AnalysisTaskResult`** (`Modules/SourceCode/Entities/AnalysisTaskResult.cs`): Stores discrete JSON outputs.
*   **`AnalysisReport`** (`Modules/SourceCode/Entities/AnalysisReport.cs`): Stores the raw aggregated JSON report in `ReportData` (`jsonb`).
*   **`SourceCodeRepository`** (`Modules/SourceCode/Entities/SourceCodeRepository.cs`): Stores classification, risk, and trust metrics parsed by C# `ParseV2ReportMetadata()`.

---

## Detailed Field Mapping & Mismatch Risks

The table below traces the data contract for key fields under the Report V2 contract across boundaries:

| Concept | Python Pydantic Schema Path | C# Database Field (SourceCodeRepository) | C# Extractor Parser | React UI Target |
|---|---|---|---|---|
| **Schema Version** | `schemaVersion` | N/A (Checked in conditional) | Check `== "v2"` | Checked by Zod parser |
| **Primary Domain** | `classification.primaryDomain` | `repo.Classification` | `primaryDomain.GetString()` | Renders as main type tag |
| **Sub Domain** | `classification.subDomain` | N/A | N/A | Renders sub-languages |
| **Confidence** | `classification.confidence` | N/A | N/A | Renders gauge confidence |
| **Verification Status** | `classification.isVerified` | `repo.IsVerified` | `isVerified.GetBoolean()` | Displays verification status |
| **Trust Score** | `classification.trustScore` | `repo.TrustScore` | `trustScore.GetDouble()` | Renders trust meter |
| **Risk Score** | `risk.score` | `repo.LatestRiskScore` | `risk.score.GetDouble()` | Renders risk percentage |
| **Risk Level** | `risk.level` | `repo.LatestRiskLevel` | `risk.level.GetString()` | Matches risk level badge |
| **Risk Reasons** | `risk.reasons` | `repo.LatestRiskFactorsJson` | `risk.reasons.ToString()` | Renders warning bullets |
| **CV Summary** | `cvSynthesis.summary` | N/A | N/A | Executive summary section |
| **CV Title** | `cvSynthesis.title` | N/A | N/A | Professional title banner |
| **CV Highlights** | `cvSynthesis.highlights` | N/A | N/A | Dynamic timeline highlight items |

---

## Key Mismatches and Nullability Risks

> [!WARNING]
> **1. Pydantic Constraints vs. C# Strict Parsing**:
> CVerify.Core's `ParseV2ReportMetadata` parses `ReportV2Contract` using C#'s `System.Text.Json` library. If Pydantic validates a structure, but C# expects a property like `classification.trustScore` to be a number and it contains `null` or a string, the C# parser will throw a `JsonException` and fail the job execution.
>
> **2. Workspace Cleanup Dependency**:
> C# triggers aggregation with `deleteWorkspace = true`. If the aggregation call fails or times out before returning, the C# transaction rolls back but the temporary clones directory inside CVerify.AI might not be cleaned up, leading to accumulative disk bloat.
>
> **3. Fallback Mapping**:
> While `ReportV2Contract` allows extra fields to preserve backward compatibility (e.g. `facts`, `ai_conclusions`, `trust_intelligence` are injected at the root of `report_dict`), these properties are not typed inside `ReportV2Contract` and are instead checked on the client via Zod catch fallbacks.

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | `ReportV2Contract` Pydantic models in [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py) |
| **Dependencies** | Python: `pydantic`. C#: `System.Text.Json`, `EF Core`. |
| **Execution Flow** | Aggregation compiles JSON ➔ Validates via Pydantic ➔ Returns HTTP string ➔ Core C# parses via `ParseV2ReportMetadata` ➔ Writes to database entity ➔ React validates via Zod. |
| **Common Failure Modes** | **Pydantic Validation Failures** (Claude failed to output CV Highlights structure), **C# GetDouble Exception** (trustScore represented as string `"0.82"` instead of float `0.82`). |
| **Related Files** | `RepositoryAnalysisService.cs` (C#), `github_analysis_orchestrator.py` |
| **Related Services** | `RepositoryAnalysisService.cs` in C# |
| **Related DTOs** | `AggregationRequest`, `ReportV2Contract` |
| **Related Database Tables** | `AnalysisReports`, `SourceCodeRepositories`, `AnalysisTasks` |
| **Related Frontend Components** | `DetailedAnalysisModal.tsx` |
