# UML Swimlane Diagrams (Bản Chi Tiết Đầy Đủ Trắng Đen)

Tài liệu chứa các sơ đồ **Swimlane Activity Diagrams chi tiết đầy đủ (Fully Detailed)** ở định dạng mã PlantUML và Mermaid phong cách **Trắng Đen (Monochrome / Black & White)** cho toàn bộ quy trình kiến trúc nền tảng **CVerify**.

---

## Danh mục các Quy trình Swimlane

1. [Quy trình 1: Line 2 - Candidate CV AI Analysis Pipeline (Phân tích CV & Đánh giá Năng lực)](#workflow-1)
2. [Quy trình 2: Line 1 - Source Code Intelligence Pipeline (Phân tích Mã nguồn & Git Repository)](#workflow-2)
3. [Quy trình 3: Authentication, Security Telemetry & MFA Workflow (Đăng nhập, MFA & An ninh)](#workflow-3)
4. [Quy trình 4: Job Vacancy Matching & Candidate Discovery (Ghép nối Ứng viên & Nhu cầu Tuyển dụng)](#workflow-4)

---

<a id="workflow-1"></a>
## Quy trình 1: Line 2 - Candidate CV AI Analysis Pipeline (Phân tích CV & Đánh giá Năng lực)

### 1.1. PlantUML Activity Swimlane Code (Chi Tiết Trắng Đen)

```plantuml
@startuml
skinparam TitleFontSize 16
skinparam TitleFontColor #000000
skinparam ActivityBorderColor #000000
skinparam ActivityBackgroundColor #FFFFFF
skinparam ActivityFontColor #000000
skinparam SwimlaneBorderColor #000000
skinparam SwimlaneTitleFontColor #000000
skinparam SwimlaneTitleFontSize 14
skinparam ArrowColor #000000

title UML Swimlane: Line 2 Candidate CV AI Analysis Pipeline

|Client (React UI)|
start
:Click "Start CV Analysis";
:POST /api/v1/candidate-assessments;

|API Layer (CandidateAssessmentController)|
:Authenticate JWT & Extract Claims;
:Check Candidate Profile Readiness (Bio, Skills, Repos);
if (Is Profile Ready?) then (Yes)
  :Check Redis Lock (candidate:assessment:lock:{userId});
  if (Is Already Locked?) then (Yes)
    :Return HTTP 409 Conflict;
    |Client (React UI)|
    :Display "Assessment In Progress" Alert;
    stop
  else (No)
    |Data & Cache Layer (PostgreSQL & Redis)|
    :Acquire Redis Lock & Enqueue candidate:assessment:queue;
    :Insert CandidateAssessment Entity (Status = Pending);
    |API Layer (CandidateAssessmentController)|
    :Return HTTP 202 Accepted (assessmentId);
  endif
else (No)
  :Return HTTP 400 Bad Request;
  |Client (React UI)|
  :Display "Incomplete Profile / Missing Repo" Error;
  stop
endif

|Client (React UI)|
:Connect SSE GET /api/v1/candidate-assessments/progress/{userId};

|Background Worker (.NET Core Processor)|
:BackgroundWorker Dequeue Job from Redis Queue;
:Set CandidateAssessment Status = Processing;
:Fetch Line 1 Repo Analysis & Candidate Profile from PostgreSQL;
:HTTP POST /api/v1/candidate/assess/stream (Python Subsystem);

|Python AI Subsystem (FastAPI DAG)|
:FastAPI Initializes DAG Executor (15 Tasks: L2-001 to L2-015);
fork
  :L2-001: Normalize Candidate Skills;
  :L2-002: Compute Capability Vectors;
fork again
  :L2-005: Analyze Git Commit Evidence & Contributions;
  :L2-006: Compute AST Code Complexity Metrics;
end fork

|External LLM (Anthropic Claude API)|
|Python AI Subsystem (FastAPI DAG)|
:Synthesize Evaluation Context & Invoke Prompt;
|External LLM (Anthropic Claude API)|
:Inference Technical & Behavioral Evaluation JSON;

|Python AI Subsystem (FastAPI DAG)|
:Parse LLM Response & Construct Output Artifacts;
:Stream SSE Events (Progress % & Completed Tasks) to .NET Worker;

|Background Worker (.NET Core Processor)|
:Receive Stream Event from FastAPI;
|Data & Cache Layer (PostgreSQL & Redis)|
:Persist Artifacts JSON & Relational Profile Entities in DB;
:Publish Progress Event to Redis Pub/Sub (candidate:assessment:progress:{userId});

|Client (React UI)|
:Receive SSE Progress Event;
:Update Real-time UI Progress Bar;

|Background Worker (.NET Core Processor)|
:Pipeline Execution 100% Completed;
|Data & Cache Layer (PostgreSQL & Redis)|
:Set Status = Completed & Release Redis Lock;

|Client (React UI)|
:Receive Completion Event & Render Digital CV Report;
stop
@enduml
```

### 1.2. Mermaid Flowchart Swimlane Code (Chi Tiết Trắng Đen)

```mermaid
flowchart TD
    subgraph Client ["Client (React UI)"]
        C1[Click Start CV Analysis] --> C2[POST /api/v1/candidate-assessments]
        C3[Display Profile Readiness Error]
        C4[Display Concurrency Conflict Error]
        C5[Connect SSE /progress/userId]
        C6[Update Real-time Progress Bar]
        C7[Render Digital CV Report]
    end

    subgraph API ["API Layer (CandidateAssessmentController)"]
        C2 --> A1[Authenticate JWT & Check Profile Readiness]
        A1 -- "Incomplete" --> C3
        A1 -- "Ready" --> A2[Check Redis Lock candidate:assessment:lock]
        A2 -- "Locked" --> C4
        A2 -- "Available" --> A3[Issue Task & Return HTTP 202 Accepted]
        A3 --> C5
    end

    subgraph Storage ["Data & Cache (PostgreSQL & Redis)"]
        A2 --> S1[Acquire Lock & Enqueue Redis Queue]
        S1 --> S2[Insert CandidateAssessment Pending State]
        W2 --> S3[Persist Artifacts & Relational Entities]
        W2 --> S4[Publish Progress Event to Redis Pub/Sub]
        W3 --> S5[Release Lock & Set Status Completed]
    end

    subgraph Worker ["Background Worker (.NET Processor)"]
        S1 --> W1[Dequeue Job & Set Processing Status]
        W1 --> W2_Call[Fetch Line 1 Repo Data & Profile]
        W2_Call --> W3_Call[POST /api/v1/candidate/assess/stream]
        P2 --> W2[Receive FastAPI Stream Events]
        W2 --> W3[Complete Assessment Job]
        W3 --> C7
    end

    subgraph FastAPI ["Python AI Subsystem (FastAPI DAG)"]
        W3_Call --> P1[Execute 15 DAG Tasks L2-001 to L2-015]
        P1 --> P2_Prompt[Build Context & Send Prompt to LLM]
        L1 --> P2[Parse LLM Output & Stream SSE Events]
    end

    subgraph LLM ["External LLM (Anthropic Claude API)"]
        P2_Prompt --> L1[Inference Technical & Behavioral Evaluation]
    end

    S4 --> C6
```

---

<a id="workflow-2"></a>
## Quy trình 2: Line 1 - Source Code Intelligence Pipeline (Phân tích Mã nguồn & Git Repository)

### 2.1. PlantUML Activity Swimlane Code (Chi Tiết Trắng Đen)

```plantuml
@startuml
skinparam TitleFontSize 16
skinparam TitleFontColor #000000
skinparam ActivityBorderColor #000000
skinparam ActivityBackgroundColor #FFFFFF
skinparam ActivityFontColor #000000
skinparam SwimlaneBorderColor #000000
skinparam SwimlaneTitleFontColor #000000
skinparam SwimlaneTitleFontSize 14
skinparam ArrowColor #000000

title UML Swimlane: Line 1 Source Code Intelligence Pipeline

|User / Recruiter|
start
:Select Git Repository & Click Analyze;
:POST /api/v1/repositories/{id}/analyze;

|API Controller (RepositoryAnalysisController)|
:Validate User Permissions & Auth Provider OAuth Token;
if (Is OAuth Token Valid?) then (Yes)
  :Submit Job to Pipeline Orchestrator;
else (No)
  :Return HTTP 401 Unauthorized / Token Expired;
  |User / Recruiter|
  :Prompt Re-authenticate GitHub OAuth;
  stop
endif

|Pipeline Orchestrator (.NET Pipeline Core)|
|API Controller (RepositoryAnalysisController)|
:Create PipelineJob (Status = Queued);
:Return HTTP 202 Accepted (jobId);

|Pipeline Orchestrator (.NET Pipeline Core)|
:Allocate PipelineTask to AST Worker Pool;

|Git Fetcher & AST Engine (Analysis Workers)|
:Worker Acquire Lease Lock for Task;
:Call Git Provider API (GitHub/GitLab REST & GraphQL);
:Clone / Fetch Repository Tree & Commit History;
:Execute Git Blame & Contributor Attribution Analysis;
:Run AST Code Parser (C#, Python, JS/TS, Java);
:Compute Complexity, Maintainability Index & Line Counts;

|Data Store (PostgreSQL & Artifact Registry)|
|Git Fetcher & AST Engine (Analysis Workers)|
:Generate Final AnalysisReport JSON Artifact;
|Data Store (PostgreSQL & Artifact Registry)|
:Persist RepositoryCapabilities & SkillAttributions into DB;
:Save AST Artifact Registry Entries;
:Set PipelineJob Status = Completed;

|User / Recruiter|
:Receive Notification "Repository Analysis Completed";
stop
@enduml
```

### 2.2. Mermaid Flowchart Swimlane Code (Chi Tiết Trắng Đen)

```mermaid
flowchart TD
    subgraph UserLayer ["User / Recruiter"]
        U1[Select Repository & Click Analyze] --> U2[POST /api/v1/repositories/analyze]
        U5[Receive Analysis Completion Notification]
    end

    subgraph ControllerLayer ["API Layer (RepositoryAnalysisController)"]
        U2 --> C1[Validate Authorization & Provider Tokens]
        C1 -- "Token Expired" --> U3[Prompt OAuth Re-authentication]
        C1 -- "Valid" --> C2[Enqueue Analysis Task]
        C2 --> U4[Return HTTP 202 Accepted + JobId]
    end

    subgraph GitProvider ["External Git Provider (GitHub/GitLab)"]
        W1[Fetch Repos, Trees, Commits & Blame Data]
    end

    subgraph WorkerLayer ["Analysis Worker Engine (.NET AST Service)"]
        C2 --> W1
        W1 --> W2[Execute Git Blame & Contributor Attribution]
        W2 --> W3[Run AST Multi-language Code Parser]
        W3 --> W4[Compute Code Complexity & Quality Metrics]
        W4 --> W5[Generate Final AnalysisReport Artifact]
    end

    subgraph DatabaseLayer ["Database & Artifact Store (PostgreSQL)"]
        W5 --> D1[Insert RepositoryAssessments & RepositoryCapabilities]
        D1 --> D2[Save AST Artifact Registry Entries]
        D2 --> D3[Set PipelineJob Status = Completed]
        D3 --> U5
    end
```

---

<a id="workflow-3"></a>
## Quy trình 3: Authentication, Security Telemetry & MFA Workflow (Đăng nhập, MFA & An ninh)

### 3.1. PlantUML Activity Swimlane Code (Chi Tiết Trắng Đen)

```plantuml
@startuml
skinparam TitleFontSize 16
skinparam TitleFontColor #000000
skinparam ActivityBorderColor #000000
skinparam ActivityBackgroundColor #FFFFFF
skinparam ActivityFontColor #000000
skinparam SwimlaneBorderColor #000000
skinparam SwimlaneTitleFontColor #000000
skinparam SwimlaneTitleFontSize 14
skinparam ArrowColor #000000

title UML Swimlane: Authentication, Security Telemetry & MFA Workflow

|Client Browser / Mobile App|
start
:Enter Email & Password;
:POST /api/v1/auth/login;

|Auth Controller & Security Middleware|
:Sanitize Input & Apply IP Rate Limiting;
:Lookup User Entity by Email;
if (Is User Existing?) then (Yes)
  :Check Account Lock & Legal Hold Status;
  if (Is Account Locked?) then (Yes)
    |Security Telemetry (SOC Engine)|
    :Log SecurityEvent (AccountLockedAttempt);
    |Auth Controller & Security Middleware|
    :Return HTTP 423 Locked;
    |Client Browser / Mobile App|
    :Display "Account Temporarily Locked" Message;
    stop
  else (No)
    :Verify Password Hash (PBKDF2 / BCrypt);
  endif
else (No)
  |Auth Controller & Security Middleware|
  :Return HTTP 401 Invalid Credentials;
  |Client Browser / Mobile App|
  :Display Login Failed Error;
  stop
endif

if (Is Password Correct?) then (Yes)
  |Identity Service (AuthModule Core)|
  :Reset FailedLoginAttempts = 0;
  if (Is MFA/OTP Enabled?) then (Yes)
    :Generate 6-digit OTP & Hash ChallengeId;
    |Notification Outbox Worker|
    :Enqueue Outbox Message (Send OTP Email);
    |Auth Controller & Security Middleware|
    :Return HTTP 202 Accepted (OTP Challenge Required);
    |Client Browser / Mobile App|
    :Display OTP Input Form;
    :Submit OTP Code POST /api/v1/auth/mfa/verify;
    |Identity Service (AuthModule Core)|
    :Verify OTP Code & Expiration;
  else (No)
  endif
else (No)
  |Identity Service (AuthModule Core)|
  :Increment FailedLoginAttempts += 1;
  if (FailedLoginAttempts >= 5?) then (Yes)
    :Lock Account (LockoutEnd = UtcNow + 30m);
    |Security Telemetry (SOC Engine)|
    :Trigger SecurityIncident (BruteForceDetected);
  else (No)
  endif
  |Auth Controller & Security Middleware|
  :Return HTTP 401 Invalid Credentials;
  |Client Browser / Mobile App|
  :Display Invalid Password Message;
  stop
endif

|Identity Service (AuthModule Core)|
:Generate JWT Access Token & Refresh Token;
|Database (PostgreSQL)|
:Insert RefreshToken Record into DB;
:Write AuditLog (Event: UserLoginSuccess);

|Auth Controller & Security Middleware|
:Return HTTP 200 OK (Set-Cookie Refresh Token & Body JWT);
|Client Browser / Mobile App|
:Store JWT & Redirect to Dashboard;
stop
@enduml
```

### 3.2. Mermaid Flowchart Swimlane Code (Chi Tiết Trắng Đen)

```mermaid
flowchart TD
    subgraph Client ["Client Browser / App"]
        C1[Enter Email & Password] --> C2[POST /api/v1/auth/login]
        C7[Display Login Error / Lock Message]
        C8[Display OTP Verification UI] --> C9[Submit OTP Code]
        C12[Store JWT & Redirect Dashboard]
    end

    subgraph AuthAPI ["Auth Controller & Security Middleware"]
        C2 --> A1[IP Rate Limiting & Sanitize Input]
        A1 --> A2[Lookup User by Email]
        A2 -- "User Not Found" --> C7
        A2 -- "User Found" --> A3[Check Account Lock & Legal Hold]
        A3 -- "Account Locked" --> S1[Log SecurityEvent AccountLockedAttempt]
        S1 --> C7
        A3 -- "Account Active" --> A4[Verify Password Hash]
    end

    subgraph SecurityModule ["Security & Identity Service"]
        A4 -- "Password Invalid" --> S2[Increment FailedLoginAttempts]
        S2 -- "Failed >= 5" --> S3[Lock Account & Create SecurityIncident]
        S3 --> C7
        S2 -- "Failed < 5" --> C7

        A4 -- "Password Correct" --> S4[Reset FailedAttempts = 0]
        S4 --> S5{Is MFA Enabled?}
        S5 -- "Yes" --> S6[Generate OTP Challenge & Queue Outbox Email]
        S6 --> C8
        C9 --> S7[Verify OTP Challenge Code]
        S7 -- "OTP Invalid/Expired" --> C7
        S7 -- "OTP Valid" --> S8[Generate JWT & Refresh Token]
        S5 -- "No" --> S8
    end

    subgraph OutboxWorker ["Outbox Worker & DB"]
        S6 --> O1[Send OTP Email to User]
        S8 --> DB1[Insert RefreshToken & Write AuditLog]
        DB1 --> C12
    end
```

---

<a id="workflow-4"></a>
## Quy trình 4: Job Vacancy Matching & Candidate Discovery (Ghép nối Ứng viên & Nhu cầu Tuyển dụng)

### 4.1. PlantUML Activity Swimlane Code (Chi Tiết Trắng Đen)

```plantuml
@startuml
skinparam TitleFontSize 16
skinparam TitleFontColor #000000
skinparam ActivityBorderColor #000000
skinparam ActivityBackgroundColor #FFFFFF
skinparam ActivityFontColor #000000
skinparam SwimlaneBorderColor #000000
skinparam SwimlaneTitleFontColor #000000
skinparam SwimlaneTitleFontSize 14
skinparam ArrowColor #000000

title UML Swimlane: Job Vacancy Matching & Candidate Discovery

|Recruiter / Enterprise Admin|
start
:Create Job Vacancy & Enter Hiring Requirement;
:POST /api/v1/hiring-requirements/{id}/match;

|Matching API (HiringRequirementController)|
:Authorize Organization & Workspace Scope;
:Initialize CandidateDiscoveryRun Entity;

|Matching & Discovery Engine (.NET System Service)|
:Create RequirementSnapshot & Vector Snapshot;
:Fetch Active Candidate Profiles from CandidateSearchProfiles;

|AI Vector & Ranking Engine|
loop For Each Candidate in CandidatePool
  :Compute Vector Cosine Similarity (Requirement vs Capability);
  :Evaluate Evidence Signals vs Code Attributions;
  :Factor in Candidate Trust Profile Projections;
  :Compute Aggregate Score (Capability 50%, Evidence 30%, Trust 20%);
end loop

|Data Persistence (PostgreSQL)|
|Matching & Discovery Engine (.NET System Service)|
:Rank Candidate List by Aggregate Match Score;
|Data Persistence (PostgreSQL)|
:Insert MatchingEvaluations, Factors & Explanations into DB;
:Set CandidateDiscoveryRun Status = Completed;

|Matching API (HiringRequirementController)|
:Return HTTP 200 OK (Candidate Cards & AI Match Explanations);

|Recruiter / Enterprise Admin|
:View Matched Candidate List & AI Reasoning;
stop
@enduml
```

### 4.2. Mermaid Flowchart Swimlane Code (Chi Tiết Trắng Đen)

```mermaid
flowchart TD
    subgraph Recruiter ["Recruiter / Enterprise Admin"]
        R1[Create Hiring Requirement] --> R2[POST /api/v1/hiring-requirements/match]
        R6[View Matched Candidates & AI Explanations]
    end

    subgraph API ["Matching API Controller"]
        R2 --> M1[Authorize Organization & Workspace Scope]
        M1 --> M2[Initialize CandidateDiscoveryRun Entity]
    end

    subgraph DiscoveryEngine ["Matching & Discovery Engine"]
        M2 --> D1[Create RequirementSnapshot & Vector Snapshot]
        D1 --> D2[Fetch Active Profiles from CandidateSearchProfiles]
        D2 --> D3[Trigger Multi-Factor Matching Pipeline]
    end

    subgraph RankingEngine ["AI Vector & Ranking Calculator"]
        D3 --> E1[Compute Vector Cosine Similarity]
        E1 --> E2[Evaluate Evidence Signals vs Code Attributions]
        E2 --> E3[Factor in Candidate Trust Profile Projections]
        E3 --> E4[Compute Aggregate Score & Ranking Projections]
    end

    subgraph Database ["PostgreSQL Database"]
        E4 --> DB1[Insert MatchingEvaluations & MatchingFactors]
        DB1 --> DB2[Insert MatchingExplanations AI Reasoning]
        DB2 --> DB3[Update CandidateDiscoveryRun Completed]
        DB3 --> R6
    end
```

---
*Tài liệu sơ đồ Swimlane UML bản chi tiết đầy đủ chuẩn trắng đen monochrome.*
