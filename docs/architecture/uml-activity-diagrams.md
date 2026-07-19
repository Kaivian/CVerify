# UML Activity & State Diagrams (Tài liệu Quy trình Đầy đủ & Chi tiết)

Tài liệu này chứa toàn bộ các **Sơ đồ UML Activity / State Diagram (`stateDiagram-v2`)** mô hình hóa đầy đủ tất cả các quy trình nghiệp vụ (Business Workflows), xử lý chuyển trạng thái, kiểm tra điều kiện rẽ nhánh (`<<choice>>`), luồng thực thi song song (Fork/Join), kiểm duyệt AI, và đường dẫn xử lý ngoại lệ cho **tất cả 37 Controllers và 11 Module nghiệp vụ** của nền tảng CVerify.

## 1. Tổng quan các Module & Controllers trong Hệ thống

Hệ thống CVerify được kiến trúc theo mô hình Modular Monolith kết hợp Python AI Pipeline Service, bao gồm 11 nhóm module nghiệp vụ chính:

1. **Authentication & Identity Management (IAM)**: `AuthController`, `InvitationController`, `MemberController`, `OrganizationRoleController`
2. **Account Recovery & Governance**: `PasswordRecoveryController`, `RecoveryController`, `Level2RecoveryController`
3. **Organizations & Workspaces**: `OrganizationController`, `WorkspaceController`
4. **Candidate Profile & Portfolio**: `ProfileController`, `CareerController`, `WorkExperienceController`, `EducationController`, `AchievementController`, `ProjectController`, `EvidenceController`, `CandidateAssessmentController`
5. **Source Code Intelligence & Repository Analysis**: `SourceCodeProvidersController`, `RepositoryAnalysisController`, `AiJobsController`
6. **Talent Intelligence & Job Vacancy Matching**: `TalentDiscoveryController`, `JobVacancyController`, `HiringRequirementController`, `PublicJobController`
7. **AI Assistant & Token Streaming Engine**: `AiChatController`, `StreamingController`
8. **Community Forum**: `ForumController`
9. **Notifications & System Utilities**: `NotificationController`, `SystemController`, `EmailTestController`
10. **System Administration & Enterprise Governance**: `UsersAdminController`, `RolesAdminController`, `PermissionsController`, `EnterpriseOperationsController`, `AuditLogsController`
11. **Security Telemetry & AI Operations**: `SecurityEventsController`, `AiOperationsController`

---

## 2. Chi tiết Sơ đồ Trạng thái Workflow theo Module (`stateDiagram-v2`)

### Module 1: Authentication & Identity Management (IAM)

#### Workflow 1.1: Đăng ký Tài khoản & Gửi Email Xác minh (`Register`)

```mermaid
stateDiagram-v2
    [*] --> Unauthenticated
    Unauthenticated --> ValidatingInput : Submits Signup Form
    
    state check_input <<choice>>
    ValidatingInput --> check_input
    check_input --> ValidationError : [Format or Password Weak]
    ValidationError --> [*]
    
    check_input --> CheckingUniqueness : [Input Valid]
    
    state check_unique <<choice>>
    CheckingUniqueness --> check_unique
    check_unique --> AccountConflictError : [Email/Username Exists]
    AccountConflictError --> [*]
    
    check_unique --> PendingVerification : [Unique Account / Enqueue Outbox Email]
    
    state check_token <<choice>>
    PendingVerification --> ValidatingToken : Clicks Email Verification Link
    ValidatingToken --> check_token
    check_token --> TokenExpiredError : [Token Invalid or Expired]
    TokenExpiredError --> [*]
    
    check_token --> ActiveAccount : [Token Valid]
    ActiveAccount --> AccountVerifiedAuditLogged : Log Audit Event
    AccountVerifiedAuditLogged --> [*]
```

#### Workflow 1.2: Đăng nhập & Thử thách MFA (`Login & MFA`)

