# Test Case Module Audit

This document groups the **25 functional modules** of CVerify by user/system actors to reflect the operational responsibilities of Candidates, Organizations, Platform Administrators, and Shared services.

---

## Module Summary by Actor

### 1. Shared / Core Platform
These modules are available to guests, unauthenticated users, or apply globally across all actors.

| No | Module | Description |
| -- | ------ | ----------- |
| 1 | Authentication | Handles credential login, Google OAuth integration, email verification, magic link verification, OTP verification, password changes/resets, session management, token cleanup background workers, and reactivation. |
| 24 | Developer Community Forums | Implements category-based developer discussion forums with topic CRUD, bookmarking, replies, solutions, and community votes/reactions. |

### 2. Candidate (Developer)
These modules contain features dedicated to developers managing their profiles, uploading portfolios, syncing Git codebases, running assessments, and applying for jobs.

| No | Module | Description |
| -- | ------ | ----------- |
| 3 | Profile Management | Manages candidate name, bio, social links, recruiter discoverability status, avatar uploading, and account deletion requests with cascading data purge. |
| 4 | Create CV | Supports resume PDF uploading, parsing, work experiences entries, educational histories, achievements, and manual skill registries on profiles. |
| 5 | Apply Jobs | Manages public job postings board search, filtering, and job application submissions with CV and profile attachments. |
| 6 | VCS Integration & Codebase Synchronization | Handles connecting external VCS accounts (GitHub/GitLab), listing repositories/branches, and background code synchronization processes. |
| 7 | Codebase Static Analysis & Intelligence | Performs automated static analysis on synchronized source code repositories to compute code structure, quality metrics, security issues, and plagiarism detection. |
| 8 | Candidate Vetting & Readiness | Evaluates if a candidate is ready for full AI capability assessment based on profile completeness and connected Git repositories. |
| 9 | Skill Taxonomy & Proficiency Calibration | Maps and estimates raw skill metrics extracted from codebases and profiles against CVerify's global skill taxonomy, calibrating career levels and proficiency scores. |
| 10 | Behavioral & Maturity Diagnostics | Analyzes codebase hygiene, testing practices, logging conventions, collaboration patterns, and commit history to diagnose developer maturity, tendencies, and working styles. |
| 11 | Role Recommendation & Career Pathways | Computes matching scores for standard engineering roles and generates personalized capability improvement roadmaps for developers. |
| 12 | Skill Tree Visualization | Renders interactive hierarchical SVG node graphs of candidate capabilities based on codebase evidence. |
| 13 | AI Profile Composition & Executive Summaries | Assembles the finalized, calibrated candidate profile data structures and generates recruiter-friendly narrative summaries. |

### 3. Organization (Business / Recruiter)
These modules are dedicated to company admins, recruiters, hiring managers, and legal representatives to onboard their business, configure workspaces, define hiring criteria, book interviews, source talent, and handle account recovery.

| No | Module | Description |
| -- | ------ | ----------- |
| 2 | Register For Business | Manages enterprise onboarding, including tax code verification via external APIs (VietQR API), profile information configuration, and initial workspace provisioning. |
| 14 | Explainable Job Matching Engine | Matches candidate profiles with job vacancy requirements, calculating compatibility scores and generating explainable factor breakdowns. |
| 15 | Talent Sourcing & AI Search | Offers natural language search and semantic filtering of candidate intelligence profiles for recruiters. |
| 16 | Job Vacancy Posting & Management | Enables businesses to publish and manage job postings and drafts JD requirements using an AI drafting assistant. |
| 17 | Hiring Criteria & Rubrics Definition | Manages hiring requirement models, technology constraints, custom evaluation rubrics, and technical interview blueprints. |
| 18 | Hiring Pipeline & Kanban Tracker | Manages candidate application workflows through drag-and-drop Kanban pipelines. |
| 19 | Interview Scheduling & Bookings | Manages interview booking calendars, slots, dates, and email reminders for candidates and interviewers. |
| 20 | Organization Profile, Branding & Billing | Manages enterprise profile branding (description, logo, avatar, active rosters) and organization subscriptions/billing plans. |
| 21 | Workspace Collaboration & Archiving | Provisions department-specific collaboration workspaces and manages team announcements. |
| 22 | Business Memberships & Access Controls | Handles team invitations, employee memberships, and custom organization-level RBAC role matrices. |
| 23 | Representative Rotation & Multi-Sig Recovery | Implements Level 2 legal recovery of occupied accounts, including representative rotation requests, support approvals, and representative voting. |

