import json
import logging
import time
from typing import Any, Dict

from app.core.services.claude_service import ClaudeService
from app.pipelines.shared.ai.prompts.matching_prompt_factory import MatchingPromptFactory
from app.core.monitoring.observability import trace_stage, TraceContext

logger = logging.getLogger("jd_matching_orchestrator")

_JD_L3_TASK_NAMES = {
    "JdFieldValidator", "AiJdGenerator", "JdStorageService",
    "SkillMatchCalculator", "ResponsibilityMatchEngine", "SeniorityMatchCalculator",
    "CandidateSalaryFields", "SalaryMatchCalculator", "CultureRoleFitAnalyzer",
    "MatchScoreAggregator", "MatchScoreCapRule", "GapAnalysisEngine",
    "ApplicationQualityGate", "HiringRecommendationGenerator",
}

TASK_ALIASES: dict[str, str] = {
    "L3-002": "JdFieldValidator",
    "L3-003": "AiJdGenerator",
    "L3-004": "JdStorageService",
    "L3-005": "SkillMatchCalculator",
    "L3-006": "ResponsibilityMatchEngine",
    "L3-007": "SeniorityMatchCalculator",
    "L3-008": "CandidateSalaryFields",
    "L3-009": "SalaryMatchCalculator",
    "L3-010": "CultureRoleFitAnalyzer",
    "L3-011": "MatchScoreAggregator",
    "L3-012": "MatchScoreCapRule",
    "L3-013": "GapAnalysisEngine",
    "L3-015": "HiringRecommendationGenerator",
}


def is_line3_task(task_type: str) -> bool:
    return task_type in TASK_ALIASES or task_type in _JD_L3_TASK_NAMES


