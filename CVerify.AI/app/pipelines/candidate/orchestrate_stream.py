import json
import logging
import time
import asyncio
from typing import Any, Dict, List, AsyncGenerator

from app.core.clients.repo_intelligence_client import RepoIntelligenceClient
from app.pipelines.candidate.orchestrator import CandidateEvaluationOrchestrator

logger = logging.getLogger("candidate_assessment_stream_orchestrator")

STAGES = [
    ("L2-001", "SkillTaxonomyMapper", "SkillTaxonomyMap"),
    ("L2-002", "SkillProficiencyEstimator", "SkillsList"),
    ("L2-003", "StrengthWeaknessAnalyzer", "StrengthsGaps"),
    ("L2-004", "CareerLevelMapper", None),
    ("L2-005", "CareerLevelCalibrator", None),
    ("L2-006", "CareerLevelGate", None),
    ("L2-007", "EngineeringMaturityAssessor", "Maturity"),
    ("L2-008", "ProblemSolvingAnalyzer", "ProblemSolving"),
    ("L2-009", "TechnicalTendencyClassifier", None),
    ("L2-010", "WorkingStyleClassifier", None),
    ("L2-011", "ExperienceConfidenceMultiplier", None),
    ("L2-012", "MultiRoleRecommendationEngine", "Recommendations"),
    ("L2-013", "CandidateSummaryGenerator", None),
    ("L2-014", "CandidateProfileComposer", "CandidateProfile"),
]


