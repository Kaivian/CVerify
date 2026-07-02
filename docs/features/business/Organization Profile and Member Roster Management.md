# Organization Profile & Member Roster Management

## Module
Auth Module (CVerify.API.Modules.Auth)

## Primary Role
Business / Recruiter (Mapped to system 'ORGANIZATION' / 'BUSINESS' actor claim)

## Purpose
This feature governs the lifecycle, profile customization, and workplace configuration of business organizations on the CVerify platform. It also implements the membership roster system, managing how business accounts invite colleagues, allocate administrative roles, modify permissions, audit workspace details, and search/filter members.

---

## Detailed Module & File-level Architectural Mapping
- **Controllers**:
  - `OrganizationController.cs` in `CVerify.API.Modules.Auth.Controllers`
  - `MemberController.cs` in `CVerify.API.Modules.Auth.Controllers`
  - `WorkspaceController.cs` in `CVerify.API.Modules.Auth.Controllers`
- **Services**:
  - `OrganizationService.cs` in `CVerify.API.Modules.Auth.Services`
  - `MemberService.cs` in `CVerify.API.Modules.Auth.Services`
  - `OrganizationAuthorizationService.cs` in `CVerify.API.Modules.Auth.Services`
- **Entities**:
  - `Organization.cs` in `CVerify.API.Modules.Shared.Domain.Entities`
  - `OrganizationMembership.cs` in `CVerify.API.Modules.Shared.Domain.Entities`
  - `Workspace.cs` in `CVerify.API.Modules.Shared.Domain.Entities`
- **DTOs**:
  - `LinkedOrganizationDto.cs` in `CVerify.API.Modules.Auth.DTOs`
    - Fields: `string Name`, `string Username`
  - `PaginatedOrganizationsResponseDto.cs` in `CVerify.API.Modules.Auth.DTOs`
    - Fields: `List<OrganizationDto> Items`, `int TotalCount`, `int Page`, `int PageSize`
  - `UpdateOrganizationRequest.cs` in `CVerify.API.Modules.Auth.DTOs`
    - Fields: `string Name`, `string Description`, `string Industry`, `string OrganizationSize`, `string Location`, `string WebsiteUrl`, `string TaxCode`, `int Version`
  - `OrganizationMemberResponseDto.cs` in `CVerify.API.Modules.Auth.DTOs`
    - Fields: `Guid MembershipId`, `Guid UserId`, `string Email`, `string Username`, `string FullName`, `string Role`, `string Status`, `DateTimeOffset JoinedAt`

---

## Purpose & Context
In CVerify, recruitment and candidate vetting are performed within the context of an **Organization**. An organization is a corporate entity that owns jobs, manages subscription levels, and contains multiple recruiter accounts (members). The Organization Profile and Member Roster Management feature allows companies to establish their digital identities (such as brand logo, descriptions, domains, and locations) and populate their workplace with users, assigning specific roles like Owner, Admin, and Recruiter to manage permissions.

---

## Business Value & ROI Matrix
- **Identity Integrity**: Establishes verified company profiles (status: active/verified) linked to business tax registers, preventing fraudulent recruiter signups.
- **Roster Control**: Enables owners and administrators to add/remove recruiters dynamically, preventing ex-employees from accessing corporate candidate data.
- **Workplace Isolation**: Workspaces divide recruiter activities, protecting sensitive hiring pipelines.
- **Corporate Branding**: Promotes corporate visibility on public dashboards to attract high-quality candidates.
- **Audit Trails Compliance**: Ensures all changes made to memberships are tracked, fulfilling enterprise logging criteria.

---

## Complete User Stories & Scenarios

### Scenario 1: Organization Profile Update
```gherkin
Given a Business Owner is logged in with active JWT credentials
And holds the role "Owner" for the organization "Tech Corp"
When the Owner submits a PUT request to update the profile with:
  | Field            | Value                       |
  | Name             | Tech Corp Systems           |
  | Description      | Next-gen software systems.  |
  | TaxCode          | 1234567890                  |
  | Version          | 2                           |
Then the backend should verify that the profile version matches the database version
And update the organization details in the "organizations" table
And increment the organization Version count to 3
And return a 200 OK status code.
```

### Scenario 2: Evicting a Member
```gherkin
Given a Business Admin is logged in and manages the company roster
And the user "John Doe" is registered as a "Recruiter" in the organization
When the Admin submits a DELETE request to evict the recruiter "John Doe"
Then the backend should verify the Admin's authorization permission
And soft-delete the membership row in "organization_memberships" by stamping the "DeletedAt" column
And return a 204 No Content response status.
```

### Scenario 3: Attempting Owner Eviction
```gherkin
Given a Business Admin is logged in
And the target member holds the role "Owner"
When the Admin submits a DELETE request to evict the Owner
Then the backend should check role hierarchies
And block the eviction request
And throw a BusinessRuleException
And return a 400 Bad Request response with the error code "OWNER_EVICTION_BLOCKED".
```

