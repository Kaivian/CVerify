# Organization Roles & Permission Customization

## Module
Auth Module (CVerify.API.Modules.Auth)

## Primary Role
Business / Recruiter (Mapped to system 'ORGANIZATION' / 'BUSINESS' actor claim)

## Purpose
This feature enables business organizations to define custom roles, assign fine-grained permissions to those roles, and audit assignments. It provides organizational role-based access control (RBAC), mapping permissions like `organization:roles:view`, `organization:roles:manage`, `organization:members:manage`, and `organization:audit:view`.

---

## Detailed Module & File-level Architectural Mapping
- **Controllers**:
  - `OrganizationRoleController.cs` in `CVerify.API.Modules.Auth.Controllers`
  - `BusinessRoleController.cs` (Obsolete legacy proxy wrapper)
- **Services**:
  - `OrganizationRoleService.cs` in `CVerify.API.Modules.Auth.Services`
  - `OrganizationAuthorizationService.cs` in `CVerify.API.Modules.Auth.Services`
- **Entities**:
  - `OrganizationRole.cs` in `CVerify.API.Modules.Shared.Domain.Entities`
  - `OrganizationRolePermission.cs` in `CVerify.API.Modules.Shared.Domain.Entities`
  - `UserOrganizationRoleAssignment.cs` in `CVerify.API.Modules.Shared.Domain.Entities`
- **DTOs**:
  - `CreateOrganizationRoleDto.cs` in `CVerify.API.Modules.Auth.DTOs`
    - Fields: `string Name`, `string Description`, `List<string> PermissionIds`
  - `OrganizationRoleDetailsDto.cs` in `CVerify.API.Modules.Auth.DTOs`
    - Fields: `Guid Id`, `string Name`, `string Description`, `List<string> Permissions`
  - `AssignScopedRoleDto.cs` in `CVerify.API.Modules.Auth.DTOs`
    - Fields: `Guid UserId`, `Guid RoleId`
  - `RoleAssignmentDto.cs` in `CVerify.API.Modules.Auth.DTOs`
    - Fields: `Guid UserId`, `string Email`, `string FullName`, `Guid RoleId`, `string RoleName`

---

## Purpose & Context
As organizations scale, standard roles (Owner, Admin, Recruiter) become insufficient. Large enterprises require custom roles (such as "Junior Recruiter", "Auditor", or "Job Manager") with restricted capability scopes. This feature allows administrators to customize access rights, limiting a user's access to billing settings, forum moderation, candidate profiles, or job vacancies editing.

---

## Business Value & ROI Matrix
- **Least Privilege Enforcement**: Limits recruiters to their specific tasks (e.g., viewing candidates but not posting jobs), mitigating insider threats.
- **Regulatory Compliance**: Provides detailed organization-level audit logs to track role updates.
- **Operational Scalability**: Streamlines onboarding of external agency recruiters by assigning them pre-configured roles.
- **Tamper Protection**: Restricts modification of system default roles (Owner) to prevent lockouts.
- **Improved Security Auditing**: Offers administrators clear trace pathways for tracking permission changes across time.

---

## Complete User Stories & Scenarios

### Scenario 1: Creating a Custom Role
```gherkin
Given a Business Admin is logged in with active JWT credentials
And holds the permission "organization:roles:manage" for the organization "DevCorp"
When the Admin submits a POST request to `/api/organizations/devcorp/roles` with:
  | Name         | Lead Interviewer                       |
  | Description  | Responsible for screening candidates. |
  | Permissions  | ["candidate:view", "candidate:assess"] |
Then the system should check for naming conflicts within the organization
And create a new "OrganizationRole" record in the database
And map "candidate:view" and "candidate:assess" permissions to the role
And return a 201 Created status response with the new role ID.
```

### Scenario 2: Assigning a Scoped Role to a Colleague
```gherkin
Given a Business Admin is logged in
And holds the permission "organization:members:manage" for the organization "DevCorp"
And the colleague "Jane Doe" is a member of the organization
When the Admin submits a POST request to `/api/organizations/devcorp/roles/assign` with:
  | UserId | <Jane-Doe-UUID>                        |
  | RoleId | <Lead-Interviewer-Role-UUID>           |
Then the system should verify the colleague is active on the roster
And insert an assignment record in "user_organization_role_assignments"
And invalidate Jane Doe's cached authorization token claims in Redis
And return a 204 No Content response status.
```

### Scenario 3: Revoking a Scoped Role
```gherkin
Given a Business Admin is logged in
And Jane Doe holds the "Lead Interviewer" role
When the Admin submits a POST request to `/api/organizations/devcorp/roles/revoke` with:
  | UserId | <Jane-Doe-UUID>                        |
  | RoleId | <Lead-Interviewer-Role-UUID>           |
Then the system should delete the assignment record from the database
And invalidate Jane Doe's active session permissions cache in Redis
And return a 204 No Content status.
```

