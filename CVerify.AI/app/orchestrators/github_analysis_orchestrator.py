import os
import shutil
import tempfile
import json
import logging
import asyncio
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Any
from uuid import UUID

from app.github.technology_detector import TechnologyDetector
from app.github.code_sampler import CodeSampler, CodeSamplingOptions
from app.prompts.github_prompt_factory import GitHubPromptFactory
from app.services.claude_service import ClaudeService

logger = logging.getLogger("github_analysis_orchestrator")


class IGitHubAnalysisOrchestrator(ABC):
    @abstractmethod
    async def orchestrate_async(
        self,
        repository_id: Any,
        repo_name: str,
        repo_owner: str,
        encrypted_token: str,
        default_branch: str
    ) -> AsyncGenerator[dict, None]:
        ...


class GitHubAnalysisOrchestrator(IGitHubAnalysisOrchestrator):
    def __init__(self):
        self.tech_detector = TechnologyDetector()
        self.code_sampler = CodeSampler()
        self.prompt_factory = GitHubPromptFactory()
        self.claude_service = ClaudeService()

    async def orchestrate_async(
        self,
        repository_id: Any,
        repo_name: str,
        repo_owner: str,
        encrypted_token: str,
        default_branch: str
    ) -> AsyncGenerator[dict, None]:
        yield {
            "status": "CloningRepository",
            "step": "CloningRepository",
            "progress": 20.0,
            "message": f"Cloning repository branch '{default_branch}'..."
        }

        # Create temporary directory inside workspace
        temp_dir_base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "temp_clones"))
        os.makedirs(temp_dir_base, exist_ok=True)

        # Use context manager for auto-cleanup
        with tempfile.TemporaryDirectory(dir=temp_dir_base) as temp_dir:
            clone_dir = os.path.join(temp_dir, "repo")
            clone_url = f"https://{encrypted_token}@github.com/{repo_owner}/{repo_name}.git"

            env = os.environ.copy()
            env["GIT_TERMINAL_PROMPT"] = "0"

            try:
                import subprocess

                # Perform git clone in a thread pool using asyncio.to_thread
                # to keep event loop responsive without needing asyncio subprocess transports (which raise NotImplementedError on Windows under Uvicorn)
                def clone_with_branch():
                    return subprocess.run(
                        ["git", "-c", "credential.helper=", "clone", "--depth", "1", "--branch", default_branch, clone_url, clone_dir],
                        env=env,
                        capture_output=True
                    )

                proc = await asyncio.to_thread(clone_with_branch)
                if proc.returncode != 0:
                    # Clean up failed clone folder before retrying
                    shutil.rmtree(clone_dir, ignore_errors=True)
                    
                    # Retry without branch option to let git fallback to default branch
                    def clone_default_branch():
                        return subprocess.run(
                            ["git", "-c", "credential.helper=", "clone", "--depth", "1", clone_url, clone_dir],
                            env=env,
                            capture_output=True
                        )

                    proc_retry = await asyncio.to_thread(clone_default_branch)
                    if proc_retry.returncode != 0:
                        stdout_retry = proc_retry.stdout
                        stderr_retry = proc_retry.stderr
                        err_msg = stderr_retry.decode("utf-8", errors="ignore").strip()
                        if not err_msg:
                            err_msg = stdout_retry.decode("utf-8", errors="ignore").strip()
                        if not err_msg:
                            err_msg = f"Exit code {proc_retry.returncode}"
                        raise Exception(f"Git clone failed: {err_msg}")
            except Exception as e:
                logger.exception(f"Clone failed for {repo_owner}/{repo_name}")
                raise Exception(f"Failed to clone repository ({type(e).__name__}): {str(e)}")

            yield {
                "status": "DetectingTechnologyStack",
                "step": "DetectingTechnologyStack",
                "progress": 40.0,
                "message": "Detecting frameworks and programming languages..."
            }

            filenames = []
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

            yield {
                "status": "SamplingCode",
                "step": "SamplingCode",
                "progress": 60.0,
                "message": "Loading package manifests, documentation and source file samples..."
            }

            try:
                options = CodeSamplingOptions(max_files=10, max_lines_per_file=100)
                sample = await self.code_sampler.sample_async(clone_dir, encrypted_token, options)
            except Exception as e:
                logger.error(f"Sampling failed for {repo_owner}/{repo_name}: {e}")
                raise Exception(f"Failed to sample codebase files: {str(e)}")

            yield {
                "status": "RunningAgents",
                "step": "RunningAgents",
                "progress": 80.0,
                "message": "Invoking multi-agent analysis via Claude..."
            }

            input_payload = {
                "repo_name": repo_name,
                "repo_owner": repo_owner,
                "technologies": all_techs,
                "file_names": sample.file_names,
                "file_contents": sample.file_content
            }
            system_prompt = self.prompt_factory.get_system_prompt()
            user_prompt = self.prompt_factory.get_user_prompt(input_payload)

            try:
                raw_report = await self.claude_service.analyze_repo(system_prompt, user_prompt)
            except Exception as e:
                logger.error(f"Claude analysis failed for {repo_owner}/{repo_name}: {e}")
                raise Exception(f"Claude analysis service failure: {str(e)}")

            raw_report = raw_report.strip()
            
            # Robustly extract JSON object from the response (handles markdown blocks, preamble, postamble)
            first_brace = raw_report.find('{')
            last_brace = raw_report.rfind('}')
            
            report_dict = None
            if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
                json_candidate = raw_report[first_brace:last_brace + 1]
                try:
                    report_dict = json.loads(json_candidate)
                except Exception as parse_err:
                    logger.warning(f"Failed to parse extracted JSON block: {parse_err}")
            
            # Fallback to direct parsing if brace extraction failed or was not parsed
            if report_dict is None:
                try:
                    report_dict = json.loads(raw_report)
                except Exception as e:
                    logger.error(f"Failed to parse Claude output as JSON. Output:\n{raw_report}\nError: {e}")
                    raise Exception("Claude output did not return a valid JSON format.")

            report_dict["repo"]["id"] = str(repository_id)
            report_dict["repo"]["name"] = repo_name
            report_dict["repo"]["full_name"] = f"{repo_owner}/{repo_name}"
            report_dict["repo"]["url"] = f"https://github.com/{repo_owner}/{repo_name}"
            if not report_dict["repo"].get("languages"):
                report_dict["repo"]["languages"] = {t: round(100.0/len(all_techs), 1) for t in all_techs} if all_techs else {"Other": 100.0}

            # Backfill scoring for C# backend compatibility (IsVerified / TrustScore mapping)
            if "scoring" not in report_dict:
                confidence = report_dict.get("trust", {}).get("confidence", 100)
                report_dict["scoring"] = {
                    "final_score": float(confidence),
                    "band": "A" if confidence >= 90 else "B" if confidence >= 70 else "C" if confidence >= 50 else "D" if confidence >= 30 else "F"
                }

            yield {
                "status": "AggregatingResults",
                "step": "AggregatingResults",
                "progress": 90.0,
                "message": "Aggregating metrics and final report..."
            }

            yield {
                "reportData": json.dumps(report_dict)
            }
