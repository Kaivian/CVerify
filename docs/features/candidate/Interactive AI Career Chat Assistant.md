# Interactive AI Career Chat Assistant

## Module
AiChat Module (CVerify.API.Modules.AiChat)

## Primary Role
Candidate (Mapped as system 'USER' role)

## Purpose
This feature provides candidates with an interactive, real-time career counselor and portfolio assistant. It hosts streaming conversational AI connections (integrating with an external FastAPI AI microservice), retrieves historical chat contexts, persists chat sessions, and secures communication using HMAC signatures.

## Business Value
- **Interactive Career Advice**: Guides candidates through customized improvement goals, resume reviews, and portfolio optimization techniques.
- **Low-Latency UX**: Streams AI token chunks directly to client browsers using Server-Sent Events (SSE).
- **Secure Server-to-Server Auth**: Blocks prompt injections and unauthorized proxy access to paid LLM pools using cryptographic HMAC headers.
- **Robustness**: Employs readiness check health probes and DNS resolution fallbacks, keeping chat experiences operational.

## User Story
As an active Candidate,
I want to consult an interactive AI Career Assistant about my skills gaps,
So that I can receive real-time, personalized recommendations on how to improve my developer score.

## Actors
- **Primary Actor**: Candidate User.
- **Secondary Actors**: FastAPI AI Microservice Engine, Redis Cache Server.

## Preconditions
1. Candidate must hold an active account and valid JWT credentials.
2. The FastAPI AI microservice must be healthy and return a valid `"status": "ready"` response.

## Trigger
Candidate opens the AI Career Chat dashboard, selects a conversation history or starts a new conversation, and enters a message prompt.

## Main Flow
1. **Send Message**: Candidate POSTs their prompt to `/api/ai/chat/stream` including an optional `ConversationId`.
2. **Health Verification**: System initiates a 5-second readiness check request to `/health/ready` on the FastAPI microservice. If ready, the flow continues.
3. **Session Matching**: If no conversation ID is passed, the system generates a new `Conversation` record with the first 30 characters of the prompt as the title.
4. **Message Persistence**: The system writes a User Message to the database, and creates a placeholder Assistant Message with status `Pending`.
5. **Context Generation**: The service loads the previous 10 completed messages in the conversation to maintain context.
6. **HMAC Signature Creation**: The backend calculates HMAC signatures using target parameters, payloads, timestamps, nonces, and client IDs, injecting them as HTTP headers (`X-Signature`, `X-Timestamp`, `X-Nonce`, `X-Correlation-Id`).
7. **Downstream API Call**: System POSTs to the FastAPI endpoint `/api/v1/chat/stream` and updates the placeholder status to `Streaming`.
8. **SSE Streaming Broadcast**: The backend handles the connection, disabling reverse-proxy buffering (`X-Accel-Buffering: no`), and streams token chunks downstream to the candidate.
9. **Persistence**: Once resolved, the assistant message content is updated and status committed as `Completed`.

## Alternative Flows
### Alternative Flow 1: Chat Session Selection & Listing
1. **Session Listing**: Candidate checks past chats (GET `/api/ai/chat/conversations`). System returns paginated history lists.
2. **Load Detail**: Candidate clicks a chat item. GET `/api/ai/chat/conversations/{id}/messages` loads previous message exchanges.

### Alternative Flow 2: Deleting Chats
1. **Request Deletion**: Candidate clicks 'Delete Chat' (DELETE `/api/ai/chat/conversations/{id}`).
2. **Soft Delete**: System marks the conversation and associated message blocks as deleted in the database.

## Exception Flows
- **Readiness Check Timeout**: If the FastAPI service readiness check exceeds 5 seconds, the controller returns a `503 Service Unavailable` response.
- **FastAPI Connection Denied**: If the FastAPI server is offline, the backend updates the assistant message status to `Failed`, and streams a JSON error downstream.
- **HMAC Signature Invalid**: If signatures do not match, the FastAPI server rejects the request with a `403 Forbidden` response.

## Business Rules
- **Pre-flight Probe Timeout**: Hardcoded at exactly 5 seconds.
- **Conversation Context Window**: Restricted to the last 10 messages.
- **FastAPI Auth Header Names**: `X-Client-Id`, `X-Timestamp`, `X-Nonce`, `X-Correlation-Id`, `X-Signature`.

## UI Components
*Inferred from implementation:*
- **Conversational Chat Interface**: Layout showing user prompts and markdown responses.
- **Dynamic Typing/Loading Spinner**: Spinner displayed during pending states.
- **Sidebar Chat List**: Session history list.

## Backend Processing
- **AiChatController**: Handles routes, parses payloads, checks API health, and manages streams.
- **HmacSignatureService**: Encrypts requests and generates timestamps and nonces.
- **HttpClient**: Manages keep-alive connections to the FastAPI microservice.

## API Endpoints
| Method | Path | Purpose | Permission |
|---|---|---|---|
| POST | `/api/ai/chat/stream` | Send prompt and receive streamed SSE chunks | Authorize |
| GET | `/api/ai/chat/conversations` | List candidate's past chat conversations | Authorize |
| GET | `/api/ai/chat/conversations/{id}/messages` | Load historical messages for a chat | Authorize |
| DELETE | `/api/ai/chat/conversations/{id}` | Delete a chat conversation session | Authorize |

## Database Interactions
| Table Name | CRUD Operations | Purpose & Constraints |
|---|---|---|
| `conversations` | Create, Read, Update, Delete | Stores chat titles, user IDs, and soft-delete statuses. |
| `messages` | Create, Read, Update, Delete | Stores messages, roles (User/Assistant), and streaming states. |

## Validation Rules
- **Prompt Character Validation**: Refuses empty prompts or inputs over maximum size limits.

## Permissions
All chat endpoints require validated candidate JWT authorization tokens. Candidates can only view and write messages within sessions they own.

## Logging
Audits record events: `CHAT_SESSION_CREATED`, `CHAT_MESSAGE_SENT`, `CHAT_ERROR`, `CHAT_SESSION_DELETED`.

## Notifications
Live status bars indicate when the assistant is processing requests.

## Security Considerations
- **Server-to-Server HMAC Signature**: Protects the FastAPI API endpoints from external calls.
- **Input Sanitization**: Encodes outputs to prevent script execution on candidate browsers.

## Error Handling
FastAPI connection or timeout errors return a `503 Service Unavailable` code, setting the message streaming state to `Failed`.

## Edge Cases
- **Aborted Streaming Requests**: If the user closes the chat tab, the cancellation token cancels the downstream HTTP request, saving the partial text response to the DB.
- **Unverified Emails**: Hides chat access for unverified profiles.

## Dependencies
- `System.Net.Http.Json`: Serializes payloads.
- `Microsoft.EntityFrameworkCore`: Persists chat data.

## Related Features
Candidate Authentication, Candidate Profile Builder, Trust Profile.

## Sequence Summary
1. Candidate sends chat message to POST `/chat/stream`.
2. System executes pre-flight health probe check to FastAPI microservice.
3. System fetches the last 10 messages for conversational history.
4. HMAC headers are generated and injected.
5. Stream connection is established to FastAPI `/api/v1/chat/stream`.
6. Token chunks stream downstream to candidate browser.

## Technical Notes
Pre-flight check times out in 5 seconds.

## Evidence
- **Controller**: [AiChatController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/AiChat/Controllers/AiChatController.cs)
