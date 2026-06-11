# Software Design Specification - CVerify Screen Specification

---

# 2.2 Screen Descriptions

This section provides the complete functional inventory and description of every screen in the CVerify system.

| # | Feature | Screen (Route) | Description |
| :--- | :--- | :--- | :--- |
| 1 | Public | Public Landing Page (`/`) | Main marketing home page with animated CVerify pipeline steps and trust score gauges. |
| 2 | Public | Public Jobs board (`/jobs`) | Sourcing job board listings with keyword search and company filter sidebars. |
| 3 | Public | Leaderboards Page (`/ranking`) | Top candidate list ordered by verified developer trust score and capability points. |
| 4 | Public | Ranking Insights (`/ranking/insights`) | Public developer analytics charts and market statistics visualizations. |
| 5 | Public | Public Company Profile (`/business/[slug]`) | Enterprise corporate profile containing About, active Jobs, People, and Announcements tabs. |
| 6 | Public | Public Company Jobs (`/business/[slug]/jobs`) | Public job vacancy board filtered strictly for the target company. |
| 7 | Public | Public Company People (`/business/[slug]/people`) | Public roster of verified organization members and employees. |
| 8 | Public | Public Company Posts (`/business/[slug]/posts`) | Public timeline feed announcements posted by the organization. |
| 9 | Public | Public Developer Portfolio (`/[username]`) | Developer profile detailing skill nodes, experience logs, and verified trust scores. |
| 10 | Public | System Health Status (`/system/status`) | Health status dashboard tracking API server, Redis cache, and AI engine pings. |
| 11 | Public | Access Denied Page (`/unauthorized`) | Error screen displayed when a user violates role-based route constraints. |
| 12 | Auth | Login Page (`/login`) | Credential sign-in form supporting direct email passwords and Google OAuth login. |
| 13 | Auth | Continue with Email (`/continue-with-email`) | User registration form collecting full names, emails, and secure passwords. |
| 14 | Auth | Forgot Password (`/forgot-password`) | Form to trigger reset password recovery verification link emails. |
| 15 | Auth | Reset Password (`/reset-password`) | Form to enter a new password using recovery email tokens. |
| 16 | Auth | Verify Email Page (`/verify-email`) | Verification screen processed when user clicks the secure link in registration email. |
| 17 | Auth | Role Selection Gateway (`/gateway`) | Direction gate interface where signing-up users choose Developer vs Business path. |
| 18 | Auth | Google OAuth Callback (`/auth/callback/google`) | Intermediate redirection endpoint validating Google access tokens and starting sessions. |
| 19 | Auth | Account Reactivation (`/auth/reactivate`) | Form requesting manual restoration reviews for suspended user profiles. |
| 20 | Onboarding | Company Onboarding Verify (`/company-onboarding/verify`) | Tax code entry panel fetching national business metadata from VietQR API. |
| 21 | Onboarding | Company Profile Setup (`/company-setup`) | Onboarding form to upload logos and specify corporate address details. |
| 22 | Onboarding | Workspace Setup Onboarding (`/workspace-setup`) | Onboarding screen to provision the first workspace departments. |
| 23 | Onboarding | Verification Status (`/company-verification`) | Status dashboard displaying company verification level constraints. |
| 24 | Onboarding | Accept Team Invitation (`/invitations/accept`) | Verification page confirming employee workspace registration invites. |
| 25 | Recovery | Company Ownership Reclaim (`/organization/reclaim`) | Document uploader panel to reclaiming occupied tax codes from fraud accounts. |
| 26 | Recovery | Organization Recovery Request (`/organization/recovery`) | Form to request system recovery session setups. |
| 27 | Recovery | Recovery Session Bootstrap (`/organization/recovery/bootstrap`) | Representative token validation setup panel. |
| 28 | Recovery | Representative Recovery Voting (`/organization/recovery/vote`) | Voting console where representatives cast Approve/Reject votes to execute recovery. |
| 29 | Candidate | Developer Dashboard (`/user`) | Personal workspace displaying credentials, verified permissions, and sandbox widgets. |
| 30 | Candidate | Resume & CV Parser (`/cv`) | File drop uploader checking experience histories and parsing CV files. |
| 31 | Candidate | AI Analysis Report (`/intelligence/ai-analysis`) | Narrative report displaying executive summaries, strengths, and recommended roles. |
| 32 | Candidate | Skill Tree node graph (`/intelligence/skill-tree`) | SVG node graph displaying verified skill nodes mapped to codebase analysis results. |
| 33 | Candidate | Trust Score Breakdown (`/intelligence/trust-score`) | Detail page checking plagiarism warnings, contribution metrics, and trust score gauges. |
| 34 | Candidate | Profile Settings (`/settings`) | Form to customize bio, profile name, and toggle recruiter discoverability status. |
| 35 | Candidate | Git Integrations Manager (`/settings/source-code-providers`) | VCS settings panel linking GitHub/GitLab and triggering code analysis runs. |
| 36 | Chat | AI Chat Assistant (`/chat`) | Conversational stream layout offering mock interviews and capability matching queries. |
| 37 | Forum | Community Forums (`/forum`) | Developer community home page listing active categories, topics, and metrics. |
| 38 | Forum | Create Forum Topic (`/forum/new`) | Content text editor to publish new discussion topics to community categories. |
| 39 | Forum | View Forum Topic Detail (`/forum/topic/[topicSlug]`) | Discussion viewport listing thread posts, comments, likes, and reactions. |
| 40 | Forum | Edit Forum Topic (`/forum/topic/[topicSlug]/edit`) | Form to edit category topic description texts. |
| 41 | Forum | Forum Category Page (`/forum/[categorySlug]`) | Filtered topic list displaying posts sorted by target category slug. |
| 42 | Tenant Admin | Business Hub (`/business`) | Portal landing page listing companies owned or managed by the user. |
| 43 | Tenant Admin | Organization Dashboard (`/business/[slug]/dashboard`) | Main dashboard listing department workspaces and employee summaries. |
| 44 | Tenant Admin | Organization Profile settings (`/business/[slug]/information`) | Profile form to update company description, address, and logo. |
| 45 | Tenant Admin | Company Settings (`/business/[slug]/settings`) | Settings panel to configure organization configuration parameters. |
| 46 | Tenant Admin | Organization Members manager (`/business/[slug]/members`) | Workspace directory list panel to invite employees and assign roles. |
| 47 | Tenant Admin | Subscriptions & Billing (`/business/[slug]/billing`) | Package selector panel mapping pricing plans. |
| 48 | Tenant Admin | Invoices and transactions (`/business/[slug]/revenue`) | Transaction history table details. |
| 49 | Tenant Admin | Organization Verification (`/business/[slug]/verification`) | Tax audit document uploader panel. |
| 50 | Tenant Admin | Workspaces Directory (`/business/[slug]/workspaces`) | Management page listing department workspaces and active status. |
| 51 | Tenant Admin | Workspace Members manager (`/business/[slug]/workspace/members`) | Scoped member lists. |
| 52 | Tenant Admin | Workspace Settings manager (`/business/[slug]/workspace/settings`) | Scoped workspace configuration and deletes panel. |
| 53 | Tenant Admin | Access Controls Roles Matrix (`/business/[slug]/roles`) | Matrix page configuring role permissions and listing role edit audit logs. |
| 54 | Recruitment | Recruitment dashboard (`/business/[slug]/recruitment/dashboard`) | KPI manager displaying active job vacancy totals and interview counts. |
| 55 | Recruitment | Candidates directory (`/business/[slug]/recruitment/candidates`) | Sourcing table listing candidates who have applied or engaged. |
| 56 | Recruitment | Job Vacancies board (`/business/[slug]/recruitment/jd`) | Management portal listing JDs and launching AI JD drafting wizard. |
| 57 | Recruitment | Job Match Reviewer (`/business/[slug]/recruitment/jd/[id]/review`) | Detail screen showing skill prioritizations and matches list. |
| 58 | Recruitment | Job applications list (`/business/[slug]/recruitment/applications`) | Review lists of applicants details. |
| 59 | Recruitment | Kanban Hiring Pipeline (`/business/[slug]/recruitment/pipeline`) | Drag-and-drop Kanban board mapping candidates to application stages. |
| 60 | Recruitment | Talent Discovery search (`/business/[slug]/talent-pool`) | Natural language AI sourcing panel. |
| 61 | Recruitment | Interviews scheduler (`/business/[slug]/bookings`) | Calendar reservation system scheduling technical interviews. |
| 62 | Recruitment | Candidate Intelligence details (`/business/[slug]/intelligence/[id]`) | Verified report details tab layout (Skill Tree, code plagiarism, contributions). |
| 63 | Recruitment | Candidate Rankings list (`/business/[slug]/rankings`) | Candidate rank projections table. |
| 64 | Recruitment | Workspace External Listings (`/business/[slug]/listings`) | Listing publisher panel. |
| 65 | Recruitment | Workspace Analytics (`/business/[slug]/analytics`) | Analytics graphs. |
| 66 | Recruitment | Workspace AI Insights (`/business/[slug]/insights`) | AI evaluation insights on hiring. |
| 67 | Recruitment | Talent Intelligence dashboard (`/business/[slug]/intelligence`) | Vetting board overview. |
| 68 | Recruitment | Workspace bookings list (`/business/[slug]/bookings`) | Scheduled bookings overview. |
| 69 | Recruitment | Workspace Customers manager (`/business/[slug]/customers`) | External client API portal. |
| 70 | System Admin | Admin dashboard (`/admin`) | Diagnostic overview of system statistics and active jobs. |
| 71 | System Admin | Users manager (`/admin/users`) | System user directory to suspend, reactivate, or change roles. |
| 72 | System Admin | System Roles manager (`/admin/roles`) | Platform RBAC role mapping matrices. |
| 73 | System Admin | System Audit logs (`/admin/audit-logs`) | Database activity stream detailing user events and system configurations. |
| 74 | System Admin | Recovery claims list (`/admin/recovery-claims`) | Claims manager reviewing reclamation certs. |
| 75 | System Admin | Disaster Recovery console (`/admin/recovery/level2`) | Multi-sig bypass trigger console. |
| 76 | System Admin | Component Visual diagram (`/admin/components`) | Visual backend codebase node dependency graph. |
| 77 | System Admin | Forum Moderation portal (`/forum/moderation`) | Moderate reported topics and comments lists. |

