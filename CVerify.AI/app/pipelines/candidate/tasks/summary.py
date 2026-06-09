from typing import Dict, Any, List
import json
from app.pipelines.candidate.base_task import BaseTask
from app.pipelines.candidate.context import PipelineContext
from app.core.services.claude_service import ClaudeService
from app.pipelines.shared.ai.prompts.candidate_prompt_factory import CandidatePromptFactory

class CandidateSummaryGenerator(BaseTask):
    @property
    def name(self) -> str:
        return "L2-013"

    @property
    def task_name(self) -> str:
        return "CandidateSummaryGenerator"

    @property
    def dependencies(self) -> List[str]:
        return ["L2-006", "L2-007", "L2-008", "L2-009", "L2-010", "L2-012"]

    @property
    def input_keys(self) -> List[str]:
        return [
            "finalLevel", "primaryTendency", "primaryWorkingStyle",
            "strongestDomains", "skillGaps", "maturitySummary",
            "problemSolvingSummary", "topMatch"
        ]

    @property
    def output_keys(self) -> List[str]:
        return ["recruiterHeadline", "fullSummary", "keyStrengths", "watchPoints"]

    def __init__(self):
        self.claude_service = ClaudeService()
        self.prompt_factory = CandidatePromptFactory()

    async def _execute_internal(self, context: PipelineContext, correlation_id: str) -> Dict[str, Any]:
        legacy_inputs = context.to_legacy_dict()
        
        # CandidateSummaryGenerator prompt expects topMatchRole and engineeringMaturitySummary
        enriched_inputs = {
            **legacy_inputs,
            "topMatchRole": (context.topMatch or {}).get("roleTitle", ""),
            "engineeringMaturitySummary": context.maturitySummary or "",
            "problemSolvingSummary": context.problemSolvingSummary or ""
        }
        
        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_candidate_summary_prompt(enriched_inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        
        data = self._extract_json(raw)
        return {
            "recruiterHeadline": data.get("recruiterHeadline", ""),
            "fullSummary": self._cap_summary(data.get("fullSummary", "")),
            "keyStrengths": data.get("keyStrengths", []),
            "watchPoints": data.get("watchPoints", [])
        }

    def _cap_summary(self, text: str) -> str:
        if not text:
            return ""
        # Cap at 450 characters (about 3-4 sentences max), ensuring we end with a complete sentence
        if len(text) <= 450:
            return text
        import re
        truncated = text[:450]
        # Find last sentence boundary (. ! ?)
        match = re.search(r'.*[\.\!\?]', truncated)
        if match:
            return match.group(0).strip()
        return truncated.strip()

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
