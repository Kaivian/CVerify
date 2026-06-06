# 05 - Prompt Analysis

This document audits the prompt templates and factories used in `CVerify.AI`, detailing injected variables, expected outputs, schemas, and the revised **specificity-first** prompting strategy replacing the legacy brevity constraint.

---

## Prompt Directory Audit

*   **`GitHubPromptFactory` (Active)**: Injected by the orchestrator to analyze repositories and format reports.
*   **`CvPromptFactory` (Unused / Skeleton)**: Contains basic stub strings for resume analysis.
*   **`MatchingPromptFactory` (Unused / Skeleton)**: Contains stubs for job matching.
*   **`PromptFactory` (Active Base)**: Defines the `IPromptFactory` interface.

---

## Active Prompt: GitHubPromptFactory

*   **File Path**: `app/prompts/github_prompt_factory.py`
*   **Injected Variables**:
    *   `repo_owner` / `repo_name`: Identifiers for the target repository.
    *   `technologies`: List of detected technologies from directory scan.
    *   `file_names` / `file_contents`: Sampled source code contents and relative file paths.
*   **Claude Model Config**: Configured in `ClaudeService.analyze_repo` using `claude_model` (default: `claude-3-5-sonnet-20241022`), temperature: `0.2`, max tokens: `8192`.

---

## Revised Prompt Design Philosophy: Specificity-First

> [!IMPORTANT]
> **Breaking change from legacy prompt strategy.**
>
> The original system prompt instructed Claude to **"keep all narrative fields to 1-2 sentences maximum to prevent truncation."** This hard brevity constraint produced generic, low-signal descriptions that failed to surface concrete code evidence. Recruiters and engineers received summaries that could have applied to any repository (e.g., *"This repository demonstrates solid engineering practices"*) rather than insights grounded in the actual files sampled.
>
> The revised strategy enforces **specificity over brevity**. Every descriptive text field must cite observable evidence — file names, method signatures, detected patterns, or concrete code observations. Short descriptions are only acceptable when the evidence itself is concise.

### Core Specificity Requirements

| Field | Old Constraint | New Requirement |
|---|---|---|
| `findings[].explanation` | 1-2 sentences, generic summary | 2-4 sentences; **must reference at least one specific file path or method name** observed in the sampled code |
| `narrative.recruiter_summary` | 1-2 sentences, generic overview | 3-5 sentences; **must name specific technologies, architectural patterns, and at least one concrete quality signal** drawn from sampled files |
| `trust.ai_findings[]` | One-liner observation | 1-3 sentences describing a **specific observed pattern** with one concrete example (file, class, or method name) |
| `trust.explanation` | 1 sentence | 2-3 sentences; **must explain the classification rationale with specific evidence** (e.g., commit structure, authorship signals, code style consistency) |
| `narrative.top_strengths[]` | Single label | Full sentence with **why** — grounded in a specific technical observation |
| `narrative.limitations[]` | Single label | Full sentence with **what** is missing or weak, referencing a concrete gap in the sampled code |
| `positioning.relative_strengths[]` | Generic tag | Evidence-backed strength, e.g. *"Consistent use of dependency injection across service layer (observed in UserService.cs, AuthService.cs)"* |

---

## Updated Prompt Structure

### System Prompt (Revised)

```python
system_prompt = (
    "You are CVerify, an expert AI Software Architect and Repository Evidence Analyst.\n"
    "Your task is to produce a structured JSON intelligence report about a GitHub repository "
    "based on sampled source code, manifest files, and detected technologies.\n\n"
    "CRITICAL RULES FOR ALL DESCRIPTIVE FIELDS:\n"
    "- Every explanation, summary, finding, and narrative field MUST be grounded in specific, "
    "observable evidence from the provided code samples.\n"
    "- Always cite at least one specific file name, class name, method name, or code pattern "
    "when writing explanations and findings. Avoid generic statements that could apply to any codebase.\n"
    "- BAD: 'This repository demonstrates solid engineering practices.'\n"
    "- GOOD: 'The repository uses constructor-based dependency injection consistently across "
    "UserService.cs, AuthService.cs, and RepositoryService.cs, indicating adherence to SOLID principles.'\n"
    "- BAD: 'The developer shows strong frontend skills.'\n"
    "- GOOD: 'React component architecture in src/components/ follows a container/presentational split, "
    "with useReducer-based state management observed in DashboardContainer.tsx.'\n\n"
    "OUTPUT FORMAT:\n"
    "- Return raw JSON only. Do NOT wrap output in markdown code fences (no ```json).\n"
    "- Do NOT truncate the JSON. If the output would exceed limits, compress descriptions rather than "
    "cutting closing braces.\n"
    "- All numeric scores must be JSON numbers (not strings): use 92.0, not '92'.\n"
    "- All required fields listed in the schema below must be present. Use null only if genuinely absent.\n"
)
```

### User Prompt Structure (Revised)

The user prompt is built by `GitHubPromptFactory.get_user_prompt()` and injects the following sections in order:

```
1. DETECTED TECHNOLOGIES
   Lists all framework/library tags from TechnologyDetector output.

