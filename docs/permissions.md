# CVerify Permission & Role Model

CVerify operates on a dual-scope authorization system: **Company (Organization) Scope** and **Workspace Scope**. This separation ensures that corporate-wide governance (such as subscription management, billing, legal verification, and company settings) remains isolated from daily recruiting activities (such as specific job campaigns, candidate review, and interviews).

---

## Role Hierarchies

### 1. Company (Organization) Scope

Company roles govern the entire organization profile, its members, subscription/billing billing lines, and global talent intelligence databases.

| Role | Scope | Key Permissions & Responsibilities |
| :--- | :--- | :--- |
| **Owner** | Company | Full authority. Can manage subscription billing, submit company verification materials, edit company profile details, invite organization members, modify organization roles, and manage all sub-workspaces. |
| **Administrator** | Company | Mid-to-high authority. Can edit company profile details, view organization members and roles, manage all workspaces, and access global talent discovery and insights. Cannot modify billing or delete the organization. |
| **Recruiter Lead** | Company | Functional authority. Can view organization members, create/archive sub-workspaces, and access organization-wide talent intelligence features (Talent Pool, rankings, and insights). |
| **Finance Manager** | Company | Administration authority. Can access and manage billing, invoices, subscriptions, and usage reports. Cannot access recruiting pipelines or talent intelligence features. |

### 2. Workspace Scope

Workspace roles govern specific recruitment initiatives (e.g. "Backend Hiring" or "AI Recruitment"). Users are assigned workspace-specific roles which restrict them to pages inside that workspace.

| Role | Scope | Key Permissions & Responsibilities |
| :--- | :--- | :--- |
| **Workspace Lead** | Workspace | Full operational control of a specific workspace. Can create and modify job descriptions, approve candidates, assign applications, manage interview loops, configure workspace-specific pipeline stages, and invite workspace members. |
| **Workspace Recruiter** | Workspace | Active recruiting operations. Can view job descriptions, screen candidates, manage applicant pipelines, and schedule interviews. |
| **Workspace Interviewer** | Workspace | Interviewing operations. Can view assigned candidate profiles, conduct AI/evidence-based evaluations, fill out assessment reports, and score developer submissions. |

---

## Access Boundaries & Management Screens

### Company Scope Boundaries

These screens do not depend on a specific sub-workspace and load company-scoped context:

* **Overview Dashboard** (`/workspace/[slug]/dashboard`): Global hiring summary, company verification level, workspace counts, and metrics.
* **Workspaces Directory** (`/workspace/[slug]/workspaces`): Directory to view, create, archive, and select operational workspaces.
* **Talent Pool** (`/workspace/[slug]/talent-pool`): Global registry of followed or bookmarked candidates.
* **Candidate Discovery** (`/workspace/[slug]/intelligence`): Global graph-based search engine.
* **Rankings & Insights** (`/workspace/[slug]/rankings` & `/workspace/[slug]/insights`): Market trends and platform-wide engineer lists.
* **Billing** (`/workspace/[slug]/billing`): Subscription details, usage logs, and invoices.
* **Verification** (`/workspace/[slug]/verification`): Legal registration state and domain verification records.
* **Settings** (`/workspace/[slug]/settings`): Company branding, profile details, and corporate security.

### Workspace Scope Boundaries

These screens are only visible and active inside a specific workspace context, depending on the active workspace selection:

* **Workspace Dashboard** (`/workspace/[slug]/recruitment/dashboard`): Operational metrics, open jobs counts, and current interview loops.
* **Jobs Console** (`/workspace/[slug]/recruitment/jd`): Job description intake wizard, capability profiles, and taxonomy.
* **Candidates** (`/workspace/[slug]/recruitment/candidates`): Shortlist of engineers assigned to this specific workspace.
* **Applications** (`/workspace/[slug]/recruitment/applications`): Candidate screening funnel.
* **Interviews** (`/workspace/[slug]/recruitment/interviews`): Interview schedule and evaluations.
* **Pipeline** (`/workspace/[slug]/recruitment/pipeline`): Custom stages (e.g. Resume Screen, Evidence Review, Technical Challenge).
* **Workspace Members** (`/workspace/[slug]/workspace/members`): Inviting and assigning recruiters or interviewers specifically to this workspace.
* **Workspace Settings** (`/workspace/[slug]/workspace/settings`): Custom workspace notifications and workflow details.