---

## System Actors & Telemetry Mappings
- **Primary Actors**:
  - **Business Owner**: Complete management of profile, workspace, billing, and membership role setting.
  - **Business Admin**: Manage profile details, add recruiters, view membership histories.
  - **Business Recruiter**: View jobs, list candidates, check suitability match scores.
- **Secondary Actors**:
  - **Anonymous Visitors**: Browse public directory and query company listings.
  - **Cloudflare R2 Storage**: Receives uploaded binary images and returns ObjectKeys.

---

## Functional Preconditions & Environmental Constraints
1. The user must be authenticated, yielding a claims principal containing `ClaimTypes.NameIdentifier` and `actor_type == "business"`.
2. Changes to memberships must run within an isolation level transaction to prevent dirty reads.
3. R2 storage bucket configurations must be whitelisted.

---

## Trigger Event Details
An organization administrator navigates to the Settings panel of the web dashboard, alters text configurations, uploads a brand image logo, or updates the role of a recruiter in the member roster table.

---

## Exhaustive Main Execution Flow
1. **Request Ingestion**: The API controller receives a `PUT /api/organizations/{orgId}` request containing updated DTO attributes.
2. **Authorization Gate**: The system invokes `IOrganizationAuthorizationService.AuthorizeAsync(User, orgId, "org:profile:update")`.
3. **Database Fetch**: Queries the EF Core DB context for `context.Organizations.Include(o => o.Members)`.
4. **Optimistic Locking Guard**: Checks if `dbOrg.Version != request.Version`. If they differ, throws `ProfileConcurrencyConflict` and aborts.
5. **Brand Logo Processing**:
   - If `IFormFile` is present, uploads the logo stream to Cloudflare R2 bucket.
   - Updates `dbOrg.LogoUrl` with the unique ObjectKey path.
6. **Property Mutation**: Applies changes to `dbOrg.Name`, `dbOrg.Description`, `dbOrg.Location`, `dbOrg.TaxCode`.
7. **Version Increment**: Increments `dbOrg.Version` by 1.
8. **Save Changes**: Commits changes to PostgreSQL database via `SaveChangesAsync()`.
9. **Roster Status Invalidation**: Clears cache in Redis for keys prefixed with `user:permissions:{userId}`.
10. **JSON Response**: Returns the updated organization object details.

---

## Alternative Execution Flows
### Alternative Flow 1: Public Directory Search
1. **Search Request**: Visitor queries GET `/api/organizations?search=tech&industry=software&page=1&pageSize=12`.
2. **Filters Building**: System maps filters to EF Core Linq queries where `o.DeletedAt == null` and status is `active`.
3. **Pagination Calculation**: Applies `.Skip((page-1)*pageSize).Take(pageSize)`.
4. **JSON Mapping**: Maps target rows to DTO list, returning count metadata.

### Alternative Flow 2: Organization Workspace Initialization
1. **Workspace Trigger**: Owner sets up a new workplace folder (POST `/api/organizations/{orgId}/workspaces`).
2. **Initialization**: Service creates a default workspace, setting coordinates and access rights.

---

## Exception and Failure Scenarios
- **Duplicate Tax Code**:
  - *Trigger*: Saving a tax code already claimed by another organization.
  - *Result*: Throws `DuplicateTaxCodeException` returning:
    ```json
    {
      "code": "DUPLICATE_TAX_CODE",
      "message": "The tax code is already registered by another organization."
    }
    ```
- **Owner Eviction**:
  - *Result*: Returns `400 Bad Request` with code `OWNER_EVICTION_FAILED`.
- **Invalid Concurrency State**:
  - *Result*: Returns `409 Conflict` with code `CONCURRENCY_ERROR`.

---

## Rigorous Business Rules & Data Constraints
- **Hierarchy constraint**: Admins cannot demote or remove Owners.
- **Relocation of Ownership**: Organizations must hold at least one active Owner membership.
- **Tax code uniqueness**: Tax codes must be unique across all non-deleted companies.

---

## UI Pages, Components & Layout States
- **HR Settings Page**:
  - Renders membership tables, search query inputs, and role select indicators.
- **Profile Edit Canvas**:
  - Textarea description limits, file selector buttons, and saving status states.

---

## Detailed Backend API Routing Registry
| Method | Path | Input DTO | Response DTO | Permission |
|---|---|---|---|---|
| GET | `/api/organizations/my-organizations` | None | `List<LinkedOrganizationDto>` | Authorize |
| GET | `/api/organizations` | Query Params | `PaginatedOrganizationsResponseDto` | AllowAnonymous |
| GET | `/api/organizations/{orgId}` | None | `OrganizationDto` | AllowAnonymous |
| PUT | `/api/organizations/{orgId}` | `UpdateOrganizationRequest` | `OrganizationDto` | Owner / Admin |
| GET | `/api/organizations/{orgId}/members` | Query Params | `PaginatedMembersDto` | Authorize |
| PUT | `/api/organizations/{orgId}/members/{memberId}/role` | `UpdateMemberRoleRequest` | `MemberDto` | Owner / Admin |
| DELETE | `/api/organizations/{orgId}/members/{memberId}` | None | None (204) | Owner / Admin |

