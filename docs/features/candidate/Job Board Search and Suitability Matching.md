# Job Board Search & Suitability Matching

## Module
Intelligence Module (CVerify.API.Modules.Intelligence)

## Primary Role
Candidate (Mapped as system 'USER' role)

## Purpose
This feature evaluates a candidate's suitability against a job requirement. It computes a suitability score using a weighted matching engine that checks capability fits, role levels, trust indices, and preference alignments, generating human-readable explanations of strengths and gaps.

## Business Value
- **Precise Matching**: Eliminates guess-work by checking verified repository evidence instead of keywords.
- **Explainable Decisions**: Generates lists of candidate strengths and gaps, increasing recruiter trust.
- **Self-Assessment**: Enables candidates to see exactly where they fall short for target vacancies.
- **Process Optimization**: Prevents irrelevant applications, saving reviewer cycles.

## User Story
As an active Candidate,
I want to search for job vacancies and view my suitability matching scores,
So that I can identify strengths, target development areas, and apply to jobs where I am highly matched.

## Actors
- **Primary Actor**: Candidate User.
- **Secondary Actors**: Recruiter User, Unified Matching Engine.

## Preconditions
1. Candidate must have a completed, verified profile.
2. Job requirements must be defined in the database (`JobVacancies` tables).

## Trigger
Candidate searches for jobs, opens a job description, and clicks the 'Evaluate Suitability' button.

## Main Flow
1. **Query Matching Evaluation**: System triggers GET `/api/v1/intelligence/match/{jobVacancyId}/{candidateId}`.
2. **Retrieve Profiles**: Match Service loads the candidate capability indices (`CandidateCapabilityIntelligence`) and vacancy configurations (`UnifiedJobRequirement`).
3. **Execute Capability Match (40% weight)**:
   - Evaluates each required capability.
   - Matches candidate's verified codebase repositories maturity levels.
   - Calculates score weights: full score if matched, fractional if below proficiency, `0.40` for self-declared skills, `0.0` if missing.
   - Generates strengths and gaps lists.
4. **Execute Role Match (30% weight)**:
   - Evaluates seniority level alignment (candidate level vs expected job level).
   - If leadership is required, verifies if candidate level is Lead/Principal/Staff.
5. **Execute Trust Match (20% weight)**:
   - Aggregates trust levels: `0.40 * IdentityTrustScore + 0.60 * EvidenceTrustScore`.
6. **Execute Preference Match (10% weight)**:
   - Checks salary overlap (candidate expected bounds vs job vacancy maximum).
   - Checks workplace types (Remote, Hybrid, Onsite).
7. **Calculate Aggregate Match Score**:
   - `Aggregate = 0.40 * CapFit + 0.30 * RoleFit + 0.20 * TrustScore + 0.10 * PreferenceFit`.
8. **Explainable Output Generation**: Inserts matching records and text lists into DB.
9. **Display**: UI renders the matching percentage and categorized lists.

## Alternative Flows
### Alternative Flow 1: Recruiter Talent Search
1. **Recruiter Search**: Recruiter queries candidates by matching jobs.
2. **List Sorting**: The list sorts profiles by the computed composite match score.

## Exception Flows
- **Unverified Candidate**: Unverified profiles default to a low trust score, reducing the overall matching percentage.
- **Missing Requirements**: If a job vacancy has no defined capability requirements, the capability fit score defaults to `100.0%`.

## Business Rules
- **Score Weights**: Capability Fit: 40%, Role Fit: 30%, Trust Score: 20%, Preference Fit: 10%.
- **Self-Declared Skill Penalty**: Skills list items lacking repository evidence receive a maximum fit score of 40%.
- **Seniority Mappings**: Juniors, Mids, Seniors, Leads are mapped to integers to compute fractional alignment.

## UI Components
*Inferred from implementation:*
- **Compatibility Ring Chart**: Renders match percentages with colored outlines.
- **Strengths and Gaps Panels**: Bullet lists displaying matched profiles.
- **Salary Check Indicator**: Visual icon showing expected salary alignment.

## Backend Processing
- **TalentDiscoveryController**: Maps GET suitability evaluations routes.
- **UnifiedMatchingEngine**: Handles scoring formulas, weights, and mappings.
- **ExplainableMatchService**: Generates human-readable strengths and gaps statements.

## API Endpoints
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/api/v1/intelligence/match/{jobVacancyId}/{candidateId}` | Evaluate candidate suitability and return explanation details | Authorize |

## Database Interactions
| Table Name | CRUD Operations | Purpose & Constraints |
|---|---|---|
| `matching_evaluations` | Create, Read, Update | Main table storing calculated percentages and job/candidate keys. |
| `matching_factors` | Create, Read | Stores individual sub-scores (Capability, Role, Trust). |
| `matching_explanations` | Create, Read | Stores strengths and gaps text lists. |

## Validation Rules
- **UUID verification**: Checks validity of job vacancy and candidate IDs.
- **Scope validation**: Restricts access to candidate evaluation scores.

## Permissions
Private evaluations require authenticated JWT tokens. Job boards and leadership lists are public, but detailed match evaluations are private to the candidate and hiring recruiter.

## Logging
Auditing records: `SUITABILITY_EVALUATED`, `MATCH_REPORT_GENERATED`.

## Notifications
Toast notices notify user when suitability evaluation resolves.

## Security Considerations
- **Isolated Evaluation**: Scoring computations run entirely on backend services.
- **Private Match Details**: Restricts match explanation text displays from public access.

## Error Handling
Null values in fields degrade gracefully, defaulting missing metrics to zero without breaking page loads.

## Edge Cases
- **Self-referencing Job Requirements**: If a recruiter requires a skill that is not present in the system's global taxonomy, the matching engine defaults the capability weight to zero to avoid calculation errors.

## Dependencies
- `Microsoft.EntityFrameworkCore`: Loads profiles.

## Related Features
Candidate Profile Builder, Git Static Analysis, Trust Profile.

## Sequence Summary
1. Candidate requests suitability evaluation.
2. System loads candidate capabilities and job requirement metadata.
3. System runs Unified Matching Engine to compute capability, role, trust, and preference fits.
4. Explanations of strengths and gaps are saved to DB.
5. Suitability score outputs render on frontend screens.

## Technical Notes
Uses pre-computed capabilities projections to ensure sub-second response times.

## Evidence
- **Service**: [UnifiedMatchingEngine.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Intelligence/Services/UnifiedMatchingEngine.cs)
- **Controller**: [TalentDiscoveryController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Intelligence/Controllers/TalentDiscoveryController.cs)
