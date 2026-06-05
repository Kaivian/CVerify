# 05 - Prompt Analysis

This document audits the prompt templates and factories used in `CVerify.AI`, detailing injected variables, expected outputs, schemas, and architectural flaws (including the legacy AI Travel Planner identity leak).

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
*   **Prompt Structure**:
    *   *System Prompt*: Defines the identity of "CVerify, an expert AI Software Architect and Repository Fraud Analyst." Instructs Claude to keep all narrative fields to 1-2 sentences maximum to prevent truncation, and to output raw JSON *without* markdown code block backticks.
    *   *User Prompt*: Injects the list of detected technologies, walks the sampled code files, formats them with delimiters (`--- FILE: {name} ---`), and prints the target JSON validation schema.
*   **Risks and Weaknesses**:
    *   **Context Overflow**: If the code sampler extracts files containing dense, large code snippets, the total token count could exceed limits. Though the sampler implements a 10-file, 100-lines-per-file limit, it does not count tokens before calling Anthropic.
    *   **Markdown Wrap Deviation**: Despite explicit instructions in the system prompt to return raw JSON without backticks, Claude occasionally returns markdown blocks (e.g. ` ```json ... ``` `), which requires defensive outer brace parsing in the orchestrator.

---

## Identity Correction: Legacy "AI Travel Planner" Prompt Leak

### 1. File Location & Occurrence
*   **File Path**: `app/services/claude_service.py`
*   **Method**: `stream_chat` (used by endpoint `/api/v1/chat/stream`)
*   **Legacy Code**:
    ```python
    system_prompt = (
        "You are CVerify, an expert AI Travel Planner. Your goal is to design structured, highly detailed, "
        "and beautiful travel itineraries. Respond strictly using clear and beautiful Markdown formatting.\n"
        "Organize recommendations into sections, highlighting attractions, logistics, and dining tips. "
        "Include practical suggestions for hotels, transportation, and pricing where possible."
    )
    ```

### 2. Why this is Architecturally Incorrect
*   **Domain Mismatch**: CVerify is a professional repository verification and talent intelligence platform. Hardcoding a Travel Planner bot in the conversational stream endpoint completely breaks user expectations.
*   **Branding Inconsistency**: Prompts users with hotels, transportation, and dining tips, leaking conversational stubs from a boilerplate template.

### 3. Proposed Replacement: CVerify Repository Intelligence Engine
The conversational endpoint `/api/v1/chat/stream` must be updated to align with the core CVerify vision.

*   **Canonical AI Role Name**: `CVerify Repository Intelligence Engine`
*   **Canonical System Prompt Proposal**:
    ```python
    system_prompt = (
        "You are the CVerify Repository Intelligence Engine, an expert AI Software Architect. "
        "Your goal is to answer developer questions, explain repository architecture, "
        "identify engineering skill patterns, and clarify codebase metrics.\n"
        "Analyze the provided context (repositories, code samples, and verification findings) "
        "to deliver highly accurate, technical, and objective answers. "
        "Format your responses using clean and readable Markdown."
    )
    ```
*   **Key Capabilities to Support**:
    *   Analyze repository code structures and architectures.
    *   Identify and categorize skills, languages, and frameworks.
    *   Detect design patterns (e.g. MVC, microservices, repository patterns).
    *   Generate trustable hiring signals and verifiable proof-of-work indicators.
    *   Support recruitment and engineering onboarding queries.

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | `get_system_prompt` and `get_user_prompt` in [app/prompts/github_prompt_factory.py](../prompts/github_prompt_factory.py) |
| **Dependencies** | Base class: `IPromptFactory` in [app/prompts/prompt_factory.py](../prompts/prompt_factory.py) |
| **Execution Flow** | Orchestrator invokes factory methods → User prompt string generated with file loops → System/User prompts passed to `ClaudeService.analyze_repo`. |
| **Common Failure Modes** | **Empty Code Samples** (causes user prompt to omit code context), **Zipping Mismatch** (if `file_names` and `file_contents` have different lengths in loop). |
| **Related Files** | [app/prompts/cv_prompt_factory.py](../prompts/cv_prompt_factory.py), [app/prompts/matching_prompt_factory.py](../prompts/matching_prompt_factory.py) |
| **Related Services** | [ClaudeService](../services/claude_service.py) |
| **Related DTOs** | None |
| **Related Database Tables** | `AnalysisReports` (stores output formatted by this prompt) |
| **Related Frontend Components** | `DetailedAnalysisModal.tsx` |
