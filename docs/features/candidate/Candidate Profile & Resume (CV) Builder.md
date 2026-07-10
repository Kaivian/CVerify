# Candidate Profile & Resume (CV) Builder

## Module
Profiles Module (CVerify.API.Modules.Profiles)

## Primary Role
Candidate (Mapped as system 'USER' role)

## Purpose
Enables candidates to manage their digital developer identities, configure profile settings (Full Name, Username, Bio, social links, custom avatars), and input structured resume segments (Education, Academic Achievements, Work Experience, and Project Portfolios) with reordering support. It also manages public profiles, user rankings, follower interactions, and CV publishing settings (template type, visibility state).

## Business Value
- **Structured Query Capabilities**: Transforms free-form resumes into structured, indexable data, allowing recruitment algorithms to filter profiles accurately.
- **Increased Engagement**: Fosters platform community activity via follow/unfollow mechanisms and user ranking leaderboards.
- **Dynamic Web Presence**: Offers candidates an interactive public CV URL they can share externally, increasing candidate lifetime value.
- **System Data Integrity**: Enforces optimistic concurrency checks to prevent data loss or overrides during concurrent updates.

## User Story
As an active Candidate,
I want to populate my resume with my career history, projects, and academic qualifications, and customize my avatar and public template,
So that I can present a professional, verified digital CV and improve my ranking positions in the talent pool.

## Actors
- **Primary Actor**: Candidate User (authenticated user holding system 'USER' role).
- **Secondary Actors**: Public Portal Viewers (anonymous users checking rankings/profiles), Cloudflare R2 Object Storage Service.

## Preconditions
1. Candidate must be authenticated with valid JWT bearer headers for all private write actions.
2. Candidate's profile record must exist (created automatically during authentication verification).
3. Avatar assets must not exceed 5MB and must match accepted image MIME types.

## Trigger
Candidate clicks 'Edit Profile', updates biography, reorders experiences, uploads a new avatar file, or navigates to the public ranking board.

## Main Flow
1. **Profile Fetching**: Candidate opens dashboard. Frontend fetches GET `/api/users/profile`. System retrieves UserProfile, UserCvSetting, and updates pre-signed URLs.
2. **Data Modification**: Candidate edits text inputs (Bio, Full Name, Social Links) and submits PUT `/api/users/profile`.
3. **Optimistic Concurrency Verification**: Backend verifies if `profile.Version` matches `request.Version`. If they match, the system locks the row and increments `Version`.
4. **Database Update**: System updates user profile parameters, logs changes to ActivityEvents, and commits transactions.
5. **Entry Appending (Education/Experience/Project/Achievement)**: Candidate clicks 'Add Entry', fills details, and POSTs to `/education`, `/work-experience`, `/projects`, or `/achievements`.
6. **Sequence Index Assignment**: System calculates default sequence indices, assigns client-generated UUID v7s, inserts records into the database, and returns the entity DTO.
7. **Profile Synchronization**: System invalidates cache entries in `IdentityStateResolver` and updates public profile displays.

## Alternative Flows
### Alternative Flow 1: Profile Customization & Ordering
1. **Interactive Reordering**: Candidate shifts entries using drag handles on the UI. Frontend maps indices and PUTs to `/reorder` endpoints.
2. **Index Recalculation**: Service updates sort columns for all targeted ids inside a single database transaction.

### Alternative Flow 2: Avatar Upload & Sync
1. **Custom Upload**: Candidate uploads file payload to POST `/avatar`. System validates format, saves to Cloudflare R2 bucket, and saves key.
2. **OAuth Provider Sync**: Candidate triggers sync. System contacts GitHub/GitLab profile API, retrieves avatar link, and updates the local profile avatar.

### Alternative Flow 3: Public Follow & Ranking Boards
1. **Social following**: Candidates click 'Follow' on a public profile, saving mapping to `user_followers` table.
2. **Ranking lists**: Any user queries GET `/ranking`. System loads candidate scoring indices, sorts, and renders the ranked list.

## Exception Flows
- **Concurrency Conflict**: If `request.Version` doesn't match database `profile.Version`, the system throws `ProfileConcurrencyConflict` and cancels transaction execution.
- **Duplicate Username Claim**: Updating username fails with conflict errors if another profile has already claimed that handle.
- **File Validation Failures**: Avatar payload exceeding 5MB or invalid MIME types return a 400 Bad Request error.
- **Self Follow Attempt**: Attempting to follow your own profile returns a business rule error.

## Business Rules
- **Optimistic Locking**: DB transactions verify profile version attributes on edit. Version numbers are incremented on every write.
- **Sort Order Preservation**: Items map to sequence columns. Adding/deleting shifts sibling index sequence values.
- **MIME Safeguards**: Custom avatars restrict file types to JPEG, PNG, WebP, GIF. All S3 file uploads use cryptographically unique keys.

## UI Components
*Inferred from implementation:*
- **Input Dialogues**: Text fields, textareas, and date selectors for qualifications.
- **Drag Handles**: Custom icons allowing drag reordering of list elements.
- **Avatar Cropper**: Frontend cropping component with upload state indicators.
- **Ranking Table**: Paginated list displaying candidate stats, names, and scores.

## Backend Processing
- **ProfileController**: Endpoint layer, maps route variables and performs DTO checks.
- **ProfileService**: Manages transactions, concurrency validations, and maps database models to responses.
- **AttachmentService**: Connects S3 cloud storage, performs payload size assertions, and retrieves signed URLs.