```mermaid
stateDiagram-v2
    [*] --> Unauthenticated
    Unauthenticated --> FetchingUser : Submits Email & Password
    
    state check_user <<choice>>
    FetchingUser --> check_user
    check_user --> InvalidCredentialsError : [User Not Found]
    InvalidCredentialsError --> [*]
    
    check_user --> CheckingLockStatus : [User Found]
    
    state check_lock <<choice>>
    CheckingLockStatus --> check_lock
    check_lock --> AccountLockedError : [Account Locked or Legal Hold]
    AccountLockedError --> [*]
    
    check_lock --> VerifyingPassword : [Account Active]
    
    state check_pass <<choice>>
    VerifyingPassword --> check_pass
    check_pass --> IncrementingFailedAttempts : [Password Incorrect]
    IncrementingFailedAttempts --> AccountLockedError : [Failed Attempts >= 5]
    IncrementingFailedAttempts --> InvalidCredentialsError : [Failed Attempts < 5]
    
    check_pass --> ResettingFailedAttempts : [Password Correct]
    
    state check_mfa <<choice>>
    ResettingFailedAttempts --> check_mfa
    check_mfa --> OTPChallengePending : [MFA Enabled / Send OTP Code]
    
    state check_otp <<choice>>
    OTPChallengePending --> VerifyingOTP : Submits OTP Code
    VerifyingOTP --> check_otp
    check_otp --> OTPInvalidError : [OTP Invalid / Expired]
    OTPInvalidError --> [*]
    check_otp --> AuthenticatedSession : [OTP Correct]
    
    check_mfa --> AuthenticatedSession : [MFA Disabled]
    AuthenticatedSession --> TokensIssued : Issue JWT & Refresh Token
    TokensIssued --> [*]
```

#### Workflow 1.3: Đăng nhập & Liên kết OAuth2 Provider (`OAuth Login`)

```mermaid
stateDiagram-v2
    [*] --> Unauthenticated
    Unauthenticated --> RedirectedToProvider : Clicks Login with GitHub/Google
    RedirectedToProvider --> ExchangingCode : Returns with Authorization Code
    
    state check_exchange <<choice>>
    ExchangingCode --> check_exchange
    check_exchange --> OAuthProviderError : [Code Invalid or Expired]
    OAuthProviderError --> [*]
    
    check_exchange --> QueryingLinkedUser : [Provider Token Received]
    
    state check_linked <<choice>>
    QueryingLinkedUser --> check_linked
    check_linked --> AuthenticatedSession : [OAuth Provider Linked]
    
    check_linked --> PendingProviderRegistration : [New Account via Provider]
    PendingProviderRegistration --> AccountAutoCreated : Provision User & AuthProvider Entry
    AccountAutoCreated --> AuthenticatedSession
    AuthenticatedSession --> JWTIssued : Issue Tokens & Update Last Login
    JWTIssued --> [*]
```

#### Workflow 1.4: Làm mới Phiên & Đăng xuất (`Refresh Token & Logout`)

```mermaid
stateDiagram-v2
    [*] --> ActiveSession
    ActiveSession --> RefreshingToken : Access Token Expired / Sends Refresh Token
    
    state check_refresh <<choice>>
    RefreshingToken --> check_refresh
    check_refresh --> SessionExpiredError : [Token Revoked or Expired]
    SessionExpiredError --> UnauthenticatedState
    UnauthenticatedState --> [*]
    
    check_refresh --> TokenRotated : [Session Valid]
    TokenRotated --> ActiveSession : Update Hash & Return New JWT
    
    ActiveSession --> RevokingSession : Clicks Logout
    RevokingSession --> SessionMarkedRevoked : Set RevokedAt Timestamp in DB
    SessionMarkedRevoked --> UnauthenticatedState
```

#### Workflow 1.5: Mời Thành viên Tổ chức & Nhận Vai trò (`Invite Member`)

```mermaid
stateDiagram-v2
    [*] --> MemberInvitationInitiated
    MemberInvitationInitiated --> CheckingAdminPermission : Admin Sends Invite Email
    
    state check_invite_perm <<choice>>
    CheckingAdminPermission --> check_invite_perm
    check_invite_perm --> ForbiddenError : [Insufficient Admin Permission]
    ForbiddenError --> [*]
    
    check_invite_perm --> CheckingMemberExistence : [Admin Authorized]
    
    state check_existing <<choice>>
    CheckingMemberExistence --> check_existing
    check_existing --> MemberAlreadyExistsError : [User Already in Org]
    MemberAlreadyExistsError --> [*]
    
    check_existing --> InvitationCreated : [User Not in Org]
    InvitationCreated --> TokenEmailed : Enqueue Outbox Email with Pre-assigned Roles
    TokenEmailed --> AwaitingAcceptance : Invitee Clicks Acceptance Link
    AwaitingAcceptance --> MembershipCreated : Create OrgMembership & Role Assignments
    MembershipCreated --> InvitationConsumed : Mark Token Consumed & Notify Admin
    InvitationConsumed --> [*]
```

---

### Module 2: Account Recovery & Governance

