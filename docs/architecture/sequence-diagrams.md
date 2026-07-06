# Sequence Diagrams

This document contains runtime sequence diagrams detailing the interactions between users, the Next.js frontend, backend controllers, services, database contexts, and external systems.

---

## Overview

These sequence diagrams illustrate the runtime behavior of the CVerify platform. They document the authentication handshake, repository analysis pipelines, CV parsing, recruiter matching checks, and multi-sig representative voting recovery sessions.

---

## Authentication

### Login Flow

#### Feature Name: Login & Session Initiation

#### Purpose: Authenticate credentials, handle unverified states, and issue session cookies.

#### Trigger: Guest clicks the "Sign In" button on `/login`.

#### Preconditions: User account exists in database.

#### Sequence Diagram:
```mermaid
sequenceDiagram
    actor Guest
    participant Web as Next.js Web App
    participant API as CVerify Web API
    participant Auth as AuthService
    participant DB as ApplicationDbContext
    participant Google as Google OAuth API

    Guest->>Web: Input email & password, click Login
    activate Web
    Web->>API: POST /api/auth/login (email, password)
    activate API
    API->>Auth: LoginAsync(request)
    activate Auth
    Auth->>DB: SELECT * FROM Users WHERE Email = email
    activate DB
    DB-->>Auth: User Entity (PasswordHash, Status)
    deactivate DB
    
    alt User Not Found OR Password Invalid
        Auth-->>API: Throw AuthenticationException(InvalidCredentials)
        API-->>Web: 401 Unauthorized
        Web-->>Guest: Display "Invalid email or password" toast
    else Account Suspended
        Auth-->>API: Throw AuthenticationException(AccountSuspended)
        API-->>Web: 403 Forbidden
        Web-->>Guest: Redirect to /auth/reactivate
    else Email Verification Pending
        Auth-->>API: Return User (Status = VerifyPending)
        API-->>Web: 200 OK (Status = VerifyPending, UserId)
        Web-->>Guest: Redirect to /verify-email
    else Authentication Success
        Auth->>Auth: Generate JWT Cookie
        Auth-->>API: AuthResponse (Success, UserInfo)
        deactivate Auth
        API-->>Web: 200 OK (Sets HTTP-Only Cookie)
        Web->>Web: AuthOrchestrator processes state
        Web-->>Guest: Redirect to Dashboard (/user or /business)
    end
    deactivate API
    deactivate Web

    %% Google OAuth Opt Flow
    Guest->>Web: Click "Sign in with Google"
    activate Web
    Web->>Google: Redirect to Google Login screen
    Google-->>Web: Return authorization code
    Web->>API: POST /api/auth/google (authCode)
    activate API
    API->>Auth: LoginWithGoogleAsync(request)
    activate Auth
    Auth->>Google: Validate token code
    Google-->>Auth: Email, Name, Profile Image
    Auth->>DB: SELECT * FROM Users WHERE Email = GoogleEmail
    activate DB
    DB-->>Auth: User details
    deactivate DB
    Auth-->>API: AuthResponse (Success)
    deactivate Auth
    API-->>Web: Login Success (Set Cookie)
    Web-->>Guest: Redirect to Dashboard
    deactivate API
    deactivate Web
```

#### Alternative Flows:
* **Google registration**: If a Google account does not exist in the database, the system registers them, sets status to `Active`, and logs them in.

#### Error Flows:
* **Rate Limits**: IP address sending more than 5 login attempts per minute receives a 429 Too Many Requests response.

#### Postconditions:
* Authenticated user session registered in Redis cache.

#### Database Operations:
* `SELECT` from `users` (query email).
* `INSERT` into `audit_logs` (log authentication event).

#### APIs Invoked:
* `POST /api/auth/login` (Internal)
* `POST https://oauth2.googleapis.com/token` (External)

#### Security Checks:
* Password compared using Identity PasswordHasher.
* Origin checks verifying IP and User-Agent headers.

---

### Register Flow

#### Feature Name: User Account Registration

#### Purpose: Register user records and deliver email verification links.

#### Trigger: User submits registration form on `/continue-with-email`.

#### Preconditions: None.

