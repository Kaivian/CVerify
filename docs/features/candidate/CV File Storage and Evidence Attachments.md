# CV File Storage & Evidence Attachments

## Module
Profiles Module (CVerify.API.Modules.Profiles)

## Primary Role
Candidate (Mapped as system 'USER' role)

## Purpose
This feature governs the ingestion, validation, secure storage, and revocation of candidate CV files, certificates, academic achievements, and coding project evidence files. It abstracts physical cloud object storage APIs (using Cloudflare R2 buckets) and generates temporary, signed URLs to guarantee secure downloads.

## Business Value
- **Evidence Verification**: Allows candidates to upload concrete proof (diplomas, PDF certifications, screenshot files) validating their claims.
- **Resource Protection**: Prevents public scanning of candidate private PDFs using short-lived (1-hour) pre-signed download tokens.
- **CDN Decoupling**: Offloads media streaming and file hosting workloads from ASP.NET servers to distributed Cloudflare edge networks.
- **Storage Hygiene**: Implements physical storage cleanups on document deletion to prevent orphan storage leaks.

## User Story
As an active Candidate,
I want to upload my certificate PDFs and project screenshots to my profile,
So that I can back up my CV achievements with verified evidence and download them securely.

## Actors
- **Primary Actor**: Candidate User.
- **Secondary Actors**: Cloudflare R2 Storage Service, local browser file picker APIs.

## Preconditions
1. Candidate must be logged in.
2. Target profile entity (e.g. AcademicAchievement ID, WorkExperience ID) must belong to the active candidate.
3. Payload size and file extensions must pass checks.

## Trigger
Candidate clicks 'Upload Evidence File' on a resume segment card or uploads a profile avatar.

## Main Flow
1. **Upload Request**: Candidate selects a file and POSTs to `/api/v1/users/evidence/upload` containing: `file`, `entityType` ("Avatar", "AcademicAchievement"), and optional `entityId`.
2. **Storage Rule Selection**: `AttachmentService` evaluates the `entityType` and selects the appropriate storage category (`StorageModule.Profile` or `StorageModule.Evidence`).
3. **Physical Cloud Ingestion**: The service streams the file directly to Cloudflare R2.
4. **PostgreSQL Registry Entry**: The system registers a `ProfileAttachment` row, assigning a unique UUID v7, file size, content MIME type, and R2 ObjectKey path.
5. **URL Signature Generation**: System generates a 1-hour pre-signed access URL.
6. **Response Response**: Returns `201 Created` containing file details and the pre-signed preview URL.

## Alternative Flows
### Alternative Flow 1: Secure File Download
1. **Download Trigger**: Candidate clicks on an evidence file link.
2. **Redirect API**: The browser calls GET `/api/v1/users/evidence/{id}/download`.
3. **Redirection Execution**: Backend validates candidate ownership, requests a fresh signed URL from Cloudflare, and returns a `302 Found` response redirecting the client to the cloud CDN location.

### Alternative Flow 2: File Deletion
1. **Delete Request**: Candidate clicks 'Delete' (DELETE `/api/v1/users/evidence/{id}`).
2. **Cloud Cleanup**: System attempts to delete the object from Cloudflare R2 bucket. If it fails, it logs a warning but proceeds.
3. **Soft Delete**: The system stamps `DeletedAt` on the DB attachment row, invalidates profile cache entries, and returns `204 NoContent`.

## Exception Flows
- **File Empty / Missing**: Uploading null payloads returns a `400 BadRequest("File payload is empty or missing.")`.
- **Ownership Invalidation**: Querying or downloading an attachment ID belonging to another candidate triggers a `ResourceNotFoundException`.
- **MIME/Size Overrun**: Uploading files over configured limits returns `400 BadRequest` error payloads.

## Business Rules
- **Access URL Lifespan**: Signed URLs expire exactly 1 hour after generation (`TimeSpan.FromHours(1)`).
- **Physical Cleanup grace**: Network errors during R2 object deletion log a warning but proceed with DB soft-deletion to ensure database consistency.

## UI Components
*Inferred from implementation:*
- **File Drag-and-Drop Area**: Component with upload state indicator spinner frames.
- **Attachment List Card**: Renders document file extensions (PDF, PNG, etc.), sizes, and delete controls.

## Backend Processing
- **EvidenceController**: Handles incoming file streams and executes redirect headers.
- **AttachmentService**: Checks entity types, invokes storage APIs, and updates database records.
- **StorageService**: Low-level implementation interfacing AWS S3 SDK for Cloudflare R2.

## API Endpoints
| Method | Path | Purpose | Permission |
|---|---|---|---|
| POST | `/api/v1/users/evidence/upload` | Upload new avatar or evidence attachment | Authorize |
| GET | `/api/v1/users/evidence/{id}/download` | Fetch signed URL and redirect download | Authorize |
| DELETE | `/api/v1/users/evidence/{id}` | Delete attachment from cloud and database | Authorize |

## Database Interactions
| Table Name | CRUD Operations | Purpose & Constraints |
|---|---|---|
| `profile_attachments` | Create, Read, Update | Tracks unique file UUIDs, owner user IDs, file metadata, and cloud object keys. |
| `academic_achievements` | Read | Verifies relationships for certificates. |
| `project_entries` | Read | Verifies relationships for project files. |

## Validation Rules
- **Payload verification**: Refuses empty files.
- **Token validation**: Checks ownership constraints to prevent unauthorized downloads.

## Permissions
Access is restricted to authenticated users holding a valid JWT cookie. Candidates can only manage attachments they own.

## Logging
Audits record events: `ATTACHMENT_UPLOADED`, `ATTACHMENT_DOWNLOADED`, `ATTACHMENT_DELETED`.

## Notifications
Live toast notifications on the dashboard show upload and deletion status.

## Security Considerations
- **Secure Redirections**: File download URLs are short-lived, preventing link sharing.
- **R2 Bucket Isolation**: Files are referenced by random UUID object keys to prevent scanning attacks.

## Error Handling
Failures are captured by global filter logs, returning standard HTTP codes (400, 404).

## Edge Cases
- **Orphan Cleanup**: If a candidate deletes an entire project entry, the background processor triggers cleanups for all associated evidence files.
- **OAuth Sync Override**: Syncing a profile picture from GitHub overrides the existing custom avatar in storage.

## Dependencies
- `AWSSDK.S3`: Handles connection to Cloudflare R2.
- `Microsoft.EntityFrameworkCore`: Persists database mappings.

## Related Features
Candidate Profile Builder, Candidate Authentication, Password Recovery.

## Sequence Summary
1. Candidate uploads file payload to POST `/evidence/upload`.
2. Service maps payload structure, calling AWS S3 SDK upload.
3. System inserts attachment details in `profile_attachments` table.
4. Pre-signed 1-hour URL redirect is returned.
5. Deletion triggers R2 cleanup and soft-deletes DB record.

## Technical Notes
Pre-signed URLs are valid for exactly 1 hour.

## Evidence
- **Controller**: [EvidenceController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Profiles/Controllers/EvidenceController.cs)
- **Service**: [AttachmentService.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Profiles/Services/AttachmentService.cs)
