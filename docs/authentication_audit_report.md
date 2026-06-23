# CVerify Authentication Test Suite Audit Report

## 1. General Information

| Information | Content |
|---|---|
| Course | Software Development Project |
| Course Code | SWP391 |
| Class | SE20A02 |
| Semester | SU26 |
| Project / Module | CVerify - Authentication & Identity System |
| Student / Lead Auditor | Đoàn Thế Lực |
| Student ID | DE200523 |
| Audit Date | 2026-07-07 |

---

## 2. Audit Executive Summary

This report documents a comprehensive audit of the authentication and security-enforcement mechanisms of CVerify.

### Environment & Execution History
- **Round 1 & Round 2**: Integration tests were **Blocked** due to the absence of a running Docker daemon (required by Testcontainers for PostgreSQL and Redis). Unit-level state machine tests were executed and passed successfully.
- **Round 3**: The local Docker Desktop environment was successfully started, resolving container creation blocks. The entire integration test suite (`CVerify.API.IntegrationTests`) was executed dynamically, resulting in **100% Passed** status across all 26 authentication test cases (`AUTH-001` through `AUTH-026`).

### Result Column Rules
- **Passed**: The test case was successfully executed and validated.
- **Blocked**: The test case maps to an integration test that was blocked from execution in that round due to environment constraints.
- **N/A**: The test case maps to a scenario that is missing implementation or test coverage.

---

## 3. Test Coverage & Execution Matrix

