# Job Vacancy Posting & Requirements Management

## Module
Shared System Module (CVerify.API.Modules.Shared.System)

## Primary Role
Business / Recruiter (Mapped to system 'ORGANIZATION' / 'BUSINESS' actor claim)

## Purpose
This feature governs the lifecycle of recruitment vacancies and hiring criteria. It coordinates setting up roles, seniority levels, capability configurations, and required tech stacks. It also manages how recruiters generate AI-assisted job descriptions, define candidate discovery profiles, draft vacancies, edit details (e.g. salary ranges, benefits, cover images), and publish vacancies to the public job board.

---

## Detailed Module & File-level Architectural Mapping
- **Controllers**:
  - `JobVacancyController.cs` in `CVerify.API.Modules.Shared.System.Controllers`
  - `HiringRequirementController.cs` in `CVerify.API.Modules.Shared.System.Controllers`
- **Services**:
  - `HiringRequirementService.cs` in `CVerify.API.Modules.Shared.System.Services`
  - `JobVacancyService.cs` (Inferred service wrapper interface)
  - `CapabilityCatalogService.cs` in `CVerify.API.Modules.Shared.System.Services`
- **Entities**:
  - `JobVacancy.cs` in `CVerify.API.Modules.Shared.Domain.Entities`
  - `HiringRequirement.cs` in `CVerify.API.Modules.Shared.Domain.Entities`
  - `TechnologyRequirement.cs` in `CVerify.API.Modules.Shared.Domain.Entities`
  - `RequirementArtifact.cs` in `CVerify.API.Modules.Shared.Domain.Entities`
- **DTOs**:
  - `CreateHiringRequirementRequestDto.cs` in `CVerify.API.Modules.Shared.System.DTOs`
    - Fields: `string Title`, `string Department`, `string Seniority`, `string EmploymentType`, `Guid WorkspaceId`
  - `JobVacancyDto.cs` in `CVerify.API.Modules.Shared.System.DTOs`
    - Fields: `Guid Id`, `Guid HiringRequirementId`, `string Title`, `string Description`, `string Status`, `decimal? SalaryMin`, `decimal? SalaryMax`, `List<string> Skills`, `List<string> Benefits`
  - `UpdateJobVacancyRequest.cs` in `CVerify.API.Modules.Shared.System.DTOs`
    - Fields: `string Title`, `string Summary`, `List<string> Description`, `string Status`, `string SalaryMinMax`, `List<string> Skills`, `List<string> Benefits`
  - `HiringRequirementDetailsDto.cs` in `CVerify.API.Modules.Shared.System.DTOs`
    - Fields: `Guid Id`, `string Title`, `string Seniority`, `string Status`, `DateTimeOffset CreatedAt`

---

## Purpose & Context
Job posting on CVerify is built on structured hiring criteria. Instead of writing unstructured descriptions, recruiters define structured **Hiring Requirements** specifying target roles, seniority thresholds, core capabilities, and technology stacks. AI agents process these requirements to generate three artifacts: JD Markdowns, metadata, and Candidate Discovery Profiles. Once marked `Ready`, the recruiter generates a vacancy draft, updates fields, and publishes it.

---

## Business Value & ROI Matrix
- **Structured Sourcing**: Replaces vague text descriptions with structured technology and capability tags.
- **AI-Augmented Writing**: Speeds up posting by auto-generating JD content.
- **Accurate Calibration**: Mapped candidate discovery profiles provide direct inputs to the matching engine.
- **Version Control**: Allows updating hiring requirements without breaking live, active postings.
- **Dynamic Adaptability**: Enables recruiters to adjust criteria during active campaigns to refine match quality.

---

## Complete User Stories & Scenarios

### Scenario 1: Creating Hiring Requirements
```gherkin
Given a Business Recruiter is logged in with active JWT credentials
And belongs to the workspace "Engineers Workspace"
When the Recruiter submits a POST request to `/api/v1/hiring-requirements` with:
  | Title          | Backend developer                    |
  | Department     | Core Engineering                     |
  | Seniority      | Senior                               |
  | EmploymentType | Full-Time                            |
Then the system should verify the workspace context
And insert a new "HiringRequirement" row under the status "Draft"
And return a 201 Created response returning the new requirement ID.
```

### Scenario 2: Draft Vacancy Creation
```gherkin
Given a Business Recruiter is logged in
And a hiring requirement with ID "019ecc1b-44e6-7600-803f-11249088aacc" has status "Ready"
When the Recruiter submits a POST request to `/api/v1/job-vacancies/requirement/{id}/create-draft`
Then the system should verify the requirement status is "Ready" or "Published"
And verify no vacancy already exists for this requirement
And create a new "JobVacancy" record inheriting title, department, skills, and JD markdown details
And insert the new vacancy row under the status "Draft"
And return a 201 Created status code.
```

