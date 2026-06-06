# 17 - Repository Classification Cases

This document defines how CVerify.AI classifies each repository before running the analysis pipeline, specifying the confidence rules, API query patterns, and AI prompt instructions for each case.

The classification step runs **before** any LLM call — it is fully deterministic and uses GitHub API metadata only.

---

## Why Classification Matters

Running the same pipeline on all repos produces misleading results:

- A **forked** repo with no original contribution would score high on "React skill" simply because the parent codebase contains React — the user may have never written a single line.
- A **cloned/dumped** repo with one massive initial commit and no development history inflates scores for skills the user didn't actually exercise.
- An **org private** repo that the user legitimately built cannot be verified — it needs a separate confidence tier, not rejection.

Classification solves this by assigning a `repo_type`, a `confidence_ceiling`, and an `analysis_strategy` before the pipeline starts.

---

## Decision Tree

```
Repo fetched
├── fork: true?
│   ├── User có commit được merged vào parent? → Case 3 (parent contribution)
│   └── Không → Case 2 (ecosystem familiarity only)
└── fork: false?
    ├── Org repo?
    │   ├── Accessible (public / user is member) → Org Public pipeline
    │   └── Not accessible → Self-declare / user-provided export
    └── Personal repo
        ├── Red flags detected? → Case 4 (cloned/dumped, downgrade)
        └── Clean → Case 1 (full pipeline)
```

---

## Personal Repos

### Case 1 — Original Work (fork: false, no red flags)

**GitHub API signal**: `repository.fork = false`

**Analysis strategy**: Run full pipeline — commit authorship %, git blame sampling, commit message quality, code complexity.

**Confidence ceiling**: `1.0` (no cap applied)

**AI prompt instruction**:
```
This repository is classified as ORIGINAL_WORK.
Run full skill extraction. All evidence signals are eligible for verification.
evidence_type may be set to "verified" for skills with strong deterministic evidence.
```

**Evidence weight**: All weights apply as defined in the confidence scoring algorithm.

---

### Case 2 — Fork, No Upstream Contribution (fork: true, no merged commits in parent)

**GitHub API signal**: `repository.fork = true`, query `GET /repos/{parent_owner}/{parent_repo}/commits?author={username}` returns empty.

**Analysis strategy**: Do **not** run skill scoring against this repo's codebase. The code belongs to the original author. Only infer ecosystem familiarity.

**Confidence ceiling**: `0.35`

**Output label**: `"familiar_with"` — not `"verified"` or `"inferred"`.

**AI prompt instruction**:
```
This repository is classified as FORK_NO_CONTRIBUTION.
Do NOT extract skill scores from this codebase. The code was authored by others.
Only output a single "ecosystem_familiarity" tag for the primary technology detected.
Set evidence_type to "ecosystem_only". Set confidence to 0.30 maximum.
Do not populate evidence_signals with file paths from this repo.
```

**Recruiter display**: Badge `"Ecosystem Familiarity — not a contribution"`.

---

### Case 3 — Fork with Merged Upstream Contribution (fork: true, commits merged into parent)

**GitHub API signal**: `repository.fork = true`, query `GET /repos/{parent_owner}/{parent_repo}/commits?author={username}` returns ≥ 1 commit.

**Analysis strategy**: This is the **highest-value evidence type** — open source contributions that were reviewed and merged by the community. Fetch skill data from the **parent repo**, not the fork. Evidence links point to parent repo + user's commit SHAs.

**Confidence ceiling**: `1.0` with a **bonus multiplier of 1.15** (community-reviewed work).

**Query pattern**:
```
# Step 1: Detect fork and get parent
GET /repos/{owner}/{repo}
→ { "fork": true, "parent": { "full_name": "org/parent-repo" } }

# Step 2: Check user contributions in parent
GET /repos/{org}/{parent-repo}/commits?author={username}
→ [{ "sha": "a3f9b2...", "commit": { "message": "feat: add OAuth2 flow" } }]

# Step 3: Fetch parent repo for skill extraction
GET /repos/{org}/{parent-repo}  (shallow clone of parent)
```

**AI prompt instruction**:
```
This repository is classified as FORK_WITH_UPSTREAM_CONTRIBUTION.
The user has commits merged into the parent repository: {parent_full_name}.
Skill extraction MUST be performed against the PARENT repo codebase (already cloned).
Evidence links MUST reference the parent repo path and the user's commit SHAs listed below.
This is community-reviewed evidence — set evidence_type to "verified_upstream".
Apply confidence normally; the upstream merge itself is a strong quality signal.
User's merged commit SHAs: {commit_sha_list}
```

