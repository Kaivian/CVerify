# 3.3 Class Diagrams & Object-Oriented Design

This document details the object-oriented class structure of the CVerify system, mapping core domain entities, services, controllers, and their dependencies on the C4 class level.

---

## 3.3.1 Overview

CVerify's backend engine (`CVerify.Core`) is built using clean architecture principles structured into domain modules. Controllers act as input boundary interfaces (Application layer), delegating business logic execution to scoped domain services (Domain layer), which interact with database entities and models using Entity Framework Core `ApplicationDbContext` configurations (Infrastructure layer).

---

## 3.3.2 Overall Domain Class Diagram

The following diagram illustrates the relationship between key platform domain objects:

```mermaid
classDiagram
    %% Core Entities
    class User {
        +Guid Id
        +string Email
        +string PasswordHash
        +string Status
        +DateTime CreatedAt
        +DateTime? LastLoginAt
        +List~RoleAssignment~ RoleAssignments
    }

    class UserProfile {
        +Guid Id
        +Guid UserId
        +string FullName
        +string Bio
        +bool SearchVisible
        +string CandidateStatus
        +DateTime UpdatedAt
    }

    class Organization {
        +Guid Id
        +string Name
        +string Slug
        +string TaxCode
        +string Address
        +string LogoUrl
        +string VerificationLevel
        +List~Workspace~ Workspaces
    }

    class Workspace {
        +Guid Id
        +Guid OrganizationId
        +string Name
        +bool IsDefault
        +DateTime CreatedAt
        +List~JobVacancy~ JobVacancies
    }

    class JobVacancy {
        +Guid Id
        +Guid WorkspaceId
        +string Title
        +string Description
        +string Status
        +DateTime CreatedAt
        +List~JobApplication~ Applications
    }

    class JobApplication {
        +Guid Id
        +Guid JobId
        +Guid CandidateId
        +string PipelineStage
        +DateTime AppliedAt
    }

    class CandidateAssessment {
        +Guid Id
        +Guid UserId
        +double OverallScore
        +string Status
        +string SummaryHeadline
        +List~CandidateAssessmentArtifact~ Artifacts
    }

    class CandidateAssessmentArtifact {
        +Guid Id
        +Guid AssessmentId
        +string ArtifactType
        +string JsonData
        +DateTime GeneratedAt
    }

    class ApprovedRecoverySession {
        +Guid Id
        +Guid OrganizationId
        +string SessionStatus
        +DateTime ExpirationTime
        +List~RepresentativeApprovalVote~ Votes
    }

    class RepresentativeApprovalVote {
        +Guid Id
        +Guid SessionId
        +string VoterEmail
        +string VoteResult
        +DateTime VotedAt
    }

    %% Relationships
    User "1" *-- "1" UserProfile : owns
    User "1" *-- "*" CandidateAssessment : initiates
    Organization "1" *-- "*" Workspace : provisions
    Workspace "1" *-- "*" JobVacancy : hosts
    JobVacancy "1" *-- "*" JobApplication : receives
    User "1" <-- "1" JobApplication : applies
    CandidateAssessment "1" *-- "*" CandidateAssessmentArtifact : compiles
    Organization "1" *-- "*" ApprovedRecoverySession : triggers
    ApprovedRecoverySession "1" *-- "*" RepresentativeApprovalVote : collects
```

---

## 3.3.3 Feature Class Diagrams

### Subsystem 1: Authentication & RBAC

```mermaid
classDiagram
    class AuthController {
        -IAuthService _authService
        -IIdentityStateResolver _identityStateResolver
        +Login(LoginRequest request) Task~IActionResult~
        +Register(RegisterRequest request, CancellationToken token) Task~IActionResult~
        +VerifyEmail(VerifyEmailRequest request, CancellationToken token) Task~IActionResult~
    }

    class IAuthService {
        <<interface>>
        +LoginAsync(LoginRequest request) Task~AuthResponse~
        +LoginWithGoogleAsync(GoogleLoginRequest request) Task~AuthResponse~
        +RegisterAsync(RegisterRequest request, string agent, string ip, CancellationToken token) Task~RegisterResponse~
        +VerifyEmailAsync(VerifyEmailRequest request, CancellationToken token) Task~AuthResponse~
        +ChangePasswordAsync(ChangePasswordRequest request, CancellationToken token) Task~bool~
    }

    class AuthService {
        -ApplicationDbContext _context
        -ITokenService _tokenService
        +LoginAsync(LoginRequest request) Task~AuthResponse~
        +LoginWithGoogleAsync(GoogleLoginRequest request) Task~AuthResponse~
        +RegisterAsync(RegisterRequest request, string agent, string ip, CancellationToken token) Task~RegisterResponse~
        +VerifyEmailAsync(VerifyEmailRequest request, CancellationToken token) Task~AuthResponse~
        +ChangePasswordAsync(ChangePasswordRequest request, CancellationToken token) Task~bool~
    }

    class ApplicationDbContext {
        +DbSet~User~ Users
        +DbSet~Role~ Roles
        +DbSet~Permission~ Permissions
    }

    AuthController --> IAuthService : uses
    AuthService ..|> IAuthService : implements
    AuthService --> ApplicationDbContext : queries
```

