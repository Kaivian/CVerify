# Developer Forum Category & Topic Discussion

## Module
Forum Module (CVerify.API.Modules.Forum)

## Primary Role
Candidate (Mapped as system 'USER' role)

## Purpose
This feature hosts the community discussion platform of CVerify, where candidates can exchange software design practices, ask questions, mark replies as accepted solutions, follow/bookmark topics, tag posts, upvote/downvote content, react with emojis, and report inappropriate content.

## Business Value
- **Platform Engagement**: Builds an active developer ecosystem within CVerify, driving recurring candidate traffic.
- **Organic SEO Content**: Indexes public forum topics and categories, attracting search traffic from external developers.
- **Knowledge Share**: Promotes technical sharing and collaborative problem solving.
- **Community Safety**: Enforces moderation queues and report resolution to maintain professional discussion standards.

## User Story
As an active Candidate,
I want to browse discussion topics, ask engineering questions, bookmark threads, upvote replies, and flag inappropriate comments,
So that I can learn from my peers, build my reputation, and solve development blockers.

## Actors
- **Primary Actor**: Candidate User.
- **Secondary Actors**: Recruiter/Admin User (moderators), spam analysis engines.

## Preconditions
1. Reading topics/categories is open to anonymous visitors.
2. Creating topics, adding replies, voting, reacting, bookmarking, and reporting require candidate JWT authentication cookies.

## Trigger
Candidate opens the Forum tab, clicks a category list card, selects a topic, or writes a new post.

## Main Flow
1. **Browse Categories**: Candidate navigates to the forum dashboard, fetching GET `/api/v1/forum/categories`.
2. **Topic Fetching**: Candidate opens a category. System returns paginated lists via GET `/api/v1/forum/topics`.
3. **Topic Creation**: Candidate clicks 'New Topic' and submits a POST request to `/topics` containing: `title`, `content`, `categoryId`, and `tags`.
4. **Formatting Check**: System checks that the content length exceeds minimum limits and sanitizes body inputs.
5. **Slug Generation**: The service generates a URL-friendly slug based on the title, inserts the topic into the database, and returns the response payload.
6. **Interaction Loops**:
   - *Add Reply*: Submits a reply payload to POST `/topics/{topicId}/replies`.
   - *Mark Solution*: The topic author clicks 'Accept Solution' on a reply, toggling `IsSolution` in the DB.
   - *Upvote/Downvote*: Clicks vote indicators (POST `/vote`) to modify topic scores.
   - *Reactions*: Clicks emoji indicators to submit emoji payloads.
   - *Follow/Bookmark*: Toggles bookmark states to receive updates or pin threads.

## Alternative Flows
### Alternative Flow 1: Content Reporting
1. **Flag Content**: Candidate spots abusive behavior and clicks 'Report'.
2. **File Report**: Frontend sends report details (content ID, content type, reason) to POST `/api/v1/forum/reports`.
3. **Queue Ingestion**: System inserts the report into the moderation queue table.

### Alternative Flow 2: Moderator Cleanup
1. **Queue Inspection**: Administrator opens GET `/api/v1/forum/moderation/queue`.
2. **Resolve Report**: Administrator resolves the report (POST `/moderation/resolve/{id}`) to hide or delete the offending content.

## Exception Flows
- **Closed Topic Restrictions**: If a topic is locked by a moderator, submitting replies is rejected with a `400 BadRequest` error.
- **Unauthorized Mutation**: Candidates trying to edit or delete posts written by other users receive a `403 Forbidden` response.
- **Spam Limits**: Triggering multiple posts within seconds triggers a `429 Too Many Requests` response.

## Business Rules
- **Solution Accept Scope**: Only the original creator of a topic holds permissions to mark a reply as the accepted solution.
- **Vote Constraints**: Users are restricted to one active vote (value -1, 0, or +1) per post.
- **Slug Uniqueness**: Slugs must be unique; duplicate titles append short random suffix codes.

## UI Components
*Inferred from implementation:*
- **Post Rich Text Editor**: Markdown-enabled input box.
- **Voting Arrows**: Controls to register upvotes or downvotes.
- **Accepted Indicator**: Visual border highlighting the selected solution.
- **Category Grid**: Display of folders, post counts, and active tags.

## Backend Processing
- **ForumController**: Maps REST routes and checks model states.
- **ForumService**: Manages transaction locks, slug logic, tag mergers, and moderation queue resolutions.

