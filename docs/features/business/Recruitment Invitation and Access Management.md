# Recruitment Invitation & Access Management

## Module
Auth Module (CVerify.API.Modules.Auth)

## Primary Role
Business / Recruiter (Mapped to system 'ORGANIZATION' / 'BUSINESS' actor claim)

## Purpose
This feature handles the recruitment and member onboarding loops by managing invitations. It allows organization owners and administrators to send invitations, specify roles (Admin, Recruiter), track statuses (Pending, Accepted, Declined, Cancelled, Expired), resend invitation emails, revoke open invitations, and process candidate acceptance/declination actions via secure cryptographical token links.

---

## Detailed Module & File-level Architectural Mapping
- **Controllers**:
  - `InvitationController.cs` in `CVerify.API.Modules.Auth.Controllers`
- **Services**:
  - `InvitationService.cs` in `CVerify.API.Modules.Auth.Services`
  - `OrganizationAuthorizationService.cs` in `CVerify.API.Modules.Auth.Services`
- **Entities**:
  - `OrganizationInvitation.cs` in `CVerify.API.Modules.Shared.Domain.Entities`
  - `OrganizationMembership.cs` in `CVerify.API.Modules.Shared.Domain.Entities`
- **DTOs**:
  - `CreateInvitationsDto.cs` in `CVerify.API.Modules.Auth.DTOs`
    - Fields: `List<string> Emails`, `string Role`
  - `PaginatedInvitationsResponseDto.cs` in `CVerify.API.Modules.Auth.DTOs`
    - Fields: `List<InvitationDetailsDto> Items`, `int TotalCount`, `int Page`, `int PageSize`
  - `AcceptInvitationDto.cs` in `CVerify.API.Modules.Auth.DTOs`
    - Fields: `string Token`
  - `DeclineInvitationDto.cs` in `CVerify.API.Modules.Auth.DTOs`
    - Fields: `string Token`
  - `InvitationDetailsDto.cs` in `CVerify.API.Modules.Auth.DTOs`
    - Fields: `Guid Id`, `string Email`, `string Role`, `string Status`, `DateTimeOffset ExpiresAt`, `DateTimeOffset CreatedAt`

---

## Purpose & Context
Organizations recruit talent and onboarding HR members using a secure invitation process. Instead of creating accounts manually, administrators trigger invitations. The system issues hashed tokens, enqueuing SMTP delivery. When a candidate clicks the link, they verify their email ownership, accept the role, and automatically bind to the organization roster with the pre-configured role settings.

---

## Business Value & ROI Matrix
- **Identity Assurance**: Onboards users using verification links, blocking unauthorized access.
- **Role Scoping**: Ensures invited team members receive pre-configured permissions (Recruiter or Admin), preventing administrative credential leaks.
- **Workflow Isolation**: Revocation controls enable administrators to cancel pending invitations, mitigating rogue onboarding attempts.
- **Audit Trails**: Logs all stages (sent, accepted, declined, cancelled) for compliance reports.
- **Reliable Email Dispatch**: Integrates outbox message sweeps to guarantee emails are delivered even under network failure.

---

## Complete User Stories & Scenarios

### Scenario 1: Sending Invitations
```gherkin
Given a Business Admin is logged in with active JWT credentials
And holds the permission "organization:members:manage" for the organization "TechCorp"
When the Admin submits a POST request to `/api/organizations/techcorp/invitations` with:
  | Emails | ["recruiter1@gmail.com", "recruiter2@gmail.com"] |
  | Role   | Recruiter                                        |
Then the system should verify that the email addresses are not already members
And generate a unique cryptographically secure Token for each email
And insert "OrganizationInvitation" rows under the status "Pending"
And hash the tokens using SHA-256 before database insertion
And enqueue confirmation invitation emails via the transactional outbox messages table
And return a 204 No Content response.
```

### Scenario 2: Accepting Invitation via Token Link
```gherkin
Given an invited candidate receives a confirmation email containing a verification token
And is logged in as a registered user on CVerify
When the candidate submits a POST request to `/api/invitations/accept` with the token parameters
Then the backend should hash the token using SHA-256
And look up the matching invitation row in the database
And verify the invitation status is "Pending" and has not expired (within 72 hours)
And create an active "OrganizationMembership" record linking the candidate's User ID to the Organization
And update the invitation status to "Accepted"
And clear permission caches in Redis
And return a 200 OK response returning the organization slug context.
```

### Scenario 3: Cancelling a Pending Invitation
```gherkin
Given a Business Admin is logged in
And holds the permission "organization:members:manage" for "TechCorp"
And a pending invitation with ID "019ecc1b-44e6-7600-803f-11249088aaff" exists
When the Admin submits a POST request to cancel the invitation
Then the backend should locate the invitation row
And update its status column to "Cancelled"
And return a 204 No Content response.
```

