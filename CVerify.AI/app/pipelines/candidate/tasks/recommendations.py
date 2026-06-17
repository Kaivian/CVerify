from typing import Dict, Any, List
import json
from app.pipelines.candidate.base_task import BaseTask
from app.pipelines.candidate.context import PipelineContext
from app.core.services.claude_service import ClaudeService
from app.pipelines.shared.ai.prompts.candidate_prompt_factory import CandidatePromptFactory

class MultiRoleRecommendationEngine(BaseTask):
    @property
    def name(self) -> str:
        return "L2-012"

    @property
    def task_name(self) -> str:
        return "MultiRoleRecommendationEngine"

    @property
    def dependencies(self) -> List[str]:
        return ["L2-006", "L2-009", "L2-010"]

    @property
    def input_keys(self) -> List[str]:
        return ["primaryTendency", "tendencyRanking", "finalLevel", "primaryWorkingStyle", "backgroundRepositories"]

    @property
    def output_keys(self) -> List[str]:
        return ["topMatch", "suggestedRoles", "suggestedCvTitles", "cvImprovementSuggestions"]

    def __init__(self):
        self.claude_service = ClaudeService()
        self.prompt_factory = CandidatePromptFactory()

    async def _execute_internal(self, context: PipelineContext, correlation_id: str) -> Dict[str, Any]:
        legacy_inputs = context.to_legacy_dict()
        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_multi_role_recommendation_prompt(legacy_inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        
        data = self._extract_json(raw)
        return {
            "topMatch": data.get("topMatch", {}),
            "suggestedRoles": data.get("suggestedRoles", []),
            "suggestedCvTitles": data.get("suggestedCvTitles", []),
            "cvImprovementSuggestions": data.get("cvImprovementSuggestions", [])
        }

    def _extract_json(self, text: str) -> dict:
        text = text.strip()
        first_brace = text.find('{')
        last_brace = text.rfind('}')
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            candidate = text[first_brace:last_brace + 1]
            try:
                return json.loads(candidate)
            except Exception:
                pass
        try:
            import json_repair
            repaired = json_repair.repair_json(text[first_brace:] if first_brace != -1 else text)
            return json.loads(repaired)
        except Exception as e:
            raise ValueError(f"Failed to parse Claude JSON output: {e}")
