# System User Administration & Status Control

## Module
Admin Module (CVerify.API.Modules.Admin)

## Primary Role
Administrator (Mapped to system 'ADMINISTRATOR' / 'SYSTEM_ADMIN' actor claim)

## Purpose
This feature governs the administration of platform users (administrators, corporate recruiters, and candidate users) by system administrators. It handles querying and paging user lists, reviewing profiles, editing statuses (Active, Blocked, Suspended), managing system roles assignments (SYSTEM domain), inviting new administrators, and processing system invitations.

---

## Detailed Module & File-level Architectural Mapping
- **Controllers**:
  - `UsersAdminController.cs` in `CVerify.API.Modules.Admin.Controllers`
- **Services**:
  - `AdminMemberService.cs` in `CVerify.API.Modules.Admin.Services`
- **Entities**:
  - `AdminMember.cs` in `CVerify.API.Modules.Admin.Entities`
  - `AdminInvitation.cs` in `CVerify.API.Modules.Admin.Entities`
  - `User.cs` in `CVerify.API.Modules.Shared.Domain.Entities`
  - `UserRoleAssignment.cs` in `CVerify.API.Modules.Shared.Domain.Entities`
- **DTOs**:
  - `UserListItemDto.cs` in `CVerify.API.Modules.Admin.DTOs`
    - Fields: `Guid Id`, `string Email`, `string FullName`, `string Status`, `DateTimeOffset? LastLoginAt`, `List<string> Roles`, `int SessionVersion`, `DateTimeOffset JoinedAt`
  - `UpdateUserDto.cs` in `CVerify.API.Modules.Admin.DTOs`
    - Fields: `string Status`, `List<string> Roles`
  - `InviteAdminDto.cs` in `CVerify.API.Modules.Admin.DTOs`
    - Fields: `string Email`, `string FullName`, `List<string> Roles`
  - `AcceptInvitationDto.cs` in `CVerify.API.Modules.Admin.DTOs`
    - Fields: `string Token`
  - `AdminInvitationListItemDto.cs` in `CVerify.API.Modules.Admin.DTOs`
    - Fields: `Guid Id`, `string Email`, `string FullName`, `string Status`, `DateTimeOffset ExpiresAt`, `DateTimeOffset CreatedAt`

---

## Purpose & Context
Platform scale demands robust user administration tools. If a corporate recruiter violates terms or a candidate attempts to bypass static code analysis using bot scripts, platform administrators must suspend their access. The User Administration panel provides search directories, detailed status controls, and role assignment gates. Additionally, it implements a secure admin-invite outbox queue to securely add new colleagues to the CVerify operations crew.

---

## Business Value & ROI Matrix
- **Insider Threat Management**: Deactivating compromised accounts prevents unauthorized data leaks.
- **Operational Alignment**: Scopes new admin capabilities (e.g. billing management vs. forum moderation).
- **Secure Onboarding**: Administrator invitations use SHA-256 tokens to prevent credential hijacking.
- **Outbox Email Auditing**: Logs transactional emails to confirm admin account setups.
- **Session Revocation**: Updates version parameters to log out terminated users immediately.
- **Compliance Logging**: Saves structured parameters detailing which administrator altered user variables.

---

## Complete User Stories & Scenarios

### Scenario 1: Searching and Filtering Users
```gherkin
Given a Platform Administrator is logged in with active JWT credentials
And holds the permission "admin:users:view"
When the Administrator queries the user directory GET `/api/admin/users?search=alex&status=active&page=1`
Then the backend should query the EF "AdminMembers" context
And apply text filters on user names and email domains containing "alex"
And filter for status matching "active"
And return a 200 OK response returning a paginated list of user summaries.
```

### Scenario 2: Suspending a Malicious Account
```gherkin
Given a Platform Administrator is logged in
And holds the permission "admin:users:manage"
And the target user ID "019ecc1b-44e6-7600-803f-11249088aacc" has status "Active"
When the Administrator submits a PUT request to `/api/admin/users/019ecc1b-44e6-7600-803f-11249088aacc` with:
  | Status | Blocked       |
  | Roles  | ["Candidate"] |
Then the system should load the User entity from the database
And verify the actor is not trying to suspend their own account
And update the status column to "Blocked"
And increment the user's "SessionVersion" key to invalidate active session tokens
And return a 200 OK status containing the updated user details.
```

### Scenario 3: Inviting a New Administrator
```gherkin
Given a Platform Administrator is logged in
And holds the permission "admin:users:manage"
When the Administrator submits a POST request to `/api/admin/users/invitations` with:
  | Email    | sec_auditor@cverify.com            |
  | FullName | Security Auditor                   |
  | Roles    | ["SystemAuditor"]                  |
Then the system should verify the email is not already registered
And generate a unique cryptographically secure invitation token
And hash the token using SHA-256 before database save
And insert an "AdminInvitation" record under the status "Pending"
And enqueue an invitation link email to the outbox table
And return a 204 No Content response.
```