### Scenario 3: Attempting to Draft Unready Requirements
```gherkin
Given a Business Recruiter is logged in
And a hiring requirement exists with status "Draft" (not yet Ready)
When the Recruiter submits a POST request to create a vacancy draft
Then the backend should block the request
And return a 400 Bad Request response with the message "Cannot create a job vacancy draft because the hiring requirements are not ready."
```

---

## System Actors & Telemetry Mappings
- **Primary Actors**:
  - **Business Recruiter**: Sets up hiring requirements, triggers AI generation, edits details, and publishes vacancies.
  - **Business Hiring Manager**: Approves job requirements, adjusts capability weights, and coordinates applications.
- **Secondary Actors**:
  - **AI Text Generator**: Auto-generates markdown descriptions.
  - **Matching Engine**: Reads discovery profiles to match candidates.
  - **Outbox Email Dispatcher**: Dispatches notification emails to matches.
  - **Telemetry Logger**: Records the duration of the AI-generation process for analysis.

---

## Functional Preconditions & Environmental Constraints
1. The user must hold active corporate claims for the workspace.
2. Generating draft vacancies requires associated hiring requirements to be in the `Ready` or `Published` state.
3. Storage configurations must be online to host vacancy banner images.

---

## Trigger Event Details
- **Trigger 1**: A recruiter opens the Recruitment tab, fills in target vacancy fields, triggers the AI JD generator, verifies the generated drafts, and clicks 'Publish Posting'.
- **Trigger 2**: A hiring manager edits capability weights on a ready requirement, forcing a recalculation of the discovery profile and a sync across active vacancy drafts.

---

## Exhaustive Main Execution Flow
1. **Requirement Drafting**: Recruiter POSTs to `/api/v1/hiring-requirements`, saving a requirement row under the status `Draft`.
2. **Requirements Setup**: Recruiter binds capabilities and technology tags (`POST /api/v1/hiring-requirements/{id}/skills`).
3. **AI Generation Trigger**: System generates description artifacts, updating status to `Ready`.
4. **Vacancy Inception**: Recruiter requests `/api/v1/job-vacancies/requirement/{reqId}/create-draft`.
5. **Validation Guard**: System checks if a vacancy already exists for the target requirement.
6. **Inheritance Process**:
   - Parses the `JobPostMetadata` JSON artifact for experience, degree, and industry category.
   - Parses the `JobDescription` Markdown artifact for description text blocks.
   - Resolves target skills from `TechnologyRequirements`.
7. **Draft Creation**: Saves a `JobVacancy` entity under the status `Draft`.
8. **Modification Loop**: Recruiter edits draft details (PATCH `/api/v1/job-vacancies/{id}`).
9. **Publication Commit**: Recruiter POSTs to `/api/v1/job-vacancies/{id}/publish`.
10. **State Change**: Sets vacancy status to `Published`, making it visible on the public board.

---

## Alternative Execution Flows
### Alternative Flow 1: Synchronization Sweep
1. **Draft Sync**: Recruiter opens a `Draft` vacancy detail page (GET `/api/v1/job-vacancies/requirement/{reqId}`).
2. **Details Comparison**: Backend compares vacancy properties with active requirement settings.
3. **Auto-Update**: Updates stale fields (e.g. edited salary ranges or benefit arrays) and commits changes.

---

## Exception and Failure Scenarios
- **Duplicate Vacancy Block**:
  - *Trigger*: Submitting a draft request when a vacancy already exists for the target requirement.
  - *Result*: Returns `400 Bad Request` with message `A job vacancy already exists for this hiring requirement.`
- **Invalid Salary Range**:
  - *Result*: Returns `400 Bad Request` with message `Minimum salary cannot exceed maximum salary.`
- **Workspace Access Block**:
  - *Result*: Returns `403 Forbidden` if recruiter belongs to a different organization domain.

---

## Rigorous Business Rules & Data Constraints
- **State Gate**: Vacancies cannot transition from `Draft` to `Published` if description fields are empty.
- **Sync Limits**: Vacancy details only sync automatically with hiring requirements while in the `Draft` state. Once published, sync routines are blocked.

---

## UI Pages, Components & Layout States
- **Vacancy Editor Workspace**:
  - Rich text editor panels for descriptions.
  - Input sliders for salary ranges.
  - Checkboxes for benefit tags.
- **Public Jobs Grid**:
  - Cards displaying title, logo, location, salary tags, and 'Apply' buttons.
- **Draft Banner Warning**:
  - Informs the user when local draft edits have diverged from the baseline AI generation model.

---

