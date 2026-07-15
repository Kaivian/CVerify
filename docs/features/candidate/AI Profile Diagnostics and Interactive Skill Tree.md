# AI Profile Diagnostics & Interactive Skill Tree

## Module
Profiles Module (CVerify.API.Modules.Profiles)

## Primary Role
Candidate (Mapped as system 'USER' role)

## Purpose
This feature conducts a deep multidimensional assessment of candidates by analyzing verified repositories, code quality metrics, and git logs. It normalizes capabilities against a technical skill taxonomy, estimates proficiency, classifies developer tendencies (frontend, backend, fullstack), structures interactive hierarchical skill trees, and streams real-time status transitions to the candidate browser using Server-Sent Events (SSE).

## Business Value
- **Capability Visualization**: Visualizes developer skills using interactive hierarchical skill tree charts (front-end rendering node graphs).
- **Accurate Career Calibration**: Standardizes candidates' seniority levels (Junior, Mid, Senior, Architect) based on codebase ownership, complexity, and contribution consistency.
- **Skill Gap Discovery**: Generates automated improvement advice highlighting engineering areas to target.
- **Recruiter Scannability**: Composes recruiter-friendly summaries, shortening interview screening times.

## User Story
As an active Candidate,
I want to execute an AI diagnostic on my linked codebases,
So that I can generate a verified skill tree graph and career recommendations to share on my public portfolio.

## Actors
- **Primary Actor**: Candidate User.
- **Secondary Actors**: OpenAi/Claude LLM services, Redis Pub/Sub channels, public job portals.

## Preconditions
1. Candidate must have connected at least one Git Provider with active, synced repositories.
2. Candidate profile must pass the system readiness check (represented as `CandidateReadinessDto`).

## Trigger
Candidate navigates to 'Skill Assessment' and clicks 'Trigger Diagnostic Scan'.

## Main Flow
1. **Readiness Evaluation**: Frontend fetches GET `/api/v1/candidate-assessments/readiness` to confirm that the profile has synced code repositories and is ready.
2. **Assessment Trigger**: Candidate triggers the process via POST `/api/v1/candidate-assessments`.
3. **Queue Insertion**: System enqueues a diagnostic request job, locks the user's assessment status to `Active`, and establishes an SSE stream listener at `/api/v1/candidate-assessments/progress/{userId}`.
4. **Step Transitions (Multi-stage analysis pipeline)**:
   - *Initialization (`Initialize`)*: Instantiates variables.
   - *Retrieve Repository Artifacts (`FetchLine1`)*: Loads previous repository static reports and commits histories.
   - *Skill Mapping & Extraction (`L2-001`, `L2-002`)*: Extracts skills, estimates commit densities, and calculates code volume indexes.
   - *Diagnostics & Leveling (`L2-003`, `L2-004`, `L2-005`)*: Determines seniority boundaries and identifies code organization patterns.
   - *Engineering hygiene evaluation (`L2-007`, `L2-008`)*: Reviews documentation coverage, test structures, and issue response logs.
   - *Affinity Mapping (`L2-009`, `L2-010`)*: Maps frontend, backend, or full-stack work splits.
   - *Skill Tree Assembly (`L2-016`)*: Builds the hierarchical node mapping lists.
   - *Improvement Advice (`L2-015`)*: Drafts gap mitigation strategies.
5. **Serialization & Broadcast**: Final profile states are saved to `candidate_assessments` and `skill_tree_nodes` tables. An event is broadcast on SSE and Redis channels, marking status as `Completed`.

## Alternative Flows
### Alternative Flow 1: Public Skill Tree Display
1. **Public Request**: An external user (visitor or recruiter) navigates to `/[username]/skills`.
2. **Details Fetch**: The frontend fetches GET `/v1/candidate-assessments/public/{username}/skill-tree` (AllowAnonymous route).
3. **Graph Rendering**: System responds with the hierarchical node structure, and the browser renders the interactive SVG skill graph.

### Alternative Flow 2: Process Cancellation
1. **Cancel Trigger**: User clicks 'Cancel' during an active scan (POST `/v1/candidate-assessments/{assessmentId}/cancel`).
2. **Job Termination**: Background service stops LLM tasks, updates job status to `Cancelled`, and frees up queue workers.

## Exception Flows
- **Readiness Check Failure**: If the candidate lacks synced code repositories or holds invalid providers connections, triggering returns a `400 Bad Request` with readiness errors.
- **Concurrent Trigger Block**: Triggering a new scan while another is running is blocked by Redis concurrency locks, returning `400 Bad Request`.
- **SSE Stream Dropped**: If the candidate's browser disconnects, the background worker continues running offline. The client recovers by polling GET `/v1/candidate-assessments/latest`.