### 4. Platform Administrator (System Admin)
These modules contain utility endpoints and administrative controls reserved for platform operators.

| No | Module | Description |
| -- | ------ | ----------- |
| 25 | Platform Administration & Moderation | Manages global user accounts, system configuration, audit logs, health diagnostics, forum moderation queues, and reclaim approvals. |

---

## Detailed Test Cases by Actor

### Actor: Shared / Core Platform

#### Module 1 - Authentication

| Test Case | Module |
| --------- | ------ |
| Login via Google | 1 Authentication |
| Login with Email/Password | 1 Authentication |
| Verify with Enter Code (OTP) | 1 Authentication |
| Verify with Secure Magic Link | 1 Authentication |
| Forgot Password Request | 1 Authentication |
| Reset Password with Token | 1 Authentication |
| Change Password | 1 Authentication |
| Logout and Session Invalidation | 1 Authentication |
| User Registration (Candidate vs Business path) | 1 Authentication |
| Email Verification Callback | 1 Authentication |
| Resend Verification Email | 1 Authentication |
| Session & Refresh Token Rotation | 1 Authentication |
| Token Cleanup Background Job execution | 1 Authentication |
| OTP Cleanup Background Worker execution | 1 Authentication |
| Platform Security & Tenant Isolation (claims evaluation) | 1 Authentication |
| Account Reactivation Request for suspended profiles | 1 Authentication |

#### Module 24 - Developer Community Forums

| Test Case | Module |
| --------- | ------ |
| Create forum category (admin only) | 24 Developer Community Forums |
| Create forum topic (Markdown post) | 24 Developer Community Forums |
| Edit or delete own forum topic | 24 Developer Community Forums |
| Filter topics by category or trending tags | 24 Developer Community Forums |
| Post replies/comments on topics | 24 Developer Community Forums |
| Mark reply as accepted solution by author | 24 Developer Community Forums |
| Vote on topic or reply (upvote/downvote) | 24 Developer Community Forums |
| React to topic or reply with emojis | 24 Developer Community Forums |
| Bookmark forum topic | 24 Developer Community Forums |
| Follow forum topic (notify on replies) | 24 Developer Community Forums |

---

### Actor: Candidate (Developer)

#### Module 3 - Profile Management

| Test Case | Module |
| --------- | ------ |
| View Developer Profile | 3 Profile Management |
| Edit Profile Bio, name, and social links | 3 Profile Management |
| Upload & Crop Profile Avatar | 3 Profile Management |
| Toggle Recruiter Discoverability status | 3 Profile Management |
| Submit Account Deletion Request | 3 Profile Management |
| Validate deletion requirements (no outstanding organization ownerships) | 3 Profile Management |
| Execute Account Deletion and data purge (hard/soft delete cascade) | 3 Profile Management |

#### Module 4 - Create CV

| Test Case | Module |
| --------- | ------ |
| Upload PDF resume file | 4 Create CV |
| Resume parser execution (text extraction, field parsing) | 4 Create CV |
| Add/Edit Work Experience entry (company, duration, role, achievements) | 4 Create CV |
| Add/Edit Education entry (school, degree, GPA, achievements) | 4 Create CV |
| Add/Edit Academic Achievement | 4 Create CV |
| Register manual skills on profile | 4 Create CV |
| Upload CV profile attachments | 4 Create CV |
| Handle invalid resume file format errors | 4 Create CV |

#### Module 5 - Apply Jobs

| Test Case | Module |
| --------- | ------ |
| Search public jobs board by keyword | 5 Apply Jobs |
| Filter jobs by location, company, and industry | 5 Apply Jobs |
| Submit Job Application (linking parsed CV and profile data) | 5 Apply Jobs |
| Prevent duplicate job applications from the same candidate | 5 Apply Jobs |
| Track job interactions (views, clicks, interest indicators) | 5 Apply Jobs |
| Handle application validation errors (missing CV or profile details) | 5 Apply Jobs |

