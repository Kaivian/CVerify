# 14 - Prompt Output Contract

This document provides the technical data contract for the repository analysis pipeline, tracing how every key field is generated, validated, stored, and rendered — and specifying the **required detail level** for every descriptive text field under the v2 schema.

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

## Data Contract Specifications (Report V2 Schema)

Aggregated results strictly satisfy the Pydantic `ReportV2Contract` model:

### 1. Root-Level Schema Fields

*   **`schemaVersion`**: Literal string `"v2"`.
*   **`repoId`**: Unique repository UUID string. Injected from the database record during execution.
*   **`classification`** (`ClassificationV2`):
    *   `primaryDomain` (string): The resolved semantic type of repository (e.g. SaaS Platform, CLI Tool).
    *   `subDomain` (string): Specific technology stack descriptors (e.g. `Python, JavaScript`).
    *   `confidence` (float): Resolution confidence score between `0.0` and `1.0`.
    *   `isVerified` (bool): True if the trust score is `50%` or higher, and there are no critical adversarial flags.
    *   `trustScore` (float): Calibrated developer trust score between `0.0` and `1.0`.
*   **`sections`** (`List[SectionV2]`):
    Grouped categories of qualitative intelligence findings. Each section contains:
    *   `type`: Literal choice of `"engineering_practices"`, `"security_findings"`, or `"architecture_insights"`.
    *   `items`: List of text elements or `SectionItemV2` objects:
        *   `title` (string): Finding name (3-6 words).
        *   `content` (string): Evidence explanation (2-4 sentences, must cite specific files).
*   **`risk`** (`RiskV2`):
    *   `score` (float): Calibrated risk score between `0.0` and `100.0`.
    *   `level`: Literal choice of `"low"`, `"medium"`, or `"high"`.
    *   `reasons` (list of strings): Concrete contributing factors justifying the risk classification.
*   **`cvSynthesis`** (`CvSynthesisContract`):
    Professional CV summary details extracted during the final pipeline task:
    *   `schemaVersion`: Literal `"v2"`.
    *   `title` (string): Professional developer title (e.g. `Django Backend Developer`).
    *   `skills` (list of strings): Exact list of calibrated developer skills.
    *   `summary` (string): Recruiter-ready narrative (2-3 sentences).
    *   `highlights` (`List[CvHighlight]`): Key developer achievements (e.g. signal description, impact tier: `positive`/`warning`/`critical`).
    *   `ownershipProfile`: Literal choice of `"High contribution profile"`, `"Standard contribution profile"`, `"Low contribution profile"`, or `"External contributor context"`.

---

## Legacy Field Preservation map

For backward compatibility with the frontend React UI, the orchestrator injects three legacy blocks at the root level of the returned payload:
*   **`facts`**: Contains `repo` info, `git_metrics` (commits, ratios, active authors, bus factor), and `quality_metrics` (scanned/sampled files, prompt caching efficiency).
*   **`ai_conclusions`**: Holds `authenticity`, classification details, findings breakdown, `trust` evaluation, risk assessments, relative strengths, and narrative summary block.
*   **`trust_intelligence`**: Holds uncertainty metrics (variance, bias, manipulation risks), conflict resolution log, and the interactive trust graph.

---

## Recruiter Summary Contract

The `cvSynthesis.summary` field is the most visible text block in the UI. It must adhere to the following structure:

1.  **Sentence 1 — What the repo is**: State the primary purpose and domain of the repository.
2.  **Sentence 2 — Tech stack highlight**: Name the detected primary language, framework, and key libraries.
3.  **Sentence 3 — Architecture/Quality signal**: Describe the observable architecture pattern or testing framework with specific file references.

**Example of an acceptable summary:**
> "CVerify is a talent verification platform built on a microservice architecture. The backend is written in ASP.NET Core with a Python FastAPI microservice (CVerify.AI) handling all AI integrations. Service communication is event-driven via Redis Pub/Sub, as visible in RepositoryAnalysisService.cs, with unit test coverage provided by xUnit."

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | Pydantic contracts in [app/orchestrators/github_analysis_orchestrator.py](../orchestrators/github_analysis_orchestrator.py) |
| **Dependencies** | Python: `pydantic`. C#: `ParseV2ReportMetadata()`. TS: `repository-analysis.service.ts` |
| **Execution Flow** | Task prompts generated ➔ Claude output ➔ JSON extracted ➔ Aggregator validates against `ReportV2Contract` ➔ Core C# parses and saves ➔ UI validates Zod. |
| **Common Failure Modes** | **JSON Schema Drift** (Claude updates format, Zod fails), **String/Numeric Mismatch** (such as formatting `trustScore` as a percentage string instead of a float). |
| **Related Files** | [app/prompts/github_prompt_factory.py](../prompts/github_prompt_factory.py), [app/prompts/cv_prompt_factory.py](../prompts/cv_prompt_factory.py) |
| **Related Services** | [ClaudeService](../services/claude_service.py) |
| **Related DTOs** | `ReportV2Contract` |
| **Related Database Tables** | `AnalysisReports` |
| **Related Frontend Components** | `DetailedAnalysisModal.tsx` |