## Business Rules
- **Taxonomy Standard**: Extracted skills must resolve against CVerify's global taxonomy rules.
- **Readiness Criteria**: Requires at least one connected provider and one completed repository static analysis.
- **Score Cap Rules**: Individual skill scores are capped based on the repository's verification status.

## UI Components
*Inferred from implementation:*
- **Skill Tree Interactive Canvas**: An SVG/D3-driven node layout showing nested skills nodes.
- **Readiness Alert Panel**: Modal displaying requirements status.
- **Stage Progress Bar**: Stepper showing pipeline step logs.

## Backend Processing
- **CandidateAssessmentController**: Exposes routes for histories, trees, and Server-Sent Event streams.
- **CandidateAssessmentService**: Manages the multi-stage pipeline, concurrency checks, and database saves.
- **AiStreamingSessionService**: Connects streaming requests to remote AI APIs.

## API Endpoints
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/api/v1/candidate-assessments/readiness` | Verify candidate requirements readiness | Authorize |
| GET | `/api/v1/candidate-assessments/stages` | Get static details for all pipeline steps | Authorize |
| POST | `/api/v1/candidate-assessments` | Trigger a new candidate diagnostic scan | Authorize |
| POST | `/api/v1/candidate-assessments/{assessmentId}/cancel` | Cancel an active assessment job | Authorize |
| GET | `/api/v1/candidate-assessments/latest` | Fetch summary of the latest report | Authorize |
| GET | `/api/v1/candidate-assessments/history` | List candidate's past diagnostic scans | Authorize |
| GET | `/api/v1/candidate-assessments/{assessmentId}/details` | Fetch detailed diagnostic reports | Authorize |
| GET | `/api/v1/candidate-assessments/{assessmentId}/skill-tree` | Retrieve assessment's skill tree graph | Authorize |
| GET | `/api/v1/candidate-assessments/latest/skill-tree` | Get latest verified skill tree nodes | Authorize |
| GET | `/api/v1/candidate-assessments/public/{username}/skill-tree` | Fetch public skill tree nodes by username | AllowAnonymous |
| GET | `/api/v1/candidate-assessments/public/{username}` | Fetch latest public assessment report | AllowAnonymous |
| GET | `/api/v1/candidate-assessments/progress/{userId}` | Connect to SSE stream for live updates | Authorize |

## Database Interactions
| Table Name | CRUD Operations | Purpose & Constraints |
|---|---|---|
| `candidate_assessments` | Create, Read, Update | Main table tracking assessment runs, overall level, and status details. |
| `skill_tree_nodes` | Create, Read | Stores hierarchical node coordinates, scores, and evidence links. |
| `assessment_stage_logs` | Create, Read | Stores telemetry logs for step updates. |
| `users` | Read | Verifies active status and username relationships. |

## Validation Rules
- **UUID Assertions**: Target assessment identifiers must follow RFC 4122 layouts.
- **Scope Limitations**: Restricts access so users cannot request private diagnostic details of other candidates.

## Permissions
Private operations require validated JWT cookies. Public endpoints allow anonymous viewers to fetch summaries and skill graphs.

## Logging
Auditing tracks: `ASSESSMENT_TRIGGERED`, `ASSESSMENT_STAGE_COMPLETED`, `ASSESSMENT_COMPLETED`, `ASSESSMENT_CANCELLED`.

## Notifications
Live dashboard alerts display current status, and completion triggers a browser notification.

## Security Considerations
- **LLM Prompt Hardening**: Sanitizes inputs before forwarding to LLM endpoints to prevent prompt injection.
- **Data Isolation**: Ensures that anonymous queries can only read metrics from users who have toggled their profile visibility settings to public.

## Error Handling
Failures inside individual stages (e.g. LLM timeout) are captured, logged, and trigger a graceful rollback that updates status to `Failed`.

## Edge Cases
- **Orphaned Profiles**: If a user is deleted, all historical assessments and skill trees are cascade deleted.
- **Empty Codebase Sync**: Scanning a profile that has linked empty repositories exits early, generating a basic report based on profile text only.

## Dependencies
- `StackExchange.Redis` for caching and SSE publish-subscribe.
- `System.Text.Json` to serialize hierarchical tree arrays.

## Related Features
Candidate Profile Builder, Git Static Analysis, Trust Profile.

## Sequence Summary
1. Candidate triggers assessment trigger route.
2. Service evaluates candidate profile readiness indicators.
3. Concurrency check locks active user assessment slots.
4. System executes pipeline stages.
5. Interactive skill tree mapping is persisted to DB.
6. Progress notifications broadcast to SSE stream client.

## Technical Notes
Uses an SSE stream to send progress status updates directly to the client browser.

## Evidence
- **Controller**: [CandidateAssessmentController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Profiles/Controllers/CandidateAssessmentController.cs)
- **Interface**: [ICandidateAssessmentService.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Profiles/Services/ICandidateAssessmentService.cs)