---

# 2.3 Screen Authorization

This matrix defines the operations available to each user role on a per-screen basis, matching the system security policies enforced by CVerify middleware guards.
* **G**: Guest
* **C**: Candidate (USER)
* **R**: Recruiter (BUSINESS - HR)
* **HM**: Hiring Manager (BUSINESS - manager)
* **OA**: Organization Admin (BUSINESS - OWNER)
* **SA**: Super Admin (SYSTEM ADMIN)
* **RP**: Representative

An **X** indicates that the role is authorized to perform the corresponding screen activity or query action.

| Screen / Dynamic Screen Activity | G | C | R | HM | OA | SA | RP |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Landing Page (`/`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query Public Marketing Details* | X | X | X | X | X | X | X |
| **Jobs Board (`/jobs`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query Public Job List* | X | X | X | X | X | X | X |
| **Rankings (`/ranking`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query Global Ranks* | X | X | X | X | X | X | X |
| **Org Profile (`/business/[slug]`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query Public Company Profile* | X | X | X | X | X | X | X |
| &nbsp;&nbsp;&nbsp;&nbsp;*Follow/Unfollow Organization* | | X | X | X | X | X | |
| **Dev Profile (`/[username]`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query Public Developer Portfolio* | X | X | X | X | X | X | X |
| **Login Page (`/login`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Submit credentials / Google OAuth token* | X | | | | | | |
| **Verify Email Page (`/verify-email`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Submit Email Verification Token* | | X | X | X | X | X | |
| **Developer Dashboard (`/user`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query Own Dashboard details* | | X | | | | X | |
| **Resume & CV Parser (`/cv`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Add New CV File* | | X | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query Own Parsed CV data* | | X | | | | | |
| **AI Analysis Report (`/intelligence/ai-analysis`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query Own AI Analysis details* | | X | | | | X | |
| **Skill Tree Graph (`/intelligence/skill-tree`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query Own Skill Nodes* | | X | | | | X | |
| **Trust Score (`/intelligence/trust-score`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query Own Trust Score metrics* | | X | | | | X | |
| **VCS Link Settings (`/settings/source-code-providers`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Add New VCS Connections* | | X | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Delete Own VCS Connections* | | X | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Trigger Codebase sync* | | X | | | | | |
| **AI Chat Assistant (`/chat`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query AI Assistant Conversational stream* | | X | X | | | X | |
| **New Forum Topic (`/forum/new`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Publish New Forum Topic* | | X | X | X | X | X | |
| **Edit Forum Topic (`/forum/topic/[slug]/edit`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Update Own Forum Topic* | | X | X | X | X | X | |
| **Org Dashboard (`/business/[slug]/dashboard`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query Managed Organization dashboard* | | | X | X | X | X | |
| **Org Settings (`/business/[slug]/settings`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Update Managed Organization configurations*| | | | | X | X | |
| **Org Members manager (`/business/[slug]/members`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query Managed Employee Roster* | | | | | X | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Add New Employee Invitation* | | | | | X | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Update Employee Roles* | | | | | X | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Delete Employee Membership* | | | | | X | X | |
| **Custom Roles Matrix (`/business/[slug]/roles`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query Custom Roles list* | | | | | X | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Add New Custom Roles* | | | | | X | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Update Custom Roles permissions* | | | | | X | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Delete Custom Roles* | | | | | X | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query Custom Roles Audit logs* | | | | | X | X | |
| **Subscriptions & Billing (`/business/[slug]/billing`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query billing plans* | | | | | X | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Update checkout plans* | | | | | X | X | |
| **VietQR Verification (`/business/[slug]/verification`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query verification status* | | | | | X | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Add New Verification Documents* | | | | | X | X | |
| **Workspaces Directory (`/business/[slug]/workspaces`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query Workspace department lists* | | | X | | X | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Add New Workspaces* | | | | | X | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Delete Workspaces* | | | | | X | X | |
| **Workspace Members (`/business/[slug]/workspace/members`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query Workspace-scoped employees* | | | | X | X | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Add New Workspace members* | | | | X | X | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Delete Workspace members* | | | | X | X | X | |
| **Workspace Settings (`/business/[slug]/workspace/settings`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Update Workspace configurations* | | | | X | X | X | |
| **Recruitment dashboard (`/business/[slug]/recruitment/dashboard`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query recruitment KPIs* | | | X | X | X | X | |
| **Candidates Directory (`/business/[slug]/recruitment/candidates`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query Managed Candidates directory* | | | X | X | X | X | |
| **Job Vacancies board (`/business/[slug]/recruitment/jd`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query Workspace vacancies* | | | X | X | X | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Add New vacancy JDs* | | | X | X | X | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Trigger AI JD drafting wizard* | | | X | X | X | X | |
| **Job Match Reviewer (`/business/[slug]/recruitment/jd/[id]/review`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Update Vacancy JD requirements* | | | X | X | X | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Execute AI Candidate Matching* | | | X | X | X | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query matched candidates lists* | | | X | X | X | X | |
| **Hiring Kanban Pipeline (`/business/[slug]/recruitment/pipeline`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query Pipeline Application states* | | | X | X | X | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Update Candidate Application Stage* | | | X | X | X | X | |
| **Talent Sourcing Pool (`/business/[slug]/talent-pool`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Execute AI Talent Discovery queries* | | | X | X | X | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query sourced candidate records* | | | X | X | X | X | |
| **Interviews Scheduler (`/business/[slug]/bookings`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query Workspace bookings calendar* | | | X | X | X | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Add New bookings slot* | | | X | X | X | X | |
| **Candidate Vetting sheet (`/business/[slug]/intelligence/[id]`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query Candidate Verified metrics report* | | | X | X | X | X | |
| **Reclaim Profile Page (`/organization/reclaim`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Add New reclamation claim* | | | | | X | | |
| **Recovery Voting Page (`/organization/recovery/vote`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query Recovery Session details* | | | | | | | X |
| &nbsp;&nbsp;&nbsp;&nbsp;*Cast Multi-sig Recovery vote* | | | | | | | X |
| **Admin dashboard (`/admin`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query system metrics* | | | | | | X | |
| **Users manager (`/admin/users`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query All platform users* | | | | | | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Update User status (Suspend/Reactivate)* | | | | | | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Update user system roles* | | | | | | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Add New Administrator invitation* | | | | | | X | |
| **System Roles matrix (`/admin/roles`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query System Roles mapping* | | | | | | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Update System Roles permissions* | | | | | | X | |
| **System Audit logs (`/admin/audit-logs`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query All system audit records* | | | | | | X | |
| **Claims Admin (`/admin/recovery-claims`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query pending reclaims* | | | | | | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Approve/Reject reclaim requests* | | | | | | X | |
| **Disaster Recovery console (`/admin/recovery/level2`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query active recovery sessions* | | | | | | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Execute Multi-sig Bypass command* | | | | | | X | |
| **Forum Moderation (`/forum/moderation`)** | | | | | | | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Query community flags* | | | | | | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Approve/Reject Forum report decisions* | | | | | | X | |
| &nbsp;&nbsp;&nbsp;&nbsp;*Delete reported topic/reply posts* | | | | | | X | |

---

# 2.4 Non-UI Functions

The following background processes and asynchronous workers operate within the CVerify .NET Web API and cache structures:

| # | Feature | System Function | Description |
| :--- | :--- | :--- | :--- |
| 1 | Shared/SMTP | `EmailOutboxBackgroundProcessor` | Periodic worker checking `outbox_messages` table and sending queued HTML email streams via SMTP. |
| 2 | Auth/Security | `TokenCleanupBackgroundJob` | Hourly worker cleaning up expired refresh tokens, reset passwords tokens, and verification links. |
| 3 | Recovery | `RecoveryClaimBackgroundWorker` | Worker sweeping organizational recovery sessions, expiring outdated representative votes. |
| 4 | Auth | `OtpCleanupBackgroundWorker` | Sweep worker removing expired OTP codes from database verification tables. |
| 5 | Candidate | `BackgroundRepositorySyncProcessor` | Async queue worker retrieving repository files and branch commits histories from VCS APIs. |
| 6 | Candidate | `BackgroundRepositoryAnalysisProcessor` | Worker streaming repository files to FastAPI AI Service to calculate code maturity and plagiarism index scores. |
| 7 | Candidate/AI | `BackgroundCandidateAssessmentProcessor` | Aggregator worker sending repo and CV metrics to AI matching engines, compile strengths. |
| 8 | Notifications | `RedisNotificationSubscriberWorker` | PubSub listener relaying Redis notification triggers directly to client browsers using SignalR Hub. |
| 9 | Recruitment | `CandidateRankingProjectionWorker` | Cron worker updating candidate rankings projection tables on a 30-minute schedule. |
