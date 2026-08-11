from typing import Dict, Any, List
import json
from app.pipelines.candidate.base_task import BaseTask
from app.pipelines.candidate.context import PipelineContext
from app.core.services.claude_service import ClaudeService
from app.pipelines.shared.ai.prompts.candidate_prompt_factory import CandidatePromptFactory

class SkillTreeGenerator(BaseTask):
    @property
    def name(self) -> str:
        return "L2-016"

    @property
    def task_name(self) -> str:
        return "SkillTreeGenerator"

    @property
    def dependencies(self) -> List[str]:
        # Depends on Skill Taxonomy Mapper, Skill Proficiency Estimator, and Experience Confidence Multiplier
        return ["L2-001", "L2-002", "L2-011"]

    @property
    def input_keys(self) -> List[str]:
        return ["mappedSkills", "skillProficiencies", "cv", "repositoryAssessments", "totalExperienceMonths"]

    @property
    def output_keys(self) -> List[str]:
        return ["skillTree"]

    def __init__(self):
        self.claude_service = ClaudeService()
        self.prompt_factory = CandidatePromptFactory()

    async def _execute_internal(self, context: PipelineContext, correlation_id: str) -> Dict[str, Any]:
        mapped_skills = context.mappedSkills or []
        skill_proficiencies = context.skillProficiencies or []
        cv = context.cv or {}
        repo_assessments = context.repositoryAssessments or []
        total_exp = context.totalExperienceMonths or 0.0

        legacy_inputs = context.to_legacy_dict()
        enriched_inputs = {
            **legacy_inputs,
            "mappedSkills": [s.model_dump() if hasattr(s, "model_dump") else s for s in mapped_skills],
            "skillProficiencies": [s.model_dump() if hasattr(s, "model_dump") else s for s in skill_proficiencies],
            "totalExperienceMonths": total_exp,
        }

        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_skill_tree_generator_prompt(enriched_inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        
        data = self._extract_json(raw)

        # Handle wrapper if present and sanitize recursively
        raw_payload = data.get("skillTree", data)
        skill_tree_payload = self._sanitize_tree(raw_payload)

        return {
            "skillTree": skill_tree_payload
        }

    def _sanitize_tree(self, payload: Any) -> Any:
        if isinstance(payload, list):
            return [self._sanitize_node(item) for item in payload if isinstance(item, dict)]
        elif isinstance(payload, dict):
            return self._sanitize_node(payload)
        return payload

    def _sanitize_node(self, node: Dict[str, Any]) -> Dict[str, Any]:
        node_id = str(node.get("id") or "skill-node")
        display_name = node.get("displayName")
        if not display_name:
            slug_part = node_id.split("/")[-1]
            display_name = slug_part.replace("-", " ").replace("_", " ").title()

        category = node.get("category") or "Technology"
        proficiency = node.get("proficiencyLevel") or "Working"
        
        confidence = node.get("confidenceScore")
        if confidence is None or not isinstance(confidence, (int, float)):
            confidence = 0.5
        else:
            confidence = float(confidence)

        exp = node.get("estimatedExperience")
        if exp is None or not isinstance(exp, (int, float)):
            exp = 0.0
        else:
            exp = float(exp)

        raw_children = node.get("children") or []
        sanitized_children = []
        if isinstance(raw_children, list):
            for child in raw_children:
                if isinstance(child, dict):
                    sanitized_children.append(self._sanitize_node(child))

        return {
            "id": node_id,
            "parentId": node.get("parentId"),
            "displayName": display_name,
            "category": category,
            "proficiencyLevel": proficiency,
            "confidenceScore": confidence,
            "estimatedExperience": exp,
            "supportingEvidence": node.get("supportingEvidence"),
            "children": sanitized_children,
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
