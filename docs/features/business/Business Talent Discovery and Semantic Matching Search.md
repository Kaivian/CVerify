# Business Talent Discovery & Semantic Matching Search

## Module
Intelligence Module (CVerify.API.Modules.Intelligence)

## Primary Role
Business / Recruiter (Mapped to system 'ORGANIZATION' / 'BUSINESS' actor claim)

## Purpose
This flagship feature serves as the core sourcing panel for corporate recruiters. It provides semantic search capabilities over the Candidate Search Profiles read-model projection, calculates aggregate suitability matches (weighting Capability, Role, Trust, and Preference fits), exposes detailed evaluations (matching factors and visual gap explanations), and maps the evidence claims, verifications, and trust profile metrics of candidates.

---

## Detailed Module & File-level Architectural Mapping
- **Controllers**:
  - `TalentDiscoveryController.cs` in `CVerify.API.Modules.Intelligence.Controllers`
- **Services**:
  - `ExplainableMatchService.cs` in `CVerify.API.Modules.Intelligence.Services`
  - `UnifiedMatchingEngine.cs` in `CVerify.API.Modules.Intelligence.Services` (Calculates suitability match index ratios)
  - `CapabilityGraphService.cs` in `CVerify.API.Modules.Intelligence.Services`
- **Entities**:
  - `CandidateSearchProfile.cs` in `CVerify.API.Modules.Shared.Domain.Entities`
  - `MatchingEvaluation.cs` in `CVerify.API.Modules.Shared.Domain.Entities`
  - `MatchingFactor.cs` in `CVerify.API.Modules.Shared.Domain.Entities`
  - `MatchingExplanation.cs` in `CVerify.API.Modules.Shared.Domain.Entities`
  - `TrustProfile.cs` in `CVerify.API.Modules.Shared.Domain.Entities`
- **DTOs**:
  - Direct JSON Object mappings in Controller actions.

---

## Purpose & Context
Rather than scanning raw resumes, corporate users require semantic matching tools that connect candidate capabilities with vacancy requirements. This feature exposes discovery tools that search candidate read-models by location, trust tier, and semantic technology queries. Once a candidate is selected for a job vacancy, the `UnifiedMatchingEngine` calculates a suitability score based on:
1. **Capability Fit** (40% weight): Verifies technical levels against job requirements.
2. **Role Fit** (30% weight): Matches seniority thresholds (e.g. Senior, Lead).
3. **Trust Score** (20% weight): Calculates identity and evidence validation levels.
4. **Preference Fit** (10% weight): Aligns remote preference types and salary targets.

---

## Business Value & ROI Matrix
- **Reduced Sourcing Costs**: Replaces manual filtering with automated matching.
- **Vetting Transparency**: Discloses candidate capability gaps, avoiding bad hiring decisions.
- **Identity Assurance**: Filters search indexes by Trust Tier (Bronze, Silver, Gold, Platinum) to prioritize verified candidates.
- **Explainability**: Breaks down match calculations into factors (Capability, Role, Trust, Preference) to build trust in AI decisions.

---

## Complete User Stories & Scenarios

### Scenario 1: Semantic Sourcing Search
```gherkin
Given a corporate Recruiter is logged in with active JWT credentials
And holds the role "Recruiter" in the company "TechCorp"
When the Recruiter queries the search API GET `/api/v1/intelligence/search?query=FastAPI&location=Hanoi&minTrustScore=60`
Then the backend should compile queries against the "CandidateSearchProfiles" read-model projection table
And filter candidates by location containing "Hanoi"
And filter candidates by TrustScore >= 60
And scan candidate headlines, fullnames, and Capability JSON strings for the term "FastAPI"
And return a 200 OK response returning matching candidate summaries.
```

### Scenario 2: Evaluating Candidate Vacancy Match
```gherkin
Given a corporate Recruiter is logged in
And a published Job Vacancy with ID "019ecc1b-44e6-7600-803f-11249088aacc" exists
And a Candidate profile with ID "019ecc1b-44e6-7600-803f-11249088aa99" exists
When the Recruiter requests a match analysis via GET `/api/v1/intelligence/match/{vacancyId}/{candidateId}`
Then the system should invoke the UnifiedMatchingEngine to calculate aggregate scores
And resolve match factors for:
  | Factor             | Weight |
  | Capability Fit     | 40%    |
  | Role Fit           | 30%    |
  | Trust Score        | 20%    |
  | Preference Fit     | 10%    |
And insert or update matching evaluation tables in the database
And return a 200 OK status code containing factor details and gap explanations.
```