#### Sequence Diagram:
```mermaid
sequenceDiagram
    actor Guest
    participant Web as Next.js Web App
    participant API as CVerify Web API
    participant Auth as AuthService
    participant DB as ApplicationDbContext
    participant Outbox as EmailOutbox
    participant SMTP as SMTP Email Service

    Guest->>Web: Submit Name, Email, Password
    activate Web
    Web->>API: POST /api/auth/register (name, email, password)
    activate API
    API->>Auth: RegisterAsync(request, userAgent, ipAddress, token)
    activate Auth
    Auth->>DB: SELECT EXISTS FROM Users WHERE Email = email
    activate DB
    DB-->>Auth: Boolean (false)
    deactivate DB
    
    alt Email Already Exists
        Auth-->>API: Throw ValidationException("Email occupied")
        API-->>Web: 409 Conflict
        Web-->>Guest: Display "Email already registered" alert
    else Registration Valid
        Auth->>Auth: Hash Password (BCrypt)
        Auth->>DB: INSERT INTO Users (Email, PasswordHash, Status='VerifyPending')
        activate DB
        DB-->>Auth: User Entity
        deactivate DB
        Auth->>Auth: Generate secure verification token
        Auth->>DB: INSERT INTO VerificationTokens (UserId, TokenHash, ExpiresAt)
        activate DB
        DB-->>Auth: Token Details
        deactivate DB
        Auth->>DB: INSERT INTO OutboxMessages (Type='EmailVerification', Recipient, Payload)
        activate DB
        DB-->>Auth: Outbox Record
        deactivate DB
        Auth-->>API: RegisterResponse (Success)
        deactivate Auth
        API-->>Web: 200 OK (Registration success)
        Web-->>Guest: Redirect to /verify-email (waiting for verification link action)
    end
    deactivate API
    deactivate Web

    %% Background Outbox check
    par Outbox Mail Delivery
        loop Every 5 Seconds
            Outbox->>DB: SELECT pending from OutboxMessages
            activate DB
            DB-->>Outbox: List of messages
            deactivate DB
            Outbox->>SMTP: Connect & Send verification email
            activate SMTP
            SMTP-->>Outbox: Dispatch confirmation
            deactivate SMTP
            Outbox->>DB: UPDATE OutboxMessages SET Status='Sent'
        end
    end
```

#### Database Operations:
* `SELECT` from `users` (check email existence).
* `INSERT` into `users` (create user).
* `INSERT` into `verification_tokens` (store hashed validation token).
* `INSERT` into `outbox_messages` (queue email verification).

#### APIs Invoked:
* `POST /api/auth/register` (Internal)

#### Security Checks:
* Input validation verifying email syntax and password complexity rules.
* Redirect domain validation checking against trusted host list configurations.

---

## Repository Management

### Sync & Analysis Flow

#### Feature Name: Source Code Repository Sync & AI Vetting

#### Purpose: Download repository codebase files and run AI vetting diagnostics.

#### Trigger: Candidate checks repositories and clicks "Sync Selected" in `/settings/source-code-providers`.

#### Preconditions: Candidate's GitHub/GitLab OAuth token is linked.

#### Sequence Diagram:
```mermaid
sequenceDiagram
    actor Candidate
    participant Web as Next.js Web App
    participant API as CVerify Web API
    participant Guard as AuthMiddleware
    participant Queue as RepositorySyncQueue
    participant Sync as SyncProcessor (Background)
    participant Git as GitHub API
    participant Analysis as BackgroundAnalysisProcessor
    participant AI as FastAPI AI Service
    participant DB as ApplicationDbContext

    Candidate->>Web: Select repos, click Sync Selected
    activate Web
    Web->>API: POST /api/source-code-providers/repositories/sync (repoSlugs)
    activate API
    API->>Guard: Validate JWT & permission (evidence:graph:edit)
    Guard-->>API: Authorized
    API->>Queue: QueueRepositorySyncs(userId, repoSlugs)
    activate Queue
    Queue->>DB: INSERT INTO AnalysisJobs (Status='Queued')
    activate DB
    DB-->>Queue: Job Entity
    deactivate DB
    Queue-->>API: Jobs Queued Details
    deactivate Queue
    API-->>Web: 202 Accepted (Sync started)
    Web->>Web: Connect to SSE Stream (/api/streaming/candidate-assessment)
    deactivate API
    deactivate Web

    %% Background worker pulls files
    activate Sync
    Sync->>DB: SELECT next Queued from AnalysisJobs
    activate DB
    DB-->>Sync: Job details
    deactivate DB
    Sync->>DB: UPDATE AnalysisJobs SET Status='Syncing'
    Sync->>DB: SELECT AccessToken FROM AuthProviders WHERE UserId = userId
    activate DB
    DB-->>Sync: OAuth Token
    deactivate DB
    Sync->>Git: Download repository archive files (using Token)
    activate Git
    Git-->>Sync: Zip/tarball files stream
    deactivate Git
    Sync->>Sync: Extract files to temporary workspace
    Sync->>DB: UPDATE AnalysisJobs SET Status='Analyzing'
    deactivate Sync

    %% Analysis begins
    activate Analysis
    Analysis->>DB: SELECT next Analyzing from AnalysisJobs
    activate DB
    DB-->>Analysis: Job Details
    deactivate DB
    Analysis->>AI: POST /analyze-repository (workspacePath)
    activate AI
    Note over AI: AI extracts capability nodes, complexity, plagiarism
    AI-->>Analysis: JSON Vetting Report (Maturity, ProblemSolving, Plagiarism details)
    deactivate AI
    Analysis->>DB: INSERT INTO CandidateAssessmentArtifacts (ReportDetails)
    Analysis->>DB: UPDATE AnalysisJobs SET Status='Completed'
    Analysis->>DB: INSERT INTO InAppNotifications (Message='Vetting completed')
    deactivate Analysis
```