**Recruiter display**: Badge `"Open Source Contributor — merged into {parent_repo}"`.

---

### Case 4 — Cloned / Dumped Repository (fork: false, red flags detected)

**GitHub API signals** (check all, flag if ≥ 2 present):

| Signal | API Check | Threshold |
|---|---|---|
| Initial dump commit | `commits[0].stats.additions` very large | > 2,000 additions in first commit |
| No development history | `total_commits / repo_age_days` | < 0.1 commits/day |
| Low commit count on substantial code | `commits.total_count` | < 5 on repos with > 500 files |
| Author email mismatch | `commit.author.email` vs account email | Any mismatch on > 50% of commits |
| Dependency timestamp anomaly | Parse `package.json` / `pom.xml` → lib version release dates | Any dependency released after `repo.created_at` |
| No branches / PRs / issues on enterprise-level code | `branches.count`, `pulls.total`, `issues.total` | All = 0 or 1 on repo with > 50 files |

**Scoring logic**:
```python
red_flag_count = sum(1 for flag in red_flags if flag.triggered)
if red_flag_count >= 3:
    confidence_penalty = 0.50   # halve all confidence scores
    badge = "SUSPICIOUS_CLONE"
elif red_flag_count >= 2:
    confidence_penalty = 0.70
    badge = "POSSIBLE_CLONE"
elif red_flag_count == 1:
    confidence_penalty = 0.90
    badge = "MINOR_FLAG"
```

**Analysis strategy**: Still run full pipeline (do not block) but apply penalty multiplier to all confidence scores.

**AI prompt instruction**:
```
This repository is classified as POSSIBLE_CLONE with {red_flag_count} red flags detected:
{red_flag_list}
Run skill extraction normally but:
- Set evidence_type to "unverified" for all skills (do not use "verified").
- In trust.ai_findings[], include one entry describing the red flags detected and why
  they reduce confidence in authorship attribution.
- Do NOT fabricate authorship evidence not present in the sampled code.
- The recruiter_summary MUST mention that authorship signals are inconclusive.
```

**Recruiter display**: Warning badge `"⚠ Authorship signals inconclusive"` with expandable flag detail.

---

## Organization Repos

### Org Public / Accessible

**GitHub API signal**: Repo is under an org namespace, accessible without extra auth.

**Query pattern**:
```
# Filter commits to only the authenticated user
GET /repos/{org}/{repo}/commits?author={username}

# Count PRs authored by user
GET /repos/{org}/{repo}/pulls?state=closed&per_page=100
→ filter by pull_request.user.login == username

# Check review participation
GET /repos/{org}/{repo}/pulls/comments?per_page=100
→ filter by user.login == username
```

**Analysis strategy**: Run full pipeline but **scope all contribution metrics to the authenticated user only**. Do not attribute the entire codebase to the user.

**Confidence ceiling**: `0.90` (slight reduction vs personal repos — multi-contributor environments introduce attribution uncertainty).

**AI prompt instruction**:
```
This repository is classified as ORG_PUBLIC.
It is a multi-contributor org repository. Skill extraction must be scoped to evidence
attributable to {username} only.
- Only cite files in evidence_signals[] that appear in the user's commit diffs.
- Do not infer skills from the full codebase if the user's commits touch only a subset.
- Set confidence proportionally to the user's contribution_percentage: {contribution_pct}%.
- In narrative.recruiter_summary, explicitly state this is an org contribution,
  not a solo project.
```

---

### Org Private / Not Accessible

**GitHub API signal**: HTTP 404 or 403 on repo fetch — not accessible to the analysis service.

**Two paths**:

**Path A — User self-declare** (no evidence provided):
- Display badge: `"Self-declared — not verified"`
- Confidence assigned: `0.30–0.40` (floor, not adjustable upward without evidence)
- Skill extracted: only from user's stated role and technologies — no code scan
- AI prompt: not invoked for skill extraction; only for generating a self-declare summary

**Path B — User-provided export** (user uploads GitHub contribution export):
- GitHub provides contribution export at: `github.com/settings/contributions`
- User uploads the export file → system parses commit counts, PR counts, review counts per repo
- Confidence assigned: `0.60–0.70` (`"User-provided evidence"` tier)
- Badge: `"User-provided evidence — not independently verified"`