#### Workflow 2.1: Quên Mật khẩu (`Forgot Password`)

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> CheckingUser : Submits Email for Reset
    
    state check_email <<choice>>
    CheckingUser --> check_email
    check_email --> NeutralResponseSent : [User Not Found]
    NeutralResponseSent --> [*]
    
    check_email --> TokenGenerated : [User Found / Outbox Email Enqueued]
    TokenGenerated --> AwaitingUserReset : Clicks Link in Email
    AwaitingUserReset --> ValidatingNewPassword : Submits New Password
    
    state check_strength <<choice>>
    ValidatingNewPassword --> check_strength
    check_strength --> PasswordWeakError : [Strength Check Failed]
    PasswordWeakError --> AwaitingUserReset
    
    check_strength --> PasswordUpdated : [Strength Check Passed]
    PasswordUpdated --> SessionsRevoked : Update BCrypt Hash & Invalidate Refresh Tokens
    SessionsRevoked --> [*]
```

#### Workflow 2.2: Khiếu nại Khôi phục Tổ chức Khẩn cấp (`Emergency Claim`)

```mermaid
stateDiagram-v2
    [*] --> NoActiveClaim
    NoActiveClaim --> ValidatingLegalDocs : Submits Claim & Legal Credentials
    
    state check_docs <<choice>>
    ValidatingLegalDocs --> check_docs
    check_docs --> ClaimRejected : [Docs Invalid]
    ClaimRejected --> [*]
    
    check_docs --> AcquiringLock : [Docs Valid]
    
    state check_lock <<choice>>
    AcquiringLock --> check_lock
    check_lock --> LockConflictError : [Lock Failed / Active Claim Pending]
    LockConflictError --> [*]
    
    check_lock --> VotingSessionActive : [Lock Acquired / 72H Voting Started]
    
    state check_vote <<choice>>
    VotingSessionActive --> check_vote : Board Members Vote
    check_vote --> VotingFailed : [Voting Expired or Rejected]
    VotingFailed --> LockReleased
    LockReleased --> [*]
    
    check_vote --> OwnershipTransferred : [Majority Approved]
    OwnershipTransferred --> OldOwnerRevoked : Revoke Previous Credentials & Release Lock
    OldOwnerRevoked --> [*]
```

#### Workflow 2.3: Xoay vòng Người Đại diện Pháp luật (`Representative Rotation`)

```mermaid
stateDiagram-v2
    [*] --> CurrentAuthorityActive
    CurrentAuthorityActive --> RotationRequestSubmitted : Submits Legal Rotation Request
    RotationRequestSubmitted --> BoardVotingInitiated : Notify Legal Authority Board
    
    state check_rotation_vote <<choice>>
    BoardVotingInitiated --> check_rotation_vote : Board Members Vote
    check_rotation_vote --> RotationRejected : [Rejected or Expired]
    RotationRejected --> CurrentAuthorityActive
    
    check_rotation_vote --> AuthoritySnapshotCreated : [Approved]
    AuthoritySnapshotCreated --> AuthorityTransferred : Create History Snapshot & Update Primary Rep
    AuthorityTransferred --> AuditLogLogged : Log Legal Rotation in Compliance Audit
    AuditLogLogged --> [*]
```

---

### Module 3: Organizations & Workspaces

#### Workflow 3.1: Khởi tạo Tổ chức & Xác thực Tên miền DNS (`Create Organization`)

```mermaid
stateDiagram-v2
    [*] --> UnregisteredOrg
    UnregisteredOrg --> CheckingTaxUniqueness : Submits Name, Tax ID & Domain
    
    state check_tax <<choice>>
    CheckingTaxUniqueness --> check_tax
    check_tax --> TaxDuplicateError : [Tax ID Already Registered]
    TaxDuplicateError --> [*]
    
    check_tax --> OrgCreatedUnverified : [Tax ID Unique]
    OrgCreatedUnverified --> AwaitingDNSVerification : TXT Code Generated
    
    state check_dns <<choice>>
    AwaitingDNSVerification --> PerformingDNSLookup : Clicks Verify Domain
    PerformingDNSLookup --> check_dns
    check_dns --> DNSVerificationFailed : [TXT Code Mismatch]
    DNSVerificationFailed --> AwaitingDNSVerification
    
    check_dns --> OrgVerified : [TXT Code Matches]
    OrgVerified --> DefaultWorkspaceCreated : Create 'General' Workspace
    DefaultWorkspaceCreated --> [*]
