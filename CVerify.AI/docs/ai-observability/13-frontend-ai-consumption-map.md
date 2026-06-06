# 13 - Frontend AI Consumption Map

This document maps the journey of AI-generated JSON fields from the raw API response to their corresponding React UI component rendering points in the frontend dashboard.

---

## Data Consumption Pathway

```text
[HTTP API Response]
       ↓
[repository-analysis.service.ts] <-- Schema validation via Zod (transforms & fallbacks)
       ↓
[source-code-providers/page.tsx]  <-- Fetches report & passes to state (`analysisResult`)
       ↓
[DetailedAnalysisModal.tsx]       <-- Main layout tabs container, handles CV tab
       ↓
[Subcomponents]                   <-- Renders specific tabs (Overview, Engineering, CV)
```

---

## Detailed UI Field Mapping

The following table details where each data field from the verified JSON report structure is consumed and rendered:

### 1. Report V2 Core Fields

| JSON Field / Property | React UI Component | Tab / Placement | Visual Render Representation |
|---|---|---|---|
| `classification.primaryDomain` | `DetailedAnalysisModal` | Modal Header / Overview | Renders as the primary classification title tag |
| `classification.subDomain` | `DetailedAnalysisModal` | Modal Header / Overview | Displays secondary technologies tags |
| `classification.trustScore` | `AnalysisScoreCards` | Overview / Stats Tab | Renders as the trust score circular gauge |
| `classification.isVerified` | `DetailedAnalysisModal` | Modal Header / Lists | Displays verification check badge |
| `risk.score` | `DetailedAnalysisModal` | Overview / Stats Tab | Displays risk score gauge value |
| `risk.level` | `DetailedAnalysisModal` | Overview / Stats Tab | Renders risk level badge (low, medium, high) |
| `risk.reasons` | `DetailedAnalysisModal` | Overview / Stats Tab | Lists bullet points detailing risk contributing factors |
| `cvSynthesis.title` | `DetailedAnalysisModal` | CV Tab | Displays recruiter-ready professional title banner |
| `cvSynthesis.summary` | `DetailedAnalysisModal` | CV Tab | Renders refined candidate resume summary (2-3 sentences) |
| `cvSynthesis.highlights` | `DetailedAnalysisModal` | CV Tab | Maps array of highlights displaying signals and colored impact icons |
| `cvSynthesis.ownershipProfile` | `DetailedAnalysisModal` | CV Tab | Renders ownership contribution tier (e.g. High contribution profile) |

### 2. Legacy/Fallback Fields (Supported)

| JSON Field / Property | React UI Component | Tab / Placement | Visual Render Representation |
|---|---|---|---|
| `facts.repo.stars`, `facts.repo.forks`, `facts.repo.branches`, `facts.repo.open_prs` | `MetricCards` | Contributors Tab | Renders Lucide metric icon badges |
| `facts.git_metrics.user_commit_ratio` | `DetailedAnalysisModal` | Contributors Tab | Displays commit contribution ratio percentage |
| `facts.git_metrics.total_commits` | `DetailedAnalysisModal` | Contributors Tab | Displays total commit counts |
| `ai_conclusions.profile.skills` | `SkillTreeVisualization` | Engineering Tab | Maps skill categories into an interactive nested tree diagram |
| `ai_conclusions.profile.architecture.patterns` | `InsightSections` | Overview Tab | Rendered as architectural pill badges |
| `ai_conclusions.profile.engineering_practices` | `InsightSections` | Overview Tab | Renders cards detailing "Testing", "Observability", and "CI/CD" |
| `ai_conclusions.findings` | `SkillTreeVisualization` / `VerificationSignals` | Multiple Tabs | Groups findings by category, rendering titles, explanations, and file signals |

---

## Unused Fields and Missing Bindings

The audit identified several fields defined in the database and API payloads that are completely ignored by the client UI:

1.  **`facts.repo.topics`**: The Zod schema (`RepoInfoSchema`) parses this as a list of strings (`topics: z.array(z.string())`), but no frontend component binds or displays it.
2.  **`facts.repo.fork`**: The boolean flag indicating if the repository is a fork is validated in `RepositoryAnalysisSchema` but remains unused (only the forks count is displayed).
3.  **`schemaVersion`**: Transited through HTTP payloads but ignored in layout rendering.

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | React Components Folder: [client/src/app/(private)/settings/components/repository-analysis/](../components/repository-analysis/) |
| **Dependencies** | `@heroui/react`, `lucide-react`, Zod, axios Client |
| **Execution Flow** | React triggers request ➔ API resolves JSON ➔ State updates ➔ `DetailedAnalysisModal` re-renders, passing data down as props. |
| **Common Failure Modes** | **Null Reference Crash** (if fields are undefined/null in JSON and Zod transformations fail, React throws a rendering exception). |
| **Related Files** | [client/src/services/repository-analysis.service.ts](../services/repository-analysis.service.ts), [client/src/types/repository-analysis.types.ts](../types/repository-analysis.types.ts) |
| **Related Services** | `repositoryAnalysisApi` |
| **Related DTOs** | `RepositoryAnalysis` |
| **Related Database Tables** | `AnalysisReports` |
| **Related Frontend Components** | `DetailedAnalysisModal`, `VerificationSignals`, `SkillTreeVisualization` |
