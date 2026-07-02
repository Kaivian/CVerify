# Candidate Authentication & Access Control

## Module
Auth Module

## Primary Role
Candidate (Mapped as system 'USER' role)

## Purpose
This feature serves as the secure entryway and identity gatekeeper for the candidate persona in CVerify. It encapsulates account creation, multi-provider sign-in (traditional email/password and Google OAuth), active session token issuance, outbox-enrolled email verification link dispatch, token rotation concurrency control, and secure account deletion. It guarantees that only verified individuals can construct developer profiles, link source code repositories, run code assessments, and view proprietary matching outputs.

## Business Value
- **Data Protection**: Guards sensitive resume components, verified skills scores, and private repository contribution metrics against unauthorized data extraction.
- **Identity Legitimacy**: Mitigates artificial account multiplication and duplicate signup fraud using mandatory outbox-based email verification loops.
- **Takeover Prevention**: Enforces automatic brute-force login lockouts and strict Google OAuth auto-link checks to block unauthorized email ownership hijacking.
- **Regulatory Compliance**: Implements a double-verified, transactional candidate self-deletion flow conforming to data governance and right-to-be-forgotten privacy mandates.

## User Story
As a new Candidate,
I want to sign up with my email address and verify my ownership via a secure confirmation link,
So that I can securely sign in, link my GitHub account, and generate my verified portfolio without risk of account duplication.

## Actors
- **Primary Actor**: Candidate User (unauthenticated visitor / authenticated member mapped to system 'USER' role).
- **Secondary Actors**: Email Server Transport (SMTP / Transactional Sender), Redis Cache Storage, Identity State Cache Resolver.

## Preconditions
1. The applicant's email must be syntactically valid and capable of receiving external mail.
2. To use Google Single Sign-On, the user must hold an active Google identity with a verified email attribute returned by Google's JSON Web Signature API.
3. System configuration must list the client redirect domain in the active 'TrustedDomains' setting (enforced dynamically in code).

## Trigger
The user accesses the landing page or portal dashboard and clicks the authentication controls (e.g. Sign Up, Login, or Continue with Google).

## Main Flow
1. **Registration Input**: Candidate navigates to `/auth/continue-with-email` and submits their Full Name, Email, Password, and Confirm Password.
2. **Password Complexity Assertion**: The system invokes `PasswordPolicyService` to assert length, casing, digit presence, and non-alphanumeric character requirements. Unfit passwords raise a validation exception immediately.
3. **Email Uniqueness Guard**: The system normalizes the email (stripping dots and lowercasing) and performs a database lookup. If no account matches, it proceeds.
4. **Security Hashing**: The password is salted and hashed using BCrypt.Net prior to record generation.
5. **Account Setup**: A new user record is inserted into the `users` table in a transaction, mapped with the system default `USER` role and status marked as `EMAIL_VERIFY_PENDING`.
6. **Verification Token Issuance**: The system generates a URL-safe, secure cryptographically random token string. The token is hashed via SHA-256 and stored inside `verification_tokens` table with an expiry offset of 5 minutes.
7. **Outbox Enrollment**: The system builds the verification URL redirect string, checks that the redirect host is registered inside the `TrustedDomains` configuration, constructs an email envelope, and registers it within the transactional database outbox table via `AddAndAuditOutboxMessage`.
8. **Transaction Commit**: The database transaction is committed, user cache state is invalidated, and a success response is returned. The Candidate is prompted to check their mailbox.
9. **Email Link Processing**: The Candidate clicks the confirmation link in their email, forwarding the plaintext verification token to GET `/api/auth/verify-email` (or client proxy equivalents).
10. **Token Authentication**: The system hashes the plaintext token using SHA-256, looks it up in the database, verifies it is not expired, loads the target user profile, activates their status to `ACTIVE`, and commits the changes.
11. **First Login and Session Management**: The Candidate logs in with their newly verified email. The system resets failed attempts, creates a JWT access token and a refresh token, places them in HttpOnly cookies, and redirects the user to the workspace dashboard.

## Alternative Flows
### Alternative Flow 1: Google SSO Login & Auto-Registration
1. **Google Authentication**: Candidate clicks 'Sign in with Google' and authorizes their profile. The Google OAuth API yields an ID Token returned to Next.js.
2. **Token Validation**: The backend validates the signature, audience client ID, and expiration claims of the Google ID Token with a 5-minute clock tolerance.
3. **Auto-Link / Provider Lookup**: The system checks if the Google Subject ID matches an existing linked `AuthProviders` row. If yes, it signs the user in and proceeds.
4. **Auto-Registration for New Users**: If no provider match exists, the system checks if the email is present. If the email is not registered anywhere, the system automatically registers a new user with status `EMAIL_VERIFY_PENDING` and immediately activates it.
5. **Provider Mapping**: The Google Subject ID, profile avatar, and account email are mapped as a new `AuthProvider` linked to the user account inside a transaction.
6. **Session Generation**: The backend issues HttpOnly JWT and refresh cookies, logs the success event, and routes the Candidate to the dashboard.

