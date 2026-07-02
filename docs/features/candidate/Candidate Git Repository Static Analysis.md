# Candidate Git Repository Static Analysis

## Module
SourceCode Module (CVerify.API.Modules.SourceCode)

## Primary Role
Candidate (Mapped as system 'USER' role)

## Purpose
This feature manages the backend static analysis engine that clones Git repositories, detects technology stacks, samples code files, runs security/plagiarism/authenticity agents, and generates detailed trust reports containing confidence ratings, risk scores, and risk factors. It allows candidates to verify repository details and provides Server-Sent Events (SSE) for real-time progress monitoring.

## Business Value
- **Developer Verification**: Provides the core automated validation mechanism that tests the authenticity of a candidate's code submissions.
- **Plagiarism Detection**: Flags copy-paste or AI-generated structures, helping recruiters identify authentic contributions.
- **Automated Skill Profiles**: Translates repo commits and file structures into verified technology stack insights.
- **System Concurrency Control**: Prevents redundant sync/analysis triggers using status locking, queue priority routing, and resource management.

## User Story
As an active Candidate,
I want to trigger a static analysis scan on my synced repositories,
So that I can verify my code authenticity, generate an AI-validated trust score, and showcase it on my public developer CV.

## Actors
- **Primary Actor**: Candidate User.
- **Secondary Actors**: Background Worker Thread Pool, Redis Event Bus, Local Git Filesystem.

## Preconditions
1. Repository must be successfully synced (present in `source_code_repositories`).
2. Candidate's OAuth credentials must be active and valid for checking visibility and cloning content.
3. Disk space and background worker processes must be available.

## Trigger
Candidate clicks 'Verify Repository' on their dashboard or triggers a manual re-scan.

## Main Flow
1. **Analysis Request**: Candidate triggers analysis via POST `/api/repositories/{repoId}/analyses`.
2. **Enqueue Job**: Service allocates a UUID v7 jobId, inserts an `AnalysisJob` row, sets status to `Queued`, caches job info in Redis, and pushes the job to `BackgroundRepositoryAnalysisQueue`.
3. **Execution Fetch**: A background worker picks up the job. The status switches to `CloningRepository` and updates progress properties.
4. **Git Repository Cloning**: Worker retrieves the Git credentials, clones the target branch into a temporary workspace folder, and updates the step status to `DetectingTechnologyStack`.
5. **Technology Stack Detection**: System runs static detectors on repository root structures (looking for package configuration files like `package.json`, `csproj`, `Cargo.toml`, etc.) and updates status to `SamplingCode`.
6. **Code Sampling & Parser Execution**: System samples files, running AST and lexical analyses. Step status shifts to `RunningAgents` to invoke plagiarism and authenticity algorithms.
7. **Report Aggregation**: System gathers the risk reports, calculates overall confidence ratios, saves the output data as JSON within `AnalysisReport` records, updates repository trust flags, and deletes temporary files.
8. **Final State**: Job status turns to `Completed` with 100% progress.

## Alternative Flows
### Alternative Flow 1: Server-Sent Events Progress Listening
1. **Event Connection**: Frontend client opens GET `/api/repository-analyses/jobs/{jobId}/progress-stream` SSE connection.
2. **Stream Dispatch**: The backend reads historical logs from the database, pushes them to the client stream, and listens to Redis Pub/Sub channels for subsequent job progress mutations.
3. **Real-time Updates**: When steps complete, the backend pushes update events containing progress status to the client socket until the job resolves.

### Alternative Flow 2: Resetting Analysis
1. **Reset Trigger**: Candidate clicks 'Reset' under repository options (POST `/api/repositories/{repoId}/reset`).
2. **Job Cleansing**: System verifies that no active sync/analysis jobs exist for the target repository, deletes past reports, and sets `latest_analysis_status` back to `null`.

## Exception Flows
- **Concurrent Analysis Lock**: If a user attempts to enqueue an analysis job while another job is active (Queued/Running steps), the controller throws `InvalidOperationException` returning a `429 Too Many Requests` code.
- **Rate Limit Trigger**: The endpoints restrict trigger frequency per user using IP rate limits, yielding `429 Too Many Requests`.
- **Cloning/Network Failures**: If repository cloning fails (e.g. revoked token, private repo access lost), the worker updates the status to `Failed`, saves the stack trace error payload, and cleans up the temporary directories.

