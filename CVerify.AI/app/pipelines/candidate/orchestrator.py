import json
import logging
import time
from typing import Any, Dict, Optional, List, Callable, Awaitable

from app.core.clients.repo_intelligence_client import RepoIntelligenceClient
from app.pipelines.candidate.context import PipelineContext, PipelineEvent
from app.pipelines.candidate.dag import PipelineDAG
from app.pipelines.candidate.tasks.taxonomy_mapper import SkillTaxonomyMapper
from app.pipelines.candidate.tasks.proficiency_estimator import SkillProficiencyEstimator
from app.pipelines.candidate.tasks.strength_weakness import StrengthWeaknessAnalyzer
from app.pipelines.candidate.tasks.career_level import CareerLevelMapper, CareerLevelCalibrator, CareerLevelGate
from app.pipelines.candidate.tasks.maturity import EngineeringMaturityAssessor
from app.pipelines.candidate.tasks.problem_solving import ProblemSolvingAnalyzer
from app.pipelines.candidate.tasks.classifiers import TechnicalTendencyClassifier, WorkingStyleClassifier
from app.pipelines.candidate.tasks.confidence import ExperienceConfidenceMultiplier
from app.pipelines.candidate.tasks.recommendations import MultiRoleRecommendationEngine
from app.pipelines.candidate.tasks.summary import CandidateSummaryGenerator
from app.pipelines.candidate.tasks.composer import CandidateProfileComposer
from app.pipelines.candidate.tasks.improvement_engine import CandidateImprovementEngine
from app.pipelines.candidate.tasks.skill_tree import SkillTreeGenerator

logger = logging.getLogger("candidate_evaluation_orchestrator")

# Constants and compatibility tables
_LINE1_ARTIFACT_KEYS = frozenset({
    "repoIntelligenceReport",
    "skillEvidenceGraph",
    "commitTimelineData",
    "commitIntentData",
})

_CANDIDATE_L2_TASK_NAMES = {
    "SkillTaxonomyMapper", "SkillProficiencyEstimator", "StrengthWeaknessAnalyzer",
    "CareerLevelMapper", "CareerLevelCalibrator", "CareerLevelGate",
    "EngineeringMaturityAssessor", "ProblemSolvingAnalyzer", "TechnicalTendencyClassifier",
    "WorkingStyleClassifier", "ExperienceConfidenceMultiplier", "MultiRoleRecommendationEngine",
    "CandidateSummaryGenerator", "CandidateProfileComposer", "CandidateImprovementEngine",
    "SkillTreeGenerator"
}

TASK_ALIASES: Dict[str, str] = {
    "L2-001": "SkillTaxonomyMapper",
    "L2-002": "SkillProficiencyEstimator",
    "L2-003": "StrengthWeaknessAnalyzer",
    "L2-004": "CareerLevelMapper",
    "L2-005": "CareerLevelCalibrator",
    "L2-006": "CareerLevelGate",
    "L2-007": "EngineeringMaturityAssessor",
    "L2-008": "ProblemSolvingAnalyzer",
    "L2-009": "TechnicalTendencyClassifier",
    "L2-010": "WorkingStyleClassifier",
    "L2-011": "ExperienceConfidenceMultiplier",
    "L2-012": "MultiRoleRecommendationEngine",
    "L2-013": "CandidateSummaryGenerator",
    "L2-014": "CandidateProfileComposer",
    "L2-015": "CandidateImprovementEngine",
    "L2-016": "SkillTreeGenerator"
}

def is_line2_task(task_type: str) -> bool:
    return task_type in TASK_ALIASES or task_type in _CANDIDATE_L2_TASK_NAMES


