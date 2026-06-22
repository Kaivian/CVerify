from typing import Dict, Any, List
import json
import logging
from app.pipelines.candidate.base_task import BaseTask
from app.pipelines.candidate.context import PipelineContext
from app.core.services.claude_service import ClaudeService
from app.pipelines.shared.ai.prompts.candidate_prompt_factory import CandidatePromptFactory
from app.pipelines.candidate.tendency_rules import get_primary_tendency
from app.pipelines.candidate.working_style_rules import get_primary_working_style

logger = logging.getLogger("classifiers_task")

class TechnicalTendencyClassifier(BaseTask):
    @property
    def name(self) -> str:
        return "L2-009"

    @property
    def task_name(self) -> str:
        return "TechnicalTendencyClassifier"

    @property
    def dependencies(self) -> List[str]:
        return ["L2-002", "L2-003"]

    @property
    def input_keys(self) -> List[str]:
        return ["skillProficiencies", "strongestDomains", "repoIntelligenceReport"]

    @property
    def output_keys(self) -> List[str]:
        return ["primaryTendency", "primaryConfidence", "tendencyRanking", "tendencySummary", "_hybridSource", "_ruleBasedPrimary"]

    def __init__(self):
        self.claude_service = ClaudeService()
        self.prompt_factory = CandidatePromptFactory()

    async def _execute_internal(self, context: PipelineContext, correlation_id: str) -> Dict[str, Any]:
        # Rule-based calculation
        repo_report = context.repoIntelligenceReport or {}
        tech_stack = repo_report.get("techStack", {})
        detected_technologies = tech_stack.get("frameworks", []) + [tech_stack.get("primaryLanguage", "")]
        detected_technologies += list(tech_stack.get("languages", {}).keys()) if isinstance(tech_stack.get("languages"), dict) else []
        
        skill_proficiencies = context.skillProficiencies or []
        skill_names = [sp.get("skill", "") for sp in skill_proficiencies]
        commit_languages = tech_stack.get("languages", {}) if isinstance(tech_stack.get("languages"), dict) else None

        rule_primary, rule_confidence, rule_ranked = get_primary_tendency(
            detected_technologies, skill_names, commit_languages
        )

        legacy_inputs = context.to_legacy_dict()
        enriched_inputs = {
            **legacy_inputs,
            "ruleBased": {
                "primaryTendency": rule_primary,
                "primaryConfidence": round(rule_confidence, 3),
                "tendencyRanking": rule_ranked[:5],
            },
        }

        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_technical_tendency_prompt(enriched_inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        
        data = self._extract_json(raw)
        
        def safe_float(val: Any, default: float) -> float:
            if val is None:
                return default
            try:
                return float(val)
            except (ValueError, TypeError):
                return default

        ai_confidence = safe_float(data.get("primaryConfidence"), 0.0)
        
        if ai_confidence < 0.5 and rule_confidence > 0.7:
            data["primaryTendency"] = rule_primary
            data["primaryConfidence"] = round(rule_confidence, 3)
            data.setdefault("tendencyRanking", rule_ranked)
            data["_hybridSource"] = "rule_override"
        else:
            data["_hybridSource"] = "ai_primary"
            
        data["_ruleBasedPrimary"] = rule_primary
        
        return {
            "primaryTendency": data.get("primaryTendency", rule_primary),
            "primaryConfidence": safe_float(data.get("primaryConfidence"), rule_confidence),
            "tendencyRanking": data.get("tendencyRanking", rule_ranked),
            "tendencySummary": data.get("tendencySummary", ""),
            "_hybridSource": data.get("_hybridSource", "fallback"),
            "_ruleBasedPrimary": rule_primary
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


class WorkingStyleClassifier(BaseTask):
    @property
    def name(self) -> str:
        return "L2-010"

    @property
    def task_name(self) -> str:
        return "WorkingStyleClassifier"

    @property
    def dependencies(self) -> List[str]:
        return ["L2-003"]

    @property
    def input_keys(self) -> List[str]:
        return ["problemsInputs", "maturityInputs", "strongestDomains"]

    @property
    def output_keys(self) -> List[str]:
        return ["primaryWorkingStyle", "styleConfidence", "styleDistribution", "workingStyleSummary", "_hybridSource", "_ruleBasedStyle"]

    def __init__(self):
        self.claude_service = ClaudeService()
        self.prompt_factory = CandidatePromptFactory()

    async def _execute_internal(self, context: PipelineContext, correlation_id: str) -> Dict[str, Any]:
        problems_inputs = context.problemsInputs or {}
        maturity_inputs = context.maturityInputs or {}

        commit_messages: List[str] = []
        if isinstance(problems_inputs, dict):
            commit_messages += problems_inputs.get("commitMessages", [])
            for item in problems_inputs.get("commits", []):
                if isinstance(item, dict):
                    commit_messages.append(item.get("message", ""))
        if isinstance(maturity_inputs, dict):
            for item in maturity_inputs.get("commits", []):
                if isinstance(item, dict):
                    commit_messages.append(item.get("message", ""))

        branch_names: List[str] = []
        if isinstance(problems_inputs, dict):
            branch_names = problems_inputs.get("branchNames", [])

        rule_primary, rule_confidence, rule_distribution = get_primary_working_style(
            commit_messages, branch_names
        )

        legacy_inputs = context.to_legacy_dict()
        enriched_inputs = {
            **legacy_inputs,
            "ruleBased": {
                "primaryWorkingStyle": rule_primary,
                "styleConfidence": round(rule_confidence, 3),
                "styleDistribution": rule_distribution,
                "analyzedCommitCount": len(commit_messages),
            },
        }

        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_working_style_prompt(enriched_inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        
        data = self._extract_json(raw)
        
        valid_styles = {
            "Feature Builder",
            "System Designer",
            "Problem Solver",
            "Maintenance Engineer",
            "Performance Optimizer",
            "Research-Oriented"
        }
        primary_style = data.get("primaryWorkingStyle")
        if primary_style not in valid_styles:
            logger.warning(
                f"AI returned invalid/unclassifiable working style '{primary_style}'. "
                f"Falling back to rule-based: '{rule_primary}'"
            )
            data["primaryWorkingStyle"] = rule_primary
            raw_conf = data.get("styleConfidence", 0.1)
            try:
                conf_val = float(raw_conf)
            except (ValueError, TypeError):
                conf_val = 0.1
            data["styleConfidence"] = min(0.3, max(0.1, conf_val))
            data["_hybridSource"] = "fallback_unclassifiable"

        def safe_float(val: Any, default: float) -> float:
            if val is None:
                return default
            try:
                return float(val)
            except (ValueError, TypeError):
                return default

        if data.get("_hybridSource") == "fallback_unclassifiable":
            data["_ruleBasedStyle"] = rule_primary
        elif len(commit_messages) >= 20 and rule_confidence >= 0.5:
            ai_style_confidence = safe_float(data.get("styleConfidence"), 0.0)
            if ai_style_confidence < 0.4:
                data["primaryWorkingStyle"] = rule_primary
                data["styleConfidence"] = round(rule_confidence, 3)
                data.setdefault("styleDistribution", rule_distribution)
                data["_hybridSource"] = "rule_override"
            else:
                data["_hybridSource"] = "ai_primary"
                data["_ruleBasedStyle"] = rule_primary
        else:
            data["_hybridSource"] = "ai_primary_insufficient_commits"
            data["_ruleBasedStyle"] = rule_primary

        return {
            "primaryWorkingStyle": data.get("primaryWorkingStyle", rule_primary),
            "styleConfidence": safe_float(data.get("styleConfidence"), rule_confidence),
            "styleDistribution": data.get("styleDistribution", rule_distribution),
            "workingStyleSummary": data.get("workingStyleSummary", ""),
            "_hybridSource": data.get("_hybridSource", "fallback"),
            "_ruleBasedStyle": rule_primary
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