## API Endpoints
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/api/v1/users/profile` | Retrieve current candidate profile | Authorize |
| PUT | `/api/v1/users/profile` | Update profile details (Bio, Name, social links) | Authorize |
| PUT | `/api/v1/users/profile/username` | Update profile username handle | Authorize |
| POST | `/api/v1/users/profile/avatar` | Upload custom profile avatar to R2 | Authorize |
| POST | `/api/v1/users/profile/avatar/sync` | Sync avatar with provider (GitHub) | Authorize |
| DELETE | `/api/v1/users/profile/avatar` | Delete custom avatar | Authorize |
| GET | `/api/v1/users/profile/public/{username}` | Retrieve candidate public profile info | AllowAnonymous |
| GET | `/api/v1/users/profile/ranking` | Retrieve candidate ranking leaderboard | AllowAnonymous |
| POST | `/api/v1/users/education` | Create new education entry | Authorize |
| PUT | `/api/v1/users/education/{id}` | Update existing education entry | Authorize |
| DELETE | `/api/v1/users/education/{id}` | Delete education entry | Authorize |
| PUT | `/api/v1/users/education/reorder` | Reorder education list sequence | Authorize |
| POST | `/api/v1/users/work-experience` | Create work experience entry | Authorize |
| PUT | `/api/v1/users/work-experience/{id}` | Update work experience details | Authorize |
| DELETE | `/api/v1/users/work-experience/{id}` | Delete work experience details | Authorize |
| PUT | `/api/v1/users/work-experience/reorder` | Reorder work experience items | Authorize |
| POST | `/api/v1/users/projects` | Create new project entry | Authorize |
| PUT | `/api/v1/users/projects/{id}` | Update project entry details | Authorize |
| DELETE | `/api/v1/users/projects/{id}` | Delete project entry details | Authorize |
| PUT | `/api/v1/users/projects/reorder` | Reorder project entries list | Authorize |

## Database Interactions
| Table Name | CRUD Operations | Purpose & Constraints |
|---|---|---|
| `user_profiles` | Create, Read, Update | Primary profile tables. Linked to users. Tracks concurrency Version. |
| `education_entries` | Create, Read, Update, Delete | Stores educational histories. Sequence index field for ordering. |
| `work_experience_entries` | Create, Read, Update, Delete | Stores work histories. Maps linked technologies and achievements. |
| `project_entries` | Create, Read, Update, Delete | Tracks project portfolios, GitHub links, and sequence indices. |
| `user_cv_settings` | Create, Read, Update | Stores active template choices and CV publication status variables. |
| `user_followers` | Create, Read, Delete | Maps followers. Composite primary key on follower and target IDs. |

## Validation Rules
- **String Limits**: Bios restrict to 1000 characters; usernames limit to 30 alphanumeric characters.
- **Date ranges validations**: Entry start dates must predate end dates.
- **Image constraints**: Avatar files must be JPEG, PNG, WebP, GIF and <= 5MB.

## Permissions
Authenticated candidates (USER role) hold full CRUD permissions on their own profiles and resume sections. Anonymous users can view public URLs (`/public/{username}`) and leaderboard rankings.

## Logging
All mutations write to the ActivityEvents logs. Key audited events include `USER_PROFILE_UPDATED`, `USER_USERNAME_UPDATED`, `AVATAR_UPLOADED`, and `AVATAR_DELETED`, capturing metadata, IP addresses, and User-Agents.

## Notifications
Frontend UI displays toast notifications showing saving status. Reordering or uploads trigger micro-animation spinners.

## Security Considerations
- **Bearer Verification**: Private route endpoints mandate JWT authentication checks.
- **Input Sanitization**: Biography and field updates strip HTML markup to thwart XSS injections.
- **Secure Storage Assets**: Cloud avatar references resolve dynamically through signed short-term S3 URLs.

## Error Handling
Validation and constraint errors trigger `BadRequest`. Optimistic locking failures throw `ProfileConcurrencyConflict`, yielding a 409 Conflict code to prompt frontend profile synchronization.

## Edge Cases
- **Concurrent Edits**: When two sessions edit profile data, the second transaction is blocked and returns a conflict error.
- **OAuth Avatar Sync failures**: If provider OAuth connections expire, sync returns 400 Bad Request requesting re-authentication.

## Dependencies
- `AWSSDK.S3`: Interfaces Cloudflare R2 storage for avatar binary data.
- `Microsoft.EntityFrameworkCore`: Manages entity models, reorder sequences, and updates.

## Related Features
This feature is related to Candidate Authentication (for username verification and profile instantiation), and GitHub Provider sync.

## Sequence Summary
1. Candidate submits PUT profile data containing model parameter properties.
2. System verifies version properties matching database record properties.
3. System locks the database row and applies changes inside a single database transaction.
4. System increments the version property on successful database commit operations.

## Technical Notes
Implements optimistic concurrency version matching for updates to avoid race conditions.

## Evidence
- **Controllers**: 
  - [ProfileController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Profiles/Controllers/ProfileController.cs)
  - [AchievementController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Profiles/Controllers/AchievementController.cs)
  - [EducationController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Profiles/Controllers/EducationController.cs)
  - [WorkExperienceController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Profiles/Controllers/WorkExperienceController.cs)
  - [ProjectController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Profiles/Controllers/ProjectController.cs)
- **Services**: 
  - [ProfileService.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Profiles/Services/ProfileService.cs)
  - [AttachmentService.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Profiles/Services/AttachmentService.cs)
- **Entities**: 
  - [UserProfile.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Profiles/Entities/UserProfile.cs)
  - [UserCvSetting.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Profiles/Entities/UserCvSetting.cs)
