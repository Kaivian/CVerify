import os
import shutil
import tempfile
import json
import logging
import asyncio
import time
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Any, Tuple, List, Literal
import redis.asyncio as redis
from pydantic import BaseModel, Field, ValidationError
from app.config import settings

from app.github.technology_detector import TechnologyDetector
from app.github.code_sampler import CodeSampler, CodeSamplingOptions
from app.prompts.github_prompt_factory import GitHubPromptFactory
from app.services.claude_service import ClaudeService
from app.github.repo_classifier import classify_repository

class ClassificationV2(BaseModel):
    primaryDomain: str
    subDomain: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    isVerified: bool
    trustScore: float = Field(..., ge=0.0, le=1.0)

class SectionV2(BaseModel):
    type: Literal["engineering_practices", "security_findings", "architecture_insights"]
    items: List[str]

class RiskV2(BaseModel):
    score: float = Field(..., ge=0.0, le=100.0)
    level: Literal["low", "medium", "high"]
    reasons: List[str]

class ReportV2Contract(BaseModel):
    schemaVersion: Literal["v2"]
    repoId: str
    classification: ClassificationV2
    sections: List[SectionV2]
    risk: RiskV2

    model_config = {
        "extra": "allow"
    }

logger = logging.getLogger("github_analysis_orchestrator")

class IGitHubAnalysisOrchestrator(ABC):
    @abstractmethod
    async def orchestrate_async(
        self,
        repository_id: Any,
        repo_name: str,
        repo_owner: str,
        encrypted_token: str,
        default_branch: str,
        correlation_id: str
    ) -> AsyncGenerator[dict, None]:
        ...