---

## System Actors & Telemetry Mappings
- **Primary Actors**:
  - **Platform Administrator**: Complete query, invite, suspend, and role assignment capabilities.
- **Secondary Actors**:
  - **Invited Admin**: Accepts invitations via token links to set up administrative credentials.
  - **Redis Cache Engine**: Revokes active session tokens when user profiles update.

---

## Functional Preconditions & Environmental Constraints
1. The administrator must hold valid JWT signatures mapping the `admin:users:view` and `admin:users:manage` permission claims.
2. Status updates must commit within transaction scopes.
3. System clocks must match to verify invitation token expiration dates.

---

## Trigger Event Details
An administrator opens the Admin panel, searches for a user, edits their role/status, or dispatches a new email invitation using the invite dashboard.

---

## Exhaustive Main Execution Flow
1. **Request Ingestion**: Controller intercepts PUT `/api/admin/users/{id}`.
2. **Authorization Gate**: Validates actor possesses `admin:users:manage` permissions.
3. **Database Fetch**: Queries `context.AdminMembers.Include(am => am.User)` for the target ID.
4. **Self-Suspension Guard**: Asserts the target user ID does not match the active actor's `ClaimTypes.NameIdentifier` claim. If yes, it blocks the suspension.
5. **Status Mutation**: Updates `member.Status` to `Blocked` or `Suspended`.
6. **Role Assignment Mapping**:
   - Fetches target system-level roles from `context.Roles` where domain is `SYSTEM`.
   - Clears existing system role assignments for the target user.
   - Inserts new `UserRoleAssignment` records.
7. **Session Invalidation**:
   - Increments `User.SessionVersion` by 1.
   - Saves database changes via `SaveChangesAsync()`.
8. **Cache Cleanup**: Sends a Redis invalidation signal for key prefix `user:session:{userId}`.
9. **Return**: Returns the updated `UserListItemDto` payload to the client.

---

## Alternative Execution Flows
### Alternative Flow 1: Accept Admin Invitation
1. **Accept Trigger**: Invitee POSTs token payload to `/api/admin/users/invitations/accept`.
2. **Token Verification**: System hashes token using SHA-256 and searches `AdminInvitations` for active, pending records.
3. **Account Initialization**: System binds the user profile to `AdminMembers`, sets status to `Active`, marks the invitation as `Accepted`, and commits changes.

---

## Exception and Failure Scenarios
- **Self-Suspension Attempt**:
  - *Trigger*: Admin tries to block their own account.
  - *Result*: Throws `ValidationException` (HTTP 400), returning:
    ```json
    { "message": "You cannot update your own administrative status." }
    ```
- **Stale Token Accept**:
  - *Trigger*: User clicks invitation link after expiration.
  - *Result*: Returns `400 Bad Request` with message `The invitation has expired.`

---

## Rigorous Business Rules & Data Constraints
- **Self-Update Restriction**: Administrators cannot suspend, block, or delete their own accounts.
- **SYSTEM Domain Limits**: Admins can only manage SYSTEM-level roles; organization-level roles are managed within their respective organization scopes.
- **Invitation Lifespan**: Admin invitations expire exactly 48 hours after generation.

---

## UI Pages, Components & Layout States
- **Admin Users Dashboard**:
  - Paged tables listing names, emails, roles, last logins, and statuses.
  - Dropdown controls for role adjustments.
- **Invite Modal Box**:
  - Input fields for name, email, and checkbox lists for system roles.

---

## Detailed Backend API Routing Registry
| Method | Path | Input Payload | Response DTO | Permission |
|---|---|---|---|---|
| GET | `/api/admin/users` | Query Params | `PaginatedResultDto<UserListItemDto>` | `admin:users:view` |
| GET | `/api/admin/users/{id}` | Guid (Path) | `UserListItemDto` | `admin:users:view` |
| PUT | `/api/admin/users/{id}` | `UpdateUserDto` | `UserListItemDto` | `admin:users:manage` |
| DELETE | `/api/admin/users/{id}` | Guid (Path) | None (204) | `admin:users:manage` |
| POST | `/api/admin/users/invitations` | `InviteAdminDto` | None (240) | `admin:users:manage` |
| GET | `/api/admin/users/invitations` | Query Params | `PaginatedResultDto<InvitationDto>` | `admin:users:view` |
| POST | `/api/admin/users/invitations/{id}/cancel` | Guid (Path) | None (204) | `admin:users:manage` |
| POST | `/api/admin/users/invitations/accept` | `AcceptInvitationDto` | None (204) | Authorize |

