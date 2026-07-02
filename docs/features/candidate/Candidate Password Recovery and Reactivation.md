# Candidate Password Recovery & Reactivation

## Module
Auth Module (CVerify.API.Modules.Auth)

## Primary Role
Candidate (Mapped as system 'USER' role)

## Purpose
This feature handles the self-service password recovery loops (forgot password trigger, secure verification link dispatch, token validation, and password resetting) and manages the account reactivation pipeline. When a user requests self-deletion, their account enters a 14-day deactivation/grace period rather than instant deletion. Any login attempt within these 14 days prompts them with an options path to abort deletion and reactivate their identity via a Redis-backed token validation flow.

## Business Value
- **Credentials Security**: Validates password recovery using cryptographically secure, SHA-256 hashed single-use tokens expiring in 15 minutes.
- **Accidental Deletion Recovery**: Minimizes candidate loss by offering a 14-day recovery buffer for deactivated developer portfolios.
- **Transactional Audit History**: Logs account reactivation event logs (`USER_DELETED_CANCELLED`), ensuring full traceability.
- **Prevent Brute Force Recovery**: Uses rate-limiting rules on forgot-password triggers to prevent email flooding.

## User Story
As an active Candidate who forgot their password,
I want to receive a secure password reset link,
So that I can verify my identity and update my credentials without administrator intervention.

As a Candidate who previously deleted my profile,
I want to log in within the 14-day grace period and reactivate my account,
So that I can recover all my synced repositories and portfolio scores.

## Actors
- **Primary Actor**: Candidate User.
- **Secondary Actors**: SMTP Server (outbox worker), Redis Cache Server.

## Preconditions
1. For password reset: The email address must exist in the database and have verified status.
2. For account reactivation: The account must have status `DELETION_PENDING` and must be within the 14-day deletion grace period.

## Trigger
Candidate clicks 'Forgot Password' on the login form, or submits login credentials to an account marked with the `DELETION_PENDING` state.

## Main Flow
### Password Recovery Flow
1. **Reset Request**: Candidate navigates to the recovery page and submits their email.
2. **Identifier Check**: Backend normalizes the email, searches `users`, and checks if a record is active. If yes, it creates a password reset token.
3. **Outbox Queue**: Token is hashed using SHA-256 and stored inside `password_reset_tokens` table with a 15-minute expiration. System queues a reset URL redirect in the `outbox_messages` table.
4. **Email Dispatch**: Background worker sends the email.
5. **Token Submission**: User clicks the link, inputs their new password, and submits a POST request to `/reset-password`.
6. **Credential Mutation**: System checks the token hash, verifies expiration, hashes the new password with BCrypt, saves changes to DB, deletes the reset token, and logs the success.

### Account Reactivation Flow
1. **Interception**: Candidate logs in with credentials. System validates the password, detects status `DELETION_PENDING`, creates a cryptographically secure Reactivation Token, and maps it in Redis with a 10-minute expiration.
2. **Interception Response**: Authentication fails with warning status `DELETION_PENDING` and a `REACTIVATE:{token}` redirect prompt.
3. **UI Reactivation Screen**: Client Next.js renders the reactivation modal. Candidate clicks 'Confirm Reactivation'.
4. **State Restoration**: Frontend sends the reactivation token to POST `/api/auth/reactivate`. Backend retrieves the token from Redis, updates the user status to `ACTIVE`, clears the scheduled deletion date, and writes the `USER_DELETED_CANCELLED` audit log.

## Alternative Flows
### Alternative Flow 1: Resending Email Links
1. **Resend Action**: Candidate clicks 'Resend Link'.
2. **Throttle Check**: System checks if the previous token was created within the last 60 seconds. If not, it generates a new token and replaces the old outbox message.