2. SAMPLED SOURCE FILES
   For each file: delimiter "--- FILE: {relative_path} ---" followed by first 100 lines of content.
   Files are sorted largest-first so the most substantial modules appear early in context.

3. TARGET JSON SCHEMA
   Full schema definition with field-level description comments, including specificity directives
   embedded as JSON comments (e.g., // cite specific file — not a generic statement).
```

#### Schema Specificity Annotations (New)

Each descriptive field in the user prompt schema now carries an inline instruction:

```json
{
  "narrative": {
    "recruiter_summary": "// 3-5 sentences. Name specific technologies, architecture patterns, and one concrete quality signal from the sampled files.",
    "top_strengths": ["// Full sentence per strength. Ground each in a specific technical observation."],
    "limitations": ["// Full sentence per limitation. Reference a concrete gap visible in the sampled code."]
  },
  "findings": [
    {
      "title": "// Short label for the finding category",
      "explanation": "// 2-4 sentences. Cite at least one specific file path or method name.",
      "evidence_signals": ["// List of file paths or code patterns that support this finding"]
    }
  ],
  "trust": {
    "explanation": "// 2-3 sentences explaining the trust classification. Cite specific commit structure or authorship signals.",
    "ai_findings": ["// One specific observed pattern per entry, with a concrete example (file, class, or method)."]
  }
}
```

---

## Risks and Mitigations (Updated)

*   **Token Budget Risk**: Detailed descriptions increase total output token count. Mitigation: the 8192 max token limit is sufficient for a well-structured report with 5 findings and full narrative fields, provided the number of findings stays ≤ 5 and `evidence_signals` arrays stay ≤ 5 items each.
*   **Evidence Hallucination Risk**: Claude may fabricate plausible-sounding file names not present in the sampled code. Mitigation: the system prompt explicitly instructs Claude to cite only files visible in the provided samples; the `evidence_signals` array allows cross-validation against `file_names` passed in the user prompt.
*   **Markdown Wrap Deviation**: Despite explicit instructions, Claude occasionally returns markdown blocks (e.g. ` ```json ... ``` `). The orchestrator's outer-brace extraction handles this defensively.
*   **Context Overflow**: Dense code dumps can push total tokens toward limits. The 10-file / 100-lines-per-file sampler cap remains in place; a future enhancement is to add a token pre-count before calling Claude and trim the lowest-value files if the budget is tight.

---

## Legacy Issue: Identity Correction

### File Location & Occurrence
*   **File Path**: `app/services/claude_service.py`
*   **Method**: `stream_chat` (used by endpoint `/api/v1/chat/stream`)
*   **Legacy Code** (to be removed):
    ```python
    system_prompt = (
        "You are CVerify, an expert AI Travel Planner. Your goal is to design structured, highly detailed, "
        "and beautiful travel itineraries. Respond strictly using clear and beautiful Markdown formatting.\n"
        "Organize recommendations into sections, highlighting attractions, logistics, and dining tips. "
        "Include practical suggestions for hotels, transportation, and pricing where possible."
    )
    ```

### Canonical Replacement: CVerify Repository Intelligence Engine

```python
system_prompt = (
    "You are the CVerify Repository Intelligence Engine, an expert AI Software Architect and talent intelligence advisor.\n"
    "Answer developer and recruiter questions about repository architecture, code quality, skill patterns, "
    "and verification findings.\n\n"
    "When citing evidence from a repository analysis, reference specific file names, class structures, "
    "or detected technologies — never give generic summaries. "
    "Format responses using clean, readable Markdown."
)
```

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | `get_system_prompt` and `get_user_prompt` in [app/prompts/github_prompt_factory.py](../prompts/github_prompt_factory.py) |
| **Dependencies** | Base class: `IPromptFactory` in [app/prompts/prompt_factory.py](../prompts/prompt_factory.py) |
| **Execution Flow** | Orchestrator invokes factory methods → User prompt string generated with file loops + schema annotations → System/User prompts passed to `ClaudeService.analyze_repo`. |
| **Common Failure Modes** | **Evidence Hallucination** (Claude cites file names not in sampled set), **Token Overflow** (dense repos pushing output past 8192 tokens), **Zipping Mismatch** (if `file_names` and `file_contents` differ in length). |
| **Related Files** | [app/prompts/cv_prompt_factory.py](../prompts/cv_prompt_factory.py), [app/prompts/matching_prompt_factory.py](../prompts/matching_prompt_factory.py) |
| **Related Services** | [ClaudeService](../services/claude_service.py) |
| **Related DTOs** | None |
| **Related Database Tables** | `AnalysisReports` (stores output formatted by this prompt) |
| **Related Frontend Components** | `DetailedAnalysisModal.tsx` |
