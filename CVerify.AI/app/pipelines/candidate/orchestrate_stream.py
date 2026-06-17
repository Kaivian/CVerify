import json
import logging
import time
import asyncio
from typing import Any, Dict, List, AsyncGenerator, Optional

from app.core.clients.repo_intelligence_client import RepoIntelligenceClient
from app.pipelines.candidate.orchestrator import CandidateEvaluationOrchestrator
from app.pipelines.candidate.context import PipelineEvent

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
    ("L2-015", "CandidateImprovementEngine", "ImprovementPlan"),
]


def build_real_repo_report(repository_assessments: list) -> dict:
    complexities = []
    qualities = []
    ownerships = []
    clone_risks = []
    all_patterns = []
    all_langs = {}
    all_fws = []
    
    for ra in repository_assessments:
        overall_score = float(ra.get("overallScore", 0.0))
        complexities.append(overall_score)
        
        quality_metrics = ra.get("qualityMetrics") or {}
        if isinstance(quality_metrics, dict):
            qualities.append(float(quality_metrics.get("qualityScore", 0.0)))
            clone_risks.append(quality_metrics.get("cloneRiskClassification", "clean"))
            
        signal = ra.get("intelligenceSignal") or {}
        if isinstance(signal, dict):
            ownerships.append(float(signal.get("ownershipSignal", 0.0)))

        patterns = ra.get("patterns")
        if isinstance(patterns, list):
            for pat in patterns:
                if pat and pat not in all_patterns:
                    all_patterns.append(pat)
        elif isinstance(patterns, dict):
            for p in patterns.keys():
                if p not in all_patterns:
                    all_patterns.append(p)

        tech_stack = ra.get("techStack") or {}
        if isinstance(tech_stack, dict):
            langs = tech_stack.get("languages", tech_stack)
            if isinstance(langs, dict):
                for lang, pct in langs.items():
                    try:
                        all_langs[lang] = max(all_langs.get(lang, 0.0), float(pct))
                    except:
                        pass
            fws = tech_stack.get("frameworks", [])
            if isinstance(fws, list):
                for fw in fws:
                    if fw and fw not in all_fws:
                        all_fws.append(fw)

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
        except:
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


def build_real_skill_graph(repository_assessments: list) -> dict:
    nodes = []
    edges = []
    seen_skills = set()
    
    for ra in repository_assessments:
        repo_name = ra.get("repositoryName", "unknown")
        
        for attr in ra.get("skillAttributions", []):
            skill = attr.get("skillName")
            if not skill:
                continue
            skill_id = f"skill:{skill.lower()}"
            if skill_id not in seen_skills:
                seen_skills.add(skill_id)
                nodes.append({
                    "id": skill_id,
                    "type": "skill",
                    "data": {
                        "name": skill,
                        "confidence": attr.get("confidence", 0.0),
                        "verificationLevel": attr.get("verificationLevel", "AiAnalyzed")
                    }
                })
                
            for cap in ra.get("capabilities", []):
                cap_name = cap.get("name")
                if not cap_name:
                    continue
                cap_id = f"capability:{cap_name.lower()}"
                if not any(n["id"] == cap_id for n in nodes):
                    nodes.append({
                        "id": cap_id,
                        "type": "capability",
                        "data": {
                            "name": cap_name,
                            "category": cap.get("category", "other"),
                            "maturity": cap.get("maturity", "Basic"),
                            "difficultyScore": cap.get("difficultyScore", 1.0)
                        }
                    })
                
                edge_id = f"edge:{skill_id}->{cap_id}"
                if not any(e["id"] == edge_id for e in edges):
                    edges.append({
                        "id": edge_id,
                        "source": skill_id,
                        "target": cap_id,
                        "data": {
                            "repo": repo_name,
                            "weight": attr.get("contributionWeight", 0.0)
                        }
                    })
    return {"nodes": nodes, "edges": edges, "skill_count": len(seen_skills)}


def build_real_maturity_inputs(repository_assessments: list) -> dict:
    strengths = []
    gaps = []
    
    for ra in repository_assessments:
        json_data = ra.get("jsonData") or {}
        if isinstance(json_data, dict):
            strengths.extend(json_data.get("keyStrengths", []))
            gaps.extend(json_data.get("identifiedGaps", []))
            
    return {
        "commits": [{"message": s, "type": "feat"} for s in strengths if s],
        "codeQualityData": {
            "keyStrengths": strengths,
            "identifiedGaps": gaps
        }
    }