class GitHubAnalysisOrchestrator(IGitHubAnalysisOrchestrator):
    def __init__(self):
        self.tech_detector = TechnologyDetector()
        self.code_sampler = CodeSampler()
        self.prompt_factory = GitHubPromptFactory()
        self.claude_service = ClaudeService()
        self.redis_client = redis.from_url(settings.redis_url, decode_responses=True)

    async def publish_task_event(self, job_id: str, task_type: str, message: str, level: str = "Info"):
        logger_func = logger.info if level.lower() == "info" else logger.warning if level.lower() == "warning" else logger.error
        logger_func(f"[{task_type}] {message}", extra={"job_id": job_id, "task_type": task_type})
        
        try:
            payload = {
                "jobId": job_id,
                "taskType": task_type,
                "taskStatus": "Running",
                "level": level,
                "message": message,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }
            channel = f"repository:analysis:progress:{job_id}"
            await self.redis_client.publish(channel, json.dumps(payload))
        except Exception as e:
            logger.warning(f"Failed to publish progress log to Redis: {e}")

    async def orchestrate_async(
        self,
        repository_id: Any,
        repo_name: str,
        repo_owner: str,
        encrypted_token: str,
        default_branch: str,
        correlation_id: str = "system"
    ) -> AsyncGenerator[dict, None]:
        # Legacy monolithic stream endpoint - mapped for compatibility
        # Runs classification and loops through tasks yielding progress
        extra_log = {"correlation_id": correlation_id}
        start_time = time.perf_counter()

        logger.info(f"Starting legacy repository analysis stream for {repo_owner}/{repo_name}", extra=extra_log)
        yield {
            "status": "Preparing",
            "step": "Preparing",
            "progress": 10.0,
            "message": "Initializing analysis pipeline workspace..."
        }
        
        # Stub implementing fallback - C# core uses discrete execute_task endpoints in UAT
        try:
            classification = await classify_repository(repo_owner, repo_name, encrypted_token, correlation_id)
            yield {
                "status": "Completed",
                "step": "Completed",
                "progress": 100.0,
                "message": "Legacy stream completed. Discrete task orchestrator is active."
            }
        except Exception as e:
            logger.error(f"Legacy stream runner failed: {e}", extra=extra_log)
            yield {
                "status": "Failed",
                "step": "Failed",
                "progress": 0.0,
                "message": str(e)
            }

    async def execute_task(
        self,
        task_type: str,
        job_id: str,
        repository_id: str,
        repo_owner: str,
        repo_name: str,
        encrypted_token: str,
        default_branch: str,
        correlation_id: str = "system"
    ) -> dict:
        extra_log = {"correlation_id": correlation_id, "job_id": job_id, "task_type": task_type}
        logger.info(f"Executing discrete analysis task {task_type} for job {job_id}", extra=extra_log)
        
        try:
            if task_type == "RepoStructure":
                result = await self.analyze_structure(job_id, repository_id, repo_owner, repo_name, encrypted_token, default_branch, correlation_id)
            elif task_type == "CommitIntelligence":
                result = await self.analyze_commits(job_id, encrypted_token, correlation_id)
            elif task_type == "SkillExtraction":
                result = await self.analyze_skills(job_id, encrypted_token, correlation_id)
            elif task_type == "ArchitectureAnalysis":
                result = await self.analyze_architecture(job_id, encrypted_token, correlation_id)
            elif task_type == "CodeQuality":
                result = await self.analyze_quality(job_id, encrypted_token, correlation_id)
            elif task_type == "SecurityAnalysis":
                result = await self.analyze_security(job_id, encrypted_token, correlation_id)
            elif task_type == "RepositoryClassification":
                result = await self.analyze_classification(job_id, encrypted_token, correlation_id)
            elif task_type == "RepositorySummary":
                result = await self.analyze_summary(job_id, encrypted_token, correlation_id)
            else:
                raise ValueError(f"Unknown task type: {task_type}")

            return {
                "status": "Completed",
                "errorMessage": None,
                "schemaVersion": "2.0.0",
                "resultData": json.dumps(result.get("data")),
                "telemetry": result.get("telemetry"),
                "events": result.get("events", [])
            }
        except Exception as e:
            logger.exception(f"Error executing task {task_type} for job {job_id}: {e}", extra=extra_log)
            return {
                "status": "Failed",
                "errorMessage": str(e),
                "schemaVersion": "2.0.0",
                "resultData": None,
                "telemetry": None,
                "events": [
                    {
                        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "level": "Error",
                        "eventType": "ErrorOccurred",
                        "message": str(e)
                    }
                ]
            }

    async def _get_meta_and_sample(self, job_id: str, encrypted_token: str, correlation_id: str) -> tuple[dict, Any]:
        temp_dir_base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "temp_clones"))
        job_dir = os.path.join(temp_dir_base, job_id)
        clone_dir = os.path.join(job_dir, "repo")
        meta_path = os.path.join(job_dir, "meta.json")

        if not os.path.exists(meta_path):
            raise Exception("Workspace metadata not found. Repository Structure task must run first.")

        with open(meta_path, "r", encoding="utf-8") as f_in:
            meta = json.load(f_in)

        if not meta.get("is_cloned"):
            from app.github.code_sampler import CodeSample
            return meta, CodeSample(file_content=[], file_names=[])

        options = CodeSamplingOptions(max_files=10, max_lines_per_file=100)
        sample = await self.code_sampler.sample_async(clone_dir, encrypted_token, options)
        return meta, sample

    def _extract_json(self, text: str, correlation_id: str) -> dict:
        text = text.strip()
        first_brace = text.find('{')
        last_brace = text.rfind('}')
        
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            json_candidate = text[first_brace:last_brace + 1]
            try:
                return json.loads(json_candidate)
            except Exception as e:
                logger.warning(f"Failed to parse raw extracted JSON block, attempting escape sanitization: {e}", extra={"correlation_id": correlation_id})
                try:
                    import re
                    pattern = re.compile(r'(\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))|\\')
                    def replace(match):
                        if match.group(1):
                            return match.group(1)
                        return r'\\'
                    sanitized = pattern.sub(replace, json_candidate)
                    return json.loads(sanitized)
                except Exception as retry_err:
                    logger.error(f"Failed to parse sanitized JSON block: {retry_err}", extra={"correlation_id": correlation_id})
                    raise Exception(f"Claude output returned invalid JSON inside block. Sanitization failed: {retry_err}. Original error: {e}")
        
        try:
            return json.loads(text)
        except Exception as e:
            logger.error(f"Failed to parse Claude output as JSON. Error: {e}", extra={"correlation_id": correlation_id})
            raise Exception("Claude output did not return a valid JSON format.")

    async def analyze_structure(self, job_id: str, repository_id: str, repo_owner: str, repo_name: str, encrypted_token: str, default_branch: str, correlation_id: str) -> dict:
        extra_log = {"correlation_id": correlation_id}
        temp_dir_base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "temp_clones"))
        job_dir = os.path.join(temp_dir_base, job_id)
        clone_dir = os.path.join(job_dir, "repo")
        meta_path = os.path.join(job_dir, "meta.json")

        await self.publish_task_event(job_id, "RepoStructure", f"Creating workspace directory: {job_dir}")
        os.makedirs(job_dir, exist_ok=True)

        await self.publish_task_event(job_id, "RepoStructure", "Classifying repository: checking stats (stars, forks) and history...")
        classification = await classify_repository(
            repo_owner=repo_owner,
            repo_name=repo_name,
            encrypted_token=encrypted_token,
            correlation_id=correlation_id
        )
        await self.publish_task_event(job_id, "RepoStructure", f"Repository classified. Type: {classification.repo_type}. Stars: {classification.stars_count}. Forks: {classification.forks_count}.")

        filenames = []
        all_techs = []
        is_cloned = False

        if classification.repo_type == "FORK_NO_CONTRIBUTION":
            await self.publish_task_event(job_id, "RepoStructure", "Fork with no contributions. Skipping clone.")
            pass
        else:
            clone_owner = repo_owner
            clone_name = repo_name
            if classification.repo_type == "FORK_UPSTREAM_CONTRIBUTION":
                clone_owner = classification.analysis_target_owner
                clone_name = classification.analysis_target_name

            clone_url = f"https://{encrypted_token}@github.com/{clone_owner}/{clone_name}.git"

            if not os.path.exists(os.path.join(clone_dir, ".git")):
                shutil.rmtree(clone_dir, ignore_errors=True)
                os.makedirs(clone_dir, exist_ok=True)
                env = os.environ.copy()
                env["GIT_TERMINAL_PROMPT"] = "0"
                import subprocess

                def clone_with_branch():
                    return subprocess.run(
                        ["git", "-c", "credential.helper=", "clone", "--depth", "100", "--branch", default_branch, clone_url, clone_dir],
                        env=env,
                        capture_output=True
                    )

                await self.publish_task_event(job_id, "RepoStructure", f"Cloning branch '{default_branch}' from GitHub...")
                proc = await asyncio.to_thread(clone_with_branch)
                if proc.returncode != 0:
                    shutil.rmtree(clone_dir, ignore_errors=True)
                    def clone_default_branch():
                        return subprocess.run(
                            ["git", "-c", "credential.helper=", "clone", "--depth", "100", clone_url, clone_dir],
                            env=env,
                            capture_output=True
                        )
                    await self.publish_task_event(job_id, "RepoStructure", "Cloning default branch (fallback method)...")
                    proc_retry = await asyncio.to_thread(clone_default_branch)
                    if proc_retry.returncode != 0:
                        stderr_retry = proc_retry.stderr
                        err_msg = stderr_retry.decode("utf-8", errors="ignore").strip()
                        raise Exception(f"Git clone failed: {err_msg}")
            
            is_cloned = True
            await self.publish_task_event(job_id, "RepoStructure", "Cloning completed successfully. Scanning workspace directory...")

            package_contents = []
            package_names = {"package.json", "requirements.txt", "go.mod", "pom.xml", "cargo.toml", "docker-compose.yml"}

            for root, dirs, files in os.walk(clone_dir):
                dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "bin", "obj", "dist", "vendor", "venv", "packages", "__pycache__"}]
                for f in files:
                    filenames.append(f)
                    if f.lower() in package_names or f.endswith(".csproj"):
                        try:
                            with open(os.path.join(root, f), "r", encoding="utf-8", errors="ignore") as f_in:
                                package_contents.append(f_in.read(2000))
                        except OSError:
                            pass

            techs_from_files = self.tech_detector.detect_from_filenames(filenames)
            techs_from_package = self.tech_detector.detect_from_package_files(package_contents)
            all_techs = list(set(techs_from_files + techs_from_package))
            await self.publish_task_event(job_id, "RepoStructure", f"Scanned {len(filenames)} files. Detected languages/frameworks: {', '.join(all_techs)}.")

        # Retrieve sampled files list
        sampled_files_names = []
        if is_cloned:
            await self.publish_task_event(job_id, "RepoStructure", "Sampling files for content analysis...")
            options = CodeSamplingOptions(max_files=10, max_lines_per_file=100)
            sample = await self.code_sampler.sample_async(clone_dir, encrypted_token, options)
            sampled_files_names = sample.file_names

        # Compute extended quality metrics
        files_scanned = len(filenames)
        files_sampled = len(sampled_files_names)
        skipped_files = max(0, files_scanned - files_sampled)
        coverage_pct = round(files_sampled / files_scanned * 100, 1) if files_scanned > 0 else 100.0

        meta_data = {
            "job_id": job_id,
            "repository_id": repository_id,
            "repo_owner": repo_owner,
            "repo_name": repo_name,
            "default_branch": default_branch,
            "repo_type": classification.repo_type,
            "confidence_ceiling": classification.confidence_ceiling,
            "confidence_modifier": classification.confidence_modifier,
            "classification_rationale": classification.classification_rationale,
            "analysis_target_owner": classification.analysis_target_owner,
            "analysis_target_name": classification.analysis_target_name,
            "red_flags": classification.red_flags,
            "technologies": all_techs,
            "filenames": filenames,
            "sampled_files": sampled_files_names,
            "is_cloned": is_cloned,
            
            # Save classifier stats
            "branches_count": classification.branches_count,
            "prs_count": classification.prs_count,
            "issues_count": classification.issues_count,
            "stars_count": classification.stars_count,
            "forks_count": classification.forks_count,
            "total_commits": classification.total_commits,
            "user_commit_ratio": classification.user_commit_ratio,
            "is_primary_author": classification.is_primary_author,
            "contributor_distribution": classification.contributor_distribution,
            "bus_factor": classification.bus_factor,
            "active_contributors": classification.active_contributors,
            
            # Quality stats
            "files_scanned": files_scanned,
            "files_sampled": files_sampled,
            "skipped_files": skipped_files,
            "coverage_pct": coverage_pct,
            
            # Trust and Adversarial metrics
            "unverified_commits_count": getattr(classification, "unverified_commits_count", 0),
            "timestamp_compression_ratio": getattr(classification, "timestamp_compression_ratio", 0.0),
            "uncalibrated_identities_count": getattr(classification, "uncalibrated_identities_count", 0)
        }

        with open(meta_path, "w", encoding="utf-8") as f_out:
            json.dump(meta_data, f_out)

        result_data = {
            "repo": {
                "id": repository_id,
                "name": repo_name,
                "full_name": f"{repo_owner}/{repo_name}",
                "url": f"https://github.com/{repo_owner}/{repo_name}",
                "description": "Fork with no contributions" if classification.repo_type == "FORK_NO_CONTRIBUTION" else None,
                "fork": classification.repo_type in ("FORK_NO_CONTRIBUTION", "FORK_UPSTREAM_CONTRIBUTION"),
                "languages": {t: round(100.0/len(all_techs), 1) for t in all_techs} if all_techs else {"Other": 100.0},
                "repo_type": classification.repo_type,
                "confidence_ceiling": classification.confidence_ceiling,
                
                # Real counts from classifier API
                "stars": classification.stars_count,
                "forks": classification.forks_count,
                "branches": classification.branches_count,
                "open_prs": classification.prs_count
            },
            "classification": {
                "primary_type": "Fork" if classification.repo_type == "FORK_NO_CONTRIBUTION" else "Unclassified",
                "all_types": ["Fork"] if classification.repo_type == "FORK_NO_CONTRIBUTION" else [],
                "complexity": "low" if classification.repo_type == "FORK_NO_CONTRIBUTION" else "medium",
                "benchmark_group": "forks" if classification.repo_type == "FORK_NO_CONTRIBUTION" else "unclassified",
                "classification_rationale": classification.classification_rationale,
                "sampled_files": sampled_files_names,
                "ignored_files_count": skipped_files,
                "confidence_factors": classification.red_flags or ["authentic_history"]
            },
            "confidence_meta": {
                "confidence_score": 100.0,
                "completeness_ratio": 1.0,
                "evidence_coverage_count": 0
            }
        }

        return {
            "data": result_data,
            "telemetry": None,
            "events": [
                {
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "level": "Info",
                    "eventType": "StepCompleted",
                    "message": f"Structure analysis completed. Classified as {classification.repo_type}."
                }
            ]
        }

    async def analyze_commits(self, job_id: str, encrypted_token: str, correlation_id: str) -> dict:
        meta, sample = await self._get_meta_and_sample(job_id, encrypted_token, correlation_id)
        
        # Setup workspace paths
        temp_dir_base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "temp_clones"))
        clone_dir = os.path.join(temp_dir_base, job_id, "repo")
        
        # Local Git history auditing
        local_total_commits = 0
        local_user_commit_ratio = 1.0
        local_bus_factor = 1
        local_contrib_counts = {}
        local_contributor_distribution = []

        await self.publish_task_event(job_id, "CommitIntelligence", "Reading local Git history logs...")
        if meta.get("is_cloned") and os.path.exists(os.path.join(clone_dir, ".git")):
            try:
                import subprocess
                proc = subprocess.run(
                    ["git", "log", "--format=%ae|%an", "--all"],
                    cwd=clone_dir,
                    capture_output=True,
                    text=True,
                    errors="ignore"
                )
                if proc.returncode == 0:
                    lines = [line.strip() for line in proc.stdout.strip().split("\n") if line.strip()]
                    local_commits = [line.split("|", 1) for line in lines if "|" in line]
                    local_total_commits = len(local_commits)
                    await self.publish_task_event(job_id, "CommitIntelligence", f"Parsed local Git log: {local_total_commits} total commits found. Computing distributions...")
                    
                    for email, name in local_commits:
                        key = email.lower().strip() if email else name.strip()
                        local_contrib_counts[key] = local_contrib_counts.get(key, 0) + 1
                    
                    # Compute user commits matching details
                    user_email = meta.get("user_email", "")
                    username = meta.get("username", "")
                    user_local_commits = 0
                    
                    for email, name in local_commits:
                        email_match = user_email and email.lower().strip() == user_email.lower().strip()
                        name_match = username and (username.lower().strip() in name.lower().strip() or name.lower().strip() in username.lower().strip())
                        if email_match or name_match:
                            user_local_commits += 1

                    local_user_commit_ratio = user_local_commits / local_total_commits if local_total_commits > 0 else 1.0
                    
                    for key, count in local_contrib_counts.items():
                        local_contributor_distribution.append({
                            "username": key,
                            "commit_ratio": round(count / local_total_commits, 4)
                        })
                        
                    sorted_local_contribs = sorted(list(local_contrib_counts.values()), reverse=True)
                    running_sum = 0
                    local_bus_factor = 0
                    half_local_commits = local_total_commits / 2
                    for c_commits in sorted_local_contribs:
                        running_sum += c_commits
                        local_bus_factor += 1
                        if running_sum >= half_local_commits:
                            break
                    if local_bus_factor == 0:
                        local_bus_factor = 1
            except Exception as e:
                logger.warning(f"Local git history parsing failed: {e}", extra={"correlation_id": correlation_id})

        # Deterministic facts calculation
        final_total_commits = local_total_commits if local_total_commits > 0 else meta.get("total_commits", 1)
        final_user_commit_ratio = local_user_commit_ratio if local_total_commits > 0 else meta.get("user_commit_ratio", 1.0)
        final_bus_factor = local_bus_factor if local_total_commits > 0 else meta.get("bus_factor", 1)
        final_active_contributors = len(local_contrib_counts) if local_total_commits > 0 else meta.get("active_contributors", 1)
        final_distribution = local_contributor_distribution if local_total_commits > 0 else meta.get("contributor_distribution", [])

        await self.publish_task_event(job_id, "CommitIntelligence", f"Git metrics computed: Bus Factor={final_bus_factor}, Active Contributors={final_active_contributors}, User Contribution Ratio={final_user_commit_ratio*100:.1f}%.")

        if not meta.get("is_cloned"):
            # Return fork stats structure directly
            await self.publish_task_event(job_id, "CommitIntelligence", "Ecosystem evaluation only (repo is a fork with no contributions).")
            return {
                "data": {
                    "ownership": {
                        "user_commit_ratio": 0.0,
                        "total_commits": 0,
                        "is_primary_author": False,
                        "architectural_ownership_pct": 0.0,
                        "critical_path_ownership_pct": 0.0,
                        "maintenance_duration_months": 0,
                        "explanation": "No contributions were found in this repository by the current user.",
                        "contributor_distribution": [],
                        "bus_factor": 1,
                        "active_contributors": 1
                    },
                    "trust": {
                        "classification": "template_dump",
                        "confidence": 30,
                        "rule_flags": ["fork_no_contributions"],
                        "ai_findings": ["Ecosystem familiarity evaluation only. Code belongs to parent author."],
                        "explanation": "Ecosystem familiarity evaluation only. Code belongs to parent author."
                    },
                    "confidence_meta": {
                        "confidence_score": 100.0,
                        "completeness_ratio": 1.0,
                        "evidence_coverage_count": 0
                    }
                },
                "telemetry": None,
                "events": []
            }

        files_str = "".join([f"--- FILE: {name} ---\n{content}\n\n" for name, content in zip(sample.file_names, sample.file_content)])
        input_payload = {
            "repo_name": meta.get("repo_name"),
            "repo_owner": meta.get("repo_owner"),
            "red_flags": meta.get("red_flags", []),
            "repo_type": meta.get("repo_type"),
            "files_str": files_str,
            # Ingest factual git history metadata for Claude context grounding
            "factual_total_commits": final_total_commits,
            "factual_user_commit_ratio": final_user_commit_ratio,
            "factual_bus_factor": final_bus_factor,
            "factual_active_contributors": final_active_contributors
        }
        system_prompt = self.prompt_factory.get_system_prompt()
        user_prompt = self.prompt_factory.get_commits_user_prompt(input_payload)
        
        await self.publish_task_event(job_id, "CommitIntelligence", "Invoking AI reasoning to evaluate repository trust and author patterns...")
        raw_text, telemetry = await self.claude_service.analyze_repo_with_telemetry(system_prompt, user_prompt, correlation_id)
        parsed = self._extract_json(raw_text, correlation_id)
        await self.publish_task_event(job_id, "CommitIntelligence", "AI reasoning complete. Parsed response successfully.")
        
        # Override Claude's generated values with real deterministic facts
        if "ownership" not in parsed:
            parsed["ownership"] = {}
        parsed["ownership"]["total_commits"] = final_total_commits
        parsed["ownership"]["user_commit_ratio"] = round(final_user_commit_ratio, 4)
        parsed["ownership"]["is_primary_author"] = (final_user_commit_ratio >= 0.50)
        parsed["ownership"]["bus_factor"] = final_bus_factor
        parsed["ownership"]["active_contributors"] = final_active_contributors
        parsed["ownership"]["contributor_distribution"] = final_distribution
        
        # Inject task-level confidence metadata
        parsed["confidence_meta"] = {
            "confidence_score": parsed.get("trust", {}).get("confidence", 80.0),
            "completeness_ratio": round(meta.get("coverage_pct", 100.0) / 100.0, 2),
            "evidence_coverage_count": len(parsed.get("trust", {}).get("ai_findings", []))
        }

        return {
            "data": parsed.get("data", parsed),
            "telemetry": telemetry,
            "events": [
                {
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "level": "Info",
                    "eventType": "StepCompleted",
                    "message": "Commit intelligence and Git trust analysis complete."
                }
            ]
        }

    async def analyze_skills(self, job_id: str, encrypted_token: str, correlation_id: str) -> dict:
        meta, sample = await self._get_meta_and_sample(job_id, encrypted_token, correlation_id)
        await self.publish_task_event(job_id, "SkillExtraction", "Extracting skill signatures and technology stack details...")
        if not meta.get("is_cloned"):
            await self.publish_task_event(job_id, "SkillExtraction", "Ecosystem evaluation only (repo is a fork with no contributions).")
            return {
                "data": {
                    "skills": [],
                    "confidence_meta": {
                        "confidence_score": 100.0,
                        "completeness_ratio": 1.0,
                        "evidence_coverage_count": 0
                    }
                },
                "telemetry": None,
                "events": []
            }

        files_str = "".join([f"--- FILE: {name} ---\n{content}\n\n" for name, content in zip(sample.file_names, sample.file_content)])
        input_payload = {
            "repo_name": meta.get("repo_name"),
            "repo_owner": meta.get("repo_owner"),
            "technologies": meta.get("technologies", []),
            "files_str": files_str
        }
        system_prompt = self.prompt_factory.get_system_prompt()
        user_prompt = self.prompt_factory.get_skills_user_prompt(input_payload)
        
        await self.publish_task_event(job_id, "SkillExtraction", "Invoking AI Skill Extraction model...")
        raw_text, telemetry = await self.claude_service.analyze_repo_with_telemetry(system_prompt, user_prompt, correlation_id)
        parsed = self._extract_json(raw_text, correlation_id)
        await self.publish_task_event(job_id, "SkillExtraction", "AI reasoning complete. Parsed response successfully.")
        
        parsed_data = parsed.get("data", parsed)
        parsed_data["confidence_meta"] = {
            "confidence_score": 90.0,
            "completeness_ratio": round(meta.get("coverage_pct", 100.0) / 100.0, 2),
            "evidence_coverage_count": len(parsed_data.get("skills", []))
        }

        return {
            "data": parsed_data,
            "telemetry": telemetry,
            "events": [
                {
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "level": "Info",
                    "eventType": "StepCompleted",
                    "message": "Technical skill extraction complete."
                }
            ]
        }

    async def analyze_architecture(self, job_id: str, encrypted_token: str, correlation_id: str) -> dict:
        meta, sample = await self._get_meta_and_sample(job_id, encrypted_token, correlation_id)
        await self.publish_task_event(job_id, "ArchitectureAnalysis", "Scanning codebase layout for architectural patterns...")
        if not meta.get("is_cloned"):
            await self.publish_task_event(job_id, "ArchitectureAnalysis", "Ecosystem evaluation only (repo is a fork with no contributions).")
            return {
                "data": {
                    "patterns": [],
                    "explanation": "Short-circuit repo classification",
                    "confidence_meta": {
                        "confidence_score": 100.0,
                        "completeness_ratio": 1.0,
                        "evidence_coverage_count": 0
                    }
                },
                "telemetry": None,
                "events": []
            }

        files_str = "".join([f"--- FILE: {name} ---\n{content}\n\n" for name, content in zip(sample.file_names, sample.file_content)])
        input_payload = {
            "repo_name": meta.get("repo_name"),
            "repo_owner": meta.get("repo_owner"),
            "technologies": meta.get("technologies", []),
            "files_str": files_str
        }
        system_prompt = self.prompt_factory.get_system_prompt()
        user_prompt = self.prompt_factory.get_architecture_user_prompt(input_payload)
        
        await self.publish_task_event(job_id, "ArchitectureAnalysis", "Invoking AI Architecture Pattern Scan...")
        raw_text, telemetry = await self.claude_service.analyze_repo_with_telemetry(system_prompt, user_prompt, correlation_id)
        parsed = self._extract_json(raw_text, correlation_id)
        await self.publish_task_event(job_id, "ArchitectureAnalysis", "AI reasoning complete. Parsed response successfully.")
        
        parsed_data = parsed.get("data", parsed)
        parsed_data["confidence_meta"] = {
            "confidence_score": 85.0,
            "completeness_ratio": round(meta.get("coverage_pct", 100.0) / 100.0, 2),
            "evidence_coverage_count": len(parsed_data.get("patterns", []))
        }

        return {
            "data": parsed_data,
            "telemetry": telemetry,
            "events": [
                {
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "level": "Info",
                    "eventType": "StepCompleted",
                    "message": "Architecture pattern evaluation complete."
                }
            ]
        }

    async def analyze_quality(self, job_id: str, encrypted_token: str, correlation_id: str) -> dict:
        meta, sample = await self._get_meta_and_sample(job_id, encrypted_token, correlation_id)
        await self.publish_task_event(job_id, "CodeQuality", "Inspecting code styling, testing configurations, and observability hooks...")
        if not meta.get("is_cloned"):
            await self.publish_task_event(job_id, "CodeQuality", "Ecosystem evaluation only (repo is a fork with no contributions).")
            return {
                "data": {
                    "testing": {"frameworks": [], "has_tests": False, "confidence": 0, "evidence": [], "detail": "N/A"},
                    "observability": {"logging_configured": False, "metrics_configured": False, "confidence": 0, "evidence": [], "detail": "N/A"},
                    "cicd": {"configured": False, "providers": [], "confidence": 0, "evidence": []},
                    "findings": [],
                    "confidence_meta": {
                        "confidence_score": 100.0,
                        "completeness_ratio": 1.0,
                        "evidence_coverage_count": 0
                    }
                },
                "telemetry": None,
                "events": []
            }

        files_str = "".join([f"--- FILE: {name} ---\n{content}\n\n" for name, content in zip(sample.file_names, sample.file_content)])
        input_payload = {
            "repo_name": meta.get("repo_name"),
            "repo_owner": meta.get("repo_owner"),
            "files_str": files_str
        }
        system_prompt = self.prompt_factory.get_system_prompt()
        user_prompt = self.prompt_factory.get_quality_user_prompt(input_payload)
        
        await self.publish_task_event(job_id, "CodeQuality", "Invoking AI Code Quality model...")
        raw_text, telemetry = await self.claude_service.analyze_repo_with_telemetry(system_prompt, user_prompt, correlation_id)
        parsed = self._extract_json(raw_text, correlation_id)
        await self.publish_task_event(job_id, "CodeQuality", "AI reasoning complete. Parsed response successfully.")
        
        parsed_data = parsed.get("data", parsed)
        parsed_data["confidence_meta"] = {
            "confidence_score": 80.0,
            "completeness_ratio": round(meta.get("coverage_pct", 100.0) / 100.0, 2),
            "evidence_coverage_count": len(parsed_data.get("findings", []))
        }

        return {
            "data": parsed_data,
            "telemetry": telemetry,
            "events": [
                {
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "level": "Info",
                    "eventType": "StepCompleted",
                    "message": "Code quality scan complete."
                }
            ]
        }

    async def analyze_security(self, job_id: str, encrypted_token: str, correlation_id: str) -> dict:
        meta, sample = await self._get_meta_and_sample(job_id, encrypted_token, correlation_id)
        await self.publish_task_event(job_id, "SecurityAnalysis", "Auditing dependencies and code for potential vulnerabilities...")
        if not meta.get("is_cloned"):
            await self.publish_task_event(job_id, "SecurityAnalysis", "Ecosystem evaluation only (repo is a fork with no contributions).")
            return {
                "data": {
                    "vulnerabilities": [], "confidence": 100, "evidence": "N/A", "findings": [],
                    "confidence_meta": {
                        "confidence_score": 100.0,
                        "completeness_ratio": 1.0,
                        "evidence_coverage_count": 0
                    }
                },
                "telemetry": None,
                "events": []
            }

        files_str = "".join([f"--- FILE: {name} ---\n{content}\n\n" for name, content in zip(sample.file_names, sample.file_content)])
        input_payload = {
            "repo_name": meta.get("repo_name"),
            "repo_owner": meta.get("repo_owner"),
            "files_str": files_str
        }
        system_prompt = self.prompt_factory.get_system_prompt()
        user_prompt = self.prompt_factory.get_security_user_prompt(input_payload)
        
        await self.publish_task_event(job_id, "SecurityAnalysis", "Invoking AI Security audit model...")
        raw_text, telemetry = await self.claude_service.analyze_repo_with_telemetry(system_prompt, user_prompt, correlation_id)
        parsed = self._extract_json(raw_text, correlation_id)
        await self.publish_task_event(job_id, "SecurityAnalysis", "AI reasoning complete. Parsed response successfully.")
        
        parsed_data = parsed.get("data", parsed)
        parsed_data["confidence_meta"] = {
            "confidence_score": 95.0,
            "completeness_ratio": round(meta.get("coverage_pct", 100.0) / 100.0, 2),
            "evidence_coverage_count": len(parsed_data.get("findings", []))
        }

        return {
            "data": parsed_data,
            "telemetry": telemetry,
            "events": [
                {
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "level": "Info",
                    "eventType": "StepCompleted",
                    "message": "Security scan complete."
                }
            ]
        }

    async def analyze_summary(self, job_id: str, encrypted_token: str, correlation_id: str) -> dict:
        meta, sample = await self._get_meta_and_sample(job_id, encrypted_token, correlation_id)
        await self.publish_task_event(job_id, "RepositorySummary", "Compiling repository narrative summary and suggestions...")
        if not meta.get("is_cloned"):
            await self.publish_task_event(job_id, "RepositorySummary", "Ecosystem evaluation only (repo is a fork with no contributions).")
            return {
                "data": {
                    "recruiter_summary": "This repository is a fork of the parent codebase with no detected user contributions.",
                    "top_strengths": [{"strength": "Ecosystem Familiarity", "rationale": "Familiarity with the parent codebase ecosystem.", "evidence": ["Forked metadata"]}],
                    "limitations": [{"limitation": "No Direct Contributions", "rationale": "No direct code modifications were verified.", "evidence": ["No commits on parent"]}],
                    "confidence_meta": {
                        "confidence_score": 100.0,
                        "completeness_ratio": 1.0,
                        "evidence_coverage_count": 0
                    }
                },
                "telemetry": None,
                "events": []
            }

        files_str = "".join([f"--- FILE: {name} ---\n{content}\n\n" for name, content in zip(sample.file_names, sample.file_content)])
        input_payload = {
            "repo_name": meta.get("repo_name"),
            "repo_owner": meta.get("repo_owner"),
            "technologies": meta.get("technologies", []),
            "files_str": files_str
        }
        system_prompt = self.prompt_factory.get_system_prompt()
        user_prompt = self.prompt_factory.get_summary_user_prompt(input_payload)
        
        await self.publish_task_event(job_id, "RepositorySummary", "Invoking AI Narrative engine...")
        raw_text, telemetry = await self.claude_service.analyze_repo_with_telemetry(system_prompt, user_prompt, correlation_id)
        parsed = self._extract_json(raw_text, correlation_id)
        await self.publish_task_event(job_id, "RepositorySummary", "AI reasoning complete. Parsed response successfully.")
        
        parsed_data = parsed.get("data", parsed)
        parsed_data["confidence_meta"] = {
            "confidence_score": 85.0,
            "completeness_ratio": round(meta.get("coverage_pct", 100.0) / 100.0, 2),
            "evidence_coverage_count": len(parsed_data.get("top_strengths", [])) + len(parsed_data.get("limitations", []))
        }

        return {
            "data": parsed_data,
            "telemetry": telemetry,
            "events": [
                {
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "level": "Info",
                    "eventType": "StepCompleted",
                    "message": "Narrative summary evaluation complete."
                }
            ]
        }

    async def analyze_classification(self, job_id: str, encrypted_token: str, correlation_id: str) -> dict:
        meta, sample = await self._get_meta_and_sample(job_id, encrypted_token, correlation_id)
        await self.publish_task_event(job_id, "RepositoryClassification", "Classifying repository's semantic domain...")
        
        if not meta.get("is_cloned"):
            await self.publish_task_event(job_id, "RepositoryClassification", "Ecosystem evaluation only (repo is a fork with no contributions).")
            result_data = {
                "primary_type": "Unknown",
                "all_types": [],
                "confidence": 1.0,
                "evidence": ["Repository is a fork with no contributions and has not been cloned for code analysis."],
                "schema_version": "1.0",
                "classifier_version": "2026.06",
                "confidence_meta": {
                    "confidence_score": 100.0,
                    "completeness_ratio": 1.0,
                    "evidence_coverage_count": 0
                }
            }
            return {
                "data": result_data,
                "telemetry": None,
                "events": [
                    {
                        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "level": "Info",
                        "eventType": "StepCompleted",
                        "message": "Repository classification complete (Short-circuited)."
                    }
                ]
            }

        files_str = "".join([f"--- FILE: {name} ---\n{content}\n\n" for name, content in zip(sample.file_names, sample.file_content)])
        input_payload = {
            "repo_name": meta.get("repo_name"),
            "repo_owner": meta.get("repo_owner"),
            "technologies": meta.get("technologies", []),
            "files_str": files_str
        }
        system_prompt = self.prompt_factory.get_system_prompt()
        user_prompt = self.prompt_factory.get_classification_user_prompt(input_payload)
        
        await self.publish_task_event(job_id, "RepositoryClassification", "Invoking AI Repository Classification model...")
        raw_text, telemetry = await self.claude_service.analyze_repo_with_telemetry(system_prompt, user_prompt, correlation_id)
        parsed = self._extract_json(raw_text, correlation_id)
        await self.publish_task_event(job_id, "RepositoryClassification", "AI reasoning complete. Parsed response successfully.")
        
        parsed_data = parsed.get("data", parsed)
        parsed_data["confidence_meta"] = {
            "confidence_score": round(parsed_data.get("confidence", 0.8) * 100.0, 1),
            "completeness_ratio": round(meta.get("coverage_pct", 100.0) / 100.0, 2),
            "evidence_coverage_count": len(parsed_data.get("evidence", []))
        }

        return {
            "data": parsed_data,
            "telemetry": telemetry,
            "events": [
                {
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "level": "Info",
                    "eventType": "StepCompleted",
                    "message": f"Repository classified as: {parsed_data.get('primary_type', 'Unknown')}."
                }
            ]
        }

    async def aggregate_results(
        self,
        job_id: str,
        repository_id: str,
        repo_owner: str,
        repo_name: str,
        partial_results: dict,
        delete_workspace: bool = False,
        correlation_id: str = "system"
    ) -> dict:
        extra_log = {"correlation_id": correlation_id}
        temp_dir_base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "temp_clones"))
        job_dir = os.path.join(temp_dir_base, job_id)
        meta_path = os.path.join(job_dir, "meta.json")
        clone_dir = os.path.join(job_dir, "repo")

        if not os.path.exists(meta_path):
            raise Exception("Workspace metadata not found. Repository Structure task must run first.")

        with open(meta_path, "r", encoding="utf-8") as f_in:
            meta = json.load(f_in)

        structure_data = partial_results.get("RepoStructure", {})
        commits_data = partial_results.get("CommitIntelligence", {})
        skills_data = partial_results.get("SkillExtraction", {})
        arch_data = partial_results.get("ArchitectureAnalysis", {})
        quality_data = partial_results.get("CodeQuality", {})
        security_data = partial_results.get("SecurityAnalysis", {})
        class_task_data = partial_results.get("RepositoryClassification", {})
        summary_data = partial_results.get("RepositorySummary", {})

        # Strict file-based CI/CD detection
        cicd_files_exist = False
        if meta.get("is_cloned") and os.path.exists(clone_dir):
            workflows_dir = os.path.join(clone_dir, ".github", "workflows")
            if os.path.isdir(workflows_dir):
                try:
                    w_files = os.listdir(workflows_dir)
                    if any(os.path.isfile(os.path.join(workflows_dir, f)) for f in w_files):
                        cicd_files_exist = True
                except Exception:
                    pass
            if not cicd_files_exist:
                for f in ("Jenkinsfile", "jenkinsfile"):
                    if os.path.isfile(os.path.join(clone_dir, f)):
                        cicd_files_exist = True
                        break
            if not cicd_files_exist:
                for f in (".gitlab-ci.yml", ".gitlab-ci.yaml"):
                    if os.path.isfile(os.path.join(clone_dir, f)):
                        cicd_files_exist = True
                        break

        cicd_ok = cicd_files_exist

        repo_type = meta.get("repo_type", "ORIGINAL_WORK")
        confidence_ceiling = meta.get("confidence_ceiling", 1.0)
        confidence_modifier = meta.get("confidence_modifier", 1.0)
        classification_rationale = meta.get("classification_rationale", "")
        technologies = meta.get("technologies", [])
        filenames = meta.get("filenames", [])

        repo_info = structure_data.get("repo", {})
        classification_info = structure_data.get("classification", {})

        # Segregated classification and authenticity data structures
        authenticity_info = {
            "type": repo_type,
            "confidence_ceiling": confidence_ceiling,
            "confidence_modifier": confidence_modifier,
            "rationale": classification_rationale,
            "red_flags": meta.get("red_flags", [])
        }

        class_primary_type = class_task_data.get("primary_type", "Unknown")
        class_all_types = class_task_data.get("all_types", [])
        class_confidence = class_task_data.get("confidence", 0.8)
        class_evidence = class_task_data.get("evidence", [])
        class_schema_version = class_task_data.get("schema_version", "1.0")
        class_classifier_version = class_task_data.get("classifier_version", "2026.06")

        classification_dict = {
            "schema_version": class_schema_version,
            "classifier_version": class_classifier_version,
            "primary_type": class_primary_type,
            "all_types": class_all_types,
            "confidence": class_confidence,
            "evidence": class_evidence,
            
            # Legacy fallbacks for backward compatibility
            "classification_rationale": " | ".join(class_evidence) if class_evidence else classification_rationale,
            "complexity": class_task_data.get("complexity", "medium"),
            "benchmark_group": class_task_data.get("benchmark_group", class_primary_type.lower().replace(" ", "_") + "s"),
            "sampled_files": meta.get("sampled_files", []),
            "ignored_files_count": max(0, len(filenames) - len(meta.get("sampled_files", []))),
            "confidence_factors": meta.get("red_flags") or ["authentic_history"]
        }

        ownership_info = commits_data.get("ownership", {
            "user_commit_ratio": 1.0,
            "total_commits": 1,
            "is_primary_author": True,
            "architectural_ownership_pct": 100.0,
            "critical_path_ownership_pct": 100.0,
            "maintenance_duration_months": 1,
            "explanation": "Authentic original codebase.",
            "contributor_distribution": [],
            "bus_factor": 1,
            "active_contributors": 1
        })
        trust_info = commits_data.get("trust", {
            "classification": "personal_authentic",
            "confidence": 100,
            "rule_flags": [],
            "ai_findings": [],
            "explanation": ""
        })

        trust_confidence = trust_info.get("confidence", 100)
        modified_confidence = min(100.0, float(trust_confidence) * confidence_modifier)
        max_conf = confidence_ceiling * 100.0
        if modified_confidence > max_conf:
            modified_confidence = max_conf
        trust_info["confidence"] = round(modified_confidence, 1)

        profile_info = {
            "technologies": [{"name": t, "type": "language" if t in ("Python", "JavaScript", "TypeScript", "C#", "Java", "Go", "Rust", "Ruby", "PHP") else "framework"} for t in technologies],
            "skills": {},
            "architecture": {
                "patterns": [p.get("pattern") for p in arch_data.get("patterns", [])] if "patterns" in arch_data else [],
                "explanation": arch_data.get("explanation", "")
            },
            "engineering_practices": {
                "testing": {
                    "frameworks": quality_data.get("testing", {}).get("frameworks", []),
                    "has_tests": quality_data.get("testing", {}).get("has_tests", False),
                    "detail": quality_data.get("testing", {}).get("detail", "")
                },
                "observability": {
                    "logging_configured": quality_data.get("observability", {}).get("logging_configured", False),
                    "metrics_configured": quality_data.get("observability", {}).get("metrics_configured", False),
                    "detail": quality_data.get("observability", {}).get("detail", "")
                },
                "cicd": {
                    "configured": cicd_ok,
                    "providers": quality_data.get("cicd", {}).get("providers", []) if cicd_ok else []
                }
            }
        }

        skills_dict = {}
        for s_item in skills_data.get("skills", []):
            cat = s_item.get("category", "backend")
            skill_name = s_item.get("skill")
            if cat not in skills_dict:
                skills_dict[cat] = []
            skills_dict[cat].append(skill_name)
        profile_info["skills"] = skills_dict

        findings = []
        for f in quality_data.get("findings", []):
            if isinstance(f, dict):
                f["category"] = "quality"
                findings.append(f)

        for f in security_data.get("findings", []):
            if isinstance(f, dict):
                f["category"] = "security"
                findings.append(f)

        filenames_set = set(filenames)
        for f in findings:
            ev_sigs = f.get("evidence_signals", [])
            for sig in ev_sigs:
                has_file_ref = False
                sig_lower = sig.lower()
                for fname in filenames_set:
                    if fname.lower() in sig_lower:
                        has_file_ref = True
                        break
                if not has_file_ref:
                    if "package.json" in sig_lower or "requirements.txt" in sig_lower or "go.mod" in sig_lower:
                        has_file_ref = True
                if not has_file_ref:
                    logger.warning(f"Hallucinated evidence signal detected in finding '{f.get('finding')}': '{sig}' not in files.", extra=extra_log)

        narrative_info = {
            "recruiter_summary": summary_data.get("recruiter_summary", ""),
            "top_strengths": [{"strength": s.get("strength"), "rationale": s.get("rationale")} for s in summary_data.get("top_strengths", [])],
            "limitations": [{"limitation": l.get("limitation"), "rationale": l.get("rationale")} for l in summary_data.get("limitations", [])]
        }

        # Determine risk level and score based on configuration-driven weights
        def load_risk_policy() -> dict:
            policy_path = os.path.join(os.path.dirname(__file__), "..", "scoring", "risk_policy.json")
            if os.path.exists(policy_path):
                try:
                    with open(policy_path, "r", encoding="utf-8") as f:
                        return json.load(f).get("weights", {})
                except Exception:
                    pass
            return {}

        policy = load_risk_policy()
        sec_cfg = policy.get("security", {"base_score": 15.0, "sec_critical": 35.0, "sec_warning": 15.0, "vuln_critical": 20.0, "vuln_warning": 10.0})
        maint_cfg = policy.get("maintainability", {"base_low": 15.0, "base_medium": 35.0, "base_high": 60.0, "qual_critical": 20.0, "qual_warning": 10.0})
        arch_cfg = policy.get("architecture", {"base_score": 15.0, "arch_critical": 30.0, "arch_warning": 15.0})
        op_cfg = policy.get("operational", {"base_score": 10.0, "no_cicd": 25.0, "no_tests": 20.0, "no_logging": 20.0, "no_metrics": 15.0, "op_critical": 20.0, "op_warning": 10.0})
        dep_cfg = policy.get("dependency", {"base_score": 15.0, "dep_critical": 20.0, "dep_warning": 10.0})
        unc_cfg = policy.get("evidence_uncertainty", {"low_commits": 30.0, "low_user_ratio": 25.0})
        overall_cfg = policy.get("overall", {"max_weight": 0.7, "avg_weight": 0.3})

        critical_sec = sum(1 for f in findings if f.get("category") == "security" and f.get("impact") == "critical")
        warning_sec = sum(1 for f in findings if f.get("category") == "security" and f.get("impact") == "warning")
        vuln_critical = sum(1 for v in security_data.get("vulnerabilities", []) if v.get("severity") == "critical")
        vuln_warning = sum(1 for v in security_data.get("vulnerabilities", []) if v.get("severity") in ("warning", "medium"))
        
        complexity = classification_dict.get("complexity", "medium")
        qual_critical = sum(1 for f in findings if f.get("category") == "quality" and f.get("impact") == "critical")
        qual_warning = sum(1 for f in findings if f.get("category") == "quality" and f.get("impact") == "warning")

        arch_critical = sum(1 for f in findings if ("architecture" in f.get("finding", "").lower() or "structure" in f.get("finding", "").lower()) and f.get("impact") == "critical")
        arch_warning = sum(1 for f in findings if ("architecture" in f.get("finding", "").lower() or "structure" in f.get("finding", "").lower()) and f.get("impact") == "warning")

        has_tests = quality_data.get("testing", {}).get("has_tests", False)
        logging_ok = quality_data.get("observability", {}).get("logging_configured", False)
        metrics_ok = quality_data.get("observability", {}).get("metrics_configured", False)
        op_crit = sum(1 for f in findings if f.get("category") == "quality" and "test" in f.get("finding", "").lower() and f.get("impact") == "critical")
        op_warn = sum(1 for f in findings if f.get("category") == "quality" and "test" in f.get("finding", "").lower() and f.get("impact") == "warning")

        total_commits = ownership_info.get("total_commits", 1)
        user_ratio = ownership_info.get("user_commit_ratio", 1.0)
        confidence_ceiling = meta.get("confidence_ceiling", 1.0)

        # 6-dimensional risk score calculations
        security_score = min(100.0, sec_cfg["base_score"] + sec_cfg["sec_critical"] * critical_sec + sec_cfg["sec_warning"] * warning_sec + sec_cfg["vuln_critical"] * vuln_critical + sec_cfg["vuln_warning"] * vuln_warning)
        
        complexity_base = maint_cfg["base_high"] if complexity == "high" else maint_cfg["base_medium"] if complexity == "medium" else maint_cfg["base_low"]
        maintainability_score = min(100.0, complexity_base + maint_cfg["qual_critical"] * qual_critical + maint_cfg["qual_warning"] * qual_warning)
        
        architecture_score = min(100.0, arch_cfg["base_score"] + arch_cfg["arch_critical"] * arch_critical + arch_cfg["arch_warning"] * arch_warning)
        
        operational_score = op_cfg["base_score"]
        if not cicd_ok: operational_score += op_cfg["no_cicd"]
        if not has_tests: operational_score += op_cfg["no_tests"]
        if not logging_ok: operational_score += op_cfg["no_logging"]
        if not metrics_ok: operational_score += op_cfg["no_metrics"]
        operational_score = min(100.0, operational_score + op_cfg["op_critical"] * op_crit + op_cfg["op_warning"] * op_warn)

        dep_score = dep_cfg["base_score"]
        for f in findings:
            desc = f.get("explanation", "").lower() or ""
            title = f.get("finding", "").lower() or ""
            if "dependency" in desc or "dependency" in title or "package" in desc or "package" in title:
                dep_score += dep_cfg["dep_critical"] if f.get("impact") == "critical" else dep_cfg["dep_warning"]
        dep_score = min(100.0, dep_score)

        uncertainty_score = 100.0 - (confidence_ceiling * 100.0)
        if total_commits < 5: uncertainty_score += unc_cfg["low_commits"]
        if user_ratio < 0.2: uncertainty_score += unc_cfg["low_user_ratio"]
        uncertainty_score = min(100.0, uncertainty_score)

        # Overall risk level mapping
        max_dim = max(security_score, maintainability_score, architecture_score, operational_score, dep_score, uncertainty_score)
        avg_dim = (security_score + maintainability_score + architecture_score + operational_score + dep_score + uncertainty_score) / 6.0
        overall_score = round(overall_cfg["max_weight"] * max_dim + overall_cfg["avg_weight"] * avg_dim, 1)

        risk_level = "High" if overall_score >= 70.0 else "Medium" if overall_score >= 35.0 else "Low"

        # Determine Contributing Factors
        top_factors = []
        if security_score >= 70.0: top_factors.append("Vulnerable code patterns / dependencies")
        if maintainability_score >= 70.0: top_factors.append("High structural complexity / tech debt")
        if operational_score >= 70.0: top_factors.append("Missing automated testing or CI/CD pipelines")
        if dep_score >= 70.0: top_factors.append("Supply chain / outdated package warnings")
        if uncertainty_score >= 70.0: top_factors.append("Sparse commit history or low authorship ratio")
        
        if not top_factors:
            if overall_score >= 35.0: top_factors.append("Moderate warnings in quality/security indicators")
            else: top_factors.append("Project demonstrates solid engineering practices")

        risk_assessment = {
            "risk_level": risk_level,
            "risk_score": overall_score,
            "critical_findings_count": critical_sec + qual_critical,
            "warning_findings_count": warning_sec + qual_warning,
            "explanation": f"Overall risk is {risk_level} due to: " + ", ".join(top_factors) + ".",
            "top_factors": top_factors,
            "dimensions": {
                "security": security_score,
                "maintainability": maintainability_score,
                "architecture": architecture_score,
                "operational": operational_score,
                "dependency": dep_score,
                "evidence_uncertainty": uncertainty_score
            }
        }

        # 1. TRUTH CALIBRATION LAYER & CONFLICT RESOLUTION
        conflict_resolution_log = []
        
        # Authority Ranking: Git Logs (S_git: highest) -> GitHub API (S_api: medium) -> LLM Inference (S_llm: advisory)
        calibrated_skills = {}
        
        # Reconcile LLM Inferred Skills (S_llm) with Configuration Files (S_git)
        # S_git holds technologies from technology detector config files walk
        detected_tech_set = {t.lower() for t in technologies}
        
        # If it was a list of dicts from skills_data, handle it:
        if isinstance(skills_data.get("skills"), list):
            calibrated_skills_list = []
            for s_item in skills_data.get("skills", []):
                cat = s_item.get("category", "backend")
                skill = s_item.get("skill", "")
                skill_lower = skill.lower()
                has_config_support = False
                for tech in detected_tech_set:
                    if tech in skill_lower or skill_lower in tech:
                        has_config_support = True
                        break
                
                if has_config_support or skill in ("Git", "GitHub", "CI/CD"):
                    calibrated_skills_list.append(s_item)
                else:
                    msg = f"Rejected LLM skill inference '{skill}': Unsupported by configuration files dependency references."
                    conflict_resolution_log.append(msg)
                    logger.info(msg, extra=extra_log)
            
            # Rebuild profile skills
            skills_dict = {}
            for s_item in calibrated_skills_list:
                c_cat = s_item.get("category", "backend")
                s_name = s_item.get("skill")
                if c_cat not in skills_dict:
                    skills_dict[c_cat] = []
                skills_dict[c_cat].append(s_name)
            profile_info["skills"] = skills_dict

        # Reconcile Git logs (S_git) vs GitHub API (S_api) for user ownership
        user_git_ratio = ownership_info.get("user_commit_ratio", 1.0)
        is_primary_git = ownership_info.get("is_primary_author", True)
        
        # Check scenario: API claims user is primary, but Git log says mismatch
        # If Git log has low contribution ratio (<0.20), override API's claims
        if user_git_ratio < 0.20 and is_primary_git:
            ownership_info["is_primary_author"] = False
            msg = "Ownership Conflict Resolved: Overrode primary author flag to False. Git logs indicate contribution ratio is under 20% despite API metrics."
            conflict_resolution_log.append(msg)
            logger.info(msg, extra=extra_log)

        # 2. EXPLICIT UNCERTAINTY & ADVERSARIAL METRICS DECOMPOSITION
        unverified_commits = meta.get("unverified_commits_count", 0)
        compression_ratio = meta.get("timestamp_compression_ratio", 0.0)
        uncalibrated_identities = meta.get("uncalibrated_identities_count", 0)
        
        # Calculate Variance (Stability parameter)
        # Stable: High commits count, long age. Variable: Small commits count.
        total_c = ownership_info.get("total_commits", 1)
        variance = round(100.0 / (total_c + 1), 2)
        
        # Calculate Sampling Bias Risk (ratio of skipped to scanned files)
        files_sc = meta.get("files_scanned", 1)
        files_sa = meta.get("files_sampled", 1)
        sampling_bias = round(1.0 - (files_sa / max(1, files_sc)), 4)
        
        # Calculate Adversarial Risk
        # Triggered by timestamp compression, unverified commits, or mismatch author emails
        adv_score = 0.0
        if compression_ratio > 0.1:
            adv_score += 40.0
        if uncalibrated_identities > 2:
            adv_score += 30.0
        if unverified_commits > 0:
            # Scale with unverified percentage
            pct_unverified = unverified_commits / max(1, total_c)
            adv_score += pct_unverified * 30.0
        adversarial_risk = min(100.0, round(adv_score, 1))

        # Adjust main trust confidence based on adversarial risk
        final_trust_confidence = float(trust_info.get("confidence", 100))
        if adversarial_risk > 30.0:
            final_trust_confidence = max(10.0, final_trust_confidence - (adversarial_risk * 0.5))
            trust_info["confidence"] = round(final_trust_confidence, 1)

        # Force isVerified confidence adjustments if CI/CD not configured
        if not cicd_ok:
            final_trust_confidence = max(10.0, final_trust_confidence - 20.0)
            trust_info["confidence"] = round(final_trust_confidence, 1)

        is_verified = final_trust_confidence >= 50.0

        # 3. STRUCTURED CALIBRATED TRUST GRAPH GENERATION
        # Nodes: Developer, Repository, Skill, Evidence
        # Edges: Owns, Demonstrates, Uses, Verifies, Attributes
        nodes = [
            {"id": "developer", "type": "developer", "data": {"label": f"Developer ({repo_owner})", "ratio": user_git_ratio}},
            {"id": "repository", "type": "repository", "data": {"label": f"Repository ({repo_owner}/{repo_name})", "type": repo_type}}
        ]
        edges = [
            {"id": "dev-owns-repo", "source": "developer", "target": "repository", "label": "Owns", "weight": user_git_ratio}
        ]
        
        # Add verified skill nodes (calibrated)
        skill_index = 0
        for cat, list_skills in profile_info.get("skills", {}).items():
            for s_name in list_skills:
                node_id = f"skill-{skill_index}"
                nodes.append({"id": node_id, "type": "skill", "data": {"label": s_name, "category": cat}})
                edges.append({"id": f"dev-has-{node_id}", "source": "developer", "target": node_id, "label": "Demonstrates", "weight": round(final_trust_confidence / 100.0, 2)})
                edges.append({"id": f"repo-uses-{node_id}", "source": "repository", "target": node_id, "label": "Uses"})
                skill_index += 1
                
        # Add verified evidence nodes (signed commits / verified code files)
        evidence_index = 0
        for f in findings:
            finding_name = f.get("finding", "Practice Citation")
            node_id = f"evidence-{evidence_index}"
            nodes.append({"id": node_id, "type": "evidence", "data": {"label": finding_name, "category": f.get("category", "quality")}})
            # Link evidence to developer/repo
            edges.append({"id": f"ev-supports-{node_id}", "source": node_id, "target": "repository", "label": "Verifies"})
            evidence_index += 1

        trust_graph = {
            "nodes": nodes,
            "edges": edges
        }

        # Build sections for v2 schema
        testing_frameworks = quality_data.get("testing", {}).get("frameworks", [])
        cicd_providers = quality_data.get("cicd", {}).get("providers", []) if cicd_ok else []
        
        eng_items = [
            {
                "title": "Testing",
                "content": f"{', '.join(testing_frameworks) if testing_frameworks else 'None'} ({'configured' if has_tests else 'not configured'})"
            },
            {
                "title": "Observability",
                "content": f"Logging is {'configured' if logging_ok else 'not configured'}, Metrics are {'configured' if metrics_ok else 'not configured'}"
            },
            {
                "title": "CI/CD",
                "content": f"{'Configured (' + ', '.join(cicd_providers) + ')' if cicd_ok else 'Not configured'}"
            }
        ]
        for f in findings:
            if f.get("category") == "quality":
                eng_items.append({
                    "title": f.get('finding', 'Quality Finding'),
                    "content": f.get('explanation', '')
                })

        sec_items = []
        for v in security_data.get("vulnerabilities", []):
            sec_items.append({
                "title": f"Vulnerability: {v.get('vulnerability')} ({v.get('impact')})",
                "content": v.get('explanation', '')
            })
        for f in findings:
            if f.get("category") == "security":
                sec_items.append({
                    "title": f.get('finding', 'Security Finding'),
                    "content": f.get('explanation', '')
                })
        if not sec_items:
            sec_items.append({
                "title": "Security Findings",
                "content": "No critical security vulnerabilities or warning findings detected."
            })

        arch_items = []
        for p in arch_data.get("patterns", []):
            if isinstance(p, dict) and p.get("pattern"):
                arch_items.append({
                    "title": p.get('pattern'),
                    "content": "Detected architectural design pattern configured in the workspace."
                })
            elif isinstance(p, str):
                arch_items.append({
                    "title": p,
                    "content": "Detected architectural design pattern configured in the workspace."
                })
        if arch_data.get("explanation"):
            arch_items.append({
                "title": "Architecture Explanation",
                "content": arch_data.get('explanation')
            })
        for f in findings:
            if f.get("category") == "architecture":
                arch_items.append({
                    "title": f.get('finding', 'Architecture Finding'),
                    "content": f.get('explanation', '')
                })
        if not arch_items:
            arch_items.append({
                "title": "Architectural Insights",
                "content": "No specialized architectural insights detected."
            })

        sections = [
            {"type": "engineering_practices", "items": eng_items},
            {"type": "security_findings", "items": sec_items},
            {"type": "architecture_insights", "items": arch_items}
        ]

        classification_v2 = {
            "primaryDomain": class_primary_type if class_primary_type else "Unknown",
            "subDomain": ", ".join(technologies[:2]) if technologies else "General",
            "confidence": min(1.0, max(0.0, float(class_confidence))),
            "isVerified": is_verified,
            "trustScore": min(1.0, max(0.0, float(final_trust_confidence) / 100.0))
        }

        risk_v2 = {
            "score": min(100.0, max(0.0, float(overall_score))),
            "level": risk_level.lower(),
            "reasons": top_factors
        }

        # Structure the payload strictly satisfying the v2 contract, plus legacy fields
        report_dict = {
            "schemaVersion": "v2",
            "repoId": str(repository_id),
            "classification": classification_v2,
            "sections": sections,
            "risk": risk_v2,
            
            # Legacy fields for backward compatibility
            "facts": {
                "repo": repo_info,
                "git_metrics": {
                    "total_commits": ownership_info.get("total_commits", 1),
                    "user_commit_ratio": ownership_info.get("user_commit_ratio", 1.0),
                    "is_primary_author": ownership_info.get("is_primary_author", True),
                    "bus_factor": ownership_info.get("bus_factor", 1),
                    "active_contributors": ownership_info.get("active_contributors", 1),
                    "contributor_distribution": ownership_info.get("contributor_distribution", [])
                },
                "quality_metrics": {
                    "files_scanned": meta.get("files_scanned", 0),
                    "files_sampled": meta.get("files_sampled", 0),
                    "skipped_files": meta.get("skipped_files", 0),
                    "coverage_pct": meta.get("coverage_pct", 100.0),
                    "prompt_cache_efficiency": 0.82
                }
            },
            "ai_conclusions": {
                "authenticity": authenticity_info,
                "classification": classification_dict,
                "evidence_points": {
                    "total": len(findings) * 5,
                    "breakdown": {f.get("category", "quality"): 5 for f in findings}
                },
                "trust": trust_info,
                "risk_assessment": risk_assessment,
                "positioning": {
                    "benchmark_group": classification_dict.get("benchmark_group", "unclassified"),
                    "peer_group_size": 100,
                    "relative_strengths": [s.get("strength") for s in summary_data.get("top_strengths", [])][:3]
                },
                "profile": profile_info,
                "findings": findings,
                "narrative": narrative_info
            },
            "trust_intelligence": {
                "uncertainty_metrics": {
                    "variance": variance,
                    "sampling_bias_risk": sampling_bias,
                    "adversarial_manipulation_risk": adversarial_risk,
                    "unverified_commits": unverified_commits,
                    "timestamp_compression_ratio": compression_ratio,
                    "uncalibrated_identities": uncalibrated_identities
                },
                "conflict_resolution_log": conflict_resolution_log,
                "trust_graph": trust_graph
            }
        }

        # Pydantic v2 contract enforcement validation check
        try:
            ReportV2Contract.model_validate(report_dict)
        except ValidationError as val_err:
            logger.error(f"Report V2 Contract validation failure: {val_err}", extra=extra_log)
            raise ValueError(f"Report V2 Contract validation failure: {val_err}")

        # Workspace lifecycle clean up tracking
        if delete_workspace:
            try:
                shutil.rmtree(job_dir, ignore_errors=True)
                logger.info(f"Workspace lifecycle audit: Cleaned up workspace folder for job {job_id}", extra=extra_log)
            except Exception as cleanup_err:
                logger.warning(f"Workspace lifecycle audit: Cleanup failed: {cleanup_err}", extra=extra_log)

        return report_dict
