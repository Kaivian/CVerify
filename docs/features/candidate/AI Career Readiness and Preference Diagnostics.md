# AI Career Readiness & Preference Diagnostics

## Module
Profiles Module (CVerify.API.Modules.Profiles)

## Primary Role
Candidate (Mapped as system 'USER' role)

## Purpose
This feature manages the candidate's career readiness index, job preferences, and AI-inferred suggestions. It computes a candidate readiness index on-the-fly, validates career choices against industry registries (roles, industries, company stages), manages expected salary ranges, and provides endpoints to accept and synchronize AI-suggested career preferences into active candidate profile settings.

## Business Value
- **Precise Market Fit**: Calibrates candidate targets against standard technical roles, increasing suitability match ratios.
- **AI-Guided Career Growth**: Recommends skills to learn based on codebase analysis.
- **Accurate Expectation Management**: Validates salary floors and relocation requirements to prevent mismatches.
- **Optimistic Concurrency Protection**: Blocks overwrite loops when updating profiles on multiple tabs.

## User Story
As an active Candidate,
I want to manage my job preferences and view my career readiness diagnostics report,
So that I can align my profile settings with AI suggestions and target roles that match my verified skills.

## Actors
- **Primary Actor**: Candidate User.
- **Secondary Actors**: Career Readiness Engine, AI Suggestion Worker.

## Preconditions
1. Candidate profile record must exist.
2. Candidate must hold valid JWT authentication context.

## Trigger
Candidate clicks 'Job Preferences' on the dashboard, updates parameters (like expected salary or target roles), or clicks 'Accept AI Career Suggestions'.

## Main Flow
1. **Fetch Career Dashboard**: Candidate requests dashboard GET `/api/v1/users/career`.
2. **Retrieve Declared Preferences**: System loads current settings from `career_preferences`. If empty, creates default records.
3. **Retrieve Inferred Suggestions**: System loads `ai_inferred_preferences` (populated during profile diagnostics).
4. **Calculate Readiness Index**: System calls `CalculateReadinessAsync` on the readiness engine to generate a score.
5. **Output**: Renders the Declared Preferences, Inferred Preferences, and Readiness Report.
6. **Update Preferences**: Candidate changes options and PUTs/PATCHs to `/api/v1/users/career`.
7. **Concurrency Check**: Verifies `Version` integers match. If yes, it increments `Version`.
8. **Registry Validation**: Validates inputs against standard lists:
   - *Valid Company Stages*: Bootstrap, Seed, Series A, Series B, Scaleup, Enterprise.
   - *Valid Industries*: Fintech, Edtech, Healthtech, E-commerce, AI/ML, SaaS, Blockchain, Cybersecurity, GameDev, DevOps.
   - *Valid Roles*: Frontend, Backend, Fullstack, DevOps, Data, AI/ML, Mobile, QA, Security, Architect, Tech Lead, Engineering Manager.
9. **Salary Bounds Guard**: Verifies that minimum expected salary does not exceed maximum expected salary.
10. **Save**: Persists updates and returns the updated dashboard payload.

## Alternative Flows
### Alternative Flow 1: Accept AI Career Suggestions
1. **Accept Suggestions**: Candidate clicks 'Sync AI Suggestions' (POST `/accept-suggestions`).
2. **Preferences Sync**: System copies recommended roles, target industries, and skills suggestions from `ai_inferred_preferences` into the active `career_preferences` table.

## Exception Flows
- **Salary Mismatch Exception**: Setting a minimum expected salary higher than the maximum returns a `400 BadRequest("Expected salary min cannot exceed max.")`.
- **Invalid Registry Tag**: Submitting a role, industry, or company stage not matching standard whitelists returns a `400 BadRequest` validation exception.
- **Version Mismatch Conflict**: Submitting a stale version number returns a `409 Conflict` (Optimistic Concurrency Exception).

## Business Rules
- **Taxonomy Registries**: Role targets, industries, and business stages are validated against strict string hash sets (ValidRoles, ValidIndustries, ValidCompanyStages).
- **Salary Check**: Ensures `ExpectedSalaryMin <= ExpectedSalaryMax` for numeric validation.
- **Default Seeder**: If a candidate opens the page without preferences, the system creates a default profile with available-for-hire toggled to `true`.

## UI Components
*Inferred from implementation:*
- **Preference Config Panel**: Dropdowns for company stages, workplace choices, and salary sliders.
- **AI Suggestion Card**: Displays discrepancies between declared targets and AI-inferred capabilities with a 'Sync' button.
- **Readiness Meter**: Progress bar displaying the current completeness score.

## Backend Processing
- **CareerController**: Exposes REST routes, updates fields, and applies rate-limiting policies.
- **CareerService**: Validates input scopes, resolves dependencies, and manages database records.
- **CareerReadinessEngine**: Computes completeness scores based on career preferences completeness.

## API Endpoints
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/api/v1/users/career` | Fetch candidate preferences dashboard and AI recommendations | Authorize |
| PUT | `/api/v1/users/career` | Replace target job titles, expected salary, and relocations | Authorize |
| PATCH | `/api/v1/users/career` | Update specific preference attributes | Authorize |
| POST | `/api/v1/users/career/accept-suggestions` | Merge AI-suggested preferences into active preferences | Authorize |

## Database Interactions
| Table Name | CRUD Operations | Purpose & Constraints |
|---|---|---|
| `career_preferences` | Create, Read, Update | Main table storing salary requirements, location targets, and version counts. |
| `ai_inferred_preferences` | Read | Stores AI-generated role and skill recommendations. |
| `user_skills` | Read | Identifies verified skills linked to the user. |

## Validation Rules
- **Registry Whitelist Enforcement**: Rejects non-standard roles or industries.
- **Decimal validation**: Enforces positive decimal values for expected salary parameters.

## Permissions
Access is restricted to authenticated users holding a valid JWT signature. Candidates can only access and update career preferences linked to their own user accounts.

## Logging
Events logged to audit systems: `CAREER_PREFERENCES_UPDATED`, `CAREER_SUGGESTIONS_ACCEPTED`, `READINESS_CALCULATED`.

## Notifications
Toast notices warn users about version conflict errors or invalid salary parameters.

## Security Considerations
- **Isolated Validation**: Validates all input structures on the server to prevent bypasses.
- **Input Sanitization**: Trims and normalizes strings to prevent injection attempts.

## Error Handling
Validation or concurrency errors return standard HTTP error codes (400, 409) with detailed error messages.

## Edge Cases
- **Stale Updates**: If a user updates preferences in one tab, attempts to update in another tab are rejected, requiring a refresh.

## Dependencies
- `Microsoft.EntityFrameworkCore` to update candidate tables.

## Related Features
Candidate Authentication, Candidate Profile Builder, Suitability Matching.

## Sequence Summary
1. Candidate views GET `/v1/users/career`.
2. Service evaluates declared and inferred preferences.
3. System runs Career Readiness Engine to calculate readiness scores.
4. Candidate updates parameters via PATCH `/v1/users/career`.
5. Service validates entries against registries and locks row versions.
6. DB transaction commits updates.

## Technical Notes
Pre-calculates indices using memory caches to ensure fast dashboard load times.

## Evidence
- **Controller**: [CareerController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Profiles/Controllers/CareerController.cs)
- **Service**: [CareerService.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Profiles/Services/CareerService.cs)
