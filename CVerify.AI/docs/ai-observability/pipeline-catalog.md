# Pipeline Catalog

This catalog documents the step-by-step pipeline execution for the CVerify Repository Intelligence Engine.

## Repository Analysis Pipeline Steps

```mermaid
graph TD
    A[Start Job] --> B[Loop 9 Tasks]
    B -->|Task 1: RepoStructure| C[Pre-Classify, Clone, Tech Scan]
    B -->|Task 2: CommitIntelligence| D[Factual Git Log Audit]
    B -->|Task 3: SkillExtraction| E[Skill Signature Extraction]
    B -->|Task 4: ArchitectureAnalysis| F[Architecture Pattern Map]
    B -->|Task 5: CodeQuality| G[Testing & Observability Scan]
    B -->|Task 6: SecurityAnalysis| H[Vulnerability & Dependency Check]
    B -->|Task 7: RepositoryClassification| I[Semantic Domain Classification]
    B -->|Task 8: RepositorySummary| J[Recruiter Narrative Summary]
    B -->|Task 9: CvSynthesis| K[CV Highlights Synthesis]

    C --> L[Save Task Result JSON Cache]
    D --> L
    E --> L
    F --> L
    G --> L
    H --> L
    I --> L
    J --> L
    K --> L
    
    L --> M[Call Task Aggregator]
    M --> N[Check CI/CD configurations]
    N --> O[Run Truth Calibration: Git vs API vs LLM]
    O --> P[Calculate Risk & Adversarial metrics]
    P --> Q[Construct Calibrated Trust Graph]
    Q --> R[Validate ReportV2Contract Schema]
    R --> S[Clean Workspace & Return Payload]
```

## Step Details

### 1. Task Execute Loop
The C# Core Background Worker sequentially triggers the 9 tasks by calling `/api/v1/analysis/task/execute` on CVerify.AI.
* **Module**: `RepositoryAnalysisService.cs` (C#)

### 2. Workspace JSON Caching
Each execution task processes its designated code samples, Git logs, or preceding outputs, and saves its JSON result under `temp_clones/{job_id}/{task_type}_result.json`.
* **Module**: [github_analysis_orchestrator.py](../../app/orchestrators/github_analysis_orchestrator.py)

### 3. Truth Calibration Aggregator
Called via `/api/v1/analysis/task/aggregate` at the end of the execution loop. It merges cached results, verifies physical CI/CD configs on disk, runs risk scores (6 dimensions), calculates adversarial risk (timestamp compression, unverified commits, variance, sampling bias, uncalibrated email accounts), compiles the trust graph nodes/edges, and enforces `ReportV2Contract` validation.
* **Module**: [github_analysis_orchestrator.py](../../app/orchestrators/github_analysis_orchestrator.py)

## Traceability Links

* [Repository Analysis Pipeline](./07-repository-analysis-pipeline.md)
* [Analysis Pipeline Playbook](./15-analysis-pipeline-playbook.md)