```

#### Workflow 3.2: Quản lý Không gian Làm việc Workspace (`Manage Workspace`)

```mermaid
stateDiagram-v2
    [*] --> OrganizationActive
    OrganizationActive --> CreatingWorkspace : Owner/Admin Creates Workspace
    CreatingWorkspace --> WorkspaceProvisioned : Set Name, Slug, Logo & Settings
    WorkspaceProvisioned --> AddingMembers : Assign Team Members & Roles
    AddingMembers --> WorkspaceActive : Active Collaboration Environment
    
    WorkspaceActive --> ArchivingWorkspace : Trigger Archive
    ArchivingWorkspace --> SnapshotCreated : Create WorkspaceArchiveSnapshot & Lock Reads
    SnapshotCreated --> [*]
```

---

### Module 4: Candidate Profile & Portfolio

#### Workflow 4.1: Cập nhật Bio & Kinh nghiệm Làm việc (`Update Profile & Work Exp`)

```mermaid
stateDiagram-v2
    [*] --> ProfileView
    ProfileView --> UpdatingBio : Edits Bio, Social Links & Preferred Location
    UpdatingBio --> AddingWorkExperience : Adds Work Experience Entry
    AddingWorkExperience --> AttributingTechStack : Links Tech Stack & Achievements
    AttributingTechStack --> ProfileSaved : Save WorkExperience & Tech Entries in DB
    ProfileSaved --> ProfileView
```

#### Workflow 4.2: Tải lên CV & Quét Virus (`Upload CV`)

```mermaid
stateDiagram-v2
    [*] --> ProfileEditing
    ProfileEditing --> ValidatingFile : Uploads CV File
    
    state check_file <<choice>>
    ValidatingFile --> check_file
    check_file --> InvalidFileError : [Format Not PDF/DOCX or Size > 10MB]
    InvalidFileError --> [*]
    
    check_file --> VirusScanning : [Format & Size OK]
    
    state check_virus <<choice>>
    VirusScanning --> check_virus
    check_virus --> FileQuarantined : [Malware Detected]
    FileQuarantined --> SecurityAlertTriggered
    SecurityAlertTriggered --> [*]
    
    check_virus --> StoringFile : [File Clean]
    StoringFile --> ProfileUpdated : Compute SHA-256 & Update DB
    ProfileUpdated --> TextExtractionQueued : Enqueue Background Job
    TextExtractionQueued --> [*]
```

#### Workflow 4.3: Dự án Portfolio & Bằng chứng Kỹ năng (`Project & Evidence`)

```mermaid
stateDiagram-v2
    [*] --> ProfileEditing
    ProfileEditing --> RegisteringProject : Adds Portfolio Project Title & Description
    RegisteringProject --> LinkingGitRepo : Links GitHub Repository URL
    LinkingGitRepo --> CreatingEvidenceClaim : Assert Capability Claim (e.g. React/DotNet)
    CreatingEvidenceClaim --> VerifyingClaim : System Checks Repo Commits & AST Attributions
    
    state check_evidence <<choice>>
    VerifyingClaim --> check_evidence
    check_evidence --> ClaimUnverified : [No Commit Evidence Found]
    ClaimUnverified --> [*]
    
    check_evidence --> ClaimVerified : [Commit & Code Attributed]
    ClaimVerified --> TrustScoreCalculated : Update Candidate TrustProfile & Components
    TrustScoreCalculated --> [*]
```

#### Workflow 4.4: Đánh giá Kỹ năng & Cây Kỹ năng (`Trigger Skill Assessment`)

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> CheckingData : Triggers Skill Assessment
    
    state check_data <<choice>>
    CheckingData --> check_data
    check_data --> InsufficientDataError : [No Work Exp or Repos]
    InsufficientDataError --> [*]
    
    check_data --> ParallelExtraction : [Data Sufficient]
    
    state ParallelExtraction {
        [*] --> ExtractingCVTokens
        [*] --> ExtractingRepoCommits
        [*] --> VerifyingEvidenceClaims
    }
    
    ParallelExtraction --> InvokingAIService : Join Results
    InvokingAIService --> SkillTreeGenerated : AI Computes Proficiency Matrix
    SkillTreeGenerated --> AssessmentSaved : Save CandidateAssessment & SkillTreeNodes
    AssessmentSaved --> [*]
```

---

### Module 5: Source Code Intelligence & Repository Analysis