class CandidateEvaluationOrchestrator:
    def __init__(
        self,
        repo_intelligence_client: Optional[RepoIntelligenceClient] = None,
    ) -> None:
        self._repo_client = repo_intelligence_client or RepoIntelligenceClient()
        self._tasks = [
            SkillTaxonomyMapper(),
            SkillProficiencyEstimator(),
            StrengthWeaknessAnalyzer(),
            CareerLevelMapper(),
            CareerLevelCalibrator(),
            CareerLevelGate(),
            EngineeringMaturityAssessor(),
            ProblemSolvingAnalyzer(),
            TechnicalTendencyClassifier(),
            WorkingStyleClassifier(),
            ExperienceConfidenceMultiplier(),
            MultiRoleRecommendationEngine(),
            CandidateSummaryGenerator(),
            SkillTreeGenerator(),
            CandidateProfileComposer(),
            CandidateImprovementEngine()
        ]
        self._dag = PipelineDAG(self._tasks)
        self._dag.validate() # Fail-fast compilation and schema verification

    def _ok(self, data: dict, telemetry: Any, task_type: str) -> dict:
        return {
            "status": "Completed",
            "errorMessage": None,
            "schemaVersion": "2.0.0",
            "resultData": json.dumps(data),
            "telemetry": telemetry,
            "events": [{
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "level": "Info",
                "eventType": "StepCompleted",
                "message": f"Line 2 task {task_type} completed successfully."
            }]
        }

    def _err(self, task_type: str, job_id: str, e: Exception) -> dict:
        err_str = str(e).lower()
        if "rate limit" in err_str or "429" in err_str:
            code, retry = "RATE_LIMIT_EXCEEDED", True
        elif "timeout" in err_str:
            code, retry = "TIMEOUT", True
        elif "json" in err_str or "parse" in err_str:
            code, retry = "PARSING_ERROR", False
        else:
            code, retry = "UNKNOWN_ERROR", True
        return {
            "status": "Failed",
            "errorMessage": str(e),
            "errorCode": code,
            "retryable": retry,
            "taskId": task_type,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "schemaVersion": "2.0.0",
            "resultData": None,
            "telemetry": None,
            "events": [{
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "level": "Error",
                "eventType": "AI_TASK_FAILED",
                "message": str(e)
            }]
        }

    async def execute_task(
        self,
        task_type: str,
        job_id: str,
        inputs: Dict[str, Any],
        correlation_id: str = "system",
        event_callback: Optional[Callable[[PipelineEvent], Awaitable[None]]] = None
    ) -> dict:
        normalized = TASK_ALIASES.get(task_type, task_type)
        extra = {"correlation_id": correlation_id, "job_id": job_id, "task_type": normalized}
        logger.info(f"Executing Line 2 task {normalized} for job {job_id}", extra=extra)

        # Resolve the specific task from our registered list
        task = next((t for t in self._tasks if t.task_name == normalized or t.name == task_type), None)
        if not task:
            return self._err(task_type, job_id, ValueError(f"Unknown Line 2 task type: {task_type}"))

        # Fetch all Line 1 artifacts from the CVerify.Core database if not explicitly skipped
        if inputs.get("_skipDbFetch") or inputs.get("skipDbFetch"):
            logger.info("Skipping database artifact fetch as Line 1 data is provided in inputs.")
            line1_artifacts = {}
        else:
            line1_artifacts = await self._repo_client.fetch_line1_artifacts(job_id)

        repo_report = line1_artifacts.get("repoIntelligenceReport") or inputs.get("repoIntelligenceReport") or {}
        skill_graph = line1_artifacts.get("skillEvidenceGraph") or inputs.get("skillEvidenceGraph") or {}
        timeline_data = line1_artifacts.get("commitTimelineData") or inputs.get("commitTimelineData") or {}
        intent_data = line1_artifacts.get("commitIntentData") or inputs.get("commitIntentData") or {}

        # Construct a validated PipelineContext using the accumulative inputs and pre-computed values
        context_kwargs = {}
        for field in PipelineContext.model_fields:
            if field in inputs:
                context_kwargs[field] = inputs[field]

        cv = inputs.get("cv") or {}
        context_kwargs["cv"] = cv
        context_kwargs["repositoryAssessments"] = inputs.get("repositoryAssessments") or []
        context_kwargs["backgroundRepositories"] = inputs.get("backgroundRepositories") or []
        context_kwargs["repoIntelligenceReport"] = repo_report
        context_kwargs["skillEvidenceGraph"] = skill_graph
        context_kwargs["maturityInputs"] = timeline_data
        context_kwargs["problemsInputs"] = intent_data
        context_kwargs["cvSkills"] = context_kwargs.get("cvSkills") or cv.get("skills", [])
        context_kwargs["workingExperience"] = context_kwargs.get("workingExperience") or cv.get("experiences", [])
        context_kwargs["correlationId"] = correlation_id

        try:
            context = PipelineContext(**context_kwargs)
            
            # Execute task
            start_time = time.time()
            new_context = await task.run(context, correlation_id, event_callback)
            duration_ms = (time.time() - start_time) * 1000.0

            # Extract the specific outputs of this task to return to C# caller
            result_data = {}
            for key in task.output_keys:
                result_data[key] = getattr(new_context, key)

            telemetry = {
                "duration_ms": round(duration_ms, 2),
                "task_type": task.task_name
            }
            if hasattr(task, "last_telemetry") and task.last_telemetry:
                telemetry.update(task.last_telemetry)

            return self._ok(result_data, telemetry, task.task_name)
        except Exception as e:
            logger.exception(f"Error in Line 2 task {normalized}: {e}", extra=extra)
            return self._err(task_type, job_id, e)


# --- Legacy Compatibility Helpers ---
# Keeping these exposed so that tasks can import them directly

from app.pipelines.candidate.helpers import (
    _get_normalized_name,
    _LEVEL_ORDER,
    _LEVEL_LABELS,
    _score_to_level,
    _is_boundary_score,
    _is_adjacent_or_same_level,
    parse_date,
    calculate_discounted_experience_months,
)