## Business Rules
- **Active States list**: Active jobs must match one of the active statuses: `Queued`, `Preparing`, `CloningRepository`, `DetectingTechnologyStack`, `SamplingCode`, `RunningAgents`, `AggregatingResults`, `SavingReport`.
- **Confidence Rating formula**: Repository `TrustScore` corresponds to the AI confidence output divided by 100, mapped if confidence is equal to or greater than 50.0%.

## UI Components
*Inferred from implementation:*
- **Circular Progress Indicators**: Renders real-time progress steps and message strings from the Server-Sent Event stream.
- **Trust Report Viewer**: Renders risk lists, code snippets, confidence stars, and language break-ups.
- **Reset Button**: Resets current analysis state.

## Backend Processing
- **RepositoryAnalysisController**: Exposes REST routes and manages the SSE connection.
- **RepositoryAnalysisService**: Manages the job status transaction database commits, Redis Pub/Sub channels, and background sweeps.
- **BackgroundRepositoryAnalysisQueue**: Queue hosting pending analyses.

## API Endpoints
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/api/repository-analyses/active` | Get active jobs for current candidate | Authorize |
| POST | `/api/repositories/{repoId}/analyses` | Trigger repository static analysis | Authorize |
| POST | `/api/repositories/{repoId}/reset` | Reset repository analysis state | Authorize |
| GET | `/api/repository-analyses/jobs/{jobId}` | Get current job status details | Authorize |
| GET | `/api/repository-analyses/jobs/{jobId}/snapshot` | Fetch cached JSON analysis payload | Authorize |
| GET | `/api/repository-analyses/jobs/{jobId}/events` | Fetch all logs for a job | Authorize |
| POST | `/api/repository-analyses/jobs/{jobId}/cancel` | Request cancellation of running job | Authorize |
| GET | `/api/repositories/{repoId}/analyses/latest` | Fetch the latest analysis report JSON | Authorize |
| GET | `/api/repository-analyses/jobs/{jobId}/progress-stream` | Connect to SSE stream for live updates | Authorize |

## Database Interactions
| Table Name | CRUD Operations | Purpose & Constraints |
|---|---|---|
| `analysis_jobs` | Create, Read, Update | Stores job progress, statuses, and steps. |
| `analysis_job_events` | Create, Read | Stores granular logs for step transitions. |
| `analysis_reports` | Create, Read, Delete | Stores the complete final JSON report data. |
| `source_code_repositories` | Read, Update | Updates verification flags, risk levels, and trust scores. |

## Validation Rules
- **Active job checks**: Block duplicate trigger requests.
- **UUID validations**: Job and repository identifiers must match valid v7 or v4 UUID patterns.

## Permissions
Private routes require valid JWT tokens. Candidates can only access analysis logs and trigger scans for repositories they own.

## Logging
Events are registered inside `analysis_job_events` and database logs: `ANALYSIS_QUEUED`, `ANALYSIS_STARTED`, `ANALYSIS_STEP_COMPLETED`, `ANALYSIS_SUCCESS`, `ANALYSIS_FAILED`.

## Notifications
Live UI toast alerts on completed scans, failures, or cancellations.

## Security Considerations
- **Sandboxed Cloning**: Cloned codes are stored in restricted temporary directories.
- **Safe JSON Deserialization**: Prevents malicious type injection attacks when processing JSON payloads.

## Error Handling
Cloning or worker process failures write specific error descriptions to the job status, resetting active locks.

## Edge Cases
- **Server Reboot Recovery**: Active jobs exceeding 10 minutes since their last status change are marked as failed on status fetch.
- **Repository Deletion**: Deleting a repository cancels any active analysis jobs.

## Dependencies
- `LibGit2Sharp` (or native command line Git wrapper calls) to clone repositories.
- `StackExchange.Redis` for Pub/Sub channels and caching.

## Related Features
GitHub & Git Provider Integration, Trust Profile, AI Profile Diagnostics.

## Sequence Summary
1. Candidate triggers POST `/repositories/{id}/analyses`.
2. Job is enqueued, locking repository analysis state.
3. Background worker clones Git repositories, detects stack, and samples source files.
4. AI assessment agents calculate risk scores.
5. Verification flags are committed, and temporary directories are deleted.
6. Progress streams updates to candidate browser.

## Technical Notes
Enforces strict concurrency limits on a per-user and per-repository level.

## Evidence
- **Controller**: [RepositoryAnalysisController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/SourceCode/Controllers/RepositoryAnalysisController.cs)
- **Service**: [RepositoryAnalysisService.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/SourceCode/Services/RepositoryAnalysisService.cs)
