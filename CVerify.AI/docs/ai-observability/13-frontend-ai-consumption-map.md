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
[DetailedAnalysisModal.tsx]       <-- Main layout tabs container
       ↓
[Subcomponents]                   <-- Renders specific tabs (Overview, Engineering, etc.)
```

---

## Detailed UI Field Mapping

The following table details where each data field from the verified JSON report structure is consumed and rendered:

| JSON Field / Property | React UI Component | Tab / Placement | Visual Render Representation |
|---|---|---|---|
| `repo.full_name` | `DetailedAnalysisModal` | Modal Header | Rendered as text title inside `Modal.Heading` |
| `repo.stars`, `repo.forks`, `repo.branches`, `repo.open_prs` | `MetricCards` | Contributors & Activity Tab | Displayed as metric cards using Lucide icons (`Star`, `GitFork`, `GitBranch`, `PullRequest`) |
| `classification.primary_type` | `AnalysisScoreCards` | Overview / Stats Tab | Displayed as a text tag labeled "Primary Classification" |
| `classification.complexity` | `AnalysisScoreCards` | Overview / Stats Tab | Rendered as a badge indicating "Complexity Profile" (low, medium, high) |
| `evidence_points.total` | `AnalysisScoreCards` | Overview / Stats Tab | Renders as the "Evidence Points" summary card |
| `evidence_points.breakdown` | `AnalysisScoreCards` | Overview / Stats Tab | In `AnalysisScoreCards.tsx`, `Object.entries(evidence_points.breakdown)` maps category strings to point values |
| `ownership.user_commit_ratio` | `DetailedAnalysisModal` | Contributors Tab | Renders as a percentage: `(ownership.user_commit_ratio * 100).toFixed(0)%` |
| `ownership.total_commits`, `ownership.maintenance_duration_months`, `ownership.is_primary_author` | `DetailedAnalysisModal` | Contributors Tab | Renders in the "Contributor Collaboration Details" grid layout |
| `trust.classification` | `VerificationSignals` | Verification & Trust Tab | Displayed as a Trust Status Badge (e.g. `personal_authentic`, `fork_rebranded`) |
| `trust.confidence` | `AnalysisScoreCards` | Overview / Stats Tab | Rendered as the gauge value in the "Trust Score" card |
| `trust.rule_flags`, `trust.ai_findings` | `VerificationSignals` | Verification & Trust Tab | Displays warning flags list, listing styled cards of stylistic observations |
| `positioning.percentile_rank` | `AnalysisScoreCards` | Overview / Stats Tab | Renders as the "Peer Position" percentile card |
| `positioning.relative_strengths` | `AnalysisScoreCards` | Overview / Stats Tab | Listed as list bullet elements |
| `profile.technologies` | `TechnologyTags` | Engineering Tab | Maps name and type to individual badges (e.g., green for languages, blue for frameworks) |
| `profile.skills` | `SkillTreeVisualization` | Engineering Tab | Maps skill categories (e.g., backend, frontend) into an interactive nested tree diagram |
| `profile.architecture.patterns` | `InsightSections` | Overview Tab | Rendered as architectural pill badges |
| `profile.engineering_practices` | `InsightSections` | Overview Tab | Divided into cards detailing "Testing", "Observability", and "CI/CD Providers" |
| `findings` | `SkillTreeVisualization` / `VerificationSignals` | Multiple Tabs | Groups findings by category, rendering titles, explanations, and nested file signals |
| `narrative.recruiter_summary` | `DetailedAnalysisModal` | Overview Tab | Displayed inside the "Executive Evaluation Summary" block (falls back to `trust.explanation` if missing) |
| `narrative.top_strengths`, `narrative.limitations` | `RecommendationPanels` | Recommendations Tab | Displayed inside separate grid sections for strengths and limits |

---

## Unused Fields and Missing Bindings

The audit identified several fields defined in the database and API payloads that are completely ignored by the client UI:

1.  **`repo.topics`**: The Zod schema (`RepoInfoSchema`) parses this as a list of strings (`topics: z.array(z.string())`), but no frontend component binds or displays it.
2.  **`repo.fork`**: The boolean flag indicating if the repository is a fork is validated in `RepositoryAnalysisSchema` but remains unused (only the forks count is displayed).
3.  **`schemaVersion`**: Transited through HTTP payloads but ignored in layout rendering.

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | React Components Folder: [client/src/app/(private)/settings/components/repository-analysis/](../components/repository-analysis/) |
| **Dependencies** | `@heroui/react`, `lucide-react`, Zod, axios Client |
| **Execution Flow** | React triggers request → API resolves JSON → State updates → `DetailedAnalysisModal` re-renders, passing data down as props to children |
| **Common Failure Modes** | **Null Reference Crash** (if fields are undefined/null in JSON and Zod transformations fail, React throws a rendering exception) |
| **Related Files** | [client/src/services/repository-analysis.service.ts](../services/repository-analysis.service.ts), [client/src/types/repository-analysis.types.ts](../types/repository-analysis.types.ts) |
| **Related Services** | `repositoryAnalysisApi` |
| **Related DTOs** | `RepositoryAnalysis` |
| **Related Database Tables** | `AnalysisReports` |
| **Related Frontend Components** | `DetailedAnalysisModal`, `VerificationSignals`, `SkillTreeVisualization` |