---

## System Actors & Telemetry Mappings
- **Primary Actors**:
  - **Business Owner**: Full configuration of role allocations and default settings.
  - **Business Admin**: Create, edit, assign, or delete custom roles.
  - **Colleagues (Recruiters)**: Access specific workspaces based on assigned roles.
- **Secondary Actors**:
  - **Redis Cache Engine**: Caches user-permission maps.
  - **Identity State Cache Resolver**: Interacts with database configurations to invalidate permission mappings.

---

## Functional Preconditions & Environmental Constraints
1. The organization slug must exist and resolve to an active organization record.
2. The user initiating the role change must hold active permissions (`organization:roles:manage` or `organization:members:manage`).
3. Redis must be online to update and invalidate permission caches.

---

## Trigger Event Details
An administrator navigates to the 'Roles & Permissions' panel in settings, enters a title for a new role, selects a list of checkboxes for permissions, and clicks 'Save Role' or assigns a role to a member.

---

## Exhaustive Main Execution Flow
1. **Request Ingestion**: Backend intercepts `/api/organizations/{orgSlug}/roles` request.
2. **Organization Resolution**: Resolves `orgSlug` to `orgId` via `context.Organizations` queries.
3. **Authorization Evaluation**: Validates actor holds `organization:roles:manage` permissions.
4. **Role Validation check**: System checks if the role name is already taken in the same organization scope.
5. **EF Tracking Initiation**: Registers a new `OrganizationRole` object.
6. **Permission Mapping**:
   - Loops through `PermissionIds` in the payload.
   - Verifies if the permissions exist in the global platform whitelist.
   - Inserts rows into the `organization_role_permissions` join table.
7. **Save Changes**: Commits data to the DB inside a transaction block.
8. **Cache Cleanup**: Generates a Redis cache invalidation event for affected users.
9. **Logging**: Saves audit details in `organization_audit_logs`.
10. **Return**: Outputs `201 Created` with the role ID.

---

## Alternative Execution Flows
### Alternative Flow 1: Audit Log Review
1. **Request Audit Logs**: Administrator queries GET `/api/organizations/{orgSlug}/roles/audit-logs`.
2. **Retrieve Logs**: Service retrieves logs, returning a paginated list of role updates.

### Alternative Flow 2: Available Permissions Fetch
1. **Request Permissions**: Client fetches GET `/api/organizations/{orgSlug}/roles/permissions` to display whitelisted permissions.

---

## Exception and Failure Scenarios
- **System Default Mutation Attempt**:
  - *Trigger*: Admin tries to delete the default "Owner" role.
  - *Result*: Throws `BusinessRuleException` (HTTP 400), blocking the delete.
- **Circular Role Assignment Block**:
  - *Trigger*: Assigning roles to a user who is not a member of the organization.
  - *Result*: Returns `404 Not Found` with message `Member not found`.
- **Permission Revocation Timeout**:
  - *Trigger*: Connection drops during Redis invalidation cache routines.
  - *Result*: System logs exception trace but falls back to database validation checks to prevent authorization bypasses.

---

## Rigorous Business Rules & Data Constraints
- **Role Uniqueness**: Custom role names must be unique within an organization.
- **System Roles Protection**: Owner and Admin roles cannot be deleted or renamed.
- **Maximum Permissions Limit**: Prevents adding more than 50 distinct permissions to a single role.

---

## UI Components & Layout States
- **Roles and Permissions Grid**:
  - Card layouts showing roles, descriptions, user counts, and edit controls.
- **Permission Checkbox list**:
  - Grouped lists showing permission descriptions and scopes.
- **Audit Table**:
  - Columns for Action, User, Role, and Timestamp.

---

## Detailed Backend API Routing Registry
| Method | Path | Input DTO | Response DTO | Permission |
|---|---|---|---|---|
| GET | `/api/organizations/{orgSlug}/roles` | None | `List<OrganizationRoleDetailsDto>` | `organization:roles:view` |
| POST | `/api/organizations/{orgSlug}/roles` | `CreateOrganizationRoleDto` | `Guid` (Role ID) | `organization:roles:manage` |
| PUT | `/api/organizations/{orgSlug}/roles/{roleId}` | `CreateOrganizationRoleDto` | None (204) | `organization:roles:manage` |
| DELETE | `/api/organizations/{orgSlug}/roles/{roleId}` | None | None (204) | `organization:roles:manage` |
| GET | `/api/organizations/{orgSlug}/roles/assignments` | None | `List<RoleAssignmentDto>` | `organization:members:view` |
| POST | `/api/organizations/{orgSlug}/roles/assign` | `AssignScopedRoleDto` | None (204) | `organization:members:manage` |
| POST | `/api/organizations/{orgSlug}/roles/revoke` | `AssignScopedRoleDto` | None (204) | `organization:members:manage` |
| GET | `/api/organizations/{orgSlug}/roles/audit-logs` | Page Params | `PaginatedAuditLogs` | `organization:audit:view` |
| GET | `/api/organizations/{orgSlug}/roles/permissions` | None | `List<PermissionDto>` | `organization:roles:view` |