### Alternative Flow 2: Account Self-Reactivation
1. **Login Attempt**: The user submits login credentials while in `DELETION_PENDING` status.
2. **Credential Validation**: The backend validates the password. If correct, instead of completing login, it generates a Reactivation Token, caches it in Redis for 10 minutes, and outputs a response with status `DELETION_PENDING` and nextStep `REACTIVATE:{Token}`.
3. **UI Interception**: Next.js redirects the candidate to the reactivate page, prompting them to cancel the deletion.
4. **Reactivation Confirmation**: The user clicks 'Confirm Reactivation', sending the reactivation token to POST `/api/auth/reactivate`. The backend verifies the token in Redis, recovers the UserId, restores the status to `ACTIVE`, clears the deletion timer, and signs them in.

## Exception Flows
- **Registration: Duplicate Email**: If the email is already in use and verified, the registration immediately throws `DuplicateEmailException`. If the matching user profile has email status `EMAIL_VERIFY_PENDING`, the system rotates the token, enqueues a new confirmation email, and returns a pending warning without inserting a duplicate user row (idempotent path).
- **Login: Account Lockout**: If the Candidate enters incorrect credentials repeatedly, `AccountService` registers failed attempts. Once thresholds are exceeded, the account status locks out, storing a `LockUntil` timestamp. Further attempts trigger `UnauthorizedAccessException` immediately.
- **Google Sign-In: Takeover Attempt Blocked**: If Google login email matches an existing local email, but the local account is unverified, auto-linking is blocked and throws `AccountConflict` to prevent email takeover. If the local account is verified and secured by a password or another provider connection, auto-linking is blocked, directing the candidate to log in manually first and link Google from the settings page.
- **Email Verification: Token Expired or Invalid**: If the plaintext token is not found or has exceeded the 5-minute validation lifespan, the backend throws `AuthException(AuthErrorCodes.InvalidToken)`.
- **Redirect: Untrusted Target Host**: If the client redirects target domain format doesn't match the `TrustedDomains` setting, the backend raises `AuthException(AuthErrorCodes.UntrustedRedirect).`
- **Rate Limiting**: Endpoints such as `/register` and `/verify-email` run under custom rate-limiting policies (`RegisterLimit`, `VerifyEmailLimit`). Excessive calls receive a `429 Too Many Requests` response from ASP.NET middleware.

## Business Rules
- **Email Normalization**: All emails are lowercased and whitespaces are trimmed. For Gmail, periods are stripped and sub-addresses (e.g., `+alias`) are parsed to prevent duplicate registrations and bypass limits.
- **Role Initialization**: New Candidate users are automatically assigned the default `USER` system role upon creation, unless their email matches the system environment's designated Super Admin email, in which case they receive the `SUPER_ADMIN` role.
- **Concurrency Token Refresh**: In order to support multiple browser tabs, a 10-second concurrency grace window is configured for refresh token rotation. If an old refresh token is reused within this grace window, a cached session is returned instead of triggering a replay attack alert.
- **Outbox-Enforced Mail Delivery**: Inapp and transactional emails (such as verification links) are never sent directly in the HTTP request thread. They are enqueued as `OutboxMessage` rows within the database transaction scope, ensuring reliable mail delivery.

## UI Components
*Inferred from implementation:*
- **Form Fields**: Text inputs configured with standard email, text, and password fields, showing client-side validation rules.
- **Buttons**: Standard controls (`Sign In`, `Sign Up`, `Sign in with Google`). Displays dynamic loading spinner frames during submission.
- **Feedback Alerts**: Visual error warnings (red toast/banner) on invalid password rules or lockout states.
- **Reactivate Dialogue**: Modal popup presented to deactivated users requesting cancellation of account deletion.

## Backend Processing
- **AuthController**: Coordinates REST mappings, checks `ModelState` validity, extracts request IP and User-Agent metadata, and handles cookie management.
- **AuthService**: Manages transaction boundaries, normalizes emails, interacts with Google APIs, and issues JWT/refresh payloads.
- **AccountService**: Implements brute-force protection, locks/unlocks profiles, and monitors failed credentials thresholds.
- **PasswordPolicyService**: Verifies plaintext passwords against complex regex criteria.
- **IdentityStateResolver**: Interacts with database cache configurations to invalidate user permissions/role settings dynamically.

## API Endpoints
| Method | Path | Purpose | Permission |
|---|---|---|---|
| POST | `/api/auth/register` | Register local Candidate user profile | AllowAnonymous |
| POST | `/api/auth/verify-email` | Validate email confirmation token | AllowAnonymous |
| POST | `/api/auth/login` | Authenticate via email and password | AllowAnonymous |
| POST | `/api/auth/google` | Validate Google token & login/register | AllowAnonymous |
| POST | `/api/auth/logout` | Revoke refresh token, clear cookies | AllowAnonymous |
| POST | `/api/auth/refresh-token` | Rotate JWT and Refresh token cookies | AllowAnonymous |
| GET | `/api/auth/me` | Fetch current authenticated user profile | Authorize |
| DELETE | `/api/auth/me` | Initiate account self-deletion request | Authorize |
| POST | `/api/auth/reactivate` | Reactivate account pending deletion | AllowAnonymous |
| POST | `/api/auth/resend-verification` | Resend verification mail link | AllowAnonymous |

