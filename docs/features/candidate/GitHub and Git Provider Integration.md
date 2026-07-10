# GitHub & Git Provider Integration

## Module
SourceCode Module (CVerify.API.Modules.SourceCode)

## Primary Role
Candidate (Mapped as system 'USER' role)

## Purpose
This feature manages candidate integrations with external source code platforms (primarily GitHub and GitLab). It orchestrates OAuth authorization, handles secure access token storage, schedules background metadata synchronization, retrieves developer organization affiliations, and maps coding repositories to candidate CV entries (both through explicit user bindings and automatic regex scanning of profile text).

## Business Value
- **Evidence Authenticity**: Serves as the source of truth for repository evaluations, ensuring all tested code histories belong to verified candidate credentials.
- **Enhanced Profiling**: Pulls repository star counts, commit dates, languages, and descriptions directly into candidate portfolios.
- **Hiring Trust**: Confirms repository ownership ratios and visibility properties (public vs private), reducing CV falsification.
- **Process Efficiency**: Syncs metadata asynchronously via Redis and database outbox background queues to avoid blocking main application requests.

## User Story
As an active Candidate,
I want to link my GitHub account and authorize CVerify to view my repositories,
So that I can import and map my code histories directly to my CV profile for automated AI verification.

## Actors
- **Primary Actor**: Candidate User.
- **Secondary Actors**: GitHub/GitLab OAuth API, Redis Cache Engine, Background Sync Service.

## Preconditions
1. Candidate must possess a valid, active account on GitHub or GitLab.
2. Candidate must be authenticated on CVerify.
3. System configuration must define valid Client IDs, Client Secrets, and callback redirect Whitelists.

## Trigger
Candidate clicks 'Connect Provider' under settings, or clicks the manual 'Sync Repositories' action in their workspace.

## Main Flow
1. **OAuth Redirection**: Candidate initiates connection under Settings. Frontend redirects to GitHub authorization screen.
2. **Provider Callback**: Candidate grants permissions. GitHub returns an authorization code to `GET /auth/callback/github` (or proxy endpoint).
3. **Token Verification**: Backend exchanges the code for a secure Access Token, retrieves profile metadata from `/user` API, saves or updates the `AuthProvider` entity, and creates an audit log.
4. **Enqueue Sync**: System invokes `EnqueueSyncJobAsync`, yielding a unique UUID v7 jobId, caching status in Redis with a 30-minute expiration, and putting a job onto the `IRepositorySyncQueue`.
5. **Worker Execution**: Background sync processor fetches the job from the queue, gets the provider credentials, and requests `/user/repos` and `/user/orgs` paginated records.
6. **Db Ingestion**: Synced repositories are matched against the database. New repositories are inserted, defunct ones are soft deleted, and details (languages, description, stars) are stored.
7. **Auto-Heal Check**: Repository verification status is updated if active analyses with confidence scores above 50% are found in the history.
8. **Confirmation**: Sync status shifts to `Completed`, caches are cleared, and Next.js UI updates the repository tables.

## Alternative Flows
### Alternative Flow 1: Automatic CV Mapping
1. **CV Scanning**: After a successful sync, the system triggers `CvRepositoryIndexer`.
2. **Regex Parsing**: The indexer scans the candidate's Bio, Headline, work experience logs, and project descriptions for repository URLs or handles using regular expressions.
3. **Mapping Generation**: Matched reference mappings are inserted into `CvRepositoryMappings` to link project achievements to specific repository assets automatically.

### Alternative Flow 2: Explicit Repository Linking
1. **Manual Link**: Under the Project edit form, the candidate selects a synced repository from a dropdown list.
2. **Link Entry**: A record is created in `ProjectRepositoryLinks` to explicitly bind the project to the repository.

## Exception Flows
- **Sync Timeout / Reboot Recovery**: If a synchronization job remains in a non-terminal status (Pending/Syncing) for over 10 minutes, the status checker flags it as `Failed` with message `"Synchronization interrupted due to server reboot or timeout."`.
- **OAuth Revocation**: If the external API calls return a 401 Unauthorized status, the system flags the connection, writes a `SyncError` message to the `AuthProvider` entity, and prompts the user to re-authenticate.
- **GitHub API Rate Limits**: High-frequency sync requests receive throttling headers from GitHub. System handles this using Polly-driven exponential retry backoff policies.

## Business Rules
- **Pagination Boundary**: Repository sync fetches up to 10 pages with a maximum size of 100 repositories per page to mitigate API abuse.
- **Ownership Scoping**: Synced repositories are categorized into 'Personal' or 'Organization' based on the GitHub owner payload property.
- **Verification Confidence Threshold**: Repositories are marked as verified automatically only if their AI assessment trust scores are equal to or exceed 50.0%.

