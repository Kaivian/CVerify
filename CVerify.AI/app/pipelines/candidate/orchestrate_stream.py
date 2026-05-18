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


def get_profile_dict(ra: Any) -> dict:
    if not isinstance(ra, dict):
        return {}
    js = ra.get("jsonData")
    if isinstance(js, str) and js:
        try:
            return json.loads(js)
        except Exception:
            pass
    if isinstance(js, dict):
        return js
    return ra


def build_simulated_repo_report(repository_assessments: list) -> dict:
    complexities = []
    qualities = []
    ownerships = []
    clone_risks = []
    all_patterns = []
    all_langs = {}
    all_fws = []
    
    for ra in repository_assessments:
        profile = get_profile_dict(ra)
        if not profile:
            continue
        # overallScore or complexityScore
        complexities.append(float(profile.get("complexityScore", profile.get("overallScore", 0.0))))
        qualities.append(float(profile.get("qualityScore", 0.0)))
        ownerships.append(float(profile.get("ownershipScore", 0.0)))
        clone_risks.append(profile.get("cloneRiskClassification", "clean"))
        
        for pat in profile.get("verifiedPatterns", []):
            if pat and pat not in all_patterns:
                all_patterns.append(pat)
        for fw in profile.get("detectedFrameworks", []):
            if fw and fw not in all_fws:
                all_fws.append(fw)
                
        langs = profile.get("primaryLanguages", {})
        if isinstance(langs, dict):
            for lang, pct in langs.items():
                try:
                    all_langs[lang] = max(all_langs.get(lang, 0.0), float(pct))
                except Exception:
                    pass

    max_ownership = max(ownerships) if ownerships else 0.0
    max_complexity = max(complexities) if complexities else 0.0
    max_quality = max(qualities) if qualities else 0.0
    
    if "high_risk" in clone_risks:
        final_clone = "high_risk"
    elif "medium_risk" in clone_risks:
        final_clone = "medium_risk"
    elif "low_risk" in clone_risks:
        final_clone = "low_risk"
    else:
        final_clone = "clean"

    primary_lang = ""
    if all_langs:
        try:
            primary_lang = max(all_langs, key=all_langs.get)
        except Exception:
            pass

    return {
        "ownership": {
            "ownership_score": max_ownership,
        },
        "meta": {
            "complexity_score": max_complexity,
            "quality_score": max_quality,
        },
        "fraud_signals": {
            "clone_classification": final_clone,
        },
        "patterns": [{"patternName": p} for p in all_patterns],
        "techStack": {
            "primaryLanguage": primary_lang,
            "languages": all_langs,
            "frameworks": all_fws
        }
    }


def build_simulated_skill_graph(repository_assessments: list) -> dict:
    nodes = []
    seen = set()
    for ra in repository_assessments:
        profile = get_profile_dict(ra)
        if not profile:
            continue
        
        langs = profile.get("primaryLanguages", {})
        if isinstance(langs, dict):
            for lang in langs.keys():
                if lang and lang.lower() not in seen:
                    seen.add(lang.lower())
                    nodes.append({"id": lang, "data": {"name": lang}})
                    
        fws = profile.get("detectedFrameworks", [])
        if isinstance(fws, list):
            for fw in fws:
                if fw and fw.lower() not in seen:
                    seen.add(fw.lower())
                    nodes.append({"id": fw, "data": {"name": fw}})
    return {"nodes": nodes, "edges": [], "skill_count": len(nodes)}


def build_simulated_maturity_inputs(repository_assessments: list) -> dict:
    strengths = []
    gaps = []
    for ra in repository_assessments:
        profile = get_profile_dict(ra)
        if not profile:
            continue
        strengths.extend(profile.get("keyStrengths", []))
        gaps.extend(profile.get("identifiedGaps", []))
    
    return {
        "commits": [{"message": s, "type": "feat"} for s in strengths if s],
        "codeQualityData": {
            "keyStrengths": strengths,
            "identifiedGaps": gaps
        }
    }


