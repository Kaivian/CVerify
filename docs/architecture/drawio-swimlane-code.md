# Mã Import Sơ đồ Swimlane Chi Tiết Trắng Đen dành cho Draw.io (app.diagrams.net)

Tài liệu này chứa các mã import sơ đồ Swimlane **Chi Tiết Đầy Đủ (Fully Detailed)** ở phong cách **Trắng Đen (Monochrome / Black & White)** dành cho **Draw.io (app.diagrams.net)**.

---

## 🚀 Hướng dẫn Import vào Draw.io (3 Cách thực hiện)

### Cách 1: Import bằng PlantUML (Khuyên dùng cho sơ đồ Activity phân làn chi tiết)
1. Mở [app.diagrams.net](https://app.diagrams.net/).
2. Chọn: **Arrange** (Sắp xếp) $\rightarrow$ **Insert** (Chèn) $\rightarrow$ **Advanced** (Nâng cao) $\rightarrow$ **PlantUML...**
3. Copy toàn bộ khối ````plantuml` bên dưới và dán vào ô nhập $\rightarrow$ Nhấn **Insert**.

### Cách 2: Import bằng Mermaid (Nhanh chóng & Trực quan)
1. Chọn: **Arrange** $\rightarrow$ **Insert** $\rightarrow$ **Advanced** $\rightarrow$ **Mermaid...**
2. Copy khối ````mermaid` bên dưới và dán vào ô nhập $\rightarrow$ Nhấn **Insert**.

### Cách 3: Import bằng CSV (Tạo khối Shapes Native Trắng Đen kéo thả)
1. Chọn: **Arrange** $\rightarrow$ **Insert** $\rightarrow$ **Advanced** $\rightarrow$ **CSV...**
2. Copy khối mã CSV bên dưới và dán vào ô nhập $\rightarrow$ Nhấn **Insert**.

---

## 1. Code PlantUML Chi Tiết Trắng Đen (Import qua Arrange -> Insert -> Advanced -> PlantUML)

### Quy trình 1: Line 2 - Candidate CV AI Analysis Pipeline (Phân tích CV & Đánh giá Năng lực Ứng viên)

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

title CVerify - Line 2 Candidate CV AI Analysis Pipeline (Detailed Monochrome)

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

### Quy trình 2: Line 1 - Source Code Intelligence Pipeline (Phân tích Mã nguồn & Git Repository)

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

title CVerify - Line 1 Source Code Intelligence Pipeline (Detailed Monochrome)

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

### Quy trình 3: Authentication, Security Telemetry & MFA Workflow (Đăng nhập, MFA & An ninh)

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

title CVerify - Authentication, Security Telemetry & MFA Workflow (Detailed Monochrome)

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

---

## 2. Code Mermaid Chi Tiết Trắng Đen (Import qua Arrange -> Insert -> Advanced -> Mermaid)

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

## 3. Code Draw.io CSV Format Chi Tiết Trắng Đen (Import qua Arrange -> Insert -> Advanced -> CSV)

```csv
# label: %step%
# style: shape=%shape%;fillColor=#FFFFFF;strokeColor=#000000;fontColor=#000000;fontStyle=1;whiteSpace=wrap;html=1;rounded=1;strokeWidth=1.5;
# namespace: csvimport
# connect: {"from": "from", "to": "id", "label": "label", "style": "edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#000000;strokeWidth=1.5;"}
# width: 240
# height: 60
# padding: 20
# layout: auto
# swimlane: lane
id,lane,step,shape,from,label
L1,Client (React UI),1. Click "Start CV Analysis",rectangle,,
L2,API Layer (.NET Controller),2. Authenticate JWT & Readiness Check,rhombus,L1,POST /api/v1/candidate-assessments
L3,Data & Cache Layer,3. Acquire Redis Lock & Enqueue Queue,rectangle,L2,Ready
L4,Background Worker (.NET),4. Dequeue Job & Fetch Line 1 Data,rectangle,L3,Queued
L5,Python AI Subsystem,5. Run 15 DAG Tasks (L2-001 to L2-015),rectangle,L4,POST /assess/stream
L6,External LLM (Claude API),6. Inference Technical & Behavioral JSON,rectangle,L5,Send Context
L7,Python AI Subsystem,7. Parse Output & Stream SSE Events,rectangle,L6,Response
L8,Data & Cache Layer,8. Save DB Artifacts & Pub/Sub Progress,rectangle,L7,Stream Event
L9,Client (React UI),9. Update SSE Progress Bar & Render CV,rectangle,L8,Progress Event
L10,Background Worker (.NET),10. Complete Execution & Set Status,rectangle,L8,Done
L11,Data & Cache Layer,11. Set Status = Completed & Release Lock,rectangle,L10,Complete
```

---
*Mã Import Draw.io phiên bản Chi Tiết Đầy Đủ (Trắng Đen Monochrome) cho CVerify.*
