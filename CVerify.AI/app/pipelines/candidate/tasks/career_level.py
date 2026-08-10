from typing import Dict, Any, List, Tuple, Optional, Callable, Awaitable
import json
import math
from app.pipelines.candidate.base_task import BaseTask
from app.pipelines.candidate.context import PipelineContext, PipelineEvent
from app.core.services.claude_service import ClaudeService
from app.pipelines.shared.ai.prompts.candidate_prompt_factory import CandidatePromptFactory

def calculate_vector_scores(context: PipelineContext) -> Dict[str, float]:
    """Computes the unbounded multi-dimensional capability vector dimensions."""
    # 1. Skill Depth (Logarithmic)
    a_sd, b_sd = 22.0, 0.05
    raw_skills = 0.0
    cv_skills = [s.normalizedName for s in context.cvSkills]
    skill_proficiencies = context.skillProficiencies or []
    repository_assessments = context.repositoryAssessments or []
    
    # Get unique skill names from repository attributions to evaluate Skill Depth
    unique_repo_skills = set()
    for ra in repository_assessments:
        for attr in ra.get("skillAttributions", []):
            sname = attr.get("skillName")
            if sname:
                unique_repo_skills.add(sname)

    all_skills = list(set(cv_skills) | unique_repo_skills)
    
    from app.pipelines.candidate.helpers import _get_normalized_name
    for skill_name in all_skills:
        prof = next((p for p in skill_proficiencies if p.get("skill", "").lower() == skill_name.lower()), None)
        supporting_repos = []
        norm_skill_name = _get_normalized_name(skill_name)
        for ra in repository_assessments:
            for attr in ra.get("skillAttributions", []):
                if _get_normalized_name(attr.get("skillName", "")) == norm_skill_name:
                    supporting_repos.append(ra)
        if prof and supporting_repos:
            raw_skills += float(prof.get("proficiencyLevel", 1.0)) * 25.0
            
    sd_score = a_sd * math.log1p(b_sd * raw_skills)

    # 2. Ownership (Logarithmic Scale - authoritative formula matching scoring_policy)
    a_own, b_own = 22.0, 0.2
    raw_ownership = 0.0
    for ra in repository_assessments:
        repo_score = 0.0
        capabilities = ra.get("capabilities") or []
        for cap in capabilities:
            diff_score = float(cap.get("difficultyScore", 1.0))
            if diff_score <= 1.0:
                diff_score *= 10.0
            
            maturity = cap.get("maturity", "Basic")
            maturity_mult = 0.5 if maturity == "Basic" else 1.0 if maturity == "Intermediate" else 1.5 if maturity == "Advanced" else 2.0
            repo_score += diff_score * maturity_mult
            
        sig = ra.get("intelligenceSignal", {})
        ownership_signal = float(sig.get("ownershipSignal", 0.0))
        if ownership_signal > 1.0:
            ownership_signal /= 100.0
        if ownership_signal == 0.0:
            ownership_signal = 1.0
            
        raw_ownership += ownership_signal * repo_score
        
    ownership_score = a_own * math.log1p(b_own * raw_ownership)

    # 3. Architecture (Exponential Pattern Index)
    base_arch_score = 0.0
    unique_arch_caps = {}
    for ra in repository_assessments:
        for cap in ra.get("capabilities", []):
            diff = float(cap.get("difficultyScore", 1.0))
            if diff <= 1.0:
                diff *= 10.0
            if diff >= 5.0:
                cname = cap.get("name", "").lower()
                if not cname:
                    continue
                maturity = cap.get("maturity", "Basic")
                mult = 0.5 if maturity == "Basic" else 1.0 if maturity == "Intermediate" else 1.5 if maturity == "Advanced" else 2.0
                cap_score = diff * 10.0 * mult
                if cname not in unique_arch_caps or cap_score > unique_arch_caps[cname]:
                    unique_arch_caps[cname] = cap_score
                    
    base_arch_score = sum(unique_arch_caps.values())
    
    patterns_detected = set()
    for ra in repository_assessments:
        for p in ra.get("verifiedPatterns", ra.get("patterns", [])):
            pname = p if isinstance(p, str) else p.get("patternName", "")
            if pname:
                patterns_detected.add(pname.lower())
                
    m_arch = 1.0
    if any(p in patterns_detected for p in ["dependency injection", "ioc", "interfaces"]):
        m_arch += 0.25
    if any(p in patterns_detected for p in ["cqrs", "hexagonal", "clean architecture"]):
        m_arch += 0.35
    if any(p in patterns_detected for p in ["telemetry", "middleware", "logging"]):
        m_arch += 0.15
        
    arch_score = base_arch_score * math.exp(m_arch - 1.0)

    # 4. Problem Solving (Sigmoid Complexity Scaling)
    ps_raw = 0.0
    k_ps = 0.1
    severity_threshold = 2.0
    for ra in repository_assessments:
        qm = ra.get("qualityMetrics", {})
        complexity = float(qm.get("complexityScore", 50.0)) / 10.0
        ps_raw += complexity / (1.0 + math.exp(-k_ps * (complexity - severity_threshold)))
        
    problem_solving_score = ps_raw * 10.0

    # 5. Impact (Power-Law Growth)
    total_months = 0.0
    experiences = context.cv.get("experiences", [])
    for exp in experiences:
        total_months += float(exp.get("durationMonths", 0))
    if total_months == 0:
        total_months = 12.0
        
    company_scale = 1.0
    role_scale = 1.0
    for exp in experiences:
        desc = str(exp.get("description", "")).lower()
        company = str(exp.get("company", "")).lower()
        if any(term in desc or term in company for term in ["google", "apple", "facebook", "meta", "netflix", "amazon", "microsoft"]):
            company_scale = 1.25
        title = str(exp.get("jobTitle", "")).lower()
        if "principal" in title or "director" in title or "head" in title:
            role_scale = max(role_scale, 1.6)
        elif "staff" in title or "lead" in title or "manager" in title:
            role_scale = max(role_scale, 1.4)
        elif "senior" in title:
            role_scale = max(role_scale, 1.2)
            
    impact_score = 10.0 * (total_months ** 0.4) * company_scale * role_scale

    return {
        "skillDepthScore": round(sd_score, 2),
        "ownershipScore": round(ownership_score, 2),
        "architectureScore": round(arch_score, 2),
        "problemSolvingScore": round(problem_solving_score, 2),
        "impactScore": round(impact_score, 2),
        "rawSkillDepth": round(raw_skills, 2),
        "rawOwnership": round(raw_ownership, 2),
        "rawArchitecture": round(base_arch_score, 2),
        "rawProblemSolving": round(ps_raw, 2),
        "rawImpact": round(total_months, 2)
    }