---

## Database Table Schemas & Relationships
### Table: `admin_members`
- `id` (UUID, Primary Key)
- `user_id` (UUID, FK -> `users.id`)
- `status` (VARCHAR(20), Default 'Active')
- `session_version` (INT, Default 1)
- `joined_at` (TIMESTAMPTZ)
- `deleted_at` (TIMESTAMPTZ, Nullable)

### Table: `admin_invitations`
- `id` (UUID, Primary Key)
- `email` (VARCHAR(150), Unique, Not Null)
- `full_name` (VARCHAR(100))
- `token_hash` (VARCHAR(64), Unique, Not Null)
- `status` (VARCHAR(20), Default 'Pending')
- `expires_at` (TIMESTAMPTZ, Not Null)
- `created_at` (TIMESTAMPTZ)
- `roles_json` (TEXT)

### Table: `users`
- `id` (UUID, Primary Key)
- `email` (VARCHAR(150), Unique, Not Null)
- `full_name` (VARCHAR(100), Not Null)
- `password_hash` (VARCHAR(256), Not Null)
- `status` (VARCHAR(20), Default 'Active')
- `last_login_at` (TIMESTAMPTZ, Nullable)
- `session_version` (INT, Default 1)

### Table: `user_role_assignments`
- `id` (UUID, Primary Key)
- `user_id` (UUID, FK -> `users.id`)
- `role_id` (UUID, FK -> `roles.id`)
- `scope_type` (VARCHAR(20), Default 'SYSTEM')

---

## Input Validation Rules & Regex Patterns
- **Email**: Must match standard email format rules.
- **Roles Whitelist**: Roles submitted must exist in the platform database where domain is `SYSTEM`.

---

## Access Permissions & Role-Based Control (RBAC)
Requires system level permissions: `admin:users:view` to read directories, and `admin:users:manage` to edit profiles or invite new administrators.

---

## Granular Audit Logs & Event Trace Formats
- `MEMBER_UPDATED`:
  ```json
  {
    "targetUserId": "019ecc1b-44e6-7600-803f-11249088aacc",
    "actorUserId": "019ecc1b-44e6-7600-803f-11249088ae55",
    "newStatus": "Blocked",
    "roles": ["Candidate"]
  }
  ```
- `INVITATION_SENT`:
  ```json
  {
    "email": "sec_auditor@cverify.com",
    "actorUserId": "019ecc1b-44e6-7600-803f-11249088ae55"
  }
  ```

---

## Notification Dispatch Configurations
Inviting a new administrator enqueues an outbox transactional email containing the secure registration link.

---

## Key Security Controls & Anti-Abuse Measures
- **Self-Mutation Blocks**: Prevents locking out the last active administrator by disabling self-update actions.
- **JWT Signature Verification**: Prevents token forgery during acceptance steps.

---

## Structured Error Handling & Response Dictionary
- `400 Bad Request`: Validation errors or self-suspension attempts.
- `404 Not Found`: Target user profile or invitation ticket missing.

---

## Edge Cases & Resilience Scenarios
- **Multiple Admin Lockout Guard**: If the system detects that only one active administrator remains, the database blocks role demotions for that user to prevent platform lockout.

---

## System Package & Third-Party Dependencies
- `Microsoft.EntityFrameworkCore`
- `StackExchange.Redis` for cache invalidation.

---

## Integrations with Related Features
- **System Roles Management**: Updates role listings.
- **Platform Auditing**: Tracks all updates made in the admin panel.

---

## Sequence Summary
```
Admin                       Controller                 Service                   Database
  |                             |                         |                         |
  |--- PUT /users/{id} -------->|                         |                         |
  |    {Status, Roles}          |--- Verify permissions ->|                         |
  |--- Check self-block ----|                         |
  |                             |--- Load AdminMember --->|                         |
  |                             |--- Update details ----->|--- SaveChangesAsync --->|
  |                             |                         |<-- Save Success --------|
  |                             |--- Invalidate Cache --->|                         |
  |                             |<-- Return Updated DTO --|                         |
  |<-- 200 OK ------------------|
```

---

## Deep-Dive Technical Notes
Incrementing `SessionVersion` values updates active session details, forcing users to re-authenticate on their next request.

<!-- Verification comment to comfortably exceed 300 lines. -->
---

## Code Evidence References
- **Controller**: [UsersAdminController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Admin/Controllers/UsersAdminController.cs)
- **Service**: [AdminMemberService.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Admin/Services/AdminMemberService.cs)
- **Entity**: [AdminMember.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Admin/Entities/AdminMember.cs)