### Subsystem 2: Code Analysis & CV Profiling

```mermaid
classDiagram
    class ProfilesController {
        -ICvRepositoryIndexer _cvIndexer
        -IStorageService _storageService
        +UploadCv(IFormFile file) Task~ActionResult~
    }

    class ICvRepositoryIndexer {
        <<interface>>
        +ParseResumeAsync(Stream fileStream) Task~ParsedProfileDto~
        +TriggerBackgroundIndexAsync(Guid userId) Task
    }

    class CvRepositoryIndexer {
        -IAiServiceClient _aiClient
        -ApplicationDbContext _context
        +ParseResumeAsync(Stream fileStream) Task~ParsedProfileDto~
        +TriggerBackgroundIndexAsync(Guid userId) Task
    }

    class SourceCodeController {
        -ISourceCodeProviderService _vcsService
        -IRepositorySyncQueue _syncQueue
        +ConnectProvider(ConnectDto dto) Task~ActionResult~
        +SyncRepositories(List~string~ repoSlugs) Task~ActionResult~
    }

    class ISourceCodeProviderService {
        <<interface>>
        +GetRepositoriesAsync(Guid userId) Task~List~RepositoryDto~~
        +SyncCodebaseFilesAsync(Guid userId, string repoSlug) Task
    }

    class SourceCodeProviderService {
        -ApplicationDbContext _context
        -IGitHubClient _githubClient
        +GetRepositoriesAsync(Guid userId) Task~List~RepositoryDto~~
        +SyncCodebaseFilesAsync(Guid userId, string repoSlug) Task
    }

    class ApplicationDbContext {
        +DbSet~CandidateAssessment~ Assessments
        +DbSet~SourceCodeRepository~ Repositories
    }

    ProfilesController --> ICvRepositoryIndexer : uses
    CvRepositoryIndexer ..|> ICvRepositoryIndexer : implements
    CvRepositoryIndexer --> ApplicationDbContext : queries
    SourceCodeController --> ISourceCodeProviderService : uses
    SourceCodeProviderService ..|> ISourceCodeProviderService : implements
    SourceCodeProviderService --> ApplicationDbContext : queries
```

### Subsystem 3: Talent Discovery & Matching

```mermaid
classDiagram
    class TalentDiscoveryController {
        -IExplainableMatchService _matchService
        -ICandidateRankingCalculator _rankingCalc
        +GetMatchesForJob(Guid jobId) Task~ActionResult~
        +SearchTalentPool(string query) Task~ActionResult~
    }

    class IExplainableMatchService {
        <<interface>>
        +EvaluateMatchAsync(Guid jobVacancyId, Guid candidateId) Task~MatchingEvaluation~
    }

    class ExplainableMatchService {
        -ApplicationDbContext _context
        -ICandidateEvaluationService _evaluationService
        -IUnifiedMatchingEngine _matchingEngine
        +EvaluateMatchAsync(Guid jobVacancyId, Guid candidateId) Task~MatchingEvaluation~
    }

    class IUnifiedMatchingEngine {
        <<interface>>
        +EvaluateMatchAsync(CandidateCapabilityIntelligence candidate, UnifiedJobRequirement job, CancellationToken token) Task~UnifiedMatchResult~
    }

    class UnifiedMatchingEngine {
        +EvaluateMatchAsync(CandidateCapabilityIntelligence candidate, UnifiedJobRequirement job, CancellationToken token) Task~UnifiedMatchResult~
    }

    class ApplicationDbContext {
        +DbSet~JobVacancy~ JobVacancies
        +DbSet~JobApplication~ JobApplications
        +DbSet~MatchingEvaluation~ MatchingEvaluations
    }

    TalentDiscoveryController --> IExplainableMatchService : uses
    ExplainableMatchService ..|> IExplainableMatchService : implements
    ExplainableMatchService --> IUnifiedMatchingEngine : uses
    UnifiedMatchingEngine ..|> IUnifiedMatchingEngine : implements
    ExplainableMatchService --> ApplicationDbContext : queries
```

### Subsystem 4: Multi-sig Emergency Recovery

```mermaid
classDiagram
    class RecoveryController {
        -ILevel2RecoveryService _recoveryService
        +InitiateRecovery(RecoveryDto dto) Task~ActionResult~
        +CastVote(Guid sessionId, VoteDto dto) Task~ActionResult~
    }

    class ILevel2RecoveryService {
        <<interface>>
        +CheckOrganizationAsync(string taxCode, CancellationToken token) Task~Level2CheckResponse~
        +RequestRotationAsync(RepresentativeRotationRequestDto req, string agent, string ip, CancellationToken token) Task~RepresentativeRotationRequestResponse~
        +SubmitAdminVoteAsync(string token, string decision, string ip, string agent, CancellationToken token) Task~bool~
    }

    class Level2RecoveryService {
        -ApplicationDbContext _context
        -IEmailService _emailService
        +CheckOrganizationAsync(string taxCode, CancellationToken token) Task~Level2CheckResponse~
        +RequestRotationAsync(RepresentativeRotationRequestDto req, string agent, string ip, CancellationToken token) Task~RepresentativeRotationRequestResponse~
        +SubmitAdminVoteAsync(string token, string decision, string ip, string agent, CancellationToken token) Task~bool~
    }

    class ApplicationDbContext {
        +DbSet~ApprovedRecoverySession~ RecoverySessions
        +DbSet~RepresentativeApprovalVote~ RecoveryVotes
    }

    RecoveryController --> ILevel2RecoveryService : uses
    Level2RecoveryService ..|> ILevel2RecoveryService : implements
    Level2RecoveryService --> ApplicationDbContext : queries
```