class JdMatchingOrchestrator:
    def __init__(self):
        self.claude_service = ClaudeService()
        self.prompt_factory = MatchingPromptFactory()

    def _extract_json(self, text: str, correlation_id: str) -> dict:
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

    def _ok(self, data: dict, telemetry: Any, task_type: str) -> dict:
        return {
            "status": "Completed",
            "errorMessage": None,
            "schemaVersion": "2.0.0",
            "resultData": json.dumps(data),
            "telemetry": telemetry,
            "events": [{
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "level": "Info",
                "eventType": "StepCompleted",
                "message": f"Line 3 task {task_type} completed successfully."
            }]
        }

    def _err(self, task_type: str, job_id: str, e: Exception) -> dict:
        err_str = str(e).lower()
        if "rate limit" in err_str or "429" in err_str:
            code, retry = "RATE_LIMIT_EXCEEDED", True
        elif "timeout" in err_str:
            code, retry = "TIMEOUT", True
        elif "json" in err_str or "parse" in err_str:
            code, retry = "PARSING_ERROR", False
        else:
            code, retry = "UNKNOWN_ERROR", True
        return {
            "status": "Failed",
            "errorMessage": str(e),
            "errorCode": code,
            "retryable": retry,
            "taskId": task_type,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "schemaVersion": "2.0.0",
            "resultData": None,
            "telemetry": None,
            "events": [{
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "level": "Error",
                "eventType": "AI_TASK_FAILED",
                "message": str(e)
            }]
        }

    async def execute_task(
        self,
        task_type: str,
        job_id: str,
        inputs: Dict[str, Any],
        correlation_id: str = "system"
    ) -> dict:
        normalized = TASK_ALIASES.get(task_type, task_type)
        extra = {"correlation_id": correlation_id, "job_id": job_id, "task_type": normalized}
        logger.info(f"Executing Line 3 task {normalized} for job {job_id}", extra=extra)

        TraceContext.set(pipeline_stage=normalized, is_sampled=True, extra={
            "jobId": job_id, "taskType": normalized, "correlationId": correlation_id
        })

        try:
            if normalized == "JdFieldValidator":
                result = await self._jd_field_validator(job_id, inputs, correlation_id)
            elif normalized == "AiJdGenerator":
                result = await self._ai_jd_generator(job_id, inputs, correlation_id)
            elif normalized == "JdStorageService":
                result = await self._jd_storage_service(job_id, inputs, correlation_id)
            elif normalized == "SkillMatchCalculator":
                result = await self._skill_match_calculator(job_id, inputs, correlation_id)
            elif normalized == "ResponsibilityMatchEngine":
                result = await self._responsibility_match_engine(job_id, inputs, correlation_id)
            elif normalized == "SeniorityMatchCalculator":
                result = await self._seniority_match_calculator(job_id, inputs, correlation_id)
            elif normalized == "CandidateSalaryFields":
                result = await self._candidate_salary_fields(job_id, inputs, correlation_id)
            elif normalized == "SalaryMatchCalculator":
                result = await self._salary_match_calculator(job_id, inputs, correlation_id)
            elif normalized == "CultureRoleFitAnalyzer":
                result = await self._culture_role_fit_analyzer(job_id, inputs, correlation_id)
            elif normalized == "MatchScoreAggregator":
                result = await self._match_score_aggregator(job_id, inputs, correlation_id)
            elif normalized == "MatchScoreCapRule":
                result = await self._match_score_cap_rule(job_id, inputs, correlation_id)
            elif normalized == "GapAnalysisEngine":
                result = await self._gap_analysis_engine(job_id, inputs, correlation_id)
            elif normalized == "HiringRecommendationGenerator":
                result = await self._hiring_recommendation_generator(job_id, inputs, correlation_id)
            else:
                raise ValueError(f"Unknown Line 3 task type: {task_type}")
            return result
        except Exception as e:
            logger.exception(f"Error in Line 3 task {normalized}: {e}", extra=extra)
            return self._err(task_type, job_id, e)

    # ── L3-002 JD Field Validator ─────────────────────────────────────────────

    @trace_stage("JdFieldValidator")
    async def _jd_field_validator(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_jd_validator_prompt(inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        data = self._extract_json(raw, correlation_id)
        return self._ok(data, telemetry, "JdFieldValidator")

    # ── L3-003 AI JD Generator ────────────────────────────────────────────────

    @trace_stage("AiJdGenerator")
    async def _ai_jd_generator(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_jd_generator_prompt(inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        data = self._extract_json(raw, correlation_id)
        return self._ok(data, telemetry, "AiJdGenerator")

    # ── L3-004 JD Storage Service (pass-through aggregation) ─────────────────

    async def _jd_storage_service(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        normalized_jd = inputs.get("normalizedJd", {})
        generated_text = inputs.get("generatedJdText", "")
        jd_id = inputs.get("jdId", f"jd-{job_id}")

        data = {
            "jdId": jd_id,
            "storedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "structuredJson": normalized_jd,
            "humanReadableText": generated_text,
            "storageStatus": "success"
        }
        return self._ok(data, None, "JdStorageService")

    # ── L3-005 Skill Match Calculator ─────────────────────────────────────────

    @trace_stage("SkillMatchCalculator")
    async def _skill_match_calculator(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_skill_match_prompt(inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        data = self._extract_json(raw, correlation_id)
        return self._ok(data, telemetry, "SkillMatchCalculator")

    # ── L3-006 Responsibility Match Engine ────────────────────────────────────

    @trace_stage("ResponsibilityMatchEngine")
    async def _responsibility_match_engine(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_responsibility_match_prompt(inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        data = self._extract_json(raw, correlation_id)
        return self._ok(data, telemetry, "ResponsibilityMatchEngine")

    # ── L3-007 Seniority Match Calculator (deterministic) ─────────────────────

    async def _seniority_match_calculator(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        level_map = {"Junior": 1, "Middle": 2, "Senior": 3, "Staff": 4, "Principal": 5,
                     "L1": 1, "L2": 2, "L3": 3, "L4": 4, "L5": 5}

        candidate_level = inputs.get("candidateLevel", "L2")
        jd_seniority = inputs.get("jdSeniority", "Middle")

        candidate_num = level_map.get(candidate_level, 2)
        jd_num = level_map.get(jd_seniority, 2)
        gap = candidate_num - jd_num  # positive = overqualified, negative = underqualified

        if gap == 0:
            score = 1.0
            flag = "exact_match"
        elif gap == -1:
            score = 0.7
            flag = "underqualified"
        elif gap <= -2:
            score = 0.3
            flag = "strongly_underqualified"
        elif gap == 1:
            score = 0.85
            flag = "overqualified"
        else:
            score = 0.6
            flag = "strongly_overqualified"

        data = {
            "seniorityMatchScore": score,
            "seniorityFlag": flag,
            "levelGap": gap,
            "seniorityMatchSummary": _seniority_summary(flag, candidate_level, jd_seniority)
        }
        return self._ok(data, None, "SeniorityMatchCalculator")

    # ── L3-008 Candidate Salary Fields (pass-through) ─────────────────────────

    async def _candidate_salary_fields(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        desired_salary = inputs.get("desiredSalary", 0)
        min_acceptable_salary = inputs.get("minAcceptableSalary", 0)
        currency = inputs.get("currency", "USD")

        # Normalize: ensure min ≤ desired
        if min_acceptable_salary > desired_salary and desired_salary > 0:
            min_acceptable_salary = desired_salary

        data = {
            "desiredSalary": desired_salary,
            "minAcceptableSalary": min_acceptable_salary,
            "currency": currency,
            "salaryFieldsUpdated": True
        }
        return self._ok(data, None, "CandidateSalaryFields")

    # ── L3-009 Salary Match Calculator (deterministic) ────────────────────────

    async def _salary_match_calculator(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        desired = float(inputs.get("desiredSalary", 0))
        min_acceptable = float(inputs.get("minAcceptableSalary", 0))
        jd_max = float(inputs.get("jdSalaryMax", 0))
        jd_min = float(inputs.get("jdSalaryMin", 0))

        # Formula from spec
        if jd_max <= 0:
            # No salary range in JD — neutral
            score = 1.0
            match_type = "no_jd_salary"
        elif desired <= jd_max:
            score = 1.0
            match_type = "perfect"
        elif min_acceptable <= jd_max:
            score = 0.6
            match_type = "negotiable"
        else:
            score = 0.0
            match_type = "hard_mismatch"

        data = {
            "salaryMatchScore": score,
            "salaryMatchType": match_type,
            "isHardMismatch": (score == 0.0),
            "salaryMatchSummary": _salary_summary(match_type, desired, min_acceptable, jd_min, jd_max)
        }
        return self._ok(data, None, "SalaryMatchCalculator")

    # ── L3-010 Culture / Role Fit Analyzer ───────────────────────────────────

    @trace_stage("CultureRoleFitAnalyzer")
    async def _culture_role_fit_analyzer(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_culture_fit_prompt(inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        data = self._extract_json(raw, correlation_id)
        return self._ok(data, telemetry, "CultureRoleFitAnalyzer")

    # ── L3-011 Match Score Aggregator (deterministic formula) ─────────────────

    async def _match_score_aggregator(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        skill = float(inputs.get("skillMatchScore", 0.0))
        responsibility = float(inputs.get("responsibilityMatchScore", 0.0))
        seniority = float(inputs.get("seniorityMatchScore", 0.0))
        salary = float(inputs.get("salaryMatchScore", 1.0))
        culture = float(inputs.get("cultureFitScore", 0.5))

        match_score = (
            skill * 0.35
            + responsibility * 0.25
            + seniority * 0.20
            + salary * 0.10
            + culture * 0.10
        )
        match_score = round(min(max(match_score, 0.0), 1.0), 4)
        match_score_pct = round(match_score * 100, 1)

        if match_score_pct >= 80:
            label = "Strong Match"
        elif match_score_pct >= 65:
            label = "Good Match"
        elif match_score_pct >= 50:
            label = "Partial Match"
        elif match_score_pct >= 35:
            label = "Weak Match"
        else:
            label = "Poor Match"

        data = {
            "matchScore": match_score,
            "matchScorePercent": match_score_pct,
            "matchLabel": label,
            "componentBreakdown": {
                "skill": {"score": skill, "weight": 0.35, "contribution": round(skill * 0.35, 4)},
                "responsibility": {"score": responsibility, "weight": 0.25, "contribution": round(responsibility * 0.25, 4)},
                "seniority": {"score": seniority, "weight": 0.20, "contribution": round(seniority * 0.20, 4)},
                "salary": {"score": salary, "weight": 0.10, "contribution": round(salary * 0.10, 4)},
                "culture": {"score": culture, "weight": 0.10, "contribution": round(culture * 0.10, 4)},
            }
        }
        return self._ok(data, None, "MatchScoreAggregator")

    # ── L3-012 Match Score Cap Rule (deterministic) ────────────────────────────

    async def _match_score_cap_rule(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        match_score = float(inputs.get("matchScore", 0.0))
        match_score_pct = float(inputs.get("matchScorePercent", 0.0))
        salary_score = float(inputs.get("salaryMatchScore", 1.0))
        skill_score = float(inputs.get("skillMatchScore", 0.0))
        seniority_flag = inputs.get("seniorityFlag", "exact_match")
        seniority_gap = abs(int(inputs.get("levelGap", 0)))

        flags = []
        cap_applied = False
        capped_score = match_score_pct

        # Rule 1: Hard salary mismatch → cap at 60%
        if salary_score == 0.0:
            if capped_score > 60.0:
                capped_score = 60.0
                cap_applied = True
            flags.append("SALARY_HARD_MISMATCH: Score capped at 60%")

        # Rule 2: Insufficient skills → flag
        if skill_score < 0.4:
            flags.append("INSUFFICIENT_SKILLS: Candidate skill coverage below 40% threshold")

        # Rule 3: Large seniority gap → flag
        if seniority_gap >= 2:
            flags.append(f"SENIORITY_GAP_{seniority_flag.upper()}: Level gap of {seniority_gap}")

        data = {
            "originalMatchScorePercent": match_score_pct,
            "cappedMatchScorePercent": capped_score,
            "capApplied": cap_applied,
            "activeFlags": flags,
            "isScreeningBlocked": (capped_score < 30.0 or salary_score == 0.0 and skill_score < 0.4),
            "capRuleSummary": _cap_summary(flags, cap_applied, capped_score)
        }
        return self._ok(data, None, "MatchScoreCapRule")

    # ── L3-013 Gap Analysis Engine ────────────────────────────────────────────

    @trace_stage("GapAnalysisEngine")
    async def _gap_analysis_engine(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_gap_analysis_prompt(inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        data = self._extract_json(raw, correlation_id)
        return self._ok(data, telemetry, "GapAnalysisEngine")

    # ── L3-015 Hiring Recommendation Generator ────────────────────────────────

    @trace_stage("HiringRecommendationGenerator")
    async def _hiring_recommendation_generator(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_hiring_recommendation_prompt(inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        data = self._extract_json(raw, correlation_id)

        # Enforce verdict rule deterministically
        match_pct = float(inputs.get("matchScorePercent", 0.0))
        salary_score = float(inputs.get("salaryMatchScore", 1.0))
        gap_severity = inputs.get("gapSeverity", "none")

        if match_pct >= 75 and salary_score > 0 and gap_severity not in ("critical", "significant"):
            enforced_verdict = "Yes"
        elif match_pct >= 50 or (gap_severity in ("minor", "none") and salary_score > 0):
            enforced_verdict = "Conditional"
        else:
            enforced_verdict = "No"

        data["verdict"] = enforced_verdict

        return self._ok(data, telemetry, "HiringRecommendationGenerator")


# ── Utility helpers ───────────────────────────────────────────────────────────

def _seniority_summary(flag: str, candidate: str, jd: str) -> str:
    if flag == "exact_match":
        return f"Candidate level ({candidate}) exactly matches JD seniority requirement ({jd})."
    if flag == "underqualified":
        return f"Candidate ({candidate}) is one level below JD requirement ({jd}). May need mentoring."
    if flag == "strongly_underqualified":
        return f"Candidate ({candidate}) is significantly below JD seniority ({jd}). Not recommended without upskilling plan."
    if flag == "overqualified":
        return f"Candidate ({candidate}) slightly exceeds JD seniority ({jd}). May seek more senior role."
    return f"Candidate ({candidate}) is significantly overqualified for JD seniority ({jd}). High flight risk."


def _salary_summary(match_type: str, desired: float, min_acc: float, jd_min: float, jd_max: float) -> str:
    if match_type == "no_jd_salary":
        return "No salary range specified in JD. Salary match is neutral."
    if match_type == "perfect":
        return f"Candidate desired salary (${desired:,.0f}) fits within JD range (${jd_min:,.0f}–${jd_max:,.0f})."
    if match_type == "negotiable":
        return (f"Candidate desired salary (${desired:,.0f}) exceeds JD max (${jd_max:,.0f}), "
                f"but minimum acceptable (${min_acc:,.0f}) fits. Negotiation possible.")
    return (f"Hard salary mismatch: Candidate minimum (${min_acc:,.0f}) exceeds JD max (${jd_max:,.0f}). "
            f"Score capped at 60%.")


def _cap_summary(flags: list, cap_applied: bool, capped_score: float) -> str:
    if not flags:
        return "No cap rules triggered. Match score stands as calculated."
    summary = f"Cap rules applied. Final score: {capped_score:.1f}%. "
    summary += " | ".join(flags)
    return summary