## Database Interactions
| Table Name | CRUD Operations | Purpose & Constraints |
|---|---|---|
| `users` | Create, Read, Update | Stores candidate credentials (hashes), profiles metadata, and account statuses. Email column is unique. |
| `refresh_tokens` | Create, Read, Update | Tracks active user sessions, rotation statuses, and token hashes. Linked to users via UserId. |
| `verification_tokens` | Create, Read, Delete | Stores SHA-256 hashed verification tokens and expirations. Cascade deleted when User is deleted. |
| `auth_providers` | Create, Read | Maps Google Subject IDs to Users. Subject is unique within provider scope. |
| `outbox_messages` | Create, Read, Update | Tracks outbound email tasks. Handled by a background worker for reliable delivery. |

## Validation Rules
- **Email Format**: System checks email patterns via standard regex validation.
- **Password Complexity**: Evaluates if inputs contain uppercase, lowercase, numbers, and symbols, throwing custom rules exceptions on violation.
- **Token Expiry**: Email verification tokens are rejected if validation is attempted 5 minutes after issuance.

## Permissions
Anonymous access is permitted on public authentication actions (`/login`, `/register`, `/verify-email`). Secure resources (`/api/auth/me`, `/api/auth/logout`, self-deletion endpoints) require the bearer context with a valid, non-expired JWT signature.

## Logging
All authentication events record persistent database logs via the `LogAuditEventAsync` routine. Log formats contain user IDs, correlation IDs, timestamps, browser User-Agent strings, and client IP headers. Example events include `USER_REGISTERED`, `USER_LOGIN_SUCCESS`, and `USER_LOGIN_FAILED_CREDENTIALS`.

## Notifications
Transactional email notifications are generated within database transactions via outbox envelopes. Outbox handlers convert notifications to HTML messages delivered via SMTP or transactional providers (e.g. `EmailVerification`, `PasswordReset`). Inapp notification components render verification status updates on client screens.

## Security Considerations
- **Cryptographic Salt**: User passwords run through adaptive salted BCrypt routines.
- **Token Storage**: Plaintext email and recovery tokens are never stored inside tables; only SHA-256 hashes are persisted.
- **Cookie Security**: Issued token pairs operate on HttpOnly, Secure, and SameSite settings, preventing XSS capture scripts.
- **Anti-Phishing**: The system validates redirect URLs against the registered `TrustedDomains` whitelist before dispatching verification links.

## Error Handling
Backend exception handlers capture validation, duplicate key, and database errors. Duplicate entries raise `DuplicateEmailException`. Invalid configurations trigger `AuthException(AuthErrorCodes.InvalidToken)` mapped to corresponding standard HTTP response status codes (400, 401, 409).

## Edge Cases
- **Unlinked Providers**: Re-linking Google SSO on profiles with deleted provider connections is blocked to prevent profile hi-jacking.
- **Gmail Periods**: System treats `john.doe@gmail.com` and `johndoe@gmail.com` as a single user profile to restrict registration bypass attempts.
- **Failed Deletion**: Account deletion is blocked if the user is the sole owner of active organization units.

## Dependencies
- `Google.Apis.Auth`: Handles verification of external Google ID tokens.
- `BCrypt.Net`: Provides secure password hashing.
- `StackExchange.Redis`: Stores temporary cache keys and reactivation tokens.
- `Polly`: Executes retry logic on transactional outbox message sweeps.

## Related Features
This feature is closely related to Candidate Password Recovery, Candidate Profile & Resume Builder, and GitHub/Git Provider Integration.

## Sequence Summary
1. User Registration requests password complexity verification in `PasswordPolicyService`.
2. User entity is persisted in `ApplicationDbContext` database context under `EMAIL_VERIFY_PENDING` status.
3. Outbox message is generated to trigger background mail delivery services.
4. Email verification link parameters are parsed and validated via `TokenService`.
5. Account status gets promoted to `ACTIVE` and user details cached in `IdentityStateResolver`.
6. Bearer tokens are injected in cookies for subsequential candidate requests.

## Technical Notes
Enforces strict 10-second concurrency grace window on token rotation.

## Evidence
- **Controller**: [AuthController.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Auth/Controllers/AuthController.cs)
- **Service**: [AuthService.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Auth/Services/AuthService.cs)
- **Context Config**: [ApplicationDbContext.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Shared/Persistence/ApplicationDbContext.cs)
- **Database Schema seeder**: [SuperAdminSeeder.cs](file:///d:/Semester%205/SWP391/swp391-su26-ai-audit-project-swp391_se20a02_group-05/CVerify/CVerify.Core/Modules/Shared/Persistence/SuperAdminSeeder.cs)