#### Database Operations:
* `SELECT` from `auth_providers` (OAuth tokens).
* `INSERT` / `UPDATE` on `analysis_jobs`.
* `INSERT` into `candidate_assessment_artifacts`.

#### APIs Invoked:
* `POST /api/source-code-providers/repositories/sync` (Internal API)
* `GET https://api.github.com/repos/{owner}/{repo}/zipball` (External API)
* `POST {FastApiUrl}/analyze-repository` (External AI Service)

---

## AI Analysis

### Resume Vetting & Assessment Flow

#### Feature Name: Resume CV Parsing & Evaluation

#### Purpose: Upload PDF files, parse experience, and index candidate summaries.

#### Trigger: Candidate drops a PDF resume in the dropzone on `/cv`.

#### Preconditions: Candidate account verified.

#### Sequence Diagram:
```mermaid
sequenceDiagram
    actor Candidate
    participant Web as Next.js Web App
    participant API as CVerify Web API
    participant R2 as Cloudflare R2 Storage
    participant Indexer as CvRepositoryIndexer
    participant AI as FastAPI AI Service
    participant DB as ApplicationDbContext

    Candidate->>Web: Drag & Drop PDF Resume file
    activate Web
    Web->>API: POST /api/profile/cv (File Stream)
    activate API
    API->>API: Validate file format (must be PDF, size < 10MB)
    API->>R2: Upload file stream (signed uploader)
    activate R2
    R2-->>API: Saved PDF URL key
    deactivate R2
    
    API->>Indexer: ParseResumeAsync(FileStream)
    activate Indexer
    Indexer->>AI: POST /parse-cv (File Text extractor)
    activate AI
    AI-->>Indexer: JSON parsed fields (Name, Bio, Experiences, Key Skills)
    deactivate AI
    Indexer-->>API: Parsed profile logs
    deactivate Indexer
    API-->>Web: 200 OK (Parsed details preview)
    deactivate API
    deactivate Web

    %% User indexes CV
    Candidate->>Web: Click "Index Profile Summary"
    activate Web
    Web->>API: POST /api/profile/cv/index
    activate API
    API->>DB: INSERT INTO UserProfiles (FullName, Bio, Skills)
    activate DB
    DB-->>API: Profile Entity
    deactivate DB
    API-->>Web: 200 OK (Profile saved)
    Web-->>Candidate: Redirect to AI Analysis dashboard
    deactivate API
    deactivate Web
```

#### Database Operations:
* `INSERT` / `UPDATE` on `user_profiles`.
* `INSERT` into `profile_attachments` (R2 URLs).

---

## Recruitment

### Candidate Match Sourcing Flow

#### Feature Name: Job JD Candidate Sourcing Match

#### Purpose: Analyze candidates eligibility matches for a Job vacancy.

#### Trigger: Recruiter clicks "Match Candidates" on `/recruitment/jd/[id]/review`.

#### Preconditions: JD exists and has extracted requirements.

