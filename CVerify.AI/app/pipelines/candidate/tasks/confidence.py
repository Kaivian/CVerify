from typing import Dict, Any, List
from app.pipelines.candidate.base_task import BaseTask
from app.pipelines.candidate.context import PipelineContext
from app.pipelines.candidate.helpers import calculate_discounted_experience_months

class ExperienceConfidenceMultiplier(BaseTask):
    @property
    def name(self) -> str:
        return "L2-011"

    @property
    def task_name(self) -> str:
        return "ExperienceConfidenceMultiplier"

    @property
    def input_keys(self) -> List[str]:
        return ["cv", "workingExperience"]

    @property
    def output_keys(self) -> List[str]:
        return ["confidenceMultiplier", "totalExperienceMonths", "totalExperienceYears", "hasLeadershipExperience", "multiplierRationale"]

    async def _execute_internal(self, context: PipelineContext, correlation_id: str) -> Dict[str, Any]:
        cv = context.cv or {}
        working_experience = context.workingExperience or []

        total_months = calculate_discounted_experience_months(cv)
        if total_months == 0:
            for exp in working_experience:
                total_months += float(exp.get("durationMonths", 0))

        is_leadership = False
        for exp in working_experience:
            if exp.get("isLeadership", False):
                is_leadership = True

        years = total_months / 12.0

        if years >= 5:
            multiplier = 1.25
        elif years >= 3:
            multiplier = 1.20
        elif years >= 1:
            multiplier = 1.10
        else:
            multiplier = 1.0

        if is_leadership:
            multiplier = min(multiplier + 0.05, 1.25)

        rationale = (
            f"{round(years, 1)} years of experience"
            f"{' including leadership roles' if is_leadership else ''}. "
            f"Confidence boost: {round((multiplier - 1.0) * 100, 0):.0f}%."
        )

        return {
            "confidenceMultiplier": round(multiplier, 2),
            "totalExperienceMonths": total_months,
            "totalExperienceYears": round(years, 1),
            "hasLeadershipExperience": is_leadership,
            "multiplierRationale": rationale
        }
