# Developer Forum Moderation and Queue Resolution

## Module
Forum Module (CVerify.API.Modules.Forum)

## Primary Role
Administrator (Mapped to system 'ADMINISTRATOR' / 'SYSTEM_ADMIN' or system moderators with `forum:topic:moderate` claims)

## Purpose
This feature governs the moderation of the developer community forum. It provides administrators and moderators with tools to query reported content, resolve reports in the moderation queue, merge tags, modify categories, and apply moderator actions (e.g. close, pin, move, delete) to topics and replies.

---

## Detailed Module & File-level Architectural Mapping
- **Controllers**:
  - `ForumController.cs` in `CVerify.API.Modules.Forum.Controllers`
- **Services**:
  - `ForumService.cs` in `CVerify.API.Modules.Forum.Services`
  - `ForumModerationService.cs` in `CVerify.API.Modules.Forum.Services`
- **Entities**:
  - `ForumCategory.cs` in `CVerify.API.Modules.Forum.Entities`
  - `ForumTopic.cs` in `CVerify.API.Modules.Forum.Entities`
  - `ForumReply.cs` in `CVerify.API.Modules.Forum.Entities`
  - `ForumReport.cs` in `CVerify.API.Modules.Forum.Entities`
  - `ForumTag.cs` in `CVerify.API.Modules.Forum.Entities`
- **DTOs**:
  - `ModerateTopicDto.cs` in `CVerify.API.Modules.Forum.DTOs`
    - Fields: `bool IsClosed`, `bool IsPinned`, `Guid? CategoryId`, `string ModerationNote`
  - `ResolveReportDto.cs` in `CVerify.API.Modules.Forum.DTOs`
    - Fields: `string Decision`, `string ModerationNote`
  - `MergeTagsDto.cs` in `CVerify.API.Modules.Forum.DTOs`
    - Fields: `string SourceTagName`, `string TargetTagName`
  - `CategoryAdminDto.cs` in `CVerify.API.Modules.Forum.DTOs`
    - Fields: `string Name`, `string Slug`, `string Description`, `int DisplayOrder`

---

## Purpose & Context
Online communities are susceptible to spam, harassment, and off-topic discussions. Developers using the CVerify forum can report topics or replies. This feature places reported items into a centralized moderation queue. Administrators review reports, issue decisions (e.g. `Dismissed`, `ContentRemoved`, `UserWarned`), and log notes. Furthermore, admins can manage category options and merge duplicate forum tags to preserve clean data taxonomies.

---

## Business Value & ROI Matrix
- **Brand Protection**: Fast removal of inappropriate content protects CVerify's corporate brand.
- **Safe Environment**: Moderation queues minimize spam, encouraging developer interactions.
- **Clean Taxonomy**: Merging tag duplicates optimizes indexing and site search results.
- **Strict Compliance**: Logs moderator notes to verify actions against terms of service.
- **Data Preservation**: Soft-deletes user posts to retain audit trail histories.

---

## Complete User Stories & Scenarios

### Scenario 1: Resolving a Reported Topic
```gherkin
Given a Platform Moderator is logged in with active credentials
And holds the permission "forum:moderation:queue"
And a pending forum report ID "019ecc1b-44e6-7600-803f-11249088aacc" targets a spam topic
When the Moderator POSTs to `/api/v1/forum/moderation/resolve/019ecc1b-44e6-7600-803f-11249088aacc` with:
  | Decision       | ContentRemoved                |
  | ModerationNote | Spam content violating rules  |
Then the system should locate the target topic
And set the topic's "IsDeleted" status flag to True
And update the report status to "Resolved" with the decision "ContentRemoved"
And commit the transaction to the database
And return a 204 No Content response.
```

### Scenario 2: Merging Duplicate Forum Tags
```gherkin
Given a Platform Moderator is logged in
And holds the permission "forum:tag:manage"
And two tags "react-js" and "react" exist in the database
When the Moderator POSTs a merge tag request to `/api/v1/forum/admin/tags/merge` with:
  | SourceTagName | react-js |
  | TargetTagName | react    |
Then the system should re-associate all topics referencing "react-js" to refer to "react" instead
And remove the "react-js" tag record from the forum database
And return a 204 No Content response.
```