class CareerLevelMapper(BaseTask):
    @property
    def name(self) -> str:
        return "L2-004"

    @property
    def task_name(self) -> str:
        return "CareerLevelMapper"

    @property
    def dependencies(self) -> List[str]:
        return ["L2-002", "L2-003"]

    @property
    def input_keys(self) -> List[str]:
        return ["repoIntelligenceReport", "cv", "skillProficiencies", "strongestDomains"]

    @property
    def output_keys(self) -> List[str]:
        return [
            "candidateScore", "estimatedLevel", "estimatedLevelLabel",
            "scoreBreakdown", "levelEvidence", "levelRationale",
            "skillDepthScore", "ownershipScore", "architectureScore",
            "problemSolvingScore", "impactScore",
            "rawSkillDepth", "rawOwnership", "rawArchitecture",
            "rawProblemSolving", "rawImpact"
        ]

    def __init__(self):
        self.claude_service = ClaudeService()
        self.prompt_factory = CandidatePromptFactory()

    async def _execute_internal(
        self,
        context: PipelineContext,
        correlation_id: str,
        event_callback: Optional[Callable[[PipelineEvent], Awaitable[None]]] = None
    ) -> Dict[str, Any]:
        vector_scores = calculate_vector_scores(context)
        
        legacy_inputs = context.to_legacy_dict()
        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_career_level_mapper_prompt(legacy_inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        
        data = self._extract_json(raw)
        cand_score_val = data.get("candidateScore")
        try:
            cand_score = float(cand_score_val) if cand_score_val is not None else 50.0
        except (ValueError, TypeError):
            cand_score = 50.0
        est_level = data.get("estimatedLevel", "L2")
        est_label = data.get("estimatedLevelLabel", "Middle")

        if event_callback:
            import time
            for dimension, val in vector_scores.items():
                short_dim = dimension.replace("Score", "")
                await event_callback(PipelineEvent(
                    eventType="DIMENSION_SCORE_UPDATED",
                    timestamp=time.time(),
                    correlationId=correlation_id,
                    taskId=self.name,
                    payload={"dimension": short_dim, "value": val},
                    stateSnapshot={"partialScore": cand_score, "estimatedLevel": est_level}
                ))
            await event_callback(PipelineEvent(
                eventType="SCORE_DELTA_UPDATED",
                timestamp=time.time(),
                correlationId=correlation_id,
                taskId=self.name,
                payload={"candidateScore": cand_score, "delta": 0.0},
                stateSnapshot={"partialScore": cand_score, "estimatedLevel": est_level}
            ))
            await event_callback(PipelineEvent(
                eventType="LEVEL_ESTIMATE_UPDATED",
                timestamp=time.time(),
                correlationId=correlation_id,
                taskId=self.name,
                payload={"level": est_level, "label": est_label},
                stateSnapshot={"partialScore": cand_score, "estimatedLevel": est_level}
            ))

        updates = {
            "candidateScore": cand_score,
            "estimatedLevel": est_level,
            "estimatedLevelLabel": est_label,
            "scoreBreakdown": data.get("scoreBreakdown", {}),
            "levelEvidence": data.get("levelEvidence", {}),
            "levelRationale": data.get("levelRationale", ""),
            **vector_scores
        }
        return updates

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


class CareerLevelCalibrator(BaseTask):
    @property
    def name(self) -> str:
        return "L2-005"

    @property
    def task_name(self) -> str:
        return "CareerLevelCalibrator"

    @property
    def dependencies(self) -> List[str]:
        return ["L2-004"]

    @property
    def input_keys(self) -> List[str]:
        return ["candidateScore", "scoreBreakdown", "levelEvidence"]

    @property
    def output_keys(self) -> List[str]:
        return ["calibratedScore", "calibratedLevel", "calibratedLevelLabel", "confidenceInLevel", "isBoundaryCase", "calibrationNotes"]

    def __init__(self):
        self.claude_service = ClaudeService()
        self.prompt_factory = CandidatePromptFactory()

    async def _execute_internal(
        self,
        context: PipelineContext,
        correlation_id: str,
        event_callback: Optional[Callable[[PipelineEvent], Awaitable[None]]] = None
    ) -> Dict[str, Any]:
        candidate_score = float(context.candidateScore or 0.0)
        from app.pipelines.candidate.helpers import _score_to_level, _is_boundary_score, _is_adjacent_or_same_level

        deterministic_level, deterministic_label = _score_to_level(candidate_score)
        is_boundary = _is_boundary_score(candidate_score)

        legacy_inputs = context.to_legacy_dict()
        enriched_inputs = {
            **legacy_inputs,
            "deterministicLevel": deterministic_level,
            "deterministicLevelLabel": deterministic_label,
            "isBoundaryCase": is_boundary,
        }

        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_career_level_calibrator_prompt(enriched_inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        
        data = self._extract_json(raw)
        ai_level = data.get("calibratedLevel", deterministic_level)
        
        if not _is_adjacent_or_same_level(deterministic_level, ai_level):
            data["calibratedLevel"] = deterministic_level
            data["calibratedLevelLabel"] = deterministic_label
            data["calibratedScore"] = candidate_score
            data["calibrationNotes"] = (
                f"AI calibration ({ai_level}) overridden by threshold rule: "
                f"score {candidate_score:.1f} maps to {deterministic_level}. "
                + data.get("calibrationNotes", "")
            )

        cal_score_val = data.get("calibratedScore")
        try:
            cal_score = float(cal_score_val) if cal_score_val is not None else candidate_score
        except (ValueError, TypeError):
            cal_score = candidate_score
        cal_level = data.get("calibratedLevel", deterministic_level)
        cal_label = data.get("calibratedLevelLabel", deterministic_label)

        if event_callback:
            import time
            delta = cal_score - candidate_score
            await event_callback(PipelineEvent(
                eventType="SCORE_DELTA_UPDATED",
                timestamp=time.time(),
                correlationId=correlation_id,
                taskId=self.name,
                payload={"candidateScore": cal_score, "delta": round(delta, 2)},
                stateSnapshot={"partialScore": cal_score, "estimatedLevel": cal_level}
            ))
            await event_callback(PipelineEvent(
                eventType="LEVEL_ESTIMATE_UPDATED",
                timestamp=time.time(),
                correlationId=correlation_id,
                taskId=self.name,
                payload={"level": cal_level, "label": cal_label},
                stateSnapshot={"partialScore": cal_score, "estimatedLevel": cal_level}
            ))

        conf_val = data.get("confidenceInLevel")
        try:
            confidence = float(conf_val) if conf_val is not None else (0.85 if not is_boundary else 0.70)
        except (ValueError, TypeError):
            confidence = 0.85 if not is_boundary else 0.70

        return {
            "calibratedScore": cal_score,
            "calibratedLevel": cal_level,
            "calibratedLevelLabel": cal_label,
            "confidenceInLevel": confidence,
            "isBoundaryCase": data.get("isBoundaryCase", is_boundary),
            "calibrationNotes": data.get("calibrationNotes", "")
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


class CareerLevelGate(BaseTask):
    @property
    def name(self) -> str:
        return "L2-006"

    @property
    def task_name(self) -> str:
        return "CareerLevelGate"

    @property
    def dependencies(self) -> List[str]:
        return ["L2-005"]

    @property
    def input_keys(self) -> List[str]:
        return [
            "calibratedLevel", "calibratedScore", "levelEvidence", "repositoryAssessments",
            "architectureScore", "problemSolvingScore", "impactScore"
        ]

    @property
    def output_keys(self) -> List[str]:
        return ["gatePassed", "finalLevel", "finalLevelLabel", "finalScore", "gateViolations", "gateRationale"]

    def __init__(self):
        self.claude_service = ClaudeService()
        self.prompt_factory = CandidatePromptFactory()

    async def _execute_internal(
        self,
        context: PipelineContext,
        correlation_id: str,
        event_callback: Optional[Callable[[PipelineEvent], Awaitable[None]]] = None
    ) -> Dict[str, Any]:
        calibrated_level = context.calibratedLevel or "L2"
        calibrated_score = context.calibratedScore or 50.0
        
        gate_violations = []
        final_level = calibrated_level

        arch = context.architectureScore or 0.0
        ps = context.problemSolvingScore or 0.0
        imp = context.impactScore or 0.0

        if calibrated_level == "L3":
            if arch < 100.0:
                gate_violations.append(f"Senior level (L3) requires System Architecture score >= 100 (Detected: {arch:.1f}).")
                final_level = "L2"
            if ps < 80.0:
                gate_violations.append(f"Senior level (L3) requires Problem Solving score >= 80 (Detected: {ps:.1f}).")
                final_level = "L2"
                
        elif calibrated_level == "L4":
            if arch < 180.0:
                gate_violations.append(f"Staff level (L4) requires System Architecture score >= 180 (Detected: {arch:.1f}).")
                final_level = "L3"
            if imp < 110.0:
                gate_violations.append(f"Staff level (L4) requires Business Impact score >= 110 (Detected: {imp:.1f}).")
                final_level = "L3"
                
        elif calibrated_level == "L5":
            if arch < 250.0:
                gate_violations.append(f"Principal level (L5) requires System Architecture score >= 250 (Detected: {arch:.1f}).")
                final_level = "L4"
            if imp < 150.0:
                gate_violations.append(f"Principal level (L5) requires Business Impact score >= 150 (Detected: {imp:.1f}).")
                final_level = "L4"

        has_type1 = any(
            ra.get("cvVerificationLevel") == "AiAnalyzed" or ra.get("trustLevel") == 3
            for ra in (context.repositoryAssessments or [])
        )
        if final_level in ("L3", "L4", "L5") and not has_type1:
            gate_violations.append(
                "Seniority levels (L3+) require at least one verified Type 1 (AI Analyzed) repository. "
                "No Type 1 repository is linked."
            )
            final_level = "L2"

        gate_passed = len(gate_violations) == 0
        level_map = {"L1": "Junior", "L2": "Middle", "L3": "Senior", "L4": "Staff", "L5": "Principal"}
        final_lbl = level_map.get(final_level, final_level)
        
        if gate_passed:
            rationale = f"All vector floor gating requirements met for {calibrated_level}."
        else:
            rationale = f"Vector floor gate downgrade from {calibrated_level} to {final_level}: " + " ".join(gate_violations)

        legacy_inputs = context.to_legacy_dict()
        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_career_level_gate_prompt({**legacy_inputs, "gateViolations": gate_violations})
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        
        ai_data = self._extract_json(raw)
        ai_data["gatePassed"] = gate_passed
        ai_data["finalLevel"] = final_level
        ai_data["finalLevelLabel"] = final_lbl
        ai_data["finalScore"] = calibrated_score
        ai_data["gateViolations"] = gate_violations
        if not gate_passed:
            ai_data["gateRationale"] = rationale

        if event_callback:
            import time
            await event_callback(PipelineEvent(
                eventType="LEVEL_ESTIMATE_UPDATED",
                timestamp=time.time(),
                correlationId=correlation_id,
                taskId=self.name,
                payload={"level": final_level, "label": final_lbl},
                stateSnapshot={"partialScore": calibrated_score, "estimatedLevel": final_level}
            ))

        return ai_data

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