**AI prompt instruction (Path B)**:
```
This repository is classified as ORG_PRIVATE_USER_EXPORT.
Evidence source: user-uploaded GitHub contribution export file.
This is NOT independently verified — treat all evidence as user-provided.
Set evidence_type to "user_provided" for all skills.
Do not set confidence above 0.70.
In trust.explanation, note that private org contribution cannot be independently verified
and that confidence reflects user-provided data only.
```

---

## Confidence Ceiling Summary

| Case | repo_type | Confidence Ceiling | evidence_type |
|---|---|---|---|
| Case 1 — Original work | `ORIGINAL_WORK` | 1.00 | `verified` / `inferred` |
| Case 2 — Fork, no contribution | `FORK_NO_CONTRIBUTION` | 0.35 | `ecosystem_only` |
| Case 3 — Fork + upstream merged | `FORK_UPSTREAM_CONTRIBUTION` | 1.15× bonus | `verified_upstream` |
| Case 4 — Cloned/dumped | `POSSIBLE_CLONE` | 0.50–0.90× penalty | `unverified` |
| Org public | `ORG_PUBLIC` | 0.90 | `verified` (scoped) |
| Org private — self-declare | `ORG_PRIVATE_SELF_DECLARE` | 0.40 | `self_declared` |
| Org private — user export | `ORG_PRIVATE_USER_EXPORT` | 0.70 | `user_provided` |

---

## Implementation Notes

### Classification runs before cloning

The classification step uses only GitHub REST API metadata (no clone, no LLM). It should complete in < 2 seconds per repo.

```python
async def classify_repository(repo_owner: str, repo_name: str, username: str) -> RepoClassification:
    repo = await github_api.get_repo(repo_owner, repo_name)
    
    if repo.fork:
        parent_commits = await github_api.get_commits(
            repo.parent.owner, repo.parent.name, author=username
        )
        if parent_commits:
            return RepoClassification(type="FORK_UPSTREAM_CONTRIBUTION",
                                      confidence_modifier=1.15,
                                      analysis_target=repo.parent)
        else:
            return RepoClassification(type="FORK_NO_CONTRIBUTION",
                                      confidence_ceiling=0.35)
    
    red_flags = await detect_red_flags(repo, username)
    if len(red_flags) >= 2:
        penalty = 0.50 if len(red_flags) >= 3 else 0.70
        return RepoClassification(type="POSSIBLE_CLONE",
                                  confidence_modifier=penalty,
                                  red_flags=red_flags)
    
    return RepoClassification(type="ORIGINAL_WORK", confidence_ceiling=1.0)
```

### Propagate classification into every SSE progress event

The `repo_type` and `confidence_ceiling` must be passed through the full orchestrator chain so they appear in the final JSON report and are persisted in the `AnalysisReports` table.

### Frontend rendering

The frontend `VerificationSignals.tsx` component must consume `repo.repo_type` and render the appropriate badge. Do not derive the badge from `trust.confidence` alone — classification is a first-class field in the report schema.

---

## AI Agent Consumption Optimization

| Field | Reference Value / Path |
|---|---|
| **Entry Points** | `classify_repository()` in `app/github/repo_classifier.py` (to be created) |
| **Dependencies** | GitHub REST API, `app/github/technology_detector.py` |
| **Execution Flow** | Pre-pipeline classification → sets `RepoClassification` → passed to `GitHubAnalysisOrchestrator` → injected into system prompt → appears in final JSON report |
| **Common Failure Modes** | GitHub API 403 on private org repos (handle gracefully as ORG_PRIVATE), parent repo deleted (fork but no parent accessible → treat as Case 2) |
| **Related Files** | `app/orchestrators/github_analysis_orchestrator.py`, `app/prompts/github_prompt_factory.py` |
| **Related Services** | `ClaudeService`, `GitHubAnalysisOrchestrator` |
| **Related DTOs** | `RepoClassification` (new dataclass), `AnalysisRequest` |
| **Related Database Tables** | `AnalysisReports` (add `repo_type` and `confidence_ceiling` columns), `SourceCodeRepositories` |
| **Related Frontend Components** | `VerificationSignals.tsx`, `AnalysisScoreCards.tsx` |
