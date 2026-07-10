# Trust Profile & Score Transparency

## Module
Profiles & SourceCode Modules (CVerify.API.Modules.Profiles)

## Primary Role
Candidate (Mapped as system 'USER' role)

## Purpose
This feature consolidates a candidate's credentials into a unified Trust Profile and calculates a transparent Trust Score. The Trust Score indicates the validity of a candidate's portfolio, combining Identity Trust indicators (verified email, linked provider profiles) and Evidence Trust metrics (static analyses outputs, primary authorship ratios in git commit histories, and verified certification PDFs).

## Business Value
- **Integrity Validation**: Standardizes credibility indicators for recruiters, enabling quick assessment of CV claims.
- **Fair Talent Comparisons**: Ranks developer profiles based on objective code provenance metrics rather than self-reported statements.
- **Transparency & Trust**: Allows candidates to view exactly how their score is calculated, reducing system skepticism.
- **Fraud Prevention**: Disables badge awards or verified statuses if the contributor contribution matches plagiarism or code spoofing indicators.

## User Story
As an active Candidate,
I want to view my Trust Score details and the specific factors driving it,
So that I can optimize my codebase integrations and verify my developer identity to prospective employers.

## Actors
- **Primary Actor**: Candidate User.
- **Secondary Actors**: Recruiters, Background Ranking Projector Service.

## Preconditions
1. Candidate must have completed email verification.
2. Candidate has run at least one static analysis job on a linked repository.

## Trigger
Candidate navigates to their profile dashboard and clicks the 'Trust Score' details tab.

## Main Flow
1. **Request Score Details**: Candidate opens the Trust Dashboard. Frontend fetches GET `/api/v1/users/profile` and the latest assessments data.
2. **Retrieve Score Matrix**: System fetches the sub-scores from the database:
   - *Identity Trust Score*: Checks email verification state, OAuth provider linkages, and MFA setup.
   - *Evidence Trust Score*: Checks the verification states of linked repositories and uploaded certificational attachments.
3. **Composite Calculation**: System executes `CandidateRankingCalculator` logic to compute the overall ranking score:
   `CompositeScore = (AiScore * 0.35) + (TrustScore * 0.35) + (Completeness * 0.15) + (OssImpactScore * 0.15)`
4. **Primary Authorship Calculation**: In the repository sync engine, the system evaluates developer commit ratios:
   - `userCommitRatio = trustScore / 100.0`
   - `isPrimaryAuthor = trustScore >= 50.0`
5. **Verify Repositories**: Toggle repository `IsVerified` flag to `true` if the analysis confidence score is 50% or above.
6. **Dashboard Presentation**: Renders the final score and highlights specific positive verification factors and potential risk warnings (e.g. low contribution weights).

## Alternative Flows
### Alternative Flow 1: Public Trust Score Projection
1. **Public Query**: Recruiter searches candidates on the public leaderboard ranking board.
2. **Filter Thresholds**: Recruiter applies filter for `Minimum Trust Score >= 80%`.
3. **DB Projection**: Service `CandidateRankingProjectionService` queries PostgreSQL projections and returns matching candidate rows displaying verified trust badges.

## Exception Flows
- **Unverified Candidate Restriction**: If the candidate hasn't verified their email, the system hides the Trust Dashboard, prompting them to complete setup first.
- **Zero Evidence Fallback**: If a candidate has no linked repositories or uploaded certificates, the Evidence Trust Score defaults to `0.0`, resulting in a low composite trust score.

## Business Rules
- **Ranking Formula weights**: AI score represents 35%, Trust score represents 35%, Completeness represents 15%, and Open-source (OSS) impact represents 15% of the overall composite ranking score.
- **Primary Author threshold**: User contribution ratio must meet or exceed 50.0% to be flagged as the primary repository author.
- **Sync Auto-Heal**: If a repository is unverified but holds an active report with confidence >= 50.0%, the system auto-heals its verified state during repository page loads.

## UI Components
*Inferred from implementation:*
- **Trust Score Progress Gauge**: Radial chart displaying scores with color segments.
- **Verification Badges**: Dynamic icons indicating specific verifications (e.g. GitHub Connected, Verified Email, Certification Confirmed).
- **Transparency Panel**: Detailed lists explaining how the score was calculated.

## Backend Processing
- **ProfileController**: Exposes candidate profiles and rankings.
- **CandidateRankingProjectionService**: Projects candidate rankings and saves pre-sorted scores lists.
- **RepositoryAnalysisService**: Updates repository-specific trust and author attributes.

## API Endpoints
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/api/v1/users/profile` | Fetch candidate profile including trust indicators | Authorize |
| GET | `/api/v1/users/profile/ranking` | List candidate leaderboard rankings | AllowAnonymous |
| GET | `/api/v1/users/profile/ranking/stats` | Retrieve platform-wide average score distributions | AllowAnonymous |
| GET | `/api/v1/candidate-assessments/latest` | Retrieve latest diagnostic summaries and trust scores | Authorize |

## Database Interactions
| Table Name | CRUD Operations | Purpose & Constraints |
|---|---|---|
| `user_profiles` | Read, Update | Stores composite scores and verification flags. |
| `source_code_repositories` | Read, Update | Updates repository-level trust scores and verification statuses. |
| `candidate_ranking_projections` | Create, Read, Update | Stores pre-calculated scores for the leaderboard list. |

## Validation Rules
- **Ownership verification**: Ensures users cannot view granular scoring factors of other private profiles.

## Permissions
Private profile details require authenticated JWT headers. Public leaderboards and rankings pages allow anonymous GET requests to support external verification.

## Logging
Events are logged to audit files: `TRUST_SCORE_RECALCULATED`, `BADGE_AWARDED`, `VERIFICATION_HEALED`.

## Notifications
UI notifications alerts user when their ranking position changes or a new trust badge is unlocked.

## Security Considerations
- **Secure Calculations**: All scoring computations are executed on the backend, preventing client-side score spoofing.
- **IP / User-Agent Logging**: Computations record IP and metadata to identify fake activity.

## Error Handling
Calculations with missing parameters (e.g., deleted repositories) degrade gracefully, defaulting missing sub-scores to `0` instead of failing.

## Edge Cases
- **Self-Authored Repositories on Shared Accounts**: If multiple candidate accounts claim the same repository, the system splits author percentages based on commit hashes, adjusting individual trust scores accordingly.

## Dependencies
- `Microsoft.EntityFrameworkCore` to fetch repository records.
- `System.Text.Json` to parse dynamic score configuration criteria.

## Related Features
Candidate Profile Builder, Git Static Analysis, GitHub Integration.

## Sequence Summary
1. Candidate navigates to Trust Profile Dashboard.
2. System loads candidate profile, verification histories, and repository metadata.
3. System runs composite score calculations using the ranking calculator.
4. Trust Score ratings and verification items display on screen.

## Technical Notes
Pre-calculates projections using a background service to ensure fast leaderboard page load times.

## Evidence
- **Test File**: [CandidateRankingCalculatorTests.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/tests/CVerify.API.UnitTests/Services/CandidateRankingCalculatorTests.cs)
- **Projection Service**: [CandidateRankingProjectionServiceTests.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/tests/CVerify.API.UnitTests/Services/CandidateRankingProjectionServiceTests.cs)
