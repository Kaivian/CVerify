import json
import logging
import time
from typing import Any, Dict, Optional

from app.core.services.claude_service import ClaudeService
from app.core.clients.repo_intelligence_client import RepoIntelligenceClient
from app.pipelines.shared.ai.prompts.candidate_prompt_factory import CandidatePromptFactory
from app.core.monitoring.observability import trace_stage, TraceContext
from app.pipelines.candidate.skill_taxonomy import normalize_batch, get_taxonomy_hints
from app.pipelines.candidate.tendency_rules import get_primary_tendency, score_tendencies
from app.pipelines.candidate.working_style_rules import get_primary_working_style, score_working_styles

logger = logging.getLogger("candidate_evaluation_orchestrator")

# Line 1 artifact keys that Line 2 fetches from the database.
# These must NOT be passed as inputs in the request body.
_LINE1_ARTIFACT_KEYS = frozenset({
    "repoIntelligenceReport",
    "skillEvidenceGraph",
    "commitTimelineData",
    "commitIntentData",
})

_CANDIDATE_L2_TASK_NAMES = {
    "SkillTaxonomyMapper", "SkillProficiencyEstimator", "StrengthWeaknessAnalyzer",
    "CareerLevelMapper", "CareerLevelCalibrator", "CareerLevelGate",
    "EngineeringMaturityAssessor", "ProblemSolvingAnalyzer", "TechnicalTendencyClassifier",
    "WorkingStyleClassifier", "ExperienceConfidenceMultiplier", "MultiRoleRecommendationEngine",
    "CandidateSummaryGenerator", "CandidateProfileComposer",
}

TASK_ALIASES: dict[str, str] = {
    "L2-001": "SkillTaxonomyMapper",
    "L2-002": "SkillProficiencyEstimator",
    "L2-003": "StrengthWeaknessAnalyzer",
    "L2-004": "CareerLevelMapper",
    "L2-005": "CareerLevelCalibrator",
    "L2-006": "CareerLevelGate",
    "L2-007": "EngineeringMaturityAssessor",
    "L2-008": "ProblemSolvingAnalyzer",
    "L2-009": "TechnicalTendencyClassifier",
    "L2-010": "WorkingStyleClassifier",
    "L2-011": "ExperienceConfidenceMultiplier",
    "L2-012": "MultiRoleRecommendationEngine",
    "L2-013": "CandidateSummaryGenerator",
    "L2-014": "CandidateProfileComposer",
}


def is_line2_task(task_type: str) -> bool:
    return task_type in TASK_ALIASES or task_type in _CANDIDATE_L2_TASK_NAMES