---

## Database Table Schemas & Relationships
### Table: `organizations`
- `id` (UUID, Primary Key)
- `name` (VARCHAR(100), Not Null)
- `description` (TEXT, Nullable)
- `tax_code` (VARCHAR(30), Unique, Not Null)
- `logo_url` (VARCHAR(255), Nullable)
- `version` (INT, Default 1)
- `status` (VARCHAR(20), Default 'active')
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)
- `deleted_at` (TIMESTAMPTZ, Nullable)
- **Indices**:
  - `idx_organizations_tax_code` (Unique on `tax_code` where `deleted_at IS NULL`)

### Table: `organization_memberships`
- `id` (UUID, Primary Key)
- `organization_id` (UUID, Foreign Key -> `organizations.id`)
- `user_id` (UUID, Foreign Key -> `users.id`)
- `role` (VARCHAR(20), Not Null)
- `status` (VARCHAR(20), Default 'active')
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)
- `deleted_at` (TIMESTAMPTZ, Nullable)
- **Indices**:
  - `idx_org_members_composite` (Composite on `organization_id`, `user_id`)

---

## Input Validation Rules & Regex Patterns
- **Website URL**: `^(https?:\/\/)?(www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,6}(\/[a-zA-Z0-9-_]*)*$`
- **Tax Code**: Must consist of 10 or 13 digits.
- **Name**: Must be between 2 and 100 characters.

---

## Access Permissions & Role-Based Control (RBAC)
Updates to profile structures demand `Owner` or `Admin` roles. Modifications to membership role arrays are limited to `Owner` roles only.

---

## Granular Audit Logs & Event Trace Formats
- `ORGANIZATION_PROFILE_UPDATED`:
  ```json
  {
    "orgId": "019ecc1b-44e6-7600-803f-11249088ae92",
    "actorUserId": "019ecc1b-44e6-7600-803f-11249088ae55",
    "changes": {
      "Name": ["Tech Corp", "Tech Corp Systems"]
    }
  }
  ```
- `MEMBER_EVICTED`:
  ```json
  {
    "orgId": "019ecc1b-44e6-7600-803f-11249088ae92",
    "evictedUserId": "019ecc1b-44e6-7600-803f-11249088aeee",
    "actorUserId": "019ecc1b-44e6-7600-803f-11249088ae55"
  }
  ```

---

## Notification Dispatch Configurations
Evicting a member triggers an outbox notification event, generating an `EvictionEmailAlert` sent to the user.

---

## Key Security Controls & Anti-Abuse Measures
- **Cross-Org Guard**: Verifies member IDs match target organization claims to prevent multi-tenant data leaks.
- **R2 CDN signed tokens**: Limits exposure of logo assets using secure credentials.

---

## Structured Error Handling & Response Dictionary
- `400 Bad Request`: Validation failures or hierarchy blocks.
- `409 Conflict`: Concurrency version mismatch or duplicate tax codes.

---

## Edge Cases & Resilience Scenarios
- **Multiple Membership Contexts**: If a user belongs to multiple organizations, token contexts switch claims parameters dynamically.

---

## System Package & Third-Party Dependencies
- `Microsoft.EntityFrameworkCore.PostgreSQL`
- `AWSSDK.S3` for Cloudflare R2 integrations.

---

## Integrations with Related Features
Candidate Authentication, Job Postings, Recruiter Invitations.

---

## Sequence Diagram Summary
```
Client                      Controller                 Service                   Database
  |                             |                         |                         |
  |--- PUT /organizations ----->|                         |                         |
  |    {Version, DTO}           |--- Authorize org ------>|                         |
  |                             |                         |--- Load organization -->|
  |                             |<-- Success -------------|<-- Organization entity -|
  |                             |--- Compare Version ---->|                         |
  |                             |--- Save details ------->|--- SaveChangesAsync --->|
  |                             |                         |<-- Commit Success ------|
  |                             |<-- Return DTO ----------|                         |
  |<-- 200 OK (updated) --------|
```

---

## Deep-Dive Technical Notes
EF Core tracking tracks fields, preventing blank column updates and maintaining version history integrity.

---

## Code Evidence References
- **Controller**: [OrganizationController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Auth/Controllers/OrganizationController.cs)
- **Service**: [OrganizationService.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Auth/Services/OrganizationService.cs)
- **Entity**: [Organization.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Shared/Domain/Entities/Organization.cs)
