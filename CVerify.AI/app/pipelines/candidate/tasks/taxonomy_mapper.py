from typing import Dict, Any, List
import json
from app.pipelines.candidate.base_task import BaseTask
from app.pipelines.candidate.context import PipelineContext
from app.core.services.claude_service import ClaudeService
from app.pipelines.shared.ai.prompts.candidate_prompt_factory import CandidatePromptFactory
from app.pipelines.candidate.skill_taxonomy import normalize_batch, get_taxonomy_hints

class SkillTaxonomyMapper(BaseTask):
    @property
    def name(self) -> str:
        return "L2-001"

    @property
    def task_name(self) -> str:
        return "SkillTaxonomyMapper"

    @property
    def input_keys(self) -> List[str]:
        return ["cvSkills", "skillEvidenceGraph", "cv"]

    @property
    def output_keys(self) -> List[str]:
        return ["mappedSkills", "unmatchedCvSkills"]

    def __init__(self):
        self.claude_service = ClaudeService()
        self.prompt_factory = CandidatePromptFactory()

    async def _execute_internal(self, context: PipelineContext, correlation_id: str) -> Dict[str, Any]:
        skill_graph = context.skillEvidenceGraph
        cv_skills = context.cvSkills
        
        raw_skill_names: List[str] = []
        nodes = skill_graph.get("nodes", []) if isinstance(skill_graph, dict) else []
        for node in nodes:
            name = node.get("data", {}).get("name") or node.get("id", "")
            if name:
                raw_skill_names.append(name)
        raw_skill_names += [s for s in cv_skills if isinstance(s, str)]

        pre_normalized = normalize_batch(raw_skill_names)
        taxonomy_hints = get_taxonomy_hints()

        legacy_inputs = context.to_legacy_dict()
        enriched_inputs = {
            **legacy_inputs,
            "preNormalizedSkills": pre_normalized,
            "taxonomyHints": taxonomy_hints,
        }

        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_skill_taxonomy_mapper_prompt(enriched_inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        
        # Extract JSON using helper
        from app.pipelines.candidate.helpers import _get_normalized_name
        data = self._extract_json(raw)

        # Merge pre-normalized entries for skills the AI didn't cover
        ai_mapped_names = {s.get("rawName", "").lower() for s in data.get("mappedSkills", [])}
        for pre in pre_normalized:
            if pre["rawName"].lower() not in ai_mapped_names and pre["found"]:
                data.setdefault("mappedSkills", []).append({
                    "rawName": pre["rawName"],
                    "normalizedName": pre["normalizedName"],
                    "sfiaCategory": pre["sfiaCategory"],
                    "onetCode": pre["onetCode"],
                    "evidenceStrength": "weak",
                    "declaredInCv": pre["rawName"] in cv_skills,
                    "_source": "taxonomy_dictionary",
                })

        return {
            "mappedSkills": data.get("mappedSkills", []),
            "unmatchedCvSkills": data.get("unmatchedCvSkills", [])
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