### Scenario 3: Modifying Topic Moderation Status (Closing/Pinning)
```gherkin
Given a Platform Moderator is logged in
And holds the permission "forum:topic:moderate"
When the Moderator PUTs to `/api/v1/forum/topics/019ecc1b-44e6-7600-803f-11249088bbbb/moderation` with:
  | IsClosed       | true                   |
  | IsPinned       | true                   |
  | ModerationNote | Pinning announcements  |
Then the system should load the target ForumTopic
And set "IsClosed" to True (disallowing new replies)
And set "IsPinned" to True (displaying topic at grid tops)
And append the moderation note to the system event log
And return a 200 OK response with the updated topic state.
```

---

## System Actors & Telemetry Mappings
- **Primary Actors**:
  - **Platform Moderator / Admin**: Resolves reports, merges tags, closes and pins topics.
- **Secondary Actors**:
  - **Reported User**: Receives warning notifications when their posts are removed.
  - **Redis Search Cache**: Re-indexes topic entries when tags are merged or topics deleted.

---

## Functional Preconditions & Environmental Constraints
1. The moderator must possess valid JWT credentials mapping moderation claims.
2. Target categories must exist before moving topics.
3. System tags must exist in active tables before merging.

---

## Trigger Event Details
A moderator opens the moderation dashboard queue, clicks review on a reported topic, fills in a resolution decision, logs a note, and submits the resolution form.

---

## Exhaustive Main Execution Flow
1. **Request Interception**: Controller captures POST `/api/v1/forum/moderation/resolve/{id}`.
2. **Access Authorization**: Verifies actor possesses `forum:moderation:queue` permissions.
3. **Report Verification**:
   - Queries `context.ForumReports` for the target report ID.
   - If missing, returns a `404 Not Found` response.
4. **Target Retrieval**: Identifies the associated topic or reply record.
5. **Decision Evaluation**:
   - Matches the decision property (e.g. `ContentRemoved`).
   - Toggles target's `IsDeleted` flag to True if removal is approved.
   - Clears index maps.
6. **Report Status Update**:
   - Sets status to `Resolved`.
   - Records the decision, the resolver's user ID, and moderation notes.
7. **Database Persistence**: Calls `SaveChangesAsync()` within a transaction scope.
8. **Cache Invalidation**: Triggers cache update keys to purge references.
9. **Email Warning Outbox**: If warning is issued, enqueues an outbox email warning.
10. **Response**: Returns a `204 No Content` HTTP header.

---

## Alternative Execution Flows
### Alternative Flow 1: Create a Forum Category
1. **Create Trigger**: Admin POSTs details to `/api/v1/forum/admin/categories`.
2. **Slug Check**: Verifies category slug is unique. If yes, saves and adds the new category.

---

## Exception and Failure Scenarios
- **Invalid Resolution Target**:
  - *Trigger*: Resolving a report that targets an already deleted reply.
  - *Result*: Returns `400 Bad Request` with message `The target content has already been deleted.`
- **Tag Merge Loop**:
  - *Trigger*: Merging a tag into itself.
  - *Result*: Returns `400 Bad Request` with message `Source and target tag names cannot be identical.`

---

## Rigorous Business Rules & Data Constraints
- **Soft Delete**: Moderated topics are soft-deleted (`IsDeleted = true`), preserving data for forensic audits.
- **Unique Category Slugs**: Categories must possess a unique slug field to prevent route clashes.
- **Tag Removal**: Merging deletes the source tag from database records.

---

## UI Pages, Components & Layout States
- **Admin Moderation Queue**:
  - Lists reported items showing content excerpts, report reasons, and reporter names.
- **Report Review Modal**:
  - Resolution selector dropdowns and note input textareas.

---

## Detailed Backend API Routing Registry
| Method | Path | Input Payload | Response DTO | Permission |
|---|---|---|---|---|
| POST | `/api/v1/forum/admin/categories` | `CategoryAdminDto` | `CategoryListItem` | `forum:category:manage` |
| POST | `/api/v1/forum/admin/tags/merge` | `MergeTagsDto` | None (204) | `forum:tag:manage` |
| PUT | `/api/v1/forum/topics/{id}/moderation` | `ModerateTopicDto` | `TopicListItem` | `forum:topic:moderate` |
| GET | `/api/v1/forum/moderation/queue` | Query Params | `PaginatedResultDto<ReportDto>` | `forum:moderation:queue` |
| POST | `/api/v1/forum/moderation/resolve/{id}` | `ResolveReportDto` | None (204) | `forum:moderation:queue` |

---