## Detailed Backend API Routing Registry
| Method | Path | Input DTO | Response DTO | Permission |
|---|---|---|---|---|
| POST | `/api/v1/hiring-requirements` | `CreateHiringRequirementRequestDto` | `CreatedResponse` | Authorize |
| GET | `/api/v1/job-vacancies/requirement/{requirementId}` | None | `JobVacancyDto` | Authorize |
| POST | `/api/v1/job-vacancies/requirement/{requirementId}/create-draft` | None | `JobVacancyDto` | Authorize |
| PATCH | `/api/v1/job-vacancies/{id}` | `UpdateJobVacancyRequest` | `JobVacancyDto` | Authorize |
| POST | `/api/v1/job-vacancies/{id}/publish` | None | `JobVacancyDto` | Authorize |

---

## Database Table Schemas & Relationships
### Table: `hiring_requirements`
- `id` (UUID, Primary Key)
- `title` (VARCHAR(150), Not Null)
- `department` (VARCHAR(100))
- `seniority` (VARCHAR(50))
- `status` (VARCHAR(20), Default 'Draft')
- `workspace_id` (UUID)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)
- **Indices**:
  - `idx_hiring_requirements_workspace` (Index on `workspace_id`)

### Table: `job_vacancies`
- `id` (UUID, Primary Key)
- `hiring_requirement_id` (UUID, FK -> `hiring_requirements.id`)
- `title` (VARCHAR(150), Not Null)
- `description` (TEXT)
- `status` (VARCHAR(20), Default 'Draft')
- `salary_min_max` (VARCHAR(100))
- `skills` (TEXT[] / JSONB)
- `benefits` (TEXT[] / JSONB)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)
- `deleted_at` (TIMESTAMPTZ, Nullable)
- **Indices**:
  - `idx_job_vacancies_requirement` (Unique index on `hiring_requirement_id`)

---

## Input Validation Rules & Regex Patterns
- **Salary Format**: Salary min-max values must match patterns like `^\d+-\d+$`.
- **Title Range**: Vacancy titles must be between 5 and 150 characters.
- **Benefits Limits**: Recruiter cannot register more than 15 benefits items.
- **Skills Limits**: Recruiter cannot map more than 30 separate technical skills.

---

## Access Permissions & Role-Based Control (RBAC)
Vacancies are linked to organization workspaces. Modify actions require the `Owner`, `Admin`, or `Recruiter` role context within the target workspace.

---

## Granular Audit Logs & Event Trace Formats
- `JOB_VACANCY_DRAFT_CREATED`:
  ```json
  {
    "vacancyId": "019ecc1b-44e6-7600-803f-11249088ae92",
    "requirementId": "019ecc1b-44e6-7600-803f-11249088aacc",
    "actorUserId": "019ecc1b-44e6-7600-803f-11249088ae55"
  }
  ```
- `JOB_VACANCY_PUBLISHED`:
  ```json
  {
    "vacancyId": "019ecc1b-44e6-7600-803f-11249088ae92",
    "status": "Published"
  }
  ```

---

## Notification Dispatch Configurations
Publishing a vacancy enqueues notifications to candidates with matching career preferences.

---

## Key Security Controls & Anti-Abuse Measures
- **Cross-Workspace Access Blocks**: Verifies recruiters can only view or edit vacancies belonging to their organization's workspaces.

---

## Structured Error Handling & Response Dictionary
- `400 Bad Request`: Mismatched states or missing requirements.
- `404 NotFound`: Target requirement or vacancy ID not found.

---

## Edge Cases & Resilience Scenarios
- **Deleted Requirement Recovery**: If an associated hiring requirement is deleted, the published vacancy remains active but sync routines are disabled.

---

## System Package & Third-Party Dependencies
- `Microsoft.EntityFrameworkCore`
- `Microsoft.Extensions.DependencyInjection`
- `System.Text.Json`
- `StackExchange.Redis` for locking and tracking active sessions.

---

## Integrations with Related Features
- **Organization Profile**: Validates organization statuses prior to rendering public postings.
- **Talent Discovery Search**: Enables matching engine to filter active candidates against discovery profiles.
- **Candidate Match Engine**: Leverages the target capability catalog configurations to calculate match percentages.

---

## Sequence Summary
```
Recruiter                   Controller                 Service                   Database
  |                             |                         |                         |
  |--- POST /create-draft ----->|                         |                         |
  |                             |--- Load Requirement --->|                         |
  |                             |--- Check status "Ready" |                         |
  |                             |--- Extract Artifacts -->|                         |
  |                             |--- Inherit details ---->|--- Save vacancy ------->|
  |                             |                         |<-- Save Success --------|
  |                             |<-- Return DTO ----------|                         |
  |<-- 210 Created -------------|
```

---

## Deep-Dive Technical Notes
Updates to published vacancies utilize transaction isolation to ensure the public job board does not render incomplete vacancy details.

---

## Code Evidence References
- **Controller**: [JobVacancyController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Shared/System/Controllers/JobVacancyController.cs)
- **Entity**: [JobVacancy.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Shared/Domain/Entities/JobVacancy.cs)
- **Hiring Controller**: [HiringRequirementController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Shared/System/Controllers/HiringRequirementController.cs)