#### Workflow 5.1: Kết nối Provider & Nhập Kho mã nguồn (`Import Repository`)

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> ProviderOAuth : Connects GitHub / GitLab
    ProviderOAuth --> RepositoriesFetched : Exchanges Code for Provider Access Token
    RepositoriesFetched --> SelectingRepos : Displays Remote Repository List
    SelectingRepos --> ReposImported : Saves SourceCodeRepository Entries in DB
    ReposImported --> [*]
```

#### Workflow 5.2: Phân tích Mã nguồn AST Tĩnh (`Trigger Code Analysis`)

```mermaid
stateDiagram-v2
    [*] --> RepoImported
    RepoImported --> JobQueued : Triggers Analysis
    JobQueued --> JobRunning : Worker Pulls Message from Queue
    JobRunning --> CloningRepo : Clones Repository to Isolated Worker Storage
    
    state check_clone <<choice>>
    CloningRepo --> check_clone
    check_clone --> JobFailed : [Git Clone Error]
    JobFailed --> [*]
    
    check_clone --> ASTParsingActive : [Clone Successful]
    
    state ASTParsingActive {
        [*] --> TreeSitterAST
        [*] --> ComplexityMetrics
        [*] --> GitBlameAttribution
    }
    
    ASTParsingActive --> ReportAggregated : Join AST Results
    ReportAggregated --> StorageCleaned : Save AnalysisReport & Capabilities to DB
    StorageCleaned --> JobCompleted : Delete Temporary Cloned Code
    JobCompleted --> [*]
```

---

### Module 6: Talent Intelligence & Job Matching

#### Workflow 6.1: Khởi tạo & Đăng tin Tuyển dụng (`Publish Job Vacancy`)

```mermaid
stateDiagram-v2
    [*] --> DraftingVacancy
    DraftingVacancy --> DefiningRequirements : Specifies Role, Salary Range & Tech Stack
    DefiningRequirements --> DefiningOutcomes : Adds Key Business Outcomes & Rubrics
    DefiningOutcomes --> VectorizingRequirements : Invokes AI to Generate Requirement Embeddings
    VectorizingRequirements --> SnapshotsSaved : Save Vector Embeddings & Rubrics in DB
    
    state check_publish <<choice>>
    SnapshotsSaved --> check_publish
    check_publish --> VacancyDraft : [Save as Draft]
    VacancyDraft --> [*]
    
    check_publish --> VacancyPublished : [Publish Immediately]
    VacancyPublished --> AutoDiscoveryTriggered : Enqueue Talent Auto-Discovery Job
    AutoDiscoveryTriggered --> [*]
```

#### Workflow 6.2: Ứng tuyển & Tính điểm Khớp AI (`Apply Job & AI Match`)

```mermaid
stateDiagram-v2
    [*] --> VacancyPublished
    VacancyPublished --> CheckingDuplicateApp : Candidate Submits Application
    
    state check_duplicate <<choice>>
    CheckingDuplicateApp --> check_duplicate
    check_duplicate --> DuplicateApplicationError : [Already Applied]
    DuplicateApplicationError --> [*]
    
    check_duplicate --> ApplicationSubmitted : [First Time Application]
    ApplicationSubmitted --> ComputingAIMatch : Invoke Python AI Matching Service
    ComputingAIMatch --> MatchEvaluated : Compute Score & Generate Rationale
    
    state check_score <<choice>>
    MatchEvaluated --> check_score
    check_score --> ApplicationRecommended : [Score >= 75%]
    check_score --> ApplicationUnderReview : [Score < 75%]
    
    ApplicationRecommended --> RecruiterNotified
    ApplicationUnderReview --> RecruiterNotified
    RecruiterNotified --> [*]
```

#### Workflow 6.3: Tự động Săn Tìm Nhân tài AI (`AI Talent Discovery`)

```mermaid
stateDiagram-v2
    [*] --> DiscoveryInitiated
    DiscoveryInitiated --> QueryingSearchProjections : Load Job Requirement Vector
    QueryingSearchProjections --> ComputingCosineSimilarity : Match Candidate Capabilities Vector Matrix
    ComputingCosineSimilarity --> RankingCandidates : Filter by Location, Salary & Trust Profile
    RankingCandidates --> ProjectionsSaved : Save CandidateDiscoveryRun & MatchProjections
    ProjectionsSaved --> DiscoveryResultsPresented : Return Candidate Leaderboard to Recruiter
    DiscoveryResultsPresented --> [*]
