from typing import Dict, Any, List
import json
from app.pipelines.candidate.base_task import BaseTask
from app.pipelines.candidate.context import PipelineContext
from app.core.services.claude_service import ClaudeService
from app.pipelines.shared.ai.prompts.candidate_prompt_factory import CandidatePromptFactory
from app.pipelines.candidate.skill_taxonomy import normalize_batch, get_taxonomy_hints, make_skill_id

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
        cv_skill_mappings = {}
        cv_skills_strings = []

        # Parse cvSkills (strictly CvSkill models)
        for s in cv_skills:
            original = s.originalName
            normalized = s.normalizedName
            skill_id = s.skillId
            raw_skill_names.append(original)
            cv_skills_strings.append(normalized)
            cv_skill_mappings[original.lower()] = {
                "rawName": original,
                "skillId": skill_id,
                "normalizedName": normalized,
                "sfiaCategory": "Software Development",
                "onetCode": "15-1252.00",
                "found": True
            }
            # Also map lowercase version of normalized name just in case
            cv_skill_mappings[normalized.lower()] = cv_skill_mappings[original.lower()]

        # Parse skill evidence graph nodes
        nodes = skill_graph.get("nodes", []) if isinstance(skill_graph, dict) else []
        for node in nodes:
            name = node.get("data", {}).get("name") or node.get("id", "")
            if name:
                raw_skill_names.append(name)

        # Remove duplicates preserving order
        seen_names = set()
        unique_raw_names = []
        for name in raw_skill_names:
            name_lower = name.lower()
            if name_lower not in seen_names:
                seen_names.add(name_lower)
                unique_raw_names.append(name)

        # Normalize via local taxonomy first
        pre_normalized = normalize_batch(unique_raw_names)
        
        # Override with DB-backed mappings passed from C# Core
        for item in pre_normalized:
            raw_lower = item["rawName"].lower()
            if raw_lower in cv_skill_mappings:
                mapping = cv_skill_mappings[raw_lower]
                item["skillId"] = mapping["skillId"]
                item["normalizedName"] = mapping["normalizedName"]
                item["found"] = True

        legacy_inputs = context.to_legacy_dict()
        enriched_inputs = {
            **legacy_inputs,
            "cvSkills": cv_skills_strings,
            "preNormalizedSkills": pre_normalized,
            "taxonomyHints": get_taxonomy_hints(),
        }

        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_skill_taxonomy_mapper_prompt(enriched_inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        
        # Extract JSON using helper
        data = self._extract_json(raw)

        # Backfill skillId for all AI mapped skills
        for item in data.get("mappedSkills", []):
            raw_name = item.get("rawName") or item.get("normalizedName") or ""
            raw_lower = raw_name.lower()
            
            pre_match = next((p for p in pre_normalized if p["rawName"].lower() == raw_lower), None)
            if pre_match:
                item["skillId"] = pre_match["skillId"]
                item["normalizedName"] = pre_match["normalizedName"]
            else:
                if raw_lower in cv_skill_mappings:
                    item["skillId"] = cv_skill_mappings[raw_lower]["skillId"]
                    item["normalizedName"] = cv_skill_mappings[raw_lower]["normalizedName"]
                elif not item.get("skillId"):
                    slug = make_skill_id(item.get("normalizedName") or raw_name)
                    item["skillId"] = f"skill:emerging-{slug}"

        # Merge pre-normalized entries for skills the AI didn't cover
        ai_mapped_names = {s.get("rawName", "").lower() for s in data.get("mappedSkills", [])}
        for pre in pre_normalized:
            if pre["rawName"].lower() not in ai_mapped_names and pre["found"]:
                data.setdefault("mappedSkills", []).append({
                    "rawName": pre["rawName"],
                    "normalizedName": pre["normalizedName"],
                    "skillId": pre["skillId"],
                    "sfiaCategory": pre["sfiaCategory"],
                    "onetCode": pre["onetCode"],
                    "evidenceStrength": "weak",
                    "declaredInCv": pre["rawName"].lower() in [c.lower() for c in cv_skills_strings],
                    "_source": "taxonomy_dictionary",
                })

        raw_unmatched = data.get("unmatchedCvSkills") or []
        unmatched = []
        if isinstance(raw_unmatched, list):
            for item in raw_unmatched:
                if isinstance(item, str):
                    unmatched.append(item)
                elif isinstance(item, dict):
                    name = item.get("skill") or item.get("name") or item.get("rawName")
                    if name and isinstance(name, str):
                        unmatched.append(name)
                    else:
                        found_str = False
                        for val in item.values():
                            if isinstance(val, str):
                                unmatched.append(val)
                                found_str = True
                                break
                        if not found_str:
                            unmatched.append(str(item))
                elif item is not None:
                    unmatched.append(str(item))
        elif isinstance(raw_unmatched, dict):
            for key in raw_unmatched.keys():
                if isinstance(key, str):
                    unmatched.append(key)
        elif isinstance(raw_unmatched, str):
            unmatched.append(raw_unmatched)

        return {
            "mappedSkills": data.get("mappedSkills", []),
            "unmatchedCvSkills": unmatched
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