This matrix maps each of the 26 logical authentication test cases (`AUTH-001` through `AUTH-026`) to its corresponding source code file and test method in the CVerify test proj| Test ID | Test Case Name | Source File | Test Method | Coverage Status | Execution Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **AUTH-001** | Standard Email Registration | [RegistrationFlowTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/RegistrationFlowTests.cs) | `Register_With_Valid_Inputs_Should_Return_Success` | **Covered** | **Passed** |
| **AUTH-002** | Registration Password Strength | [RegistrationFlowTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/RegistrationFlowTests.cs) | `Register_With_Weak_Password_Should_Return_BadRequest` | **Covered** | **Passed** |
| **AUTH-003** | Password Mismatch Check | [RegistrationFlowTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/RegistrationFlowTests.cs) | `Register_With_Mismatched_ConfirmPassword_Should_Return_BadRequest` | **Covered** | **Passed** |
| **AUTH-004** | Duplicate Email Conflict | [RegistrationFlowTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/RegistrationFlowTests.cs) | `Register_With_Duplicate_Email_Active_Should_Return_Conflict` | **Covered** | **Passed** |
| **AUTH-005** | Duplicate Pending Verify | [RegistrationFlowTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/RegistrationFlowTests.cs) | `Register_With_Duplicate_Email_Pending_Should_Resend_Verification` | **Covered** | **Passed** |
| **AUTH-006** | Email Input Normalization | [RegistrationFlowTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/RegistrationFlowTests.cs) | `Register_Should_Normalize_Email` | **Covered** | **Passed** |
| **AUTH-007** | Special Char Preservation | [RegistrationFlowTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/RegistrationFlowTests.cs) | `Register_With_Special_Email_Characters_Should_Preserve_Email_Exactly` | **Covered** | **Passed** |
| **AUTH-008** | Email Verification (Valid) | [VerifyEmailFlowTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/VerifyEmailFlowTests.cs) | `Verify_With_Valid_Token_Should_Activate_User` | **Covered** | **Passed** |
| **AUTH-009** | Email Verification (Expired) | [VerifyEmailFlowTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/VerifyEmailFlowTests.cs) | `Verify_With_Expired_Token_Should_Throw_ExpiredToken_Error` | **Covered** | **Passed** |
| **AUTH-010** | Verification Token Re-use | [VerifyEmailFlowTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/VerifyEmailFlowTests.cs) | `Verify_Twice_With_Same_Token_Should_Throw_AlreadyConsumed_Error` | **Covered** | **Passed** |
| **AUTH-011** | Forgot Password Active | [ForgotPasswordFlowTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/ForgotPasswordFlowTests.cs) | `ForgotPassword_For_Active_User_Should_Create_Token_And_Outbox` | **Covered** | **Passed** |
| **AUTH-012** | Forgot Password Unknown | [ForgotPasswordFlowTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/ForgotPasswordFlowTests.cs) | `ForgotPassword_For_Unknown_Email_Should_Return_Success_Idempotently` | **Covered** | **Passed** |
| **AUTH-013** | Forgot Password Cooldown | [ForgotPasswordFlowTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/ForgotPasswordFlowTests.cs)<br>[ProductionEnforcementTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/ProductionEnforcementTests.cs) | `ForgotPassword_Subsequent_Requests_Within_Cooldown_Should_Throw_CooldownActive_Error`<br>`ForgotPassword_EnforcesCooldown_And_WritesToRedis` | **Covered** | **Passed** |
| **AUTH-014** | Reset Password (Valid) | [ResetPasswordFlowTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/ResetPasswordFlowTests.cs) | `ResetPassword_With_Valid_Token_Should_Succeed_And_Update_Password` | **Covered** | **Passed** |
| **AUTH-015** | Reset Password (Expired) | [ResetPasswordFlowTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/ResetPasswordFlowTests.cs) | `ResetPassword_With_Expired_Token_Should_Throw_ExpiredToken_Error` | **Covered** | **Passed** |
| **AUTH-016** | Reset Password Mismatch | [ResetPasswordFlowTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/ResetPasswordFlowTests.cs) | `ResetPassword_With_Mismatched_Passwords_Should_Return_BadRequest` | **Covered** | **Passed** |
| **AUTH-017** | Session Session (RememberMe=F) | [RefreshTokenRotationTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/RefreshTokenRotationTests.cs) | `RememberMe_False_Should_Expire_In_24_Hours` | **Covered** | **Passed** |
| **AUTH-018** | Session Session (RememberMe=T) | [RefreshTokenRotationTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/RefreshTokenRotationTests.cs) | `RememberMe_True_Should_Expire_In_7_Days` | **Covered** | **Passed** |
| **AUTH-019** | RTR Concurrency Grace Period | [RefreshTokenRotationTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/RefreshTokenRotationTests.cs) | `ConcurrentRefreshes_WithinGracePeriod_Should_Succeed_And_Return_ReplacementToken` | **Covered** | **Passed** |
| **AUTH-020** | Refresh Token Theft | [SessionRevocationTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/SessionRevocationTests.cs) | `RefreshTokenTheft_Should_Revoke_Compromised_Session_Lineage_Only_Leaving_Other_Sessions_Active` | **Covered** | **Passed** |
| **AUTH-021** | Active Session Validation | [SessionRevocationTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/SessionRevocationTests.cs) | `ValidSid_ActiveSession_Should_Pass` | **Covered** | **Passed** |
| **AUTH-022** | Revoked Session Rejection | [SessionRevocationTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/SessionRevocationTests.cs) | `ValidSid_RevokedSession_Should_Fail` | **Covered** | **Passed** |
| **AUTH-023** | Account Lockout Policy | [ProductionEnforcementTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/ProductionEnforcementTests.cs) | `LoginFailedAttempts_EnforcesAccountLockout` | **Covered** | **Passed** |
| **AUTH-024** | Tenant/Workspace Boundary | [WorkspaceManagementTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/WorkspaceManagementTests.cs) | `PermissionBoundaryIsolation_ShouldBeEnforced` | **Covered** | **Passed** |
| **AUTH-025** | Production Safety Guards | [ProductionEnforcementTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/ProductionEnforcementTests.cs) | `Startup_ThrowsException_If_DisableRateLimits_In_Production` | **Covered** | **Passed** |
| **AUTH-026** | Security headers integration | [SecurityHeadersTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.IntegrationTests/Auth/SecurityHeadersTests.cs) (Integration)<br>[SecurityHeadersMiddlewareTests.cs](file:///d:/Coding%20Space/Github/CVerify/CVerify.Core/tests/CVerify.API.UnitTests/Security/SecurityHeadersMiddlewareTests.cs) (Unit) | `Auth_Endpoints_Should_Expose_Strict_Security_Headers` (Integration)<br>`InvokeAsync_OnAuthPath_ShouldApplySecurityHeaders` (Unit) | **Covered** | **Passed** |
 
 ---
 
 ## 4. Detailed Audit Results
 
 Below is the official audit sheet populated based on the CVerify authentication codebase.
 
 | Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions | Round 1 | R1 Test date | R1 Tester | Round 2 | R2 Test date | R2 Tester | Round 3 | R3 Test date | R3 Tester | Note |
 | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **AUTH-001** | Standard user registration | Send POST to `/api/auth/register` with valid fields (email, matching password, full name). | Returns 200 OK. Body status code `REGISTRATION_SUCCESS`. DB record created in state `EMAIL_VERIFY_PENDING`. | System role seeded. Target email is not in use. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Database seeds USER role correctly and creates pending registration. |
| **AUTH-002** | Registration with weak password | Register with password `123`. | Returns 400 BadRequest. | System roles seeded. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Weak password validator rejects the password. |
| **AUTH-003** | Mismatched password validation | Register with passwords `SecurePassword123!` and `DifferentPassword123!`. | Returns 400 BadRequest. | System roles seeded. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. ConfirmPassword validation matches Password validation constraints. |
| **AUTH-004** | Registration with duplicate active email | Attempt registration using an email associated with an `ACTIVE` account. | Returns 409 Conflict. Response error code `EmailAlreadyExists`. | User exists with status `ACTIVE`. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Duplicate active user conflicts are caught and prevent multiple email reuse. |
| **AUTH-005** | Registration with pending duplicate email | Attempt registration using an email associated with a `PENDING` account. | Returns 200 OK with status `REGISTRATION_PENDING_VERIFY`. Re-triggers/resends verification OTP. | User exists with status `EMAIL_VERIFY_PENDING`. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Resends email verification token instead of duplicating database records. |
| **AUTH-006** | Email input normalization | Register with email `  NoRmAlIzE@cVeRiFy.aI   `. | Returns 200 OK. Database email matches normalized format `normalize@cverify.ai`. | Email is not already registered. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Emails are low-cased and trimmed during validation and insertion stages. |
| **AUTH-007** | Special character email registration | Register with subaddressed and dotted emails (`theluc+work@gmail.com`). | Returns 200 OK. Database preserves email exactly in normalized form. | Emails are not already in use. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Dotted subaddresses are preserved during standard registration. |
| **AUTH-008** | Email verification (valid token) | Send POST to `/api/auth/verify-email` with a valid active token. | Returns 200 OK. DB User status changes to `ACTIVE`. | User status is `EMAIL_VERIFY_PENDING`. Valid token exists. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Verification consumes token and updates status to ACTIVE. |
| **AUTH-009** | Email verification (expired token) | Send POST to `/api/auth/verify-email` with an expired token. | Returns 400 BadRequest with code `ExpiredToken`. | User exists. Verification token has expired in DB. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Rejects verification and throws ExpiredToken code. |
| **AUTH-010** | Verification token double-use | Submit the same email verification token twice. | First call returns 200 OK. Second call returns 400 BadRequest with code `TokenAlreadyConsumed`. | Valid token exists. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Tokens are marked consumed immediately to prevent reuse attacks. |
| **AUTH-011** | Forgot password token generation | Send POST to `/api/auth/forgot-password` for active user. | Returns 200 OK. Reset token generated in DB. Email queued in outbox. | User exists with status `ACTIVE`. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Generates token and successfully dispatches email. |
| **AUTH-012** | Forgot password idempotent response | Send POST to `/api/auth/forgot-password` with unregistered email. | Returns 200 OK idempotently. No outbox message queued. | Target email does not exist in system. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Responds with success to prevent user identification leaks. |
| **AUTH-013** | Forgot password cooldown check | Request password reset twice in under 1 minute. | First request succeeds. Second request returns 400 BadRequest with code `CooldownActive`. | User exists and is active. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Redis cache checks correctly reject subsequent requests within 1 minute. |
| **AUTH-014** | Reset password (valid token) | Send POST to `/api/auth/reset-password` with valid token and matching passwords. | Returns 200 OK. User password hash updated in DB. | Valid reset token exists in database. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Password hashes update in database using BCrypt. |
| **AUTH-015** | Reset password (expired token) | Send POST to `/api/auth/reset-password` with expired token. | Returns 400 BadRequest with code `ExpiredToken`. | Reset token exists but has expired. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Rejects reset flow for expired tokens. |
| **AUTH-016** | Reset password mismatch | Send POST to `/api/auth/reset-password` with mismatching passwords. | Returns 400 BadRequest. | Valid token exists. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Backend validation asserts matching parameters. |
| **AUTH-017** | RememberMe = False session lifetime | Refresh token rotation with `RememberMe` set to false. | Returns HTTP 200. Replacement refresh token `ExpiresAt` is set to 24 hours. | Active session exists with `RememberMe` set to false. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Claims duration verified at 24 hours. |
| **AUTH-018** | RememberMe = True session lifetime | Refresh token rotation with `RememberMe` set to true. | Returns HTTP 200. Replacement token `ExpiresAt` is set to 7 days. | Active session exists with `RememberMe` set to true. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Claims duration verified at 7 days. |
| **AUTH-019** | Refresh token rotation concurrency | Send concurrent refresh requests using the same token within 10 seconds. | Returns 200 OK. Both requests return valid access tokens (grace period allowance). | Refresh token was recently rotated (within 10s). | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Grace period ensures multi-tab concurrent refreshes succeed. |
| **AUTH-020** | Refresh token theft lineage revocation | Refresh presenting a token already rotated outside the grace period. | Returns 400 BadRequest with code `InvalidToken`. All active tokens in that session chain are revoked. | Compromised token was previously revoked outside grace period. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Session invalidation logic revokes the full family lineage. |
| **AUTH-021** | Active session validation | Send request to secure endpoint `/api/auth/me` with valid access token cookie. | Returns 200 OK with user profile details. | Active valid session cookies. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Authenticated endpoints load active user info successfully. |
| **AUTH-022** | Revoked session rejection | Send request to `/api/auth/me` with a cookie belonging to a revoked session. | Returns 401 Unauthorized. | Session refresh token is marked revoked. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Revoked session rejection verified by security middleware. |
| **AUTH-023** | Account Lockout Boundary | Attempt login with incorrect password 6 times consecutively. | 5 attempts return 401. 6th attempt returns 403 Forbidden. User `LockUntil` timestamp is set. | User exists. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Locks account after 5 consecutive failures. |
| **AUTH-024** | Tenant and authorization boundaries | Request workspace resources using member vs non-member credentials. | Member is authorized. Non-member receives 403 Forbidden. | Workspace/Organization exists. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Workspace boundaries and tenant isolation are enforced. |
| **AUTH-025** | Production environment security enforcements | Set environment to `Production` and enable `DISABLE_RATE_LIMITS` or `SEED_TEST_ACCOUNTS`. | Application startup fails with `InvalidOperationException`. | Environment configured as `Production`. | **Blocked** | 2026-07-07 | Đoàn Thế Lực (AI) | **Blocked** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in Round 3 integration run. Environment validation prevents boot. |
| **AUTH-026** | Security headers integration | Request access token from Auth endpoints and verify headers. | Returns cache-control no-store headers, `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY`. | Endpoint accessed. | **Passed** | 2026-07-07 | Đoàn Thế Lực (AI) | **Passed** | 2026-07-07 | Đoàn Thế Lực | **Passed** | 2026-07-07 | Đoàn Thế Lực | Passed in R1/R2/R3. Verified via unit test SecurityHeadersMiddlewareTests.cs (and integration tests in R3). |

---

## 5. Test Quality Evaluation

The quality, robustness, and maintainability of the CVerify authentication test suite were evaluated statically. The findings are summarized below.

### Assertion Completeness
- **Strengths**: The tests verify multiple layers of execution. For example, in `RefreshTokenRotationTests.cs`, the assertions do not just stop at `HttpStatusCode.OK` on the response. They open a new database scope and assert that:
  - The old token has `IsRevoked == true`.
  - The replaced token ID is correct.
  - The replacement token maintains matching session metadata (e.g., matching `RememberMe` values).
- **Weaknesses**: Some validation tests (e.g., `Register_With_Weak_Password_Should_Return_BadRequest`) rely strictly on HTTP status code checks (`response.StatusCode.Should().Be(HttpStatusCode.BadRequest)`). They do not parse the problem details validation message to confirm *which* validation rule failed. This could lead to false positives if the request failed due to another unrelated bad request issue.

### Test Isolation
- **Strengths**: The integration test suite uses `SharedTestcontainerFixture` as a base. Isolation is achieved by database state teardown and setup between tests using **Respawn** (as documented in `TESTING.md`).
- **Weaknesses**: Tests share a single PostgreSQL and Redis test container lifecycle. If a test case modifies global configuration parameters or fails to clean up cache keys (e.g., Redis entries with long TTLs), it could contaminate downstream test runs.

### Environment Dependencies
- **Strengths**: Testing dependencies (PostgreSQL database and Redis cache) are abstracted using Testcontainers. This ensures a uniform database and cache platform that mirrors production.
- **Weaknesses**: The test suite cannot run without a Docker host. The suite lacks fallback mocks for local test execution when a developer's Docker daemon is down. This creates an all-or-nothing test environment constraint.

### Skipped & Missing Tests
- **Skipped Tests**: Unit tests contain skipped verification steps. For example:
  - `CVerify.API.UnitTests.Security.DecryptTokensTest.TestDecryptTokens` is permanently skipped (`[SKIP]`).
- **Missing Integration Coverage**:
  - **Super Admin Bypass**: While `screen-specification.md` documents Super Admin OTP bypass, there is a lack of strict integration tests demonstrating that a Super Admin *actually* bypasses OTP checks during a mock login flow.
  - **Session Inactivity Lock**: The frontend inactivity auto-logout flow has no automated end-to-end integration tests in this backend suite.

### Duplicated Coverage
- Cooldown behaviors for password reset requests are verified in both `ForgotPasswordFlowTests.cs` and `ProductionEnforcementTests.cs`. While verifying these controls under different environment conditions (e.g., rate limits enabled vs disabled) is useful, it introduces code redundancy and maintenance overhead.

### Maintainability
- The test suite implements the **Builder Pattern** (e.g., `UserBuilder`, `TokenBuilder`) for seeding database states. This isolates tests from changes in database entity constructor signatures, significantly enhancing long-term maintainability.

---

## 6. Recommendations

The following recommendations are proposed to improve the authentication system security, test quality, and environment resilience.

### 1. Critical Fixes
- **Specify BadRequest Validation Assertions**: Update DTO validation integration tests (like password strength check) to parse the `ProblemDetails` validation payload. Assert that the validation error specifically mentions the password constraints to prevent false positives.

### 2. Security Improvements
- **Audit Logging of Blocked Session IDs**: In the session validation middleware, when a request is blocked due to an inactive/revoked session ID, ensure an audit log entry is written with the normalized IP address and session identifier.

### 3. Functional Fixes
- **Enable Super Admin Bypass Integration Test**: Implement a dedicated integration test under `DevelopmentBypassTests.cs` validating that configured Super Admin accounts bypass OTP challenge checkpoints successfully.

### 4. Test Environment Improvements
- **Fallback Database Mocking for Integration Tests**: Introduce a flag or configuration to swap Postgres Testcontainers with an in-memory SQLite provider when no Docker host is detected, allowing a subset of database-dependent flows to be tested without Docker.

### 5. Automation Opportunities
- **Automate Test Suite Verification in CI**: Add a GitHub Action workflow executing `dotnet test` with a hosted runner providing a Docker daemon (e.g., `ubuntu-latest` with built-in Docker engine support). This will ensure that integration tests run automatically on every pull request.