def build_real_problem_solving_inputs(repository_assessments: list) -> dict:
    gaps = []
    for ra in repository_assessments:
        json_data = ra.get("jsonData") or {}
        if isinstance(json_data, dict):
            gaps.extend(json_data.get("identifiedGaps", []))
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
        background_repositories: Optional[List[dict]] = None,
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

        # 2. Filter Eligible Repositories (real gate check)
        eligible_repos = []
        for ra in repository_assessments:
            signal = ra.get("intelligenceSignal") or {}
            ownership_score = float(signal.get("ownershipSignal", 0.0))
            # Normalize to 0-1 if on 0-100 scale
            if ownership_score > 1.0:
                ownership_score = ownership_score / 100.0
                
            if ownership_score == 0.0:
                # Fallback to general overallScore / 100 or assume 1.0
                ownership_score = float(ra.get("overallScore", 100.0))
                if ownership_score > 1.0:
                    ownership_score = ownership_score / 100.0

            quality_metrics = ra.get("qualityMetrics") or {}
            clone_classification = quality_metrics.get("cloneRiskClassification", "clean")
            
            if ownership_score >= 0.30 and clone_classification != "high_risk":
                eligible_repos.append(ra)
            else:
                logger.info(
                    f"Repo excluded via aggregator quality check (Ownership: {ownership_score}, Clone classification: {clone_classification})",
                    extra=extra
                )

        if not eligible_repos and repository_assessments:
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

        consolidated_report = build_real_repo_report(eligible_repos)
        consolidated_graph = build_real_skill_graph(eligible_repos)
        maturity_inputs = build_real_maturity_inputs(eligible_repos)
        problems_inputs = build_real_problem_solving_inputs(eligible_repos)

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
            "repositoryAssessments": repository_assessments,
            "backgroundRepositories": background_repositories or [],
            "_skipDbFetch": True
        }

        # Synthetic job ID for L2 calls
        synthetic_job_id = f"candidate-assess-{cv_id}"

        # 4. Sequentially execute Pipeline 2 tasks L2-001 -> L2-015
        for idx, (task_alias, task_name, artifact_type) in enumerate(STAGES):
            current_pct = round(10.0 + (90.0 * idx / len(STAGES)), 1)
            yield {
                "status": "Running",
                "step": task_alias,
                "message": f"Executing task {task_alias} ({task_name})...",
                "percentage": current_pct
            }

            try:
                event_queue = asyncio.Queue()

                async def event_callback(evt: PipelineEvent) -> None:
                    await event_queue.put(evt)

                # Execute directly using the modular orchestrator uniform task runner with callback
                task_coro = self.orchestrator.execute_task(
                    task_alias,
                    synthetic_job_id,
                    inputs,
                    correlation_id,
                    event_callback=event_callback
                )
                bg_task = asyncio.create_task(task_coro)

                while not bg_task.done() or not event_queue.empty():
                    try:
                        event = await asyncio.wait_for(event_queue.get(), timeout=0.05)
                        yield {
                            "status": "Running",
                            "step": task_alias,
                            "message": f"Task {task_alias} emitted {event.eventType}.",
                            "percentage": current_pct,
                            "event": event.model_dump()
                        }
                        event_queue.task_done()
                    except asyncio.TimeoutError:
                        if bg_task.done():
                            break

                result = await bg_task

                if result.get("status") != "Completed":
                    raise ValueError(result.get("errorMessage") or f"Task {task_name} failed.")

                # Extract resultData and merge it back into inputs
                result_data = json.loads(result["resultData"])
                inputs = {**inputs, **result_data}

                # Unpack single-key wrapper for artifact types if they are nested in task outputs
                json_payload = result_data
                if artifact_type == "CandidateProfile" and "candidateProfile" in result_data:
                    json_payload = result_data["candidateProfile"]
                elif artifact_type == "SkillsList" and "skillProficiencies" in result_data:
                    json_payload = result_data["skillProficiencies"]
                elif artifact_type == "ImprovementPlan" and "improvementPlan" in result_data:
                    json_payload = result_data["improvementPlan"]

                # Emit completion
                completion_pct = round(10.0 + (90.0 * (idx + 1) / len(STAGES)), 1)
                yield {
                    "status": "Running",
                    "step": task_alias,
                    "message": f"Completed task {task_alias} ({task_name}).",
                    "percentage": completion_pct,
                    "artifactType": artifact_type,
                    "jsonData": json.dumps(json_payload)
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