```

---

### Module 7: AI Assistant & Token Streaming Engine

#### Workflow 7.1: Trợ lý AI Chat & Stream SSE Token Real-time (`AI Chat Streaming`)

```mermaid
stateDiagram-v2
    [*] --> UserPromptEntered
    UserPromptEntered --> CheckingTokenBudget : Retrieves Active Prompt & Context
    
    state check_budget <<choice>>
    CheckingTokenBudget --> check_budget
    check_budget --> BudgetExceededError : [Budget Exhausted]
    BudgetExceededError --> [*]
    
    check_budget --> SSEConnectionEstablished : [Budget Available]
    SSEConnectionEstablished --> TokenStreamingActive : Prompts LLM Provider
    
    state TokenStreamingActive {
        [*] --> StreamingSSEChunk
        StreamingSSEChunk --> StreamingSSEChunk : More Tokens
    }
    
    TokenStreamingActive --> StreamCompleted : LLM Finish Signal
    StreamCompleted --> MetricsRecorded : Save Response Message & Record Cost USD
    MetricsRecorded --> [*]
```

---

### Module 8: Community Forum

#### Workflow 8.1: Đăng bài Diễn đàn & Kiểm duyệt Tự động (`Create Forum Topic`)

```mermaid
stateDiagram-v2
    [*] --> TopicSubmitted
    TopicSubmitted --> RunningContentFilter : Validates Category
    
    state check_moderation <<choice>>
    RunningContentFilter --> check_moderation
    check_moderation --> TopicPendingReview : [Profanity / Spam Detected]
    TopicPendingReview --> ModeratorNotified
    ModeratorNotified --> [*]
    
    check_moderation --> TopicPublished : [Content Clean]
    TopicPublished --> ReputationAwarded : Add +5 Reputation Points to Author
    ReputationAwarded --> [*]
```

#### Workflow 8.2: Bình luận & Bình chọn Bài viết (`Reply & Vote`)

```mermaid
stateDiagram-v2
    [*] --> TopicViewed
    TopicViewed --> SubmittingReply : User Submits Reply
    SubmittingReply --> ReplySaved : Save ForumReply in DB
    ReplySaved --> SubmittingVote : User Upvotes/Downvotes Reply
    
    state check_vote_type <<choice>>
    SubmittingVote --> check_vote_type
    check_vote_type --> Upvoted : [Upvote]
    Upvoted --> AuthorReputationIncremented : +10 Reputation Points to Reply Author
    
    check_vote_type --> Downvoted : [Downvote]
    Downvoted --> AuthorReputationDecremented : -2 Reputation Points to Reply Author
    
    AuthorReputationIncremented --> ScoreUpdated : Recalculate ForumReply Score
    AuthorReputationDecremented --> ScoreUpdated
    ScoreUpdated --> [*]
```

---

### Module 9: System Administration & Telemetry

#### Workflow 9.1: Khóa Tài khoản Admin & Phong tỏa Pháp lý (`Legal Hold Lock`)

```mermaid
stateDiagram-v2
    [*] --> ActiveUserAccount
    ActiveUserAccount --> AdminReviewingUser : Super Admin Inspects User
    
    state check_admin_action <<choice>>
    AdminReviewingUser --> check_admin_action
    check_admin_action --> UserTemporarilyLocked : [Select Lock Account]
    UserTemporarilyLocked --> SessionRevoked
    
    check_admin_action --> LegalHoldEnforced : [Select Enforce Legal Hold]
    LegalHoldEnforced --> AllAccessFrozen : Set 'IsLegalHold' = True & Freeze All API Actions
    AllAccessFrozen --> LegalHoldAuditLogged : Log Compliance Record in Audit Logs
    LegalHoldAuditLogged --> [*]
```

#### Workflow 9.2: Cảnh báo Telemetry An ninh SOC (`Security Telemetry Alert`)

```mermaid
stateDiagram-v2
    [*] --> EventIngested
    EventIngested --> EvaluatingRules : Passes Event to Threat Engine
    
    state check_threat <<choice>>
    EvaluatingRules --> check_threat
    check_threat --> TelemetryLogged : [Normal Traffic]
    TelemetryLogged --> [*]
    
    check_threat --> IncidentCreated : [Threat Pattern Detected]
    
    state check_critical <<choice>>
    IncidentCreated --> check_critical
    check_critical --> LegalHoldEnforced : [Severity Critical]
    LegalHoldEnforced --> SOCNotified : Lock Account & Alert SOC
    
    check_critical --> SOCNotified : [Severity High/Medium]
    SOCNotified --> AnalystResolved : Analyst Adds Investigation Note & Resolves
    AnalystResolved --> AuditLogged : Log Compliance Audit
    AuditLogged --> [*]
```