class CandidateEvaluationOrchestrator:
    def __init__(
        self,
        repo_intelligence_client: Optional[RepoIntelligenceClient] = None,
    ) -> None:
        self.claude_service = ClaudeService()
        self.prompt_factory = CandidatePromptFactory()
        self._repo_client = repo_intelligence_client or RepoIntelligenceClient()

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
                "message": f"Line 2 task {task_type} completed successfully."
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
        logger.info(f"Executing Line 2 task {normalized} for job {job_id}", extra=extra)

        TraceContext.set(pipeline_stage=normalized, is_sampled=True, extra={
            "jobId": job_id, "taskType": normalized, "correlationId": correlation_id
        })

        # Guard: reject any caller that still passes Line 1 data directly in inputs.
        # Line 1 artifacts must come from the database, not from the request body.
        forbidden = _LINE1_ARTIFACT_KEYS & set(inputs.keys())
        if forbidden:
            logger.warning(
                "Line 2 task %s received Line 1 artifact keys directly in inputs: %s. "
                "These will be ignored and fetched from the database instead.",
                normalized, forbidden, extra=extra
            )
            inputs = {k: v for k, v in inputs.items() if k not in _LINE1_ARTIFACT_KEYS}

        # Fetch all Line 1 artifacts from the CVerify.Core database.
        # Tasks that do not need a particular artifact will receive None, which
        # they handle via .get(..., {}) / .get(..., []) defaults.
        line1_artifacts = await self._repo_client.fetch_line1_artifacts(job_id)
        logger.info(
            "Line 1 artifacts loaded for job %s: %s",
            job_id,
            {k: "ok" if v else "missing" for k, v in line1_artifacts.items()},
            extra=extra,
        )

        # Merge Line 1 artifacts into the working inputs dict.
        # Line 2 inter-task data (from previous L2 steps) in `inputs` is preserved.
        merged_inputs = {**inputs, **{k: v for k, v in line1_artifacts.items() if v is not None}}

        try:
            if normalized == "SkillTaxonomyMapper":
                result = await self._skill_taxonomy_mapper(job_id, merged_inputs, correlation_id)
            elif normalized == "SkillProficiencyEstimator":
                result = await self._skill_proficiency_estimator(job_id, merged_inputs, correlation_id)
            elif normalized == "StrengthWeaknessAnalyzer":
                result = await self._strength_weakness_analyzer(job_id, merged_inputs, correlation_id)
            elif normalized == "CareerLevelMapper":
                result = await self._career_level_mapper(job_id, merged_inputs, correlation_id)
            elif normalized == "CareerLevelCalibrator":
                result = await self._career_level_calibrator(job_id, merged_inputs, correlation_id)
            elif normalized == "CareerLevelGate":
                result = await self._career_level_gate(job_id, merged_inputs, correlation_id)
            elif normalized == "EngineeringMaturityAssessor":
                result = await self._engineering_maturity_assessor(job_id, merged_inputs, correlation_id)
            elif normalized == "ProblemSolvingAnalyzer":
                result = await self._problem_solving_analyzer(job_id, merged_inputs, correlation_id)
            elif normalized == "TechnicalTendencyClassifier":
                result = await self._technical_tendency_classifier(job_id, merged_inputs, correlation_id)
            elif normalized == "WorkingStyleClassifier":
                result = await self._working_style_classifier(job_id, merged_inputs, correlation_id)
            elif normalized == "ExperienceConfidenceMultiplier":
                result = await self._experience_confidence_multiplier(job_id, merged_inputs, correlation_id)
            elif normalized == "MultiRoleRecommendationEngine":
                result = await self._multi_role_recommendation(job_id, merged_inputs, correlation_id)
            elif normalized == "CandidateSummaryGenerator":
                result = await self._candidate_summary_generator(job_id, merged_inputs, correlation_id)
            elif normalized == "CandidateProfileComposer":
                result = await self._candidate_profile_composer(job_id, merged_inputs, correlation_id)
            else:
                raise ValueError(f"Unknown Line 2 task type: {task_type}")
            return result
        except Exception as e:
            logger.exception(f"Error in Line 2 task {normalized}: {e}", extra=extra)
            return self._err(task_type, job_id, e)

    # ── L2-001 ────────────────────────────────────────────────────────────────

    @trace_stage("SkillTaxonomyMapper")
    async def _skill_taxonomy_mapper(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        # Pre-normalize raw skill names from the evidence graph using the taxonomy dictionary
        skill_graph = inputs.get("skillEvidenceGraph", {})
        cv_skills = inputs.get("cvSkills", [])

        raw_skill_names: list[str] = []
        nodes = skill_graph.get("nodes", []) if isinstance(skill_graph, dict) else []
        for node in nodes:
            name = node.get("data", {}).get("name") or node.get("id", "")
            if name:
                raw_skill_names.append(name)
        raw_skill_names += [s for s in cv_skills if isinstance(s, str)]

        pre_normalized = normalize_batch(raw_skill_names)
        taxonomy_hints = get_taxonomy_hints()

        enriched_inputs = {
            **inputs,
            "preNormalizedSkills": pre_normalized,
            "taxonomyHints": taxonomy_hints,
        }

        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_skill_taxonomy_mapper_prompt(enriched_inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        data = self._extract_json(raw, correlation_id)

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

        return self._ok(data, telemetry, "SkillTaxonomyMapper")

    # ── L2-002 ────────────────────────────────────────────────────────────────

    @trace_stage("SkillProficiencyEstimator")
    async def _skill_proficiency_estimator(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_skill_proficiency_estimator_prompt(inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        data = self._extract_json(raw, correlation_id)
        return self._ok(data, telemetry, "SkillProficiencyEstimator")

    # ── L2-003 ────────────────────────────────────────────────────────────────

    @trace_stage("StrengthWeaknessAnalyzer")
    async def _strength_weakness_analyzer(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_strength_weakness_prompt(inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        data = self._extract_json(raw, correlation_id)
        return self._ok(data, telemetry, "StrengthWeaknessAnalyzer")

    # ── L2-004 ────────────────────────────────────────────────────────────────

    @trace_stage("CareerLevelMapper")
    async def _career_level_mapper(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_career_level_mapper_prompt(inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        data = self._extract_json(raw, correlation_id)
        return self._ok(data, telemetry, "CareerLevelMapper")

    # ── L2-005 ────────────────────────────────────────────────────────────────

    @trace_stage("CareerLevelCalibrator")
    async def _career_level_calibrator(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        candidate_score = float(inputs.get("candidateScore", 0))

        # Deterministic threshold calibration (per spec: score thresholds 20-45/46-65/66-82/83-92/93-100)
        deterministic_level, deterministic_label = _score_to_level(candidate_score)
        is_boundary = _is_boundary_score(candidate_score)

        enriched_inputs = {
            **inputs,
            "deterministicLevel": deterministic_level,
            "deterministicLevelLabel": deterministic_label,
            "isBoundaryCase": is_boundary,
        }

        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_career_level_calibrator_prompt(enriched_inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        data = self._extract_json(raw, correlation_id)

        # Enforce: AI must not violate threshold by more than 1 level unless strong evidence
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

        data["isBoundaryCase"] = is_boundary
        data.setdefault("confidenceInLevel", 0.85 if not is_boundary else 0.70)

        return self._ok(data, telemetry, "CareerLevelCalibrator")

    # ── L2-006 ────────────────────────────────────────────────────────────────

    @trace_stage("CareerLevelGate")
    async def _career_level_gate(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        # Rule-based gate with AI explanation
        calibrated_level = inputs.get("calibratedLevel", "L2")
        calibrated_score = inputs.get("calibratedScore", 0.0)
        level_evidence = inputs.get("levelEvidence", {})
        repo_report = inputs.get("repoIntelligenceReport", {})

        # Deterministic gate rules
        gate_violations = []
        final_level = calibrated_level

        patterns = repo_report.get("patterns", [])
        has_architecture_evidence = any(
            p.get("patternName", p.get("pattern", "")).lower() not in ("", "none", "unknown")
            for p in (patterns if isinstance(patterns, list) else [])
        )

        if calibrated_level == "L3" and not has_architecture_evidence:
            gate_violations.append("Senior level requires architecture evidence (design patterns, DI, system design). None detected.")
            final_level = "L2"

        if calibrated_level == "L4":
            l4_evidence = level_evidence.get("L4", [])
            if not l4_evidence:
                gate_violations.append("Staff level requires platform/infrastructure or cross-service evidence.")
                final_level = "L3"

        gate_passed = len(gate_violations) == 0

        level_map = {"L1": "Junior", "L2": "Middle", "L3": "Senior", "L4": "Staff", "L5": "Principal"}

        if gate_passed:
            rationale = f"All gate requirements met for {calibrated_level} ({level_map.get(calibrated_level, calibrated_level)})."
        else:
            rationale = f"Gate downgrade from {calibrated_level} to {final_level}: " + " ".join(gate_violations)

        # Generate AI explanation for the gate decision
        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_career_level_gate_prompt({**inputs, "gateViolations": gate_violations})
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        ai_data = self._extract_json(raw, correlation_id)

        # Override AI verdict with deterministic gate result
        ai_data["gatePassed"] = gate_passed
        ai_data["finalLevel"] = final_level
        ai_data["finalLevelLabel"] = level_map.get(final_level, final_level)
        ai_data["finalScore"] = calibrated_score
        ai_data["gateViolations"] = gate_violations
        if not gate_passed:
            ai_data["gateRationale"] = rationale

        return self._ok(ai_data, telemetry, "CareerLevelGate")

    # ── L2-007 ────────────────────────────────────────────────────────────────

    @trace_stage("EngineeringMaturityAssessor")
    async def _engineering_maturity_assessor(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_engineering_maturity_prompt(inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        data = self._extract_json(raw, correlation_id)
        return self._ok(data, telemetry, "EngineeringMaturityAssessor")

    # ── L2-008 ────────────────────────────────────────────────────────────────

    @trace_stage("ProblemSolvingAnalyzer")
    async def _problem_solving_analyzer(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_problem_solving_prompt(inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        data = self._extract_json(raw, correlation_id)
        return self._ok(data, telemetry, "ProblemSolvingAnalyzer")

    # ── L2-009 ────────────────────────────────────────────────────────────────

    @trace_stage("TechnicalTendencyClassifier")
    async def _technical_tendency_classifier(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        # Rule-based layer: score tendencies from detected technologies and skills
        repo_report = inputs.get("repoIntelligenceReport", {})
        tech_stack = repo_report.get("techStack", {}) if isinstance(repo_report, dict) else {}
        detected_technologies = tech_stack.get("frameworks", []) + [tech_stack.get("primaryLanguage", "")]
        detected_technologies += tech_stack.get("languages", {}).keys() if isinstance(tech_stack.get("languages"), dict) else []

        skill_proficiencies = inputs.get("skillProficiencies", [])
        skill_names = [sp.get("skill", "") for sp in (skill_proficiencies if isinstance(skill_proficiencies, list) else [])]

        commit_languages = tech_stack.get("languages", {}) if isinstance(tech_stack.get("languages"), dict) else None

        rule_primary, rule_confidence, rule_ranked = get_primary_tendency(
            detected_technologies, skill_names, commit_languages
        )

        # Enrich inputs with rule-based pre-scores for AI refinement
        enriched_inputs = {
            **inputs,
            "ruleBased": {
                "primaryTendency": rule_primary,
                "primaryConfidence": round(rule_confidence, 3),
                "tendencyRanking": rule_ranked[:5],
            },
        }

        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_technical_tendency_prompt(enriched_inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        data = self._extract_json(raw, correlation_id)

        # Hybrid merge: if AI confidence is low (<0.5) and rule confidence is high (>0.7),
        # use rule-based result as the primary
        ai_confidence = float(data.get("primaryConfidence", 0))
        if ai_confidence < 0.5 and rule_confidence > 0.7:
            data["primaryTendency"] = rule_primary
            data["primaryConfidence"] = round(rule_confidence, 3)
            data.setdefault("tendencyRanking", rule_ranked)
            data["_hybridSource"] = "rule_override"
        else:
            data["_hybridSource"] = "ai_primary"
            data["_ruleBasedPrimary"] = rule_primary

        return self._ok(data, telemetry, "TechnicalTendencyClassifier")

    # ── L2-010 ────────────────────────────────────────────────────────────────

    @trace_stage("WorkingStyleClassifier")
    async def _working_style_classifier(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        # Rule-based layer: infer working style from commit distribution
        commit_intent = inputs.get("commitIntentData", {})
        commit_timeline = inputs.get("commitTimelineData", {})

        # Extract commit messages from both sources
        commit_messages: list[str] = []
        if isinstance(commit_intent, dict):
            commit_messages += commit_intent.get("commitMessages", [])
            # Also accept flat list of dicts with 'message' key
            for item in commit_intent.get("commits", []):
                if isinstance(item, dict):
                    commit_messages.append(item.get("message", ""))
        if isinstance(commit_timeline, dict):
            for item in commit_timeline.get("commits", []):
                if isinstance(item, dict):
                    commit_messages.append(item.get("message", ""))

        branch_names: list[str] = []
        if isinstance(commit_intent, dict):
            branch_names = commit_intent.get("branchNames", [])

        rule_primary, rule_confidence, rule_distribution = get_primary_working_style(
            commit_messages, branch_names
        )

        enriched_inputs = {
            **inputs,
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
        data = self._extract_json(raw, correlation_id)

        # If we had enough commits to be confident, trust rule-based primary
        if len(commit_messages) >= 20 and rule_confidence >= 0.5:
            ai_style_confidence = float(data.get("styleConfidence", 0))
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

        return self._ok(data, telemetry, "WorkingStyleClassifier")

    # ── L2-011 (deterministic rule-based) ────────────────────────────────────

    async def _experience_confidence_multiplier(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        working_experience = inputs.get("workingExperience", [])

        total_months = 0
        is_leadership = False
        for exp in (working_experience if isinstance(working_experience, list) else []):
            duration = exp.get("durationMonths", 0)
            total_months += duration
            if exp.get("isLeadership", False):
                is_leadership = True

        years = total_months / 12.0

        # Confidence multiplier formula (1.0x base, max 1.25x)
        if years >= 5:
            multiplier = 1.25
        elif years >= 3:
            multiplier = 1.20
        elif years >= 1:
            multiplier = 1.10
        else:
            multiplier = 1.0

        if is_leadership:
            multiplier = min(multiplier + 0.05, 1.25)

        data = {
            "confidenceMultiplier": round(multiplier, 2),
            "totalExperienceMonths": total_months,
            "totalExperienceYears": round(years, 1),
            "hasLeadershipExperience": is_leadership,
            "multiplierRationale": (
                f"{round(years, 1)} years of experience"
                f"{' including leadership roles' if is_leadership else ''}. "
                f"Confidence boost: {round((multiplier - 1.0) * 100, 0):.0f}%."
            )
        }
        return self._ok(data, None, "ExperienceConfidenceMultiplier")

    # ── L2-012 ────────────────────────────────────────────────────────────────

    @trace_stage("MultiRoleRecommendationEngine")
    async def _multi_role_recommendation(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_multi_role_recommendation_prompt(inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        data = self._extract_json(raw, correlation_id)
        return self._ok(data, telemetry, "MultiRoleRecommendationEngine")

    # ── L2-013 ────────────────────────────────────────────────────────────────

    @trace_stage("CandidateSummaryGenerator")
    async def _candidate_summary_generator(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        system = self.prompt_factory.get_system_prompt()
        user = self.prompt_factory.get_candidate_summary_prompt(inputs)
        raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
        data = self._extract_json(raw, correlation_id)
        return self._ok(data, telemetry, "CandidateSummaryGenerator")

    # ── L2-014 (rule-based aggregation) ──────────────────────────────────────

    async def _candidate_profile_composer(self, job_id: str, inputs: dict, correlation_id: str) -> dict:
        # Aggregate all L2 task outputs into the final Candidate Profile
        skill_score = float(inputs.get("skillDepthScore", 0.0))
        ownership_score = float(inputs.get("ownershipScore", 0.0))
        architecture_score = float(inputs.get("architectureScore", 0.0))
        problem_solving_score = float(inputs.get("problemSolvingScore", 0.0))
        impact_score = float(inputs.get("impactScore", 0.0))

        # Formula: Skill×35% + Ownership×25% + Architecture×20% + ProblemSolving×12% + Impact×8%
        candidate_score = (
            skill_score * 0.35
            + ownership_score * 0.25
            + architecture_score * 0.20
            + problem_solving_score * 0.12
            + impact_score * 0.08
        )
        candidate_score = round(min(max(candidate_score, 0.0), 100.0), 2)

        confidence_multiplier = float(inputs.get("confidenceMultiplier", 1.0))

        data = {
            "schemaVersion": "candidate-profile-v1",
            "candidateScore": candidate_score,
            "candidateScoreLabel": _score_to_label(candidate_score),
            "careerLevel": inputs.get("finalLevel", "L2"),
            "careerLevelLabel": inputs.get("finalLevelLabel", "Middle"),
            "careerLevelConfidence": inputs.get("confidenceInLevel", 0.8),
            "confidenceMultiplier": confidence_multiplier,
            "displayConfidence": round(min(inputs.get("confidenceInLevel", 0.8) * confidence_multiplier, 1.0), 2),
            "primaryTendency": inputs.get("primaryTendency", ""),
            "tendencyConfidence": inputs.get("primaryConfidence", 0.0),
            "primaryWorkingStyle": inputs.get("primaryWorkingStyle", ""),
            "strongestDomains": inputs.get("strongestDomains", []),
            "skillGaps": inputs.get("skillGaps", []),
            "skillProficiencies": inputs.get("skillProficiencies", []),
            "engineeringMaturityScore": inputs.get("engineeringMaturityScore", 0.0),
            "problemSolvingScore": problem_solving_score,
            "topRoleMatch": inputs.get("topMatch", {}),
            "suggestedRoles": inputs.get("suggestedRoles", []),
            "recruiterHeadline": inputs.get("recruiterHeadline", ""),
            "fullSummary": inputs.get("fullSummary", ""),
            "keyStrengths": inputs.get("keyStrengths", []),
            "watchPoints": inputs.get("watchPoints", []),
            "scoreBreakdown": {
                "skillDepth": {"score": skill_score, "weight": 0.35},
                "ownership": {"score": ownership_score, "weight": 0.25},
                "architecture": {"score": architecture_score, "weight": 0.20},
                "problemSolving": {"score": problem_solving_score, "weight": 0.12},
                "impact": {"score": impact_score, "weight": 0.08},
            }
        }
        return self._ok(data, None, "CandidateProfileComposer")


def _score_to_label(score: float) -> str:
    if score >= 93:
        return "Principal"
    if score >= 83:
        return "Staff"
    if score >= 66:
        return "Senior"
    if score >= 46:
        return "Middle"
    return "Junior"


_LEVEL_ORDER = ["L1", "L2", "L3", "L4", "L5"]
_LEVEL_LABELS = {"L1": "Junior", "L2": "Middle", "L3": "Senior", "L4": "Staff", "L5": "Principal"}


def _score_to_level(score: float) -> tuple[str, str]:
    """Map a numeric score to (level_code, level_label) per threshold spec."""
    if score >= 93:
        level = "L5"
    elif score >= 83:
        level = "L4"
    elif score >= 66:
        level = "L3"
    elif score >= 46:
        level = "L2"
    else:
        level = "L1"
    return level, _LEVEL_LABELS[level]


def _is_boundary_score(score: float, margin: float = 3.0) -> bool:
    """True if the score is within `margin` points of a level boundary."""
    boundaries = [46.0, 66.0, 83.0, 93.0]
    return any(abs(score - b) <= margin for b in boundaries)


def _is_adjacent_or_same_level(level_a: str, level_b: str) -> bool:
    """True if the two level codes are the same or one step apart."""
    if level_a not in _LEVEL_ORDER or level_b not in _LEVEL_ORDER:
        return True  # unknown level — don't override
    idx_a = _LEVEL_ORDER.index(level_a)
    idx_b = _LEVEL_ORDER.index(level_b)
    return abs(idx_a - idx_b) <= 1