### Scenario 3: Querying Missing Candidate Intelligence Profiles
```gherkin
Given a corporate Recruiter is logged in
When the Recruiter requests a matching profile for a candidate ID that does not exist
Then the backend should return a 404 Not Found response containing the message "Candidate intelligence profile not found."
```

---

## System Actors & Telemetry Mappings
- **Primary Actors**:
  - **Recruiter / Hiring Manager**: Conducts sourcing searches and reviews matching logs.
- **Secondary Actors**:
  - **Unified Matching Engine**: Computes candidate suitability indices.
  - **Read Model Projector**: Syncs candidate profile data changes with the search index.

---

## Functional Preconditions & Environmental Constraints
1. The user must be authenticated with organization access scopes.
2. The search profiles index table must be seeded.
3. Candidate matches must map back to active job vacancies.

---

## Trigger Event Details
A recruiter opens the candidate sourcing page, enters keywords in the search input, clicks search, opens a candidate matching panel, or evaluates a profile match.

---

## Exhaustive Main Execution Flow
1. **Search Request Ingestion**: System receives GET `/api/v1/intelligence/search?query=react&location=vietnam&minTrustScore=70`.
2. **Database Querying**: Scans `CandidateSearchProfiles` applying location and trust score filters.
3. **Capability Tag Search**: Filters candidate capabilities by matching JSON strings for the search query.
4. **Data Delivery**: Returns paginated matching records.
5. **Match Analysis Trigger**: Client requests GET `/api/v1/intelligence/match/{vacancyId}/{candidateId}`.
6. **Matching Engine Run**: `UnifiedMatchingEngine` fetches vacancy requirements and candidate profiles.
7. **Score Evaluation**:
   - *Capability Fit*: Evaluates verified candidate skill levels against Expected Levels.
   - *Role Fit*: Matches candidate seniority parameters.
   - *Trust Score*: Integrates identity and evidence validation levels.
   - *Preference Fit*: Compares target salary ranges.
8. **Factor Resolution**: Calculates weights, yielding an `AggregateScore`.
9. **Explanations Generation**: Creates gap summaries and maps matching explanations.
10. **Save & Return**: Persists evaluations to DB and returns details to client.

---

## Alternative Execution Flows
### Alternative Flow 1: Interactive Profile Evaluation
1. **Details Request**: Recruiter fetches GET `/api/v1/intelligence/candidate/{id}`.
2. **Capability Resolution**: Service loads `CandidateCapabilities`, `EvidenceClaims` with confidence levels, and active verifications to render profile detail graphs.

---

## Exception and Failure Scenarios
- **Invalid ID Formats**:
  - *Trigger*: Passing malformed Guid strings to match routes.
  - *Result*: Throws `ArgumentException` returning HTTP 404 with error messages.
- **Stale Profile projections**:
  - *Trigger*: Sourcing candidate profile updates before read-model synchronization completes.
  - *Result*: Returns outdated match scores.

---

## Rigorous Business Rules & Data Constraints
- **Matching Weights**: Capability Fit: 0.40, Role Fit: 0.30, Trust Score: 0.20, Preference Fit: 0.10.
- **Level matching index rules**:
  - Level matches expected level: score = 1.0.
  - Level is below expected: score = `0.40 + 0.60 * (candidateLevel / expectedLevel)`.
  - Self-declared only: score = 0.40.
  - Missing capability: score = 0.0.

---

## UI Components & Layout States
- **Talent Search Dashboard**:
  - Inputs for queries, location, and trust score sliders.
  - Search result cards showing trust tiers (Bronze, Silver, Gold, Platinum).
- **Match Explanations Panel**:
  - Radial graphs showing matching factors.
  - Bullet list explaining capability gaps.

---

## Detailed Backend API Routing Registry
| Method | Path | Input Parameters | Response DTO | Permission |
|---|---|---|---|---|
| GET | `/api/v1/intelligence/search` | `query`, `location`, `minTrustScore` | `List<SearchProfileSummaryDto>` | Authorize |
| GET | `/api/v1/intelligence/candidate/{id}` | `candidateId` (Path) | `CandidateIntelligenceDetails` | Authorize |
| GET | `/api/v1/intelligence/match/{jobVacancyId}/{candidateId}` | `jobVacancyId`, `candidateId` | `MatchingEvaluationDto` | Authorize |

---