#### Sequence Diagram:
```mermaid
sequenceDiagram
    actor Recruiter
    participant Web as Next.js Web App
    participant API as CVerify Web API
    participant MatchService as ExplainableMatchService
    participant Evaluation as CandidateEvaluationService
    participant Engine as UnifiedMatchingEngine
    participant DB as ApplicationDbContext

    Recruiter->>Web: Click Match Candidates on vacancy view
    activate Web
    Web->>API: POST /api/intelligence/jobs/{id}/match
    activate API
    API->>API: Validate permissions (verification:view:list)
    API->>MatchService: EvaluateMatchAsync(jobId, candidateId)
    activate MatchService
    MatchService->>DB: SELECT * FROM JobVacancies WHERE Id = jobId
    activate DB
    DB-->>MatchService: JobVacancy details (Skills, Requirements)
    deactivate DB
    MatchService->>Evaluation: GetCapabilityIntelligenceAsync(candidateId)
    activate Evaluation
    Evaluation->>DB: SELECT Capability nodes FROM DB
    activate DB
    DB-->>Evaluation: Candidate capability DTO
    deactivate DB
    Evaluation-->>MatchService: Intelligence DTO
    deactivate Evaluation
    
    MatchService->>Engine: EvaluateMatchAsync(intelligence, jobRequirement, token)
    activate Engine
    Note over Engine: Computes capability fit, documentation, & plagiarism
    Engine-->>MatchService: UnifiedMatchResult (Scores, explanations)
    deactivate Engine
    
    MatchService->>DB: INSERT/UPDATE MatchingEvaluations (Result JSON)
    activate DB
    DB-->>MatchService: Saved Entity
    deactivate DB
    MatchService-->>API: MatchingEvaluation
    deactivate MatchService
    API-->>Web: 200 OK (Returns matched list sorted by score)
    Web-->>Recruiter: Renders matched candidate table
    deactivate API
    deactivate Web
```

---

## Emergency Recovery

### Multi-sig Representative Voting Flow

#### Feature Name: Multi-sig Representative Lockout Recovery Vote

#### Purpose: Cast representative votes to authorize owner email changes.

#### Trigger: Representative clicks vote option link on `/organization/recovery/vote`.

#### Preconditions: Active recovery session.

#### Sequence Diagram:
```mermaid
sequenceDiagram
    actor Representative
    participant Web as Next.js Web App
    participant API as CVerify Web API
    participant Recovery as Level2RecoveryService
    participant DB as ApplicationDbContext
    participant Mail as SMTP Email Service

    Representative->>Web: Open recovery invite link, click Approve Recovery
    activate Web
    Web->>API: POST /api/recovery/session/{sessionId}/vote (voterEmail, Vote='Approve')
    activate API
    API->>Recovery: SubmitAdminVoteAsync(token, 'Approve', ip, agent, token)
    activate Recovery
    Recovery->>DB: SELECT * FROM ApprovedRecoverySessions WHERE Id = sessionId
    activate DB
    DB-->>Recovery: Session Details (ExpirationTime, OrganizationId)
    deactivate DB
    
    alt Session Expired OR Invalid
        Recovery-->>API: Throw ValidationException("Session expired")
        API-->>Web: 400 Bad Request
    else Vote Valid
        Recovery->>DB: INSERT INTO RepresentativeApprovalVotes (SessionId, VoterEmail, Vote='Approve')
        Recovery->>Recovery: CheckThresholdReachedAsync(sessionId)
        
        alt Threshold Met (e.g. 2 of 3 votes)
            Recovery->>DB: UPDATE ApprovedRecoverySessions SET Status='Executed'
            Recovery->>DB: UPDATE Users SET Email = NewEmail WHERE Role='Owner' (For org)
            Recovery->>Mail: Queue Recovery Success emails to all admins
            Recovery-->>API: Vote cast & recovery executed
        else Threshold Pending
            Recovery-->>API: Vote cast successfully
        end
        deactivate Recovery
        API-->>Web: 200 OK (Vote registered)
        Web-->>Representative: Displays "Vote cast successfully" confirmation page
    end
    deactivate API
    deactivate Web
```

#### Database Operations:
* `SELECT` from `approved_recovery_sessions`.
* `INSERT` into `representative_approval_votes`.
* `UPDATE` on `approved_recovery_sessions`.
* `UPDATE` on `users` (owner email rotation).