## API Endpoints
| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/api/v1/forum/categories` | Retrieve all categories list | AllowAnonymous |
| GET | `/api/v1/forum/categories/{id}` | Fetch category details by ID | AllowAnonymous |
| POST | `/api/v1/forum/admin/categories` | Create category folder | HasPermission |
| GET | `/api/v1/forum/tags` | List all tags | AllowAnonymous |
| GET | `/api/v1/forum/tags/trending` | List trending tags | AllowAnonymous |
| GET | `/api/v1/forum/topics` | List paginated forum topics | AllowAnonymous |
| GET | `/api/v1/forum/topics/{slug}` | Fetch topic details by slug | AllowAnonymous |
| POST | `/api/v1/forum/topics` | Create a new discussion thread | Authorize |
| PUT | `/api/v1/forum/topics/{id}` | Update topic content details | Authorize |
| DELETE | `/api/v1/forum/topics/{id}` | Soft-delete a discussion topic | Authorize |
| POST | `/api/v1/forum/topics/{id}/vote` | Submit upvote or downvote on topic | Authorize |
| POST | `/api/v1/forum/topics/{id}/react` | Add emoji reaction to topic | Authorize |
| POST | `/api/v1/forum/topics/{id}/bookmark` | Toggle bookmarked topic list | Authorize |
| POST | `/api/v1/forum/topics/{id}/follow` | Toggle notifications follow status | Authorize |
| GET | `/api/v1/forum/topics/{topicId}/replies` | Get replies list for a topic | AllowAnonymous |
| POST | `/api/v1/forum/topics/{topicId}/replies` | Submit reply message on topic | Authorize |
| PUT | `/api/v1/forum/replies/{id}` | Update reply content details | Authorize |
| DELETE | `/api/v1/forum/replies/{id}` | Soft-delete reply message | Authorize |
| POST | `/api/v1/forum/replies/{id}/accept` | Accept reply as resolved solution | Authorize |
| POST | `/api/v1/forum/replies/{id}/vote` | Submit upvote or downvote on reply | Authorize |
| POST | `/api/v1/forum/replies/{id}/react` | Add emoji reaction to reply | Authorize |
| POST | `/api/v1/forum/reports` | Report abusive or inappropriate content | Authorize |
| GET | `/api/v1/forum/moderation/queue` | List open content reports | HasPermission |
| POST | `/api/v1/forum/moderation/resolve/{id}` | Resolve report and set action | HasPermission |
| GET | `/api/v1/forum/user/me` | Fetch user's forum profile statistics | Authorize |

## Database Interactions
| Table Name | CRUD Operations | Purpose & Constraints |
|---|---|---|
| `forum_categories` | Create, Read, Update, Delete | Groups topics by subject. |
| `forum_topics` | Create, Read, Update, Delete | Stores main posts, title slugs, views, and flags. |
| `forum_replies` | Create, Read, Update, Delete | Stores replies, scores, and solution statuses. |
| `forum_tags` | Create, Read, Update | Stores tags. Linked to topics via junction tables. |
| `forum_votes` | Create, Read, Update | Tracks candidate voting records to prevent duplication. |
| `forum_reports` | Create, Read, Update | Tracks report tickets and resolution actions. |

## Validation Rules
- **Slug Formatting**: Replaces spaces with hyphens, lowercases text, and trims symbols.
- **Length Constraints**: Topic title must be between 5 and 150 characters.

## Permissions
Browsing categories, tags, topics, and replies is open to anonymous visitors. Actions altering state require candidate authorization. Category and global tag management require admin permissions (`forum:category:manage`, `forum:tag:manage`).

## Logging
Audits record events: `TOPIC_CREATED`, `REPLY_CREATED`, `SOLUTION_MARKED`, `CONTENT_REPORTED`, `REPORT_RESOLVED`.

## Notifications
Following a topic registers event triggers, sending notification alerts on new replies.

## Security Considerations
- **Content Sanitization**: Sanitizes reply inputs to prevent HTML script injections.
- **Rate-limiting**: Restricts quick post submittals.

## Error Handling
Validation or authorization errors return appropriate status codes (400, 403).

## Edge Cases
- **Orphan Cleanup**: Deleting a category soft-deletes all associated topics and replies.
- **Merge Tags**: If administrators merge two tags, all linked topic references update automatically.

## Dependencies
- `Microsoft.EntityFrameworkCore`: Manages relations.

## Related Features
Candidate Authentication, Candidate Profile Builder.

## Sequence Summary
1. Candidate views GET `/v1/forum/topics/{slug}`.
2. System loads main post and paginated replies list.
3. Candidate submits reply to POST `/v1/forum/topics/{id}/replies`.
4. Service verifies topic lock settings.
5. Reply is saved to DB and author score increments.
6. Email notification dispatches to topic followers.

## Technical Notes
Pre-calculates trending tags using memory metrics.

## Evidence
- **Controller**: [ForumController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Forum/Controllers/ForumController.cs)