---

## Database Table Schemas & Relationships
### Table: `organization_roles`
- `id` (UUID, Primary Key)
- `organization_id` (UUID, FK -> `organizations.id`)
- `name` (VARCHAR(50), Not Null)
- `description` (VARCHAR(250))
- `is_system` (BOOLEAN, Default False)
- `created_at` (TIMESTAMPTZ)
- `deleted_at` (TIMESTAMPTZ, Nullable)

### Table: `organization_role_permissions`
- `role_id` (UUID, FK -> `organization_roles.id`, Composite PK)
- `permission_id` (VARCHAR(50), Composite PK)

### Table: `user_organization_role_assignments`
- `id` (UUID, Primary Key)
- `organization_id` (UUID, FK -> `organizations.id`)
- `user_id` (UUID, FK -> `users.id`)
- `role_id` (UUID, FK -> `organization_roles.id`)

---

## Input Validation Rules & Regex Patterns
- **Role Name**: `^[a-zA-Z0-9\s_-]{3,50}$` (alphanumeric, spaces, hyphens, underscores).

---

## Access Permissions & Role-Based Control (RBAC)
Requires explicit permission claims: `organization:roles:manage` to create/edit roles, and `organization:members:manage` to assign or revoke roles from users.

---

## Granular Audit Logs & Event Trace Formats
- `ROLE_CREATED`:
  ```json
  {
    "orgId": "019ecc1b-44e6-7600-803f-11249088ae92",
    "roleName": "Junior HR Auditor",
    "permissions": ["candidate:view"],
    "actorUserId": "019ecc1b-44e6-7600-803f-11249088ae55"
  }
  ```
- `ROLE_ASSIGNED`:
  ```json
  {
    "orgId": "019ecc1b-44e6-7600-803f-11249088ae92",
    "roleId": "019ecc1b-44e6-7600-803f-11249088aaff",
    "targetUserId": "019ecc1b-44e6-7600-803f-11249088aedd",
    "actorUserId": "019ecc1b-44e6-7600-803f-11249088ae55"
  }
  ```

---

## Notification Dispatch Configurations
Assigning or revoking roles sends an in-app notification to the affected user dashboard.

---

## Key Security Controls & Anti-Abuse Measures
- **Redis Cache Invalidation**: Immediately revokes access to prevent a demoted user from exploiting active sessions.
- **Cross-Org Verification**: Checks slugs to ensure admins cannot modify roles in other organizations.

---

## Structured Error Handling & Response Dictionary
- `400 Bad Request`: Validation failures or system role mutation attempts.
- `403 Forbidden`: User lacks roles/permissions management access.

---

## Edge Cases & Resilience Scenarios
- **Redis Cache Failures**: If Redis is offline, system uses direct database queries as a fallback, ensuring security remains active at the cost of slight latency.

---

## System Package & Third-Party Dependencies
- `Microsoft.EntityFrameworkCore`
- `StackExchange.Redis`

---

## Integrations with Related Features
Organization Profile, Recruitment Invitations, Job Posting.

---

## Sequence Diagram Summary
```
Admin                       Controller                 Service                   Database
  |                             |                         |                         |
  |--- POST /roles/assign ----->|                         |                         |
  |    {UserId, RoleId}         |--- Authorize action --->|                         |
  |                             |                         |--- Verify member role ->|
  |                             |<-- Success -------------|<-- Assign role ---------|
  |                             |--- Commit changes ---->|--- SaveChangesAsync --->|
  |                             |                         |<-- Save Success --------|
  |                             |--- Clear Redis Cache ->|                         |
  |                             |<-- Return 204 ----------|                         |
  |<-- 240 No Content ----------|
```

---

## Deep-Dive Technical Notes
Invalidating Redis cache prefixes updates user claims instantly, ensuring permissions take effect without requiring a user logout.

---

## Code Evidence References
- **Controller**: [OrganizationRoleController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Auth/Controllers/OrganizationRoleController.cs)
- **Service**: [OrganizationRoleService.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Auth/Services/OrganizationRoleService.cs)
- **Entity**: [OrganizationRole.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Shared/Domain/Entities/OrganizationRole.cs)
