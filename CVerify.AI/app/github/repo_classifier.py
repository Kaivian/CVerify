import logging
import httpx
from dataclasses import dataclass, field
from typing import Optional, List
from datetime import datetime

logger = logging.getLogger("repo_classifier")

@dataclass
class RepoClassification:
    repo_type: str  # ORIGINAL_WORK, FORK_NO_CONTRIBUTION, FORK_UPSTREAM_CONTRIBUTION, POSSIBLE_CLONE, ORG_PUBLIC, ORG_PRIVATE_SELF_DECLARE
    confidence_ceiling: float = 1.0
    confidence_modifier: float = 1.0
    analysis_target_owner: Optional[str] = None
    analysis_target_name: Optional[str] = None
    red_flags: List[str] = field(default_factory=list)
    classification_rationale: str = ""
    
    # Real-time GitHub Metadata
    branches_count: int = 1
    prs_count: int = 0
    issues_count: int = 0
    stars_count: int = 0
    forks_count: int = 0
    
    # Contributor Metadata
    total_commits: int = 0
    user_commit_ratio: float = 1.0
    is_primary_author: bool = True
    contributor_distribution: List[dict] = field(default_factory=list)
    bus_factor: int = 1
    active_contributors: int = 1

async def classify_repository(
    repo_owner: str,
    repo_name: str,
    encrypted_token: str,
    correlation_id: str = "system"
) -> RepoClassification:
    extra_log = {"correlation_id": correlation_id}
    logger.info(f"Starting repository classification for {repo_owner}/{repo_name}", extra=extra_log)

    headers = {
        "Authorization": f"token {encrypted_token}",
        "User-Agent": "CVerify-AI/1.0",
        "Accept": "application/vnd.github.v3+json"
    }

    async with httpx.AsyncClient(headers=headers, timeout=10.0) as client:
        # Step 1: Identify the authenticated user's details
        username = None
        user_email = None
        try:
            user_response = await client.get("https://api.github.com/user")
            user_response.raise_for_status()
            user_data = user_response.json()
            username = user_data.get("login")
            user_email = user_data.get("email")
            logger.info(f"Authenticated user identified as: {username} (Email: {user_email})", extra=extra_log)
        except Exception as e:
            logger.error(f"Failed to fetch authenticated user profile from GitHub API: {e}", extra=extra_log)
            return RepoClassification(
                repo_type="ORG_PRIVATE_SELF_DECLARE",
                confidence_ceiling=0.40,
                confidence_modifier=0.40,
                classification_rationale=f"Failed to authenticate user profile via GitHub API. Falling back to self-declared status."
            )

        # Step 2: Fetch target repository metadata
        try:
            repo_url = f"https://api.github.com/repos/{repo_owner}/{repo_name}"
            repo_response = await client.get(repo_url)
            if repo_response.status_code in (403, 404):
                logger.warning(f"Repository {repo_owner}/{repo_name} is private or inaccessible. Classifying as ORG_PRIVATE_SELF_DECLARE.", extra=extra_log)
                return RepoClassification(
                    repo_type="ORG_PRIVATE_SELF_DECLARE",
                    confidence_ceiling=0.40,
                    confidence_modifier=0.40,
                    classification_rationale=f"Repository {repo_owner}/{repo_name} is private or inaccessible under current token scope. Falling back to self-declared status."
                )
            repo_response.raise_for_status()
            repo_data = repo_response.json()
        except Exception as e:
            logger.error(f"Failed to fetch repository metadata: {e}", extra=extra_log)
            return RepoClassification(
                repo_type="ORG_PRIVATE_SELF_DECLARE",
                confidence_ceiling=0.40,
                confidence_modifier=0.40,
                classification_rationale=f"Error querying repository details: {str(e)}. Falling back to self-declared status."
            )

        is_fork = repo_data.get("fork", False)
        owner_type = repo_data.get("owner", {}).get("type", "User")
        
        # Real-time metadata variables
        stars_count = repo_data.get("stargazers_count", 0)
        forks_count = repo_data.get("forks_count", 0)
        
        # Fetch branch count
        branches_count = 1
        try:
            branches_resp = await client.get(f"https://api.github.com/repos/{repo_owner}/{repo_name}/branches")
            if branches_resp.status_code == 200:
                branches_count = len(branches_resp.json())
        except Exception as e:
            logger.warning(f"Failed to fetch branches count: {e}", extra=extra_log)

        # Fetch PRs count
        prs_count = 0
        try:
            prs_resp = await client.get(f"https://api.github.com/repos/{repo_owner}/{repo_name}/pulls", params={"state": "all"})
            if prs_resp.status_code == 200:
                prs_count = len(prs_resp.json())
        except Exception as e:
            logger.warning(f"Failed to fetch PRs count: {e}", extra=extra_log)

        # Fetch Issues count
        issues_count = 0
        try:
            issues_resp = await client.get(f"https://api.github.com/repos/{repo_owner}/{repo_name}/issues", params={"state": "all"})
            if issues_resp.status_code == 200:
                issues_count = len(issues_resp.json())
        except Exception as e:
            logger.warning(f"Failed to fetch Issues count: {e}", extra=extra_log)

        # Fetch contributors list and calculate metrics
        contributors_list = []
        try:
            contrib_url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/contributors"
            contrib_resp = await client.get(contrib_url, params={"per_page": 100})
            if contrib_resp.status_code == 200:
                contributors_list = contrib_resp.json()
        except Exception as e:
            logger.warning(f"Failed to fetch contributors list: {e}", extra=extra_log)

        total_commits = 0
        user_commit_ratio = 1.0
        is_primary_author = True
        contributor_distribution = []
        active_contributors = len(contributors_list) if contributors_list else 1

        if contributors_list and isinstance(contributors_list, list):
            total_commits = sum(c.get("contributions", 0) for c in contributors_list)
            user_contrib = 0
            
            for c in contributors_list:
                login = c.get("login")
                contrib_count = c.get("contributions", 0)
                ratio = contrib_count / total_commits if total_commits > 0 else 0.0
                contributor_distribution.append({
                    "username": login,
                    "commit_ratio": round(ratio, 4)
                })
                if login and username and login.lower() == username.lower():
                    user_contrib = contrib_count

            if total_commits > 0:
                user_commit_ratio = user_contrib / total_commits

            if contributors_list:
                top_contributor = max(contributors_list, key=lambda c: c.get("contributions", 0), default=None)
                if top_contributor and username:
                    is_primary_author = top_contributor.get("login", "").lower() == username.lower()
                else:
                    is_primary_author = True
            
            sorted_contribs = sorted([c.get("contributions", 0) for c in contributors_list], reverse=True)
            running_sum = 0
            bus_factor = 0
            half_commits = total_commits / 2
            for c_commits in sorted_contribs:
                running_sum += c_commits
                bus_factor += 1
                if running_sum >= half_commits:
                    break
            if bus_factor == 0:
                bus_factor = 1
        else:
            total_commits = 1
            user_commit_ratio = 1.0
            is_primary_author = True
            contributor_distribution = [{"username": username or "developer", "commit_ratio": 1.0}]
            bus_factor = 1

        # Package base metadata args for easy dataclass initialization
        meta_args = {
            "branches_count": branches_count,
            "prs_count": prs_count,
            "issues_count": issues_count,
            "stars_count": stars_count,
            "forks_count": forks_count,
            "total_commits": total_commits,
            "user_commit_ratio": user_commit_ratio,
            "is_primary_author": is_primary_author,
            "contributor_distribution": contributor_distribution,
            "bus_factor": bus_factor,
            "active_contributors": active_contributors
        }

        # Case 2 & 3: Repository is a Fork
        if is_fork:
            parent_info = repo_data.get("parent", {})
            parent_owner = parent_info.get("owner", {}).get("login")
            parent_name = parent_info.get("name")
            parent_full_name = parent_info.get("full_name", f"{parent_owner}/{parent_name}")

            if not parent_owner or not parent_name:
                logger.warning("Repository is fork but parent details are missing in API response.", extra=extra_log)
                return RepoClassification(
                    repo_type="FORK_NO_CONTRIBUTION",
                    confidence_ceiling=0.35,
                    confidence_modifier=0.35,
                    classification_rationale="Repository is classified as a fork but parent metadata was inaccessible. Restricting to ecosystem tags.",
                    **meta_args
                )

            # Check if user has commits in parent repository
            try:
                commits_url = f"https://api.github.com/repos/{parent_owner}/{parent_name}/commits"
                commits_response = await client.get(commits_url, params={"author": username, "per_page": 5})
                commits_response.raise_for_status()
                parent_commits = commits_response.json()
            except Exception as e:
                logger.warning(f"Could not fetch parent commits for {parent_full_name}: {e}. Treating as no contributions.", extra=extra_log)
                parent_commits = []

            if len(parent_commits) >= 1:
                commit_shas = [c.get("sha")[:8] for c in parent_commits]
                logger.info(f"User {username} has commits in parent repository {parent_full_name}: {commit_shas}", extra=extra_log)
                return RepoClassification(
                    repo_type="FORK_UPSTREAM_CONTRIBUTION",
                    confidence_ceiling=1.0,
                    confidence_modifier=1.15,  # 1.15x upstream contribution bonus
                    analysis_target_owner=parent_owner,
                    analysis_target_name=parent_name,
                    classification_rationale=f"Community-reviewed contributions merged into upstream repository {parent_full_name}. Analyzing parent repository.",
                    **meta_args
                )
            else:
                logger.info(f"User {username} has no commits in parent repository {parent_full_name}.", extra=extra_log)
                return RepoClassification(
                    repo_type="FORK_NO_CONTRIBUTION",
                    confidence_ceiling=0.35,
                    confidence_modifier=0.35,
                    classification_rationale=f"Repository is a fork of {parent_full_name} with no detected upstream contributions by the user. Restricting to ecosystem tags.",
                    **meta_args
                )

        # Organization Repos
        if owner_type == "Organization":
            logger.info(f"Repository {repo_owner}/{repo_name} belongs to an Organization ({owner_type}).", extra=extra_log)
            return RepoClassification(
                repo_type="ORG_PUBLIC",
                confidence_ceiling=0.90,
                confidence_modifier=0.90,
                classification_rationale=f"Repository is owned by the organization '{repo_owner}'. Analysis will be scoped to contributions by {username} only.",
                **meta_args
            )

        # Personal Original Work or Cloned/Dumped (Case 1 vs Case 4)
        red_flags = []
        try:
            # Fetch commits to analyze history
            commits_url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/commits"
            commits_resp = await client.get(commits_url, params={"per_page": 100})
            commits_resp.raise_for_status()
            commits = commits_resp.json()
            total_commits_fetched = len(commits)

            # Age in days
            created_at_str = repo_data.get("created_at")
            created_at_dt = datetime.strptime(created_at_str, "%Y-%m-%dT%H:%M:%SZ")
            repo_age_days = (datetime.utcnow() - created_at_dt).days
            if repo_age_days <= 0:
                repo_age_days = 1

            # Check: Initial dump commit (additions in first commit > 2000)
            if len(commits) > 0:
                oldest_commit_sha = commits[-1].get("sha")
                oldest_commit_resp = await client.get(f"https://api.github.com/repos/{repo_owner}/{repo_name}/commits/{oldest_commit_sha}")
                if oldest_commit_resp.status_code == 200:
                    oldest_data = oldest_commit_resp.json()
                    stats = oldest_data.get("stats", {})
                    additions = stats.get("additions", 0)
                    if additions > 2000:
                        red_flags.append(f"Initial dump commit detected (>2,000 code additions in first commit: {additions})")

            # Check: No development history
            commits_per_day = total_commits_fetched / repo_age_days
            if commits_per_day < 0.1:
                red_flags.append(f"Low commit density over time (commits/day: {commits_per_day:.3f} < 0.1)")

            # Check: Author email mismatch
            if len(commits) > 0:
                mismatch_count = 0
                for c in commits:
                    commit_author_email = c.get("commit", {}).get("author", {}).get("email")
                    if commit_author_email and user_email and commit_author_email.lower() != user_email.lower():
                        mismatch_count += 1
                mismatch_ratio = mismatch_count / len(commits)
                if mismatch_ratio > 0.50:
                    red_flags.append(f"High authorship email mismatch (ratio: {mismatch_ratio:.2%})")

            # Check: Low activity signals (no branches/PRs/issues) on significant repo
            if branches_count <= 1 and prs_count == 0 and issues_count == 0:
                red_flags.append("No branches, pull requests, or issues activity (single developer dump profile)")

        except Exception as e:
            logger.warning(f"Error checking red flags for {repo_owner}/{repo_name}: {e}", extra=extra_log)

        # Apply penalties based on flags
        if len(red_flags) >= 2:
            penalty = 0.50 if len(red_flags) >= 3 else 0.70
            logger.warning(f"Cloned/Dumped repository suspected for {repo_owner}/{repo_name}. Triggered flags: {red_flags}", extra=extra_log)
            return RepoClassification(
                repo_type="POSSIBLE_CLONE",
                confidence_ceiling=penalty,
                confidence_modifier=penalty,
                red_flags=red_flags,
                classification_rationale=f"Suspected cloned or dumped repository due to triggered signals: {', '.join(red_flags)}. Downgrading trust confidence metrics.",
                **meta_args
            )

        logger.info(f"Repository {repo_owner}/{repo_name} classified as ORIGINAL_WORK.", extra=extra_log)
        return RepoClassification(
            repo_type="ORIGINAL_WORK",
            confidence_ceiling=1.0,
            confidence_modifier=1.0,
            classification_rationale="Authentic personal repository with consistent authorship and development history signals.",
            **meta_args
        )