#### Module 6 - VCS Integration & Codebase Synchronization

| Test Case | Module |
| --------- | ------ |
| Link GitHub account via OAuth callback | 6 VCS Integration & Codebase Synchronization |
| Link GitLab account via OAuth callback | 6 VCS Integration & Codebase Synchronization |
| Check GitHub/GitLab connection status | 6 VCS Integration & Codebase Synchronization |
| List Git repositories and branches | 6 VCS Integration & Codebase Synchronization |
| List Git organization structures | 6 VCS Integration & Codebase Synchronization |
| Trigger VCS repository metadata sync (commits, branches, pull requests) | 6 VCS Integration & Codebase Synchronization |
| Background repository sync processor execution (queue worker) | 6 VCS Integration & Codebase Synchronization |
| Handle Git API rate limiting or credential expiration errors | 6 VCS Integration & Codebase Synchronization |

#### Module 7 - Codebase Static Analysis & Intelligence

| Test Case | Module |
| --------- | ------ |
| Trigger repository static analysis | 7 Codebase Static Analysis & Intelligence |
| Check analysis task execution progress (Structure, Commits, Quality, Security) | 7 Codebase Static Analysis & Intelligence |
| Generate repository classification and summaries | 7 Codebase Static Analysis & Intelligence |
| Plagiarism warning check and code provenance analysis | 7 Codebase Static Analysis & Intelligence |
| Retrieve static analysis reports and summaries | 7 Codebase Static Analysis & Intelligence |
| Developer reset and re-analyze repository | 7 Codebase Static Analysis & Intelligence |
| Handle analysis task failures and retry logic | 7 Codebase Static Analysis & Intelligence |
| Retrieve raw analysis artifacts from storage | 7 Codebase Static Analysis & Intelligence |

#### Module 8 - Candidate Vetting & Readiness

| Test Case | Module |
| --------- | ------ |
| Check candidate readiness status (profile fields, Git repo count) | 8 Candidate Vetting & Readiness |
| Retrieve list of assessment stages and descriptions | 8 Candidate Vetting & Readiness |
| Trigger full candidate capability assessment | 8 Candidate Vetting & Readiness |
| Cancel active candidate assessment run | 8 Candidate Vetting & Readiness |
| Handle trigger requests when candidate is not ready | 8 Candidate Vetting & Readiness |

#### Module 9 - Skill Taxonomy & Proficiency Calibration

| Test Case | Module |
| --------- | ------ |
| Map project-level skills to CVerify global skill taxonomy | 9 Skill Taxonomy & Proficiency Calibration |
| Estimate skill proficiency scores (frequency and complexity weights) | 9 Skill Taxonomy & Proficiency Calibration |
| Calibrate candidate career levels (Junior, Mid, Senior, Lead, Architect) | 9 Skill Taxonomy & Proficiency Calibration |
| Handle manual overrides or validation constraints for career levels | 9 Skill Taxonomy & Proficiency Calibration |
| Update candidate capability scorecards and history | 9 Skill Taxonomy & Proficiency Calibration |

#### Module 10 - Behavioral & Maturity Diagnostics

| Test Case | Module |
| --------- | ------ |
| Evaluate codebase hygiene and engineering maturity (testing, logging, organization) | 10 Behavioral & Maturity Diagnostics |
| Analyze problem-solving complexity (bug-fix cycles in commit messages) | 10 Behavioral & Maturity Diagnostics |
| Classify developer affinity (Frontend, Backend, DevOps, Fullstack) | 10 Behavioral & Maturity Diagnostics |
| Classify developer working style and collaboration density | 10 Behavioral & Maturity Diagnostics |
| Calibrate experience confidence scores based on codebase age and volume | 10 Behavioral & Maturity Diagnostics |
| Handle analysis of empty or single-commit repositories | 10 Behavioral & Maturity Diagnostics |

#### Module 11 - Role Recommendation & Career Pathways

| Test Case | Module |
| --------- | ------ |
| Compute alignment percentages for classic industry roles | 11 Role Recommendation & Career Pathways |
| Generate personalized capability improvement recommendations | 11 Role Recommendation & Career Pathways |
| Suggest specific skill optimization pathways | 11 Role Recommendation & Career Pathways |
| Retrieve latest career preferences and AI-inferred preferences | 11 Role Recommendation & Career Pathways |