## Database Table Schemas & Relationships
### Table: `candidate_search_profiles`
- `candidate_id` (UUID, Primary Key)
- `full_name` (VARCHAR(150), Not Null)
- `headline` (VARCHAR(200))
- `location` (VARCHAR(100))
- `trust_score` (INT)
- `trust_tier` (VARCHAR(20))
- `capabilities_json` (TEXT)
- `last_projected_at` (TIMESTAMPTZ)

### Table: `matching_evaluations`
- `id` (UUID, Primary Key)
- `job_vacancy_id` (UUID, FK -> `job_vacancies.id`)
- `candidate_id` (UUID, FK -> `users.id`)
- `aggregate_score` (DECIMAL)
- `confidence_level` (VARCHAR(20))
- `created_at` (TIMESTAMPTZ)

### Table: `matching_factors`
- `id` (UUID, Primary Key)
- `matching_evaluation_id` (UUID, FK -> `matching_evaluations.id`)
- `factor_name` (VARCHAR(50))
- `factor_score` (DECIMAL)
- `weight` (DECIMAL)

### Table: `matching_explanations`
- `id` (UUID, Primary Key)
- `matching_evaluation_id` (UUID, FK -> `matching_evaluations.id`)
- `explanation_type` (VARCHAR(50))
- `assertion_text` (TEXT)
- `capability_node_id` (UUID, Nullable)

---

## Input Validation Rules & Regex Patterns
- **Trust Score Boundaries**: Min trust score parameters must range between 0 and 100.
- **Search Term Constraints**: Strips HTML tags and special characters before query execution.

---

## Access Permissions & Role-Based Control (RBAC)
Limited to corporate users holding valid JWT authentication claims. Candidate identity details remain masked if the recruiter belongs to a restricted workspace tier.

---

## Granular Audit Logs & Event Trace Formats
- `TALENT_SEARCH_EXECUTED`:
  ```json
  {
    "actorUserId": "019ecc1b-44e6-7600-803f-11249088ae55",
    "query": "React",
    "location": "Vietnam"
  }
  ```
- `MATCH_EVALUATION_COMPUTED`:
  ```json
  {
    "actorUserId": "019ecc1b-44e6-7600-803f-11249088ae55",
    "vacancyId": "019ecc1b-44e6-7600-803f-11249088aacc",
    "candidateId": "019ecc1b-44e6-7600-803f-11249088aa99",
    "score": 0.82
  }
  ```

---

## Notification Dispatch Configurations
High-match evaluations trigger notifications to hiring managers.

---

## Key Security Controls & Anti-Abuse Measures
- **Rate-Limiting Sourcing Queries**: Prevents scraping of the candidate database using automated scripts.
- **Encrypted Profile Access**: Shields email address variables from unauthorized search results.

---

## Structured Error Handling & Response Dictionary
- `404 Not Found`: Candidate intelligence profile or job vacancy ID missing.
- `500 Server Error`: Connection timeouts during score evaluations.

---

## Edge Cases & Resilience Scenarios
- **Embedding Synchronization Lag**: If semantic embedding indexing runs slow, the system falls back to text-based matching over capability tags.

---

## System Package & Third-Party Dependencies
- `Microsoft.EntityFrameworkCore`
- `Npgsql.EntityFrameworkCore.PostgreSQL`

---

## Integrations with Related Features
- **Job Vacancies**: Resolves active requirements.
- **Trust Profiles**: Incorporates verification parameters.
- **Evidence Claims**: Displays verified credentials.

---

## Sequence Summary
```
Recruiter                   Controller                 Service                   Database
  |                             |                         |                         |
  |--- GET /match/{vId}/{cId} ->|                         |                         |
  |                             |--- EvaluateMatchAsync ->|                         |
  |                             |                         |--- Load Candidate ----->|
  |                             |                         |--- Load Vacancy ------->|
  |                             |                         |--- Compute match score -|
  |                             |                         |--- Create explanations -|
  |                             |                         |--- Save Evaluation ---->|
  |                             |                         |<-- Save Success --------|
  |                             |<-- Return Evaluation ---|                         |
  |<-- 200 OK ------------------|
```

---

## Deep-Dive Technical Notes
Pre-calculates match components in background tasks to minimize latency on recruiter detail pages.

---

## Code Evidence References
- **Controller**: [TalentDiscoveryController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Intelligence/Controllers/TalentDiscoveryController.cs)
- **Service**: [UnifiedMatchingEngine.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Intelligence/Services/UnifiedMatchingEngine.cs)
- **Read Model**: [CandidateSearchProfile.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Shared/Domain/Entities/CandidateSearchProfile.cs)