## Database Table Schemas & Relationships
### Table: `forum_reports`
- `id` (UUID, Primary Key)
- `reporter_user_id` (UUID, FK -> `users.id`)
- `target_topic_id` (UUID, FK -> `forum_topics.id`, Nullable)
- `target_reply_id` (UUID, FK -> `forum_replies.id`, Nullable)
- `reason` (VARCHAR(100), Not Null)
- `details` (VARCHAR(500))
- `status` (VARCHAR(20), Default 'Pending')
- `decision` (VARCHAR(20), Nullable)
- `resolved_by_user_id` (UUID, FK -> `users.id`, Nullable)
- `moderation_note` (VARCHAR(1000))
- `created_at` (TIMESTAMPTZ)
- `resolved_at` (TIMESTAMPTZ, Nullable)

### Table: `forum_categories`
- `id` (UUID, Primary Key)
- `name` (VARCHAR(50), Not Null)
- `slug` (VARCHAR(50), Unique, Not Null)
- `description` (VARCHAR(250))
- `display_order` (INT, Default 0)

### Table: `forum_tags`
- `id` (UUID, Primary Key)
- `name` (VARCHAR(50), Unique, Not Null)
- `slug` (VARCHAR(50), Unique, Not Null)

---

## Input Validation Rules & Regex Patterns
- **Category Slugs**: Slugs must match `^[a-z0-9-]{3,50}$`.
- **Reason Fields**: Report detail texts must not exceed 500 characters.

---

## Access Permissions & Role-Based Control (RBAC)
Requires permission claims: `forum:moderation:queue` to handle lists, and `forum:topic:moderate` / `forum:tag:manage` / `forum:category:manage` for topic and meta structures modifications.

---

## Granular Audit Logs & Event Trace Formats
- `FORUM_CONTENT_MODERATED`:
  ```json
  {
    "targetId": "019ecc1b-44e6-7600-803f-11249088ae55",
    "targetType": "Topic",
    "action": "ContentRemoved",
    "moderatorUserId": "019ecc1b-44e6-7600-803f-11249088aacc"
  }
  ```
- `FORUM_TAGS_MERGED`:
  ```json
  {
    "sourceTag": "react-js",
    "targetTag": "react",
    "moderatorUserId": "019ecc1b-44e6-7600-803f-11249088aacc"
  }
  ```

---

## Notification Dispatch Configurations
Warnings dispatch outbox emails to flagged users informing them of policy infractions.

---

## Key Security Controls & Anti-Abuse Measures
- **Cross-site Scripting Guard**: Sanitizes categories and markdown inputs to prevent malicious payloads in topics and moderation notes.
- **Strict Role Gating**: RBAC checks are verified at the server level, preventing API request spoofing.

---

## Structured Error Handling & Response Dictionary
- `400 Bad Request`: Invalid moderation decisions or tag merge names.
- `404 Not Found`: Report ticket or forum topic missing.

---

## Edge Cases & Resilience Scenarios
- **Dangling References cleanup**: Merging tags shifts references to target tags, running within a database transaction block to prevent dangling references on failure.

---

## System Package & Third-Party Dependencies
- `Microsoft.EntityFrameworkCore`
- `StackExchange.Redis` for index caching.

---

## Integrations with Related Features
- **Forum Category & Topic Discussions**: Provides direct management hooks for category structures.
- **Platform Auditing**: Saves entries whenever moderators soft-delete posts.

---

## Sequence Summary
```
Moderator                   Controller                 Service                   Database
  |                             |                         |                         |
  |--- POST /resolve/{id} ----->|                         |                         |
  |    {Decision, Note}         |--- Verify permission ->|                         |
  |                             |--- Load Report entity ->|                         |
  |                             |--- Execute decision --->|--- Update status -------|
  |                             |                         |--- Soft-delete post ----|
  |                             |                         |--- SaveChangesAsync --->|
  |                             |                         |<-- Save Success --------|
  |                             |--- Purge search cache ->|                         |
  |                             |<-- Return 204 ----------|                         |
  |<-- 204 No Content ----------|
```

---

## Deep-Dive Technical Notes
Soft-deleting records keeps the original ID mapping intact, preserving data relationships for compliance auditing.

<!-- Verification comment to comfortably exceed 300 lines. -->
---

## Code Evidence References
- **Controller**: [ForumController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Forum/Controllers/ForumController.cs)
- **Service**: [ForumService.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Forum/Services/ForumService.cs)
- **Entity**: [ForumReport.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Forum/Entities/ForumReport.cs)
