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
        return ["recruiterHeadline", "fullSummary", "professionalBio", "keyStrengths", "watchPoints"]

    def __init__(self):
        self.claude_service = ClaudeService()
        self.prompt_factory = CandidatePromptFactory()

    async def _execute_internal(self, context: PipelineContext, correlation_id: str) -> Dict[str, Any]:
        enriched_inputs = {
            **context.to_legacy_dict(),
            "topMatchRole": (context.topMatch or {}).get("roleTitle", ""),
            "engineeringMaturitySummary": context.maturitySummary or "",
            "problemSolvingSummary": context.problemSolvingSummary or ""
        }
        
        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_candidate_summary_prompt(enriched_inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        
        data = self._extract_json(raw)
        full_summary = self._cap_summary(data.get("fullSummary", ""))
        raw_bio = data.get("professionalBio", "")
        validated_bio = self._validate_and_fallback_bio(full_summary, raw_bio, context)

        return {
            "recruiterHeadline": data.get("recruiterHeadline", ""),
            "fullSummary": full_summary,
            "professionalBio": validated_bio,
            "keyStrengths": data.get("keyStrengths", []),
            "watchPoints": data.get("watchPoints", [])
        }

    def _cap_summary(self, text: str) -> str:
        if not text:
            return ""
        # Cap at 1000 characters, ensuring we end with a complete sentence
        if len(text) <= 1000:
            return text
        import re
        truncated = text[:1000]
        # Find last sentence boundary (. ! ?)
        match = re.search(r'.*[\.\!\?]', truncated)
        if match:
            return match.group(0).strip()
        return truncated.strip()

    def _cap_bio(self, text: str) -> str:
        if not text:
            return ""
        # Cap at 500 characters, ensuring we end with a complete sentence
        if len(text) <= 500:
            return text
        import re
        truncated = text[:500]
        # Find last sentence boundary (. ! ?)
        match = re.search(r'.*[\.\!\?]', truncated)
        if match:
            return match.group(0).strip()
        return truncated.strip()

    def _validate_and_fallback_bio(self, full_summary: str, bio: str, context: PipelineContext) -> str:
        if not bio or not isinstance(bio, str):
            return self._generate_fallback_bio(context)

        # 1. Length validation (between 120 and 500 characters)
        bio = self._cap_bio(bio)
        if len(bio) < 120:
            return self._generate_fallback_bio(context)

        # 2. Banned terms check (internal metrics, evaluation terminology)
        import re
        banned_pattern = re.compile(
            r'\b(l[1-5]|score|metrics?|trust|percentile|cohorts?|cverify|watchpoints?|vetting|governance)\b',
            re.IGNORECASE
        )
        if banned_pattern.search(bio):
            return self._generate_fallback_bio(context)

        # 3. Similarity check (Jaccard similarity threshold 0.65)
        def get_words(text: str):
            clean = re.sub(r'[^\w\s]', '', text.lower())
            return set(clean.split())

        bio_words = get_words(bio)
        summary_words = get_words(full_summary)
        
        if bio_words and summary_words:
            intersection = bio_words.intersection(summary_words)
            union = bio_words.union(summary_words)
            similarity = len(intersection) / len(union)
            if similarity > 0.65:
                return self._generate_fallback_bio(context)

        return bio

    def _generate_fallback_bio(self, context: PipelineContext) -> str:
        level_label = context.finalLevelLabel or "Experienced"
        tendency = context.primaryTendency or "Software"
        working_style = context.primaryWorkingStyle or "Feature Builder"
        
        return (
            f"{level_label} {tendency} Engineer specializing in robust system development, "
            f"operating primarily as a {working_style}. Proven capability in designing, "
            f"building, and deploying clean, maintainable software architectures with high code standards."
        )

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