## UI Components
*Inferred from implementation:*
- **Provider Status Cards**: Toggle toggles to link or disconnect credentials. Shows synchronization metadata (Last Sync, Status).
- **Repository Grid**: A list with filters (language, visibility public/private, search query) and sort options (stars count, name, updated time).
- **Linked Repos Indicator**: Badges showing which repositories are actively linked to CV project nodes.

## Backend Processing
- **SourceCodeProvidersController**: Endpoint layer mapping Git provider collections, initiating syncs, and checking status variables.
- **SourceCodeProviderService**: Orchestrates sync jobs, parses organizations, manages caching, and executes auto-heal checks.
- **CvRepositoryIndexer**: Automated regex processor parsing profile strings to populate candidate repository references.
- **BackgroundRepositorySyncQueue**: Thread queue hosting background sync processes.

## API Endpoints
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/api/source-code-providers` | List candidate's connected Git providers | Authorize |
| GET | `/api/source-code-providers/repositories` | Fetch paginated repositories list | Authorize |
| GET | `/api/source-code-providers/organizations` | Fetch affiliated developer organizations | Authorize |
| GET | `/api/source-code-providers/repositories/categories` | Retrieve distinct classification categories | Authorize |
| POST | `/api/source-code-providers/{providerId}/sync` | Enqueue background repository sync job | Authorize |
| POST | `/api/source-code-providers/sync-all` | Enqueue background sync for all providers | Authorize |
| GET | `/api/source-code-providers/sync/status/{jobId}` | Get sync job progress and errors | Authorize |

## Database Interactions
| Table Name | CRUD Operations | Purpose & Constraints |
|---|---|---|
| `auth_providers` | Create, Read, Update | Stores access tokens, client IDs, scope verifications, and sync status. |
| `external_organizations` | Create, Read, Update | Stores synced developer organization profiles linked to AuthProviders. |
| `source_code_repositories` | Create, Read, Update, Delete | Stores repository metadata, languages, forks, verification states, and trust scores. |
| `cv_repository_mappings` | Create, Read, Delete | Links repository references to CV entries. Scanned/updated by the Indexer. |
| `project_repository_links` | Create, Read, Delete | Explicit relationships linking Project Entries to SourceCodeRepositories. |

## Validation Rules
- **Access Tokens scopes**: Validates that OAuth grants include necessary scopes (e.g. `repo`, `read:org`).
- **Domain whitelist verification**: Exchanged provider API routes must strictly target verified domains (e.g. `api.github.com`).

## Permissions
Access to these APIs is restricted to authenticated users holding a valid JWT context. Users can only query or sync providers and repositories linked to their own candidate profile.

## Logging
Audits record events: `PROVIDER_LINKED` (on token setup), `REPOSITORY_SYNC_STARTED`, `REPOSITORY_SYNC_SUCCESS`, `REPOSITORY_SYNC_FAILED`.

## Notifications
Frontend displays real-time toast alerts: "Repository sync enqueued", "Sync completed successfully", or "Sync failed".

## Security Considerations
- **Token Protection**: Access tokens are stored encrypted in the database.
- **Payload Verification**: GitHub API responses run through sanitization steps before database insertion.

## Error Handling
Throttled or failed API connections are managed by Polly policies, which retry request threads on temporary network failures.

## Edge Cases
- **Orphaned Mappings**: If a candidate disconnects an AuthProvider, all linked repositories and CV mappings are soft-deleted from the workspace.
- **Repository Rename**: If a user renames a repository on GitHub, the system handles it by matching the unique external repository ID rather than the repository name.

## Dependencies
- `Octokit` (or standard `HttpClient` implementations fetching GitHub APIs).
- `StackExchange.Redis`: Caches status configurations.
- `Polly`: Manages retry behaviors.

## Related Features
Candidate Profile Builder, AI Repository Analysis, Trust Score & Profiles.

## Sequence Summary
1. Candidate authorizes CVerify on GitHub.
2. Callback writes Access Token to `auth_providers` table.
3. System triggers background sync job.
4. Sync service queries GitHub API, parses JSON, and updates `source_code_repositories`.
5. `CvRepositoryIndexer` scans profile text, running regex parsing to map CV entries to repositories.

## Technical Notes
Uses Redis caching to store sync status with an auto-timeout fail-safe.

## Evidence
- **Controller**: [SourceCodeProvidersController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/SourceCode/Controllers/SourceCodeProvidersController.cs)
- **Service**: [SourceCodeProviderService.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/SourceCode/Services/SourceCodeProviderService.cs)
- **Indexer**: [CvRepositoryIndexer.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Profiles/Services/CvRepositoryIndexer.cs)