---

## System Actors & Telemetry Mappings
- **Primary Actors**:
  - **Inviter**: Business Owner or Administrator.
  - **Invitee**: Candidate User or Recruiter User.
- **Secondary Actors**:
  - **SMTP Outbox Processor**: Sends transactional emails.
  - **Redis Cache Engine**: Clears security mappings.
  - **Audit Logger**: Captures system state changes.

---

## Functional Preconditions & Environmental Constraints
1. The inviting user must possess the `organization:members:manage` permission.
2. The invitee's email must be syntactically valid.
3. System clocks must be synchronized to ensure accurate token expiration (72-hour lifespan).

---

## Trigger Event Details
An administrator navigates to the 'Invite Team' panel, inputs target email addresses, selects the target role, and triggers the invitations dispatch, or an invitee clicks the verification link in their email.

---

## Exhaustive Main Execution Flow
1. **Request Ingestion**: Backend receives POST `/api/organizations/{orgSlug}/invitations`.
2. **Authorization Gate**: Validates actor holds `organization:members:manage` permission.
3. **Email Deduplication**: Checks if any input email has an active membership. If yes, filters it.
4. **Token Generation**:
   - Generates a cryptographically secure random token.
   - Hashes the token using SHA-256.
5. **Database Entry**: Inserts rows into `organization_invitations` storing hashed tokens, target emails, target roles, expiration times (72 hours), and status `Pending`.
6. **Outbox Message Enqueuing**: Creates transactional outbox email queue rows.
7. **Commit Transaction**: Saves database changes and clears caches.
8. **Client Redirect**: Invitee clicks link, sending token to POST `/api/invitations/accept`.
9. **Verification**: Backend hashes the incoming token, checks matching records, asserts status is `Pending`, and ensures expiration date is in the future.
10. **Activation**: Inserts an active `OrganizationMembership` row, marks the invitation status as `Accepted`, and clears Redis cache maps.

---

## Alternative Execution Flows
### Alternative Flow 1: Resending an Invitation
1. **Resend Request**: Admin POSTs to `/invitations/{id}/resend`.
2. **Refresh Expiry**: Service refreshes the expiration timestamp (adds 72 hours), enqueues a new outbox email message, and commits.

### Alternative Flow 2: Declining an Invitation
1. **Decline Request**: Invitee POSTs to `/invitations/decline` with token parameters.
2. **Status Update**: System updates invitation status to `Declined` and commits changes.

---

## Exception and Failure Scenarios
- **Expired Token Attempt**:
  - *Trigger*: Invitee clicks accept link 5 days after issuance.
  - *Result*: Returns `400 Bad Request` with message `Invitation has expired.`
- **Invalid Token Attempt**:
  - *Result*: Returns `400 Bad Request` with message `Invalid invitation token.`
- **Already Registered Email Block**:
  - *Result*: Returns `400 Bad Request` with message `User is already a member of this organization.`
- **Database Lock Timeout**:
  - *Result*: Re-tries transition, or aborts returning a `500 Internal Server Error`.

---

## Rigorous Business Rules & Data Constraints
- **Expiration Interval**: Invitations are valid for exactly 72 hours from generation.
- **Allowed Roles**: Scoped roles restricted to `Admin` and `Recruiter`.
- **Hashed Storage**: Plaintext tokens must never be written to persistent database columns.

---

## UI Components & Layout States
- **HR Invitation Grid**:
  - Displays pending invite tables, emails, expiration trackers, and resend/cancel controls.
- **Invitation Acceptance Page**:
  - Displays greeting canvas ("You have been invited to join TechCorp"), role indicators, and Accept/Decline action buttons.
- **Status Indicator Badges**:
  - Colored indicator bubbles showing Pending (Yellow), Accepted (Green), Declined (Red), or Cancelled (Gray) statuses.

---

## Detailed Backend API Routing Registry
| Method | Path | Input DTO | Response DTO | Permission |
|---|---|---|---|---|
| POST | `/api/organizations/{orgSlug}/invitations` | `CreateInvitationsDto` | None (240) | `organization:members:manage` |
| GET | `/api/organizations/{orgSlug}/invitations` | Query Params | `PaginatedInvitations` | `organization:members:view` |
| POST | `/api/organizations/{orgSlug}/invitations/{id}/resend` | None | None (240) | `organization:members:manage` |
| POST | `/api/organizations/{orgSlug}/invitations/{id}/cancel` | None | None (240) | `organization:members:manage` |
| POST | `/api/invitations/accept` | `AcceptInvitationDto` | `{ orgSlug }` | Authorize |
| POST | `/api/invitations/decline` | `DeclineInvitationDto` | `{ orgSlug }` | Authorize |
| POST | `/api/invitations/{id:guid}/accept` | None | `{ orgSlug }` | Authorize |
| POST | `/api/invitations/{id:guid}/decline` | None | `{ orgSlug }` | Authorize |