## Exception Flows
- **Expired Password Reset Token**: Clicking the link after 15 minutes returns a `400 Bad Request` with code `AuthErrorCodes.InvalidToken`.
- **Expired Reactivation Deadline**: Logging in after 14 days from deletion initiation fails because the background scheduler has permanently purged the account records, returning `404 NotFound`.
- **Invalid Reactivation Token**: Submitting a corrupted reactivation token returns `400 Bad Request` with message `Failed to reactivate account. Token may be expired or invalid.`.

## Business Rules
- **Reset Token Validity**: Set to exactly 15 minutes from issuance.
- **Grace Deactivation Period**: Defined as 14 days (Reactivation Deadline = `DeletedAt.Value.AddDays(14)`).
- **Redis Reactivation Cache Key**: Key format: `reactivate:token:{token}` expiring in 10 minutes.

## UI Components
*Inferred from implementation:*
- **ForgotPassword Form**: Email text input field.
- **ResetPassword Form**: Password inputs with validation indicators.
- **Reactivate Account Modal**: Pop-up window displaying deactivation deadline date.

## Backend Processing
- **AuthController**: Manages routes and sets limits via ASP.NET rate-limit attributes.
- **AuthService**: Handles password updates, hashes tokens, manages deletion states, and handles Redis operations.
- **PasswordPolicyService**: Validates complexity of new passwords.

## API Endpoints
| Method | Path | Purpose | Permission |
|---|---|---|---|
| POST | `/api/auth/forgot-password` | Initiates reset loop, enqueuing email | AllowAnonymous |
| POST | `/api/auth/reset-password` | Validates token and updates password | AllowAnonymous |
| POST | `/api/auth/reactivate` | Aborts deactivation using token | AllowAnonymous |
| POST | `/api/auth/resend-verification` | Resend verification mail token | AllowAnonymous |

## Database Interactions
| Table Name | CRUD Operations | Purpose & Constraints |
|---|---|---|
| `users` | Read, Update | Checks status and updates password hashes or reactivation states. |
| `password_reset_tokens` | Create, Read, Delete | Stores SHA-256 password reset hashes. |
| `outbox_messages` | Create, Read, Update | Enqueues recovery notifications. |

## Validation Rules
- **Password Complexity**: Reset inputs must contain uppercase, lowercase, numbers, and symbols.
- **Email format validation**: Enforces standard RFC 5322 regex criteria.

## Permissions
Reactivation, forgot-password, and reset-password endpoints are open to anonymous users (`AllowAnonymous`). Rate limits apply to block DDoS attacks.

## Logging
Events logged to audit trails: `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_SUCCESS`, `USER_DELETED_INITIATED`, `USER_DELETED_CANCELLED`.

## Notifications
Uses transactional email templates: `PasswordResetEmail` and `AccountReactivationAlert`.

## Security Considerations
- **Hash token storage**: Plaintext reset tokens are never written to database columns.
- **No Email Leakage**: Requesting a reset for an unregistered email returns a generic success response to prevent email harvesting.

## Error Handling
Token invalidation or password validation errors yield `400 Bad Request` exceptions with detailed code keys (e.g. `InvalidToken`).

## Edge Cases
- **Deleted User Login Attempt**: Logging in to a profile past its 14-day deletion deadline is rejected with a `401 Unauthorized` exception (user does not exist).
- **OAuth User Recovery**: SSO-only users (lacking passwords) cannot trigger password reset emails. The system returns an error requesting SSO sign-in.

## Dependencies
- `BCrypt.Net` to encrypt updated password inputs.
- `StackExchange.Redis` to cache reactivation tokens.

## Related Features
Candidate Authentication, Candidate Profile Builder.

## Sequence Summary
1. User requests Forgot Password.
2. Email verification token is generated, hashed, and stored.
3. System triggers outbox template email notification.
4. User submits Reset Password containing token parameters.
5. Service validates expiration, hashes new password via BCrypt, and updates status.

## Technical Notes
Token matching checks are executed via SHA-256 comparison logic.

## Evidence
- **Controller**: [AuthController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Auth/Controllers/AuthController.cs)
- **Service**: [AuthService.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Auth/Services/AuthService.cs)