class CandidateAssessmentStreamOrchestrator:
    def __init__(self, repo_client: RepoIntelligenceClient = None) -> None:
        self.repo_client = repo_client or RepoIntelligenceClient()
        self.orchestrator = CandidateEvaluationOrchestrator(repo_intelligence_client=self.repo_client)

    async def orchestrate_async(
        self,
        job_ids: List[str],
        cv_skills: List[str],
        working_experience: List[Dict[str, Any]],
        correlation_id: str = "system"
    ) -> AsyncGenerator[Dict[str, Any], None]:
        extra = {"correlation_id": correlation_id}
        logger.info(f"Starting Candidate Assessment Orchestrator for jobs: {job_ids}", extra=extra)

        # 1. Fetch Line 1 Artifacts
        yield {
            "status": "Running",
            "step": "FetchLine1",
            "message": "Fetching Line 1 analysis artifacts for all candidate repositories...",
            "percentage": 5.0
        }

        fetched_jobs = []
        for jid in job_ids:
            try:
                artifacts = await self.repo_client.fetch_line1_artifacts(jid)
                if artifacts and artifacts.get("repoIntelligenceReport"):
                    fetched_jobs.append({
                        "jobId": jid,
                        **artifacts
                    })
            except Exception as e:
                logger.warning(f"Failed to fetch artifacts for job {jid}: {e}", extra=extra)

        # 2. Filter Eligible Repositories (S-001 gate)
        eligible_jobs = []
        for job in fetched_jobs:
            report = job["repoIntelligenceReport"]
            ownership_score = report.get("ownership", {}).get("ownership_score", 0.0)
            total_commits = report.get("meta", {}).get("total_commits", 0)
            
            # Support both fraud_signals and flat properties for clone classification
            fraud = report.get("fraud_signals", {})
            clone_classification = fraud.get("clone_classification") or report.get("clone_classification", "clean")

            is_eligible = (
                ownership_score >= 0.30 and
                total_commits >= 5 and
                clone_classification != "high_risk"
            )

            if is_eligible:
                eligible_jobs.append(job)
            else:
                logger.info(
                    f"Job {job['jobId']} excluded via S-001 quality check (Ownership: {ownership_score}, Commits: {total_commits}, Clone classification: {clone_classification})",
                    extra=extra
                )

        if not eligible_jobs:
            err_msg = "No verified repositories pass the S-001 readiness gates (minimum 30% ownership, 5 commits, and low clone risk)."
            logger.error(err_msg, extra=extra)
            yield {
                "status": "Failed",
                "step": "FetchLine1",
                "message": err_msg,
                "percentage": 100.0
            }
            return

        # 3. Consolidate Artifacts (S-002 and S-003)
        yield {
            "status": "Running",
            "step": "ConsolidateLine1",
            "message": f"Consolidating analysis inputs from {len(eligible_jobs)} eligible repositories...",
            "percentage": 10.0
        }

        consolidated_report = {
            "ownership": {
                "ownership_score": max(j["repoIntelligenceReport"].get("ownership", {}).get("ownership_score", 0.0) for j in eligible_jobs),
                "commits_by_author": sum(j["repoIntelligenceReport"].get("ownership", {}).get("commits_by_author", 0) for j in eligible_jobs),
            },
            "meta": {
                "total_commits": sum(j["repoIntelligenceReport"].get("meta", {}).get("total_commits", 0) for j in eligible_jobs),
            },
            "fraud_signals": {
                "clone_classification": "clean",
                "clone_risk_score": min(j["repoIntelligenceReport"].get("fraud_signals", {}).get("clone_risk_score", 0.0) for j in eligible_jobs),
                "ai_code_risk_score": min(j["repoIntelligenceReport"].get("fraud_signals", {}).get("ai_code_risk_score", 0.0) for j in eligible_jobs),
            },
            "patterns": [],
            "techStack": {
                "primaryLanguage": eligible_jobs[0]["repoIntelligenceReport"].get("techStack", {}).get("primaryLanguage", ""),
                "languages": {},
                "frameworks": []
            }
        }

        # Merge patterns
        seen_patterns = set()
        for j in eligible_jobs:
            for pattern in j["repoIntelligenceReport"].get("patterns", []):
                pname = pattern.get("patternName", pattern.get("pattern", ""))
                if pname and pname not in seen_patterns:
                    seen_patterns.add(pname)
                    consolidated_report["patterns"].append(pattern)

        # Merge techStack languages and frameworks
        for j in eligible_jobs:
            ts = j["repoIntelligenceReport"].get("techStack", {})
            if not ts:
                continue
            # Languages percentages (keep max)
            for lang, pct in ts.get("languages", {}).items():
                consolidated_report["techStack"]["languages"][lang] = max(
                    consolidated_report["techStack"]["languages"].get(lang, 0), pct
                )
            # Frameworks list
            for fw in ts.get("frameworks", []):
                if fw not in consolidated_report["techStack"]["frameworks"]:
                    consolidated_report["techStack"]["frameworks"].append(fw)

        # Merge skillEvidenceGraph
        consolidated_graph = {"nodes": [], "edges": [], "skill_count": 0, "skills_summary": {}}
        seen_nodes = {}
        seen_edges = set()
        for j in eligible_jobs:
            g = j.get("skillEvidenceGraph") or {}
            for node in g.get("nodes", []):
                nid = node.get("id")
                if not nid:
                    continue
                if nid not in seen_nodes:
                    seen_nodes[nid] = node
                    consolidated_graph["nodes"].append(node)
            for edge in g.get("edges", []):
                eid = edge.get("id") or f"{edge.get('source')}-{edge.get('target')}"
                if eid not in seen_edges:
                    seen_edges.add(eid)
                    consolidated_graph["edges"].append(edge)
        consolidated_graph["skill_count"] = len(seen_nodes)

        # Merge commitTimelineData
        consolidated_timeline = {"commits": []}
        for j in eligible_jobs:
            t = j.get("commitTimelineData") or {}
            consolidated_timeline["commits"].extend(t.get("commits", []))
        try:
            consolidated_timeline["commits"].sort(key=lambda c: c.get("date", c.get("timestamp", "")))
        except Exception:
            pass

        # Merge commitIntentData
        consolidated_intent = {"commitMessages": [], "commits": []}
        for j in eligible_jobs:
            intent = j.get("commitIntentData") or {}
            consolidated_intent["commitMessages"].extend(intent.get("commitMessages", []))
            consolidated_intent["commits"].extend(intent.get("commits", []))

        # Setup orchestrator inputs
        inputs = {
            "repoIntelligenceReport": consolidated_report,
            "skillEvidenceGraph": consolidated_graph,
            "commitTimelineData": consolidated_timeline,
            "commitIntentData": consolidated_intent,
            "cvSkills": cv_skills,
            "workingExperience": working_experience,
            "jobIds": job_ids
        }

        # Synthetic job ID for L2 calls
        synthetic_job_id = f"candidate-assess-{job_ids[0]}"

        # 4. Sequentially execute Pipeline 2 tasks L2-001 -> L2-014
        for idx, (task_alias, task_name, artifact_type) in enumerate(STAGES):
            current_pct = round(10.0 + (90.0 * idx / len(STAGES)), 1)
            yield {
                "status": "Running",
                "step": task_alias,
                "message": f"Executing task {task_alias} ({task_name})...",
                "percentage": current_pct
            }

            try:
                # Resolve orchestrator private methods dynamically
                method_name = f"_{task_name.lower()}"
                if method_name == "_multirolerecommendationengine":
                    method_name = "_multi_role_recommendation"
                elif method_name == "_experienceconfidencemultiplier":
                    method_name = "_experience_confidence_multiplier"

                orchestrator_method = getattr(self.orchestrator, method_name, None)
                if not orchestrator_method:
                    raise ValueError(f"Task method not found on orchestrator: {method_name}")

                # Execute in memory
                result = await orchestrator_method(synthetic_job_id, inputs, correlation_id)

                if result.get("status") != "Completed":
                    raise ValueError(result.get("errorMessage") or f"Task {task_name} failed.")

                # Extract resultData and merge it back into inputs
                result_data = json.loads(result["resultData"])
                inputs = {**inputs, **result_data}

                # Emit completion
                completion_pct = round(10.0 + (90.0 * (idx + 1) / len(STAGES)), 1)
                yield {
                    "status": "Running",
                    "step": task_alias,
                    "message": f"Completed task {task_alias} ({task_name}).",
                    "percentage": completion_pct,
                    "artifactType": artifact_type,
                    "jsonData": json.dumps(result_data)
                }

            except Exception as e:
                logger.exception(f"Error executing Candidate Evaluation stage {task_name}: {e}", extra=extra)
                yield {
                    "status": "Failed",
                    "step": task_alias,
                    "message": f"Stage {task_name} failed: {str(e)}",
                    "percentage": current_pct
                }
                return

        # Success final yield
        yield {
            "status": "Completed",
            "step": "CandidateProfileComposer",
            "message": "Candidate Assessment completed successfully.",
            "percentage": 100.0
        }