def build_simulated_problem_solving_inputs(repository_assessments: list) -> dict:
    gaps = []
    for ra in repository_assessments:
        profile = get_profile_dict(ra)
        if not profile:
            continue
        gaps.extend(profile.get("identifiedGaps", []))
    return {
        "commits": [{"message": f"Fix gap: {g}", "type": "fix"} for g in gaps if g],
        "commitMessages": [f"Fix gap: {g}" for g in gaps if g]
    }


class CandidateAssessmentStreamOrchestrator:
    def __init__(self, repo_client: RepoIntelligenceClient = None) -> None:
        self.repo_client = repo_client or RepoIntelligenceClient()
        self.orchestrator = CandidateEvaluationOrchestrator(repo_intelligence_client=self.repo_client)

    async def orchestrate_async(
        self,
        cv: dict,
        repository_assessments: List[dict],
        correlation_id: str = "system"
    ) -> AsyncGenerator[Dict[str, Any], None]:
        extra = {"correlation_id": correlation_id}
        cv_id = cv.get("cvId", "unknown")
        logger.info(f"Starting Candidate Assessment Orchestrator for CV: {cv_id}", extra=extra)

        # 1. Fetch Line 1 Artifacts (Mock step for backward compatibility indicator)
        yield {
            "status": "Running",
            "step": "FetchLine1",
            "message": "Mapping pre-computed repository capability profiles...",
            "percentage": 5.0
        }

        # 2. Filter Eligible Repositories (Mock gate check)
        eligible_repos = []
        for ra in repository_assessments:
            profile = get_profile_dict(ra)
            if not profile:
                continue
            ownership_score = profile.get("ownershipScore", 0.0)
            clone_classification = profile.get("cloneRiskClassification", "clean")
            
            # Since repository assessment is manually triggered only for eligible repos,
            # we just log or keep the ones passing minimal quality metrics
            if ownership_score >= 0.30 and clone_classification != "high_risk":
                eligible_repos.append(ra)
            else:
                logger.info(
                    f"Repo excluded via aggregator quality check (Ownership: {ownership_score}, Clone classification: {clone_classification})",
                    extra=extra
                )

        if not eligible_repos and repository_assessments:
            # If some repos were passed but none were eligible, throw error
            err_msg = "No verified repositories pass the readiness gates (minimum 30% ownership and low clone risk)."
            logger.error(err_msg, extra=extra)
            yield {
                "status": "Failed",
                "step": "FetchLine1",
                "message": err_msg,
                "percentage": 100.0
            }
            return

        # 3. Consolidate Artifacts
        yield {
            "status": "Running",
            "step": "ConsolidateLine1",
            "message": "Consolidating capability metrics and scores...",
            "percentage": 10.0
        }

        cv_skills = cv.get("skills", [])
        working_experience = cv.get("experiences", [])

        consolidated_report = build_simulated_repo_report(eligible_repos)
        consolidated_graph = build_simulated_skill_graph(eligible_repos)
        maturity_inputs = build_simulated_maturity_inputs(eligible_repos)
        problems_inputs = build_simulated_problem_solving_inputs(eligible_repos)

        inputs = {
            "repoIntelligenceReport": consolidated_report,
            "skillEvidenceGraph": consolidated_graph,
            "commitTimelineData": {"commits": maturity_inputs["commits"]},
            "commitIntentData": {
                "commitMessages": problems_inputs["commitMessages"],
                "commits": problems_inputs["commits"]
            },
            "codeQualityData": maturity_inputs["codeQualityData"],
            "cvSkills": cv_skills,
            "workingExperience": working_experience,
            "cv": cv,
            "repositoryAssessments": repository_assessments
        }

        # Synthetic job ID for L2 calls
        synthetic_job_id = f"candidate-assess-{cv_id}"

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