#### Module 12 - Skill Tree Visualization

| Test Case | Module |
| --------- | ------ |
| Construct SVG skill tree node structure | 12 Skill Tree Visualization |
| Render interactive skill tree graph on developer dashboard | 12 Skill Tree Visualization |
| View public developer portfolio skill trees | 12 Skill Tree Visualization |
| Handle node expansion and detail tooltips (showing evidence count) | 12 Skill Tree Visualization |

#### Module 13 - AI Profile Composition & Executive Summaries

| Test Case | Module |
| --------- | ------ |
| Generate narrative executive summary of candidate skills | 13 AI Profile Composition & Executive Summaries |
| Assemble and serialize finalized candidate assessment profile | 13 AI Profile Composition & Executive Summaries |
| View public candidate portfolio narrative summary | 13 AI Profile Composition & Executive Summaries |
| Check access controls for public vs private profile details | 13 AI Profile Composition & Executive Summaries |

---

### Actor: Organization (Business / Recruiter)

#### Module 2 - Register For Business

| Test Case | Module |
| --------- | ------ |
| Company Onboarding tax code verification (VietQR metadata fetch) | 2 Register For Business |
| Handling invalid tax code validation errors | 2 Register For Business |
| Company profile setup (logos, corporate address, company size, industry) | 2 Register For Business |
| Initial organization workspace provisioning | 2 Register For Business |
| Verify company link status dashboard | 2 Register For Business |
| Registration of duplicate organization name/tax code (conflict check) | 2 Register For Business |

#### Module 14 - Explainable Job Matching Engine

| Test Case | Module |
| --------- | ------ |
| Evaluate job vacancy to candidate matching scores | 14 Explainable Job Matching Engine |
| Define matching factors and weights (technology, capability, experience) | 14 Explainable Job Matching Engine |
| Generate explainable matching assertions (strengths, gaps, warnings) | 14 Explainable Job Matching Engine |
| Handle matching evaluations for multi-repository candidates | 14 Explainable Job Matching Engine |

#### Module 15 - Talent Sourcing & AI Search

| Test Case | Module |
| --------- | ------ |
| Execute natural language talent search queries | 15 Talent Sourcing & AI Search |
| Filter talent search by location and minimum trust score | 15 Talent Sourcing & AI Search |
| Browse candidate search profiles (headlines, trust tiers, capabilities) | 15 Talent Sourcing & AI Search |
| Retrieve detailed vetting profile (capabilities, evidence, verifications) | 15 Talent Sourcing & AI Search |

#### Module 16 - Job Vacancy Posting & Management

| Test Case | Module |
| --------- | ------ |
| Create and publish job vacancy JDs | 16 Job Vacancy Posting & Management |
| Edit active job vacancy details | 16 Job Vacancy Posting & Management |
| Close, archive, or reopen job postings | 16 Job Vacancy Posting & Management |
| Launch AI JD drafting assistant (drafting from templates) | 16 Job Vacancy Posting & Management |
| Manage external job listings distribution | 16 Job Vacancy Posting & Management |

#### Module 17 - Hiring Criteria & Rubrics Definition

| Test Case | Module |
| --------- | ------ |
| Define technology constraints and capability requirements | 17 Hiring Criteria & Rubrics Definition |
| Create custom candidate evaluation rubrics | 17 Hiring Criteria & Rubrics Definition |
| Design technical interview blueprints and evidence signal requirements | 17 Hiring Criteria & Rubrics Definition |
| Snapshot hiring requirements and rubrics for job vacancy applications | 17 Hiring Criteria & Rubrics Definition |
| Modify active rubrics and handle version cascades | 17 Hiring Criteria & Rubrics Definition |

#### Module 18 - Hiring Pipeline & Kanban Tracker

| Test Case | Module |
| --------- | ------ |
| Track application states (Applied, Vetted, Interviewing, Offered, Hired) | 18 Hiring Pipeline & Kanban Tracker |
| Update candidate application stage in pipeline (drag-and-drop transitions) | 18 Hiring Pipeline & Kanban Tracker |
| Filter applications by job vacancy and candidate status | 18 Hiring Pipeline & Kanban Tracker |
| Review historical application metrics | 18 Hiring Pipeline & Kanban Tracker |