---

## Database Table Schemas & Relationships
### Table: `organization_invitations`
- `id` (UUID, Primary Key)
- `organization_id` (UUID, FK -> `organizations.id`)
- `email` (VARCHAR(150), Not Null)
- `role` (VARCHAR(20), Not Null)
- `token_hash` (VARCHAR(64), Unique, Not Null)
- `status` (VARCHAR(20), Default 'Pending')
- `expires_at` (TIMESTAMPTZ, Not Null)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)
- `invited_by_user_id` (UUID, FK -> `users.id`, Nullable)
- **Indices**:
  - `idx_invitations_token_hash` (Unique index on `token_hash`)
  - `idx_invitations_org_email` (Composite index on `organization_id`, `email`)

### Table: `organization_memberships`
- `id` (UUID, Primary Key)
- `organization_id` (UUID, FK -> `organizations.id`)
- `user_id` (UUID, FK -> `users.id`)
- `role` (VARCHAR(20), Not Null)
- `status` (VARCHAR(20), Default 'active')
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)
- `deleted_at` (TIMESTAMPTZ, Nullable)

---

## Input Validation Rules & Regex Patterns
- **Email**: Must pass standard email syntax validation format rules.
- **Status Value**: Must match one of: `Pending`, `Accepted`, `Declined`, `Cancelled`, `Expired`.

---

## Access Permissions & Role-Based Control (RBAC)
Requires explicit permission scopes. Creating invitations and cancelling them require the `organization:members:manage` permission. Viewing invitation lists requires the `organization:members:view` permission.

---

## Granular Audit Logs & Event Trace Formats
- `INVITATION_SENT`:
  ```json
  {
    "orgId": "019ecc1b-44e6-7600-803f-11249088ae92",
    "inviteeEmail": "hiring@agency.com",
    "role": "Recruiter",
    "actorUserId": "019ecc1b-44e6-7600-803f-11249088ae55"
  }
  ```
- `INVITATION_ACCEPTED`:
  ```json
  {
    "orgId": "019ecc1b-44e6-7600-803f-11249088ae92",
    "invitationId": "019ecc1b-44e6-7600-803f-11249088aacc",
    "userId": "019ecc1b-44e6-7600-803f-11249088aa99"
  }
  ```

---

## Notification Dispatch Configurations
Onboarding events trigger notifications sent to the invitee via the outbox engine.

---

## Key Security Controls & Anti-Abuse Measures
- **SHA-256 Token Protection**: Prevents database leaks from exposing active access tokens.
- **Whitelisted Roles**: Prevents invitees from modifying payload parameters to assign themselves unauthorized roles.

---

## Structured Error Handling & Response Dictionary
- `400 Bad Request`: Expired tokens or invalid signatures.
- `404 Not Found`: Organization or invitation record not found.

---

## Edge Cases & Resilience Scenarios
- **Resending Revokes Active Token**: Resending an invitation invalidates the old token, ensuring only the new link can be used to accept the invite.

---

## System Package & Third-Party Dependencies
- `Microsoft.EntityFrameworkCore`
- `Cryptography.SHA256`

---

## Integrations with Related Features
Organization Profile, Custom Roles, Job Vacancies.

---

## Sequence Summary
```
Inviter                     Controller                 Service                   Database
  |                             |                         |                         |
  |--- POST /invitations ------>|                         |                         |
  |    {Email, Role}            |--- Authorize action --->|                         |
  |                             |                         |--- Check duplicate ---->|
  |                             |                         |--- Generate Token ----->|
  |                             |                         |--- Save invitation ---->|
  |                             |                         |--- Enqueue email outbox>|
  |                             |                         |<-- Save Success --------|
  |                             |<-- Return 240 ----------|                         |
  |<-- 240 No Content ----------|
```

---

## Deep-Dive Technical Notes
Hashing tokens using SHA-256 ensures that even if database tables are compromised, attacker cannot use the stored credentials to gain access without computing raw keys.

---

## Code Evidence References
- **Controller**: [InvitationController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Auth/Controllers/InvitationController.cs)
- **Service**: [InvitationService.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Auth/Services/InvitationService.cs)
- **Entity**: [OrganizationInvitation.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Shared/Domain/Entities/OrganizationInvitation.cs)
