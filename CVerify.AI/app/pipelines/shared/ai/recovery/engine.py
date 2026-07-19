import time
import logging
from typing import Dict, Any, List, Optional, Tuple

from app.pipelines.shared.ai.recovery.policies import TaskRecoveryPolicy, get_policy_rules
from app.pipelines.shared.ai.recovery.circuit_breaker import PipelineCircuitBreaker
from app.pipelines.shared.ai.recovery.audit import RecoveryAuditLogger, AuditEntry
from app.pipelines.shared.ai.validation.validator import TaskOutputValidator, ValidationResult
from app.pipelines.shared.ai.prompts.repair_prompt import RepairPromptFactory
from app.core.services.claude_service import ClaudeService

logger = logging.getLogger("recovery_engine")

class RecoveryEngine:
    def __init__(
        self,
        claude_service: Optional[ClaudeService] = None,
        audit_logger: Optional[RecoveryAuditLogger] = None,
        circuit_breaker: Optional[PipelineCircuitBreaker] = None
    ):
        self.claude_service = claude_service or ClaudeService()
        self.audit_logger = audit_logger or RecoveryAuditLogger()
        self.circuit_breaker = circuit_breaker or PipelineCircuitBreaker()

    async def attempt_recovery(
        self,
        raw_text: str,
        validation_result: ValidationResult,
        output_keys: List[str],
        task_id: str,
        task_name: str,
        policy: TaskRecoveryPolicy,
        context: Any,
        correlation_id: str = "system"
    ) -> Tuple[Optional[Dict[str, Any]], Optional[AuditEntry]]:
        start_time = time.time()
        rules = get_policy_rules(policy)
        repair_diffs: List[Dict[str, Any]] = []

        parsed_data = validation_result.data or {}

        # -------------------------------------------------------------
        # TIER 1: Structural Repair (Zero LLM cost)
        # -------------------------------------------------------------
        if rules.allow_structural_repair and parsed_data:
            structural_repaired, diffs = self._tier1_structural_repair(parsed_data, output_keys)
            if diffs:
                repair_diffs.extend(diffs)
                parsed_data = structural_repaired
                # Re-validate
                re_val = self._revalidate(parsed_data, output_keys)
                if re_val.is_valid:
                    audit_entry = self.audit_logger.log_recovery(
                        task_id=task_id,
                        task_name=task_name,
                        policy_enforced=policy.value,
                        recovery_strategy="STRUCTURAL_REPAIR",
                        original_raw=raw_text,
                        repaired_output=parsed_data,
                        repair_diff=repair_diffs,
                        reason=f"Successfully repaired structural wrapping/casing errors: {re_val.errors}",
                        duration_ms=(time.time() - start_time) * 1000.0
                    )
                    return parsed_data, audit_entry

        # -------------------------------------------------------------
        # TIER 2: Deterministic Field Hydration (From context)
        # -------------------------------------------------------------
        if rules.allow_deterministic_hydration:
            hydrated_data, hydration_diffs = self._tier2_deterministic_hydration(parsed_data, output_keys, context)
            if hydration_diffs:
                repair_diffs.extend(hydration_diffs)
                parsed_data = hydrated_data
                re_val = self._revalidate(parsed_data, output_keys)
                if re_val.is_valid:
                    audit_entry = self.audit_logger.log_recovery(
                        task_id=task_id,
                        task_name=task_name,
                        policy_enforced=policy.value,
                        recovery_strategy="DETERMINISTIC_HYDRATION",
                        original_raw=raw_text,
                        repaired_output=parsed_data,
                        repair_diff=repair_diffs,
                        reason="Successfully hydrated missing non-critical attributes from pipeline context.",
                        duration_ms=(time.time() - start_time) * 1000.0
                    )
                    return parsed_data, audit_entry

        # -------------------------------------------------------------
        # TIER 3: Targeted AI Repair Pass (Zero-temp LLM call)
        # -------------------------------------------------------------
        if rules.allow_ai_repair_pass and self.circuit_breaker.can_attempt_ai_repair():
            logger.info(f"Triggering AI Repair Pass for task {task_id} under policy {policy.value}")
            try:
                self.circuit_breaker.record_ai_repair()
                sys_prompt = RepairPromptFactory.get_repair_system_prompt()
                usr_prompt = RepairPromptFactory.get_repair_user_prompt(raw_text, output_keys, validation_result.errors)
                
                ai_repaired_raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(
                    sys_prompt, usr_prompt, correlation_id
                )
                
                ai_parsed, parse_err = TaskOutputValidator.extract_and_parse_json(ai_repaired_raw)
                if ai_parsed:
                    re_val = self._revalidate(ai_parsed, output_keys)
                    if re_val.is_valid:
                        repair_diffs.append({"strategy": "AI_REPAIR_PASS", "repairedRaw": ai_repaired_raw[:500]})
                        audit_entry = self.audit_logger.log_recovery(
                            task_id=task_id,
                            task_name=task_name,
                            policy_enforced=policy.value,
                            recovery_strategy="AI_REPAIR_PASS",
                            original_raw=raw_text,
                            repaired_output=ai_parsed,
                            repair_diff=repair_diffs,
                            reason="Successfully repaired JSON schema via zero-temperature AI Repair Pass.",
                            duration_ms=(time.time() - start_time) * 1000.0,
                            token_cost_impact=telemetry or {}
                        )
                        return ai_parsed, audit_entry
            except Exception as ex:
                logger.warning(f"AI Repair Pass failed for task {task_id}: {ex}")

        # If all permitted tiers fail:
        return None, None

    def _tier1_structural_repair(self, data: Dict[str, Any], output_keys: List[str]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        repaired = dict(data)
        diffs = []

        # 1. Unwrap nested keys if response put everything inside "data", "result", "payload", etc.
        for wrapper_key in ["data", "result", "payload", "output", "response"]:
            if wrapper_key in repaired and isinstance(repaired[wrapper_key], dict):
                inner_dict = repaired[wrapper_key]
                if any(k in inner_dict for k in output_keys):
                    diffs.append({"field": wrapper_key, "action": "unwrapped_nested_dict"})
                    repaired.update(inner_dict)
                    break

        # 2. Case normalization (e.g. camelCase vs snake_case)
        existing_keys = list(repaired.keys())
        for req_key in output_keys:
            if req_key not in repaired:
                req_lower = req_key.lower().replace("_", "")
                for k in existing_keys:
                    if k.lower().replace("_", "") == req_lower:
                        repaired[req_key] = repaired[k]
                        diffs.append({"field": req_key, "action": "case_normalization", "from": k})
                        break

        # 3. Single object/item unwrap or list wrapping
        for req_key in output_keys:
            if req_key in repaired:
                val = repaired[req_key]
                # If key expects a list but receives a single dict/str
                if req_key in ["mappedSkills", "skillProficiencies", "suggestedRoles", "keyStrengths", "watchPoints"]:
                    if isinstance(val, dict):
                        repaired[req_key] = [val]
                        diffs.append({"field": req_key, "action": "wrapped_dict_into_list"})
                    elif isinstance(val, str):
                        repaired[req_key] = [{"name": val}]
                        diffs.append({"field": req_key, "action": "wrapped_str_into_list"})

        return repaired, diffs

    def _tier2_deterministic_hydration(self, data: Dict[str, Any], output_keys: List[str], context: Any) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        repaired = dict(data)
        diffs = []

        for req_key in output_keys:
            if req_key not in repaired or repaired[req_key] is None:
                # Hydrate empty list outputs
                if req_key in ["unmatchedCvSkills", "gateViolations", "maturitySignals", "problemSolvingPatterns", "keyStrengths", "watchPoints"]:
                    repaired[req_key] = []
                    diffs.append({"field": req_key, "action": "hydrated_default_empty_list"})
                # Hydrate mappedSkills from cvSkills if completely missing
                elif req_key == "mappedSkills" and hasattr(context, "cvSkills") and context.cvSkills:
                    hydrated = []
                    for s in context.cvSkills:
                        hydrated.append({
                            "rawName": getattr(s, "originalName", str(s)),
                            "normalizedName": getattr(s, "normalizedName", str(s)),
                            "skillId": getattr(s, "skillId", f"skill:{s}"),
                            "sfiaCategory": "Software Development",
                            "onetCode": "15-1252.00",
                            "evidenceStrength": "weak",
                            "declaredInCv": True
                        })
                    repaired["mappedSkills"] = hydrated
                    diffs.append({"field": "mappedSkills", "action": "hydrated_mapped_skills_from_cv"})

        return repaired, diffs

    def _revalidate(self, data: Dict[str, Any], output_keys: List[str]) -> ValidationResult:
        missing = [k for k in output_keys if k not in data or data[k] is None]
        return ValidationResult(is_valid=len(missing) == 0, data=data, errors=missing, raw_text="")