#### Module 19 - Interview Scheduling & Bookings

| Test Case | Module |
| --------- | ------ |
| Configure interview booking slots and availability | 19 Interview Scheduling & Bookings |
| Book technical interview slot as a candidate | 19 Interview Scheduling & Bookings |
| View workspace bookings calendar (recruiter overview) | 19 Interview Scheduling & Bookings |
| Reschedule or cancel booked interviews | 19 Interview Scheduling & Bookings |
| Trigger email reminders for scheduled bookings | 19 Interview Scheduling & Bookings |

#### Module 20 - Organization Profile, Branding & Billing

| Test Case | Module |
| --------- | ------ |
| Update enterprise profile description, address, and contacts | 20 Organization Profile, Branding & Billing |
| Upload organization logo and branding banner | 20 Organization Profile, Branding & Billing |
| Follow/unfollow business organizations | 20 Organization Profile, Branding & Billing |
| Browse pricing plans and select subscription tier (simulated) | 20 Organization Profile, Branding & Billing |
| View invoices and billing transaction history | 20 Organization Profile, Branding & Billing |

#### Module 21 - Workspace Collaboration & Archiving

| Test Case | Module |
| --------- | ------ |
| Provision new department workspaces within organization | 21 Workspace Collaboration & Archiving |
| Archive, restore, or delete workspaces | 21 Workspace Collaboration & Archiving |
| Scoped workspace settings configuration | 21 Workspace Collaboration & Archiving |
| Transfer workspace ownership | 21 Workspace Collaboration & Archiving |
| Publish workspace team announcement posts | 21 Workspace Collaboration & Archiving |
| Enumerate workspace public announcements timeline | 21 Workspace Collaboration & Archiving |

#### Module 22 - Business Memberships & Access Controls

| Test Case | Module |
| --------- | ------ |
| Send employee workspace invitation | 22 Business Memberships & Access Controls |
| Cancel or resend pending invitation | 22 Business Memberships & Access Controls |
| Accept or decline workspace invitation (candidate callback) | 22 Business Memberships & Access Controls |
| Manage active employee memberships and rosters | 22 Business Memberships & Access Controls |
| Configure custom organization roles and permissions matrix | 22 Business Memberships & Access Controls |
| Assign or revoke organization roles | 22 Business Memberships & Access Controls |
| View organization access audit logs | 22 Business Memberships & Access Controls |

#### Module 23 - Representative Rotation & Multi-Sig Recovery

| Test Case | Module |
| --------- | ------ |
| Submit organizational tax code reclaim claim (resolving fraud accounts) | 23 Representative Rotation & Multi-Sig Recovery |
| Validate recovery sessions and request representative rotation | 23 Representative Rotation & Multi-Sig Recovery |
| Record verification call notes and status (admin/super admin review) | 23 Representative Rotation & Multi-Sig Recovery |
| Support review and approval of rotation requests (admin/super admin) | 23 Representative Rotation & Multi-Sig Recovery |
| Submit representative approval vote (multi-sig recovery) | 23 Representative Rotation & Multi-Sig Recovery |
| Query organization representative authority logs and history | 23 Representative Rotation & Multi-Sig Recovery |
| Background worker sweeping expired votes and recovery sessions | 23 Representative Rotation & Multi-Sig Recovery |

---

### Actor: Platform Administrator (System Admin)

#### Module 25 - Platform Administration & Moderation

| Test Case | Module |
| --------- | ------ |
| Enumerate and manage global platform users (suspend, reactivate) | 25 Platform Administration & Moderation |
| Update user system roles (User, Admin, Super Admin) | 25 Platform Administration & Moderation |
| View global platform audit logs | 25 Platform Administration & Moderation |
| Review and approve organizational reclaim claims (Claims Admin) | 25 Platform Administration & Moderation |
| Monitor global system health status and diagnostics | 25 Platform Administration & Moderation |
| Review reported forum topics and comments (moderation queue) | 25 Platform Administration & Moderation |
| Resolve reports and execute moderator deletion of topics/replies | 25 Platform Administration & Moderation |

---

## Coverage Summary