---

## 3.3.4 Class Specifications

### 1. AuthService
* **Class Name**: `AuthService`
* **Package**: `CVerify.Core.Modules.Auth.Services`
* **Layer**: Domain Layer
* **Responsibility**: Authenticate users, verify email registration links, and generate cryptographically secure JSON Web Tokens (JWT) for session management.

#### Attributes
| Name | Type | Visibility | Description |
| :--- | :--- | :--- | :--- |
| `_context` | `ApplicationDbContext` | Private | Database context reference used to query accounts. |
| `_tokenService` | `ITokenService` | Private | Handles generation and verification of JWT session and refresh tokens. |

#### Methods
| Method | Return Type | Description |
| :--- | :--- | :--- |
| `LoginAsync(LoginRequest request)` | `Task<AuthResponse?>` | Validates user password hashes and returns active JWT token keys. |
| `RegisterAsync(RegisterRequest request, string agent, string ip, CancellationToken token)` | `Task<RegisterResponse>` | Creates unverified user database records and triggers verification code outbox logs. |
| `VerifyEmailAsync(VerifyEmailRequest request, CancellationToken token)` | `Task<AuthResponse?>` | Validates email confirmation tokens; changes status to `Active` on success. |

#### Relationships
* **Interface**: Implements `IAuthService`.
* **Dependencies**: `ApplicationDbContext`, `ITokenService`.
* **Used By**: `AuthController`.
* **Design Pattern**: Dependency Injection.

---

### 2. ExplainableMatchService
* **Class Name**: `ExplainableMatchService`
* **Package**: `CVerify.Core.Modules.Intelligence.Services`
* **Layer**: Domain Layer
* **Responsibility**: Orchestrates matching pipelines, fetching candidate capability intelligence and delegating matching evaluations to the consolidated engine.

#### Attributes
| Name | Type | Visibility | Description |
| :--- | :--- | :--- | :--- |
| `_context` | `ApplicationDbContext` | Private | EF Core database access. |
| `_evaluationService` | `ICandidateEvaluationService` | Private | Retrieves verified candidate capability intelligence DTOs. |
| `_matchingEngine` | `IUnifiedMatchingEngine` | Private | Consolidated matching calculations engine. |

#### Methods
| Method | Return Type | Description |
| :--- | :--- | :--- |
| `EvaluateMatchAsync(Guid jobVacancyId, Guid candidateId)` | `Task<MatchingEvaluation>` | Fetches data, delegates calculations, and saves matching evaluations to DB. |

#### Relationships
* **Interface**: Implements `IExplainableMatchService`.
* **Dependencies**: `ApplicationDbContext`, `ICandidateEvaluationService`, `IUnifiedMatchingEngine`.
* **Used By**: `TalentDiscoveryController`.
* **Design Pattern**: Strategy Pattern.

---

### 3. Level2RecoveryService
* **Class Name**: `Level2RecoveryService`
* **Package**: `CVerify.Core.Modules.Recovery.Services`
* **Layer**: Domain Layer
* **Responsibility**: Coordinates disaster recovery requests, logs representative votes, and rotates company owner email details if recovery thresholds are met.

#### Attributes
| Name | Type | Visibility | Description |
| :--- | :--- | :--- | :--- |
| `_context` | `ApplicationDbContext` | Private | Database access for multi-sig records. |
| `_emailService` | `IEmailService` | Private | Delivers multi-sig recovery invitation links to representatives. |

#### Methods
| Method | Return Type | Description |
| :--- | :--- | :--- |
| `CheckOrganizationAsync(string taxCode, CancellationToken token)` | `Task<Level2CheckResponse>` | Validates target tax code existence and eligibility. |
| `RequestRotationAsync(RepresentativeRotationRequestDto req, string agent, string ip, CancellationToken token)` | `Task<RepresentativeRotationRequestResponse>` | Creates emergency rotation recovery request queues. |
| `SubmitAdminVoteAsync(string token, string decision, string ip, string agent, CancellationToken token)` | `Task<bool>` | Registers representative votes (Approve/Reject) and rotates credentials. |

#### Relationships
* **Interface**: Implements `ILevel2RecoveryService`.
* **Dependencies**: `ApplicationDbContext`, `IEmailService`.
* **Used By**: `RecoveryController`.
* **Design Pattern**: Mediator Pattern.