* **Total modules**: 25
* **Total test cases**: 150
* **Average test cases per module**: 6.0

### Actor Module Weight Distribution
* **Shared / Core Platform**: 2 modules (8%)
* **Candidate (Developer)**: 11 modules (44%)
* **Organization (Business / Recruiter)**: 11 modules (44%)
* **Platform Administrator (System Admin)**: 1 module (4%)

### Complexity Highlights
* **Modules with highest complexity**:
  * [Module 1 - Authentication](file:///d:/Coding Space/Github/CVerify/CVerify.Core/Modules/Auth/Controllers/AuthController.cs): 16 test cases. Manages multi-layered verification (Google OAuth, credentials, OTP codes, magic links, token cleanups, and reactivation request flows).
  * [Module 24 - Developer Community Forums](file:///d:/Coding Space/Github/CVerify/CVerify.Core/Modules/Forum/Controllers/ForumController.cs): 10 test cases. Covers complex community features, voting, emoji reactions, bookmarking, and moderation flag queues.
  * [Module 6 - VCS Integration & Codebase Synchronization](file:///d:/Coding Space/Github/CVerify/CVerify.Core/Modules/SourceCode/Services/SourceCodeProviderService.cs): 8 test cases. Coordinates third-party OAuth access, rate limits, repository metadata enumeration, and background synchronizations.
  * [Module 7 - Codebase Static Analysis & Intelligence](file:///d:/Coding Space/Github/CVerify/CVerify.Core/Modules/SourceCode/Services/RepositoryAnalysisService.cs): 8 test cases. Orchestrates multi-stage AI analysis pipelines, SSE streaming progress bars, retries, and artifact registries.
  * [Module 23 - Representative Rotation & Multi-Sig Recovery](file:///d:/Coding Space/Github/CVerify/CVerify.Core/Modules/Recovery/Controllers/Level2RecoveryController.cs): 7 test cases. Entails multi-party voting models, document validations, legal tax code reclaims, and background vote expirations.
* **Modules with lowest complexity**:
  * [Module 11 - Role Recommendation & Career Pathways](file:///d:/Coding Space/Github/CVerify/CVerify.Core/Modules/Profiles/Controllers/CareerController.cs): 4 test cases. Primarily reads career settings and maps them to recommendations.
  * [Module 12 - Skill Tree Visualization](file:///d:/Coding Space/Github/CVerify/client/src/app/(candidate)/intelligence/page.tsx): 4 test cases. Renders SVG graphs and details tooltips.
  * [Module 13 - AI Profile Composition & Executive Summaries](file:///d:/Coding Space/Github/CVerify/CVerify.Core/Modules/Profiles/Controllers/CandidateAssessmentController.cs): 4 test cases. Assembles serialized JSON and narratives.
  * [Module 14 - Explainable Job Matching Engine](file:///d:/Coding Space/Github/CVerify/CVerify.Core/Modules/Intelligence/Services/UnifiedMatchingEngine.cs): 4 test cases. Evaluates static weights and extracts matching reasons.
  * [Module 15 - Talent Sourcing & AI Search](file:///d:/Coding Space/Github/CVerify/CVerify.Core/Modules/Intelligence/Controllers/TalentDiscoveryController.cs): 4 test cases. Focuses on search projections queries.

### Duplicate Merges
* *VCS Integration & Codebase Synchronization*: Merged VCS API integration (GitHub/GitLab account linking) with background sync queue workers to consolidate codebase imports.
* *Organization Profile, Branding & Billing*: Unified company description/avatar settings with invoice transaction histories and pricing tiers to limit enterprise configuration duplication.

### Missing Implementation Discovered During Audit
* *Subscriptions & Billing*: Business checkout structures and transactional invoices are designed in the frontend router (`/billing` and `/revenue`) and role permissions matrix (`billing:subscription:manage`), but lack dedicated database persistence models or active payment integrations in the backend modules.
* *Plagiarism Checking*: Plagiarism analysis is listed as an active pipeline stage, but currently relies on scoring weights and heuristics inside the static analysis service rather than a full source-to-source code index database.
* *Candidate CV deletion*: The system does not offer a standalone CV deletion endpoint; CV data and file mappings are unlinked via repository removal or purged completely through full account deletion requests.
