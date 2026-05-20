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

        # Hard seniority gate: L3+ cannot be satisfied by Type 3/Type 2 only. Must have Type 1 (AI Analyzed).
        repository_assessments = inputs.get("repositoryAssessments") or []
        has_type1 = any(
            ra.get("cvVerificationLevel") == "AiAnalyzed" or ra.get("trustLevel") == 3
            for ra in repository_assessments
        )

        if calibrated_level in ("L3", "L4", "L5") and not has_type1:
            gate_violations.append(
                "Seniority levels (L3+) require at least one verified Type 1 (AI Analyzed) repository. "
                "No Type 1 repository is attached to the CV."
            )
            final_level = "L2"

        patterns = repo_report.get("patterns", [])
        has_architecture_evidence = any(
            p.get("patternName", p.get("pattern", "")).lower() not in ("", "none", "unknown")
            for p in (patterns if isinstance(patterns, list) else [])
        )

        if final_level == "L3" and not has_architecture_evidence:
            gate_violations.append("Senior level requires architecture evidence (design patterns, DI, system design). None detected.")
            final_level = "L2"

        if final_level == "L4":
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

        # Validate that primaryWorkingStyle is one of the valid options
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
                f"AI returned invalid/unclassifiable working style '{primary_style}' for job {job_id}. "
                f"Falling back to rule-based: '{rule_primary}'"
            )
            data["primaryWorkingStyle"] = rule_primary
            # Map styleConfidence to a low-confidence neutral band (capped at 0.3)
            raw_conf = data.get("styleConfidence", 0.1)
            try:
                conf_val = float(raw_conf)
            except (ValueError, TypeError):
                conf_val = 0.1
            data["styleConfidence"] = min(0.3, max(0.1, conf_val))
            data["_hybridSource"] = "fallback_unclassifiable"

        # If we had enough commits to be confident, trust rule-based primary
        if data.get("_hybridSource") == "fallback_unclassifiable":
            data["_ruleBasedStyle"] = rule_primary
        elif len(commit_messages) >= 20 and rule_confidence >= 0.5:
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
        cv = inputs.get("cv") or {}
        working_experience = inputs.get("workingExperience", [])

        # Calculate discounted experience months based on CV and independent projects
        total_months = calculate_discounted_experience_months(cv)
        if total_months == 0:
            for exp in (working_experience if isinstance(working_experience, list) else []):
                total_months += float(exp.get("durationMonths", 0))

        is_leadership = False
        for exp in (working_experience if isinstance(working_experience, list) else []):
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
        import math
        import os
        import json

        cv = inputs.get("cv") or {}
        repository_assessments = inputs.get("repositoryAssessments") or []

        # Load scoring policy from scoring_policy.json
        policy_path = None
        curr_dir = os.path.dirname(os.path.abspath(__file__))
        for _ in range(10):
            candidate_path = os.path.join(curr_dir, "scoring_policy.json")
            if os.path.exists(candidate_path):
                policy_path = candidate_path
                break
            curr_dir = os.path.dirname(curr_dir)
            
        if not policy_path:
            # Fallback to defaults
            policy = {
                "dimensions": {
                  "skillDepth": {"weight": 0.35, "scale_A": 22.0, "scale_B": 0.05},
                  "ownership": {"weight": 0.25, "scale_A": 22.0, "scale_B": 0.2},
                  "architecture": {"weight": 0.20, "scale_A": 22.0, "scale_B": 0.05},
                  "problemSolving": {"weight": 0.12, "scale_A": 22.0, "scale_B": 0.1},
                  "impact": {"weight": 0.08, "scale_A": 20.0, "scale_B": 1.0}
                }
            }
        else:
            try:
                with open(policy_path, "r") as f:
                    policy = json.load(f)
            except Exception:
                policy = {
                    "dimensions": {
                      "skillDepth": {"weight": 0.35, "scale_A": 22.0, "scale_B": 0.05},
                      "ownership": {"weight": 0.25, "scale_A": 22.0, "scale_B": 0.2},
                      "architecture": {"weight": 0.20, "scale_A": 22.0, "scale_B": 0.05},
                      "problemSolving": {"weight": 0.12, "scale_A": 22.0, "scale_B": 0.1},
                      "impact": {"weight": 0.08, "scale_A": 20.0, "scale_B": 1.0}
                    }
                }

        dim_cfg = policy["dimensions"]
        w_sd, a_sd, b_sd = dim_cfg["skillDepth"]["weight"], dim_cfg["skillDepth"]["scale_A"], dim_cfg["skillDepth"]["scale_B"]
        w_own, a_own, b_own = dim_cfg["ownership"]["weight"], dim_cfg["ownership"]["scale_A"], dim_cfg["ownership"]["scale_B"]
        w_arch, a_arch, b_arch = dim_cfg["architecture"]["weight"], dim_cfg["architecture"]["scale_A"], dim_cfg["architecture"]["scale_B"]
        w_ps, a_ps, b_ps = dim_cfg["problemSolving"]["weight"], dim_cfg["problemSolving"]["scale_A"], dim_cfg["problemSolving"]["scale_B"]
        w_imp, a_imp, b_imp = dim_cfg["impact"]["weight"], dim_cfg["impact"]["scale_A"], dim_cfg["impact"]["scale_B"]

        # Parse basic intelligence properties from repos
        repo_scores = []
        max_difficulty_score = 0.0
        all_categories = set()
        
        scopes = []
        ownerships = []
        leaderships = []
        consistencies = []

        for ra in repository_assessments:
            repo_score = 0.0
            capabilities = ra.get("capabilities") or []
            for cap in capabilities:
                diff_score = float(cap.get("difficultyScore", 1.0))
                if diff_score <= 1.0:
                    diff_score *= 10.0
                max_difficulty_score = max(max_difficulty_score, diff_score)
                all_categories.add(cap.get("category", "other"))
                
                maturity = cap.get("maturity", "Basic")
                maturity_mult = 0.5 if maturity == "Basic" else 1.0 if maturity == "Intermediate" else 1.5 if maturity == "Advanced" else 2.0
                repo_score += diff_score * maturity_mult
                
            repo_scores.append(repo_score)
            
            sig = ra.get("intelligenceSignal") or {}
            scopes.append(float(sig.get("scopeSignal", 0.0)))
            ownerships.append(float(sig.get("ownershipSignal", 0.0)))
            leaderships.append(float(sig.get("leadershipSignal", 0.0)))
            consistencies.append(float(sig.get("consistencySignal", 0.0)))

        # 1. Skill Depth
        cv_skills = cv.get("skills", [])
        skill_proficiencies = inputs.get("skillProficiencies", [])
        raw_skills = 0.0
        for skill_name in cv_skills:
            prof = next((p for p in skill_proficiencies if p.get("skill", "").lower() == skill_name.lower()), None)
            supporting_repos = []
            for ra in repository_assessments:
                for attr in ra.get("skillAttributions", []):
                    if attr.get("skillName", "").lower() == skill_name.lower():
                        supporting_repos.append(ra)
            if prof and supporting_repos:
                raw_skills += float(prof.get("proficiencyLevel", 1.0)) * 25.0
                
        sd_score = int(round(a_sd * math.log1p(b_sd * raw_skills)))

        # 2. Repository Ownership
        raw_ownership = 0.0
        for idx, ra in enumerate(repository_assessments):
            sig = ra.get("intelligenceSignal") or {}
            ownership_signal = float(sig.get("ownershipSignal", 0.0))
            if ownership_signal > 1.0:
                ownership_signal /= 100.0
            if ownership_signal == 0.0:
                ownership_signal = 1.0
            raw_ownership += ownership_signal * repo_scores[idx]
            
        own_score = int(round(a_own * math.log1p(b_own * raw_ownership)))

        # 3. System Architecture
        unique_arch_caps = {}
        for ra in repository_assessments:
            capabilities = ra.get("capabilities") or []
            for cap in capabilities:
                diff_score = float(cap.get("difficultyScore", 1.0))
                if diff_score <= 1.0:
                    diff_score *= 10.0
                if diff_score >= 5.0:
                    cname = cap.get("name", "").lower()
                    if not cname:
                        continue
                    maturity = cap.get("maturity", "Basic")
                    maturity_mult = 0.5 if maturity == "Basic" else 1.0 if maturity == "Intermediate" else 1.5 if maturity == "Advanced" else 2.0
                    cap_score = diff_score * 10.0 * maturity_mult
                    if cname not in unique_arch_caps or cap_score > unique_arch_caps[cname]:
                        unique_arch_caps[cname] = cap_score
                        
        raw_architecture = sum(unique_arch_caps.values())
        arch_score = int(round(a_arch * math.log1p(b_arch * raw_architecture)))

        # 4. Problem Solving
        raw_solving = 0.0
        for ra in repository_assessments:
            sig = ra.get("intelligenceSignal") or {}
            consistency_signal = float(sig.get("consistencySignal", 50.0))
            ownership_signal = float(sig.get("ownershipSignal", 100.0))
            if ownership_signal > 1.0:
                ownership_signal /= 100.0
            
            quality_metrics = ra.get("qualityMetrics") or {}
            quality_score = float(quality_metrics.get("qualityScore", 50.0))
            
            raw_solving += (consistency_signal / 100.0) * quality_score * ownership_signal
            
        ps_score = int(round(a_ps * math.log1p(b_ps * raw_solving)))

        # 5. Engineering Business Impact
        exp_multiplier_data = inputs.get("confidenceMultiplier") or {}
        if not isinstance(exp_multiplier_data, dict):
            exp_multiplier_data = inputs
        total_months = float(exp_multiplier_data.get("totalExperienceMonths", 0))
        if total_months == 0:
            total_months = calculate_discounted_experience_months(cv)

        has_leadership = bool(exp_multiplier_data.get("hasLeadershipExperience", False))
        leadership_mult = 1.15 if has_leadership else 1.0

        max_company_scale = 1.0
        max_role_scale = 1.0
        for exp in cv.get("experiences", []):
            if any(term in str(exp.get("company", "")).lower() for term in ["google", "apple", "facebook", "meta", "netflix", "amazon", "microsoft"]):
                max_company_scale = 1.15
            title = str(exp.get("jobTitle", "")).lower()
            if "principal" in title or "director" in title or "head" in title:
                max_role_scale = max(max_role_scale, 1.6)
            elif "staff" in title or "lead" in title or "manager" in title:
                max_role_scale = max(max_role_scale, 1.4)
            elif "senior" in title:
                max_role_scale = max(max_role_scale, 1.2)
            elif "junior" in title or "intern" in title:
                max_role_scale = max(max_role_scale, 0.8)

        imp_score = int(round(math.log1p(b_imp * total_months) * max_company_scale * max_role_scale * leadership_mult * a_imp))

        # Overall Score: atomic recomputation from breakdown
        s_candidate = int(round(
            sd_score * w_sd +
            own_score * w_own +
            arch_score * w_arch +
            ps_score * w_ps +
            imp_score * w_imp
        ))

        # Trust score calculation
        verified_skills_set = set()
        for ra in repository_assessments:
            for attr in ra.get("skillAttributions", []):
                sname = attr.get("skillName")
                if sname:
                    verified_skills_set.add(sname.lower())

        matched_skills_count = sum(1 for s in cv_skills if str(s).lower() in verified_skills_set)
        r_skills = matched_skills_count / len(cv_skills) if cv_skills else 1.0

        verified_repos_count = 0
        for ra in repository_assessments:
            signal = ra.get("intelligenceSignal") or {}
            ownership = float(signal.get("ownershipSignal", 0.0))
            if ownership > 1.0:
                ownership /= 100.0
            if ownership == 0.0:
                ownership = float(ra.get("overallScore", 100.0)) / 100.0
                
            quality_metrics = ra.get("qualityMetrics") or {}
            clone_classification = quality_metrics.get("cloneRiskClassification", "clean")
            if ownership >= 0.30 and clone_classification != "high_risk":
                verified_repos_count += 1

        r_repos = verified_repos_count / len(repository_assessments) if repository_assessments else 1.0
        r_evidence = (own_score * 0.60) / s_candidate if s_candidate > 0 else 0.0

        t_candidate = ((r_skills * 0.30) + (r_repos * 0.30) + (r_evidence * 0.40)) * 100.0
        t_candidate = round(max(min(t_candidate, 100.0), 0.0), 2)

        # Seniority gating & conflicts
        has_type1 = any(
            ra.get("cvVerificationLevel") == "AiAnalyzed" or ra.get("trustLevel") == 3
            for ra in repository_assessments
        )

        candidate_complexity = max_difficulty_score * 10.0
        candidate_scope = sum(scopes) / len(scopes) if scopes else 0.0
        candidate_ownership = max(ownerships) if ownerships else 0.0
        candidate_leadership = max(leaderships) if leaderships else 0.0
        candidate_consistency = sum(consistencies) / len(consistencies) if consistencies else 0.0
        candidate_maturity = float(inputs.get("engineeringMaturityScore", 50.0))
        candidate_problem_solving = float(inputs.get("problemSolvingScore", 50.0))

        def classify_seniority(complexity, leadership, maturity, ownership) -> tuple[str, str]:
            if not has_type1:
                if complexity >= 30 and leadership >= 15 and maturity >= 35 and ownership >= 30:
                    return "L2", "Middle"
                if complexity >= 10 and maturity >= 15 and ownership >= 15:
                    return "L1", "Junior"
                return "Intern", "Intern"

            if complexity >= 85 and leadership >= 80 and maturity >= 85 and ownership >= 75:
                return "L5", "Principal"
            if complexity >= 75 and leadership >= 65 and maturity >= 75 and ownership >= 60:
                return "L4", "Staff"
            if complexity >= 55 and leadership >= 40 and maturity >= 60 and ownership >= 45:
                return "L3", "Senior"
            if complexity >= 30 and leadership >= 15 and maturity >= 35 and ownership >= 30:
                return "L2", "Middle"
            if complexity >= 10 and maturity >= 15 and ownership >= 15:
                return "L1", "Junior"
            return "Intern", "Intern"

        rule_level, rule_label = classify_seniority(
            candidate_complexity, candidate_leadership, candidate_maturity, candidate_ownership
        )

        l_ai = inputs.get("finalLevel", "L2")
        level_order = ["L1", "L2", "L3", "L4", "L5"]
        idx_ai = level_order.index(l_ai) if l_ai in level_order else 1
        idx_rules = level_order.index(rule_level) if rule_level in level_order else 1
        
        seniority_conflict_detected = False
        seniority_conflict_warning = None
        calibration_notes = inputs.get("calibrationNotes", "")
        
        if abs(idx_ai - idx_rules) >= 2:
            seniority_conflict_detected = True
            final_idx = min(idx_ai, idx_rules)
            overall_level = level_order[final_idx]
            overall_label = _LEVEL_LABELS[overall_level]
            seniority_conflict_warning = f"SENIORITY_CONFLICT: Discrepancy between AI recommendation ({l_ai}) and rule-based seniority ({rule_level}) exceeds 1 level limit. Capping at lower level: {overall_level}."
            calibration_notes = f"{seniority_conflict_warning}. {calibration_notes}".strip()
        else:
            overall_level = l_ai
            overall_label = _LEVEL_LABELS.get(overall_level, _LEVEL_LABELS["L2"])

        # 6. Candidate Skill Profiles
        skill_proficiencies_out = []
        for skill_name in cv_skills:
            prof = next((p for p in skill_proficiencies if p.get("skill", "").lower() == skill_name.lower()), None)
            supporting_repos = []
            for ra in repository_assessments:
                for attr in ra.get("skillAttributions", []):
                    if attr.get("skillName", "").lower() == skill_name.lower():
                        supporting_repos.append({
                            "repositoryId": ra.get("repositoryId"),
                            "repositoryName": ra.get("repositoryName"),
                            "confidence": attr.get("confidence", 0.0),
                            "contributionWeight": attr.get("contributionWeight", 0.0)
                        })
            
            if prof and supporting_repos:
                score = float(prof.get("proficiencyLevel", 1.0)) * 25.0
                confidence = float(prof.get("confidenceScore", 0.8))
                level = prof.get("proficiencyLabel", "Working")
                rationale = prof.get("evidenceRationale", "")
                evidence_sources = {
                    "repositories": supporting_repos,
                    "rationale": f"Verified via {', '.join(r['repositoryName'] for r in supporting_repos)}: {rationale}"
                }
            else:
                score = 0.0
                confidence = 0.0
                level = "declared_unproven"
                evidence_sources = {
                    "repositories": [],
                    "rationale": "Declared in CV but no matching code evidence found in verified repositories."
                }
                
            skill_proficiencies_out.append({
                "skillName": skill_name,
                "score": score,
                "confidence": confidence,
                "level": level,
                "evidenceSources": json.dumps(evidence_sources)
            })

        # 7. Candidate Domain Profiles
        domain_profiles_out = []
        domain_sums = {}
        domain_weights_sum = {}
        for ra in repository_assessments:
            for dom in ra.get("domains", []):
                dname = dom.get("domainName")
                if not dname:
                    continue
                w = float(dom.get("weight", 0.0))
                d_score = float(ra.get("overallScore", 0.0))
                domain_sums[dname] = domain_sums.get(dname, 0.0) + (d_score * w)
                domain_weights_sum[dname] = domain_weights_sum.get(dname, 0.0) + w

        for dname, w_sum in domain_weights_sum.items():
            avg_score = domain_sums[dname] / w_sum if w_sum > 0 else 0.0
            dom_complexity = candidate_complexity * (w_sum / len(repository_assessments) if repository_assessments else 1.0)
            dom_level, dom_label = classify_seniority(dom_complexity, candidate_leadership, candidate_maturity, candidate_ownership)
            domain_profiles_out.append({
                "domainName": dname,
                "score": round(avg_score, 2),
                "confidence": 0.85,
                "seniority": dom_label,
                "supportingEvidence": json.dumps({
                    "weight_ratio": round(w_sum, 2)
                })
            })

        # 8. Best-Fit Roles Matching V1
        best_fit_roles_out = []
        matching_roles = inputs.get("suggestedRoles", []) or inputs.get("recommendations", {}).get("suggestedRoles", [])
        top_role = inputs.get("topMatch", {}) or inputs.get("recommendations", {}).get("topMatch", {})
        
        all_roles = []
        if top_role:
            all_roles.append(top_role)
        all_roles.extend(matching_roles)

        for idx, role in enumerate(all_roles):
            title = role.get("roleTitle") or role.get("role")
            if not title:
                continue
            if any(r["roleTitle"] == title for r in best_fit_roles_out):
                continue
            best_fit_roles_out.append({
                "roleTitle": title,
                "matchScore": float(role.get("confidence", 0.8)) * 100.0,
                "confidence": float(role.get("confidence", 0.8)),
                "rank": idx + 1,
                "matchingEngineVersion": "V1",
                "evidence": json.dumps({
                    "rationale": role.get("rationale", ""),
                    "levelFit": role.get("levelFit", "exact")
                }),
                "engineMetadata": json.dumps({
                    "matchingEngine": "RuleBasedMaturityV1"
                })
            })

        # 9. Strengths & Weaknesses findings mapping
        strengths_weaknesses_out = []
        for str_item in inputs.get("keyStrengths", []):
            if str_item:
                strengths_weaknesses_out.append({
                    "findingType": "Strength",
                    "topic": "Engineering Capability",
                    "description": str_item,
                    "evidence": None
                })
        for gap_item in inputs.get("watchPoints", inputs.get("skillGaps", [])):
            g_desc = gap_item
            if isinstance(gap_item, dict):
                g_desc = gap_item.get("detail", gap_item.get("skill", ""))
            if g_desc:
                strengths_weaknesses_out.append({
                    "findingType": "ImprovementArea",
                    "topic": "Development Gap",
                    "description": g_desc,
                    "evidence": None
                })

        # 10. Calculate Evidence Governance (without averaging penalty)
        evidence_governance_out = []
        total_contrib = sum(float(ra.get("intelligenceSignal", {}).get("ownershipSignal", 100.0)) / 100.0 * repo_scores[idx] for idx, ra in enumerate(repository_assessments))
        for idx, ra in enumerate(repository_assessments):
            repo_name = ra.get("repositoryName")
            repo_contrib = float(ra.get("intelligenceSignal", {}).get("ownershipSignal", 100.0)) / 100.0 * repo_scores[idx]
            contrib_pct = (repo_contrib / total_contrib * 100.0) if total_contrib > 0 else (100.0 / len(repository_assessments))
            evidence_governance_out.append({
                "repositoryId": ra.get("repositoryId"),
                "repositoryName": repo_name,
                "cvProjectEntryId": ra.get("cvProjectEntryId"),
                "cvProjectName": ra.get("cvProjectName"),
                "cvVerificationLevel": ra.get("cvVerificationLevel"),
                "trustLevel": ra.get("trustLevel", 2),
                "scoreContributionPercent": round(contrib_pct, 2)
            })

        background_repositories = inputs.get("backgroundRepositories") or []
        for bg in background_repositories:
            evidence_governance_out.append({
                "repositoryId": bg.get("repositoryId"),
                "repositoryName": bg.get("repositoryName"),
                "cvProjectEntryId": None,
                "cvProjectName": None,
                "cvVerificationLevel": "Background",
                "trustLevel": 0,
                "scoreContributionPercent": 0.0
            })

        confidence_in_level = float(inputs.get("confidenceInLevel", 0.85))
        confidence_mult = float(exp_multiplier_data.get("confidenceMultiplier", 1.0)) if isinstance(exp_multiplier_data, dict) else 1.0
        display_confidence = min(confidence_in_level * confidence_mult, 1.0)

        # Band classification helpers
        def get_skill_depth_band(score: float) -> str:
            if score < 5: return "Limited Evidence"
            if score < 15: return "Emerging Scope"
            if score < 35: return "Advanced Scope"
            return "Enterprise Scale"

        def get_ownership_band(score: float) -> str:
            if score < 15: return "Low/External Contributor"
            if score < 50: return "Collaborative Contributor"
            if score < 80: return "Core Owner"
            return "Lead / Sole Owner"

        def get_architecture_band(score: float) -> str:
            if score < 30: return "Basic CRUD / Scripting"
            if score < 60: return "Modular / Structural Design"
            if score < 83: return "System Architecture Patterns"
            return "Distributed / Platform Scale"

        def get_problem_solving_band(score: float, qualitative: str = None) -> str:
            if qualitative:
                qual_lower = str(qualitative).lower()
                if "weak" in qual_lower: return "Symptom-level Debugging"
                elif "moderate" in qual_lower: return "Standard Bug-Fix Cycle"
                elif "strong" in qual_lower: return "Root-Cause Diagnostics"
            if score < 30: return "Symptom-level Debugging"
            if score < 60: return "Standard Bug-Fix Cycle"
            if score < 83: return "Root-Cause Diagnostics"
            return "Complex Recovery & Stabilization"

        def get_impact_band(score: float, qualitative: str = None) -> str:
            if qualitative: return str(qualitative)
            if score < 30: return "Ad-hoc / Unstructured"
            if score < 60: return "Structured Development"
            if score < 83: return "High Quality & Test Discipline"
            return "Strategic / Enterprise Standards"

        score_breakdown = {
            "skillDepth": {
                "score": sd_score, 
                "weight": w_sd,
                "band": get_skill_depth_band(sd_score),
                "scale": "calibrated",
                "percent": sd_score
            },
            "ownership": {
                "score": own_score, 
                "weight": w_own,
                "band": get_ownership_band(own_score),
                "scale": "percentage",
                "percent": own_score
            },
            "architecture": {
                "score": arch_score, 
                "weight": w_arch,
                "band": get_architecture_band(arch_score),
                "scale": "calibrated",
                "percent": arch_score
            },
            "problemSolving": {
                "score": ps_score, 
                "weight": w_ps,
                "band": get_problem_solving_band(ps_score, inputs.get("complexBugHandling")),
                "scale": "calibrated",
                "percent": ps_score
            },
            "impact": {
                "score": imp_score, 
                "weight": w_imp,
                "band": get_impact_band(imp_score, inputs.get("maturityLevel")),
                "scale": "calibrated",
                "percent": imp_score
            }
        }

        schema_version = "candidate-profile-v2"
        data = {
            "schemaVersion": schema_version,
            "candidateScore": s_candidate,
            "candidateScoreLabel": overall_label,
            "careerLevel": overall_level,
            "careerLevelLabel": overall_label,
            "careerLevelConfidence": 0.85,
            
            "primaryTendency": inputs.get("primaryTendency", ""),
            "primaryWorkingStyle": inputs.get("primaryWorkingStyle", ""),
            
            "recruiterHeadline": inputs.get("recruiterHeadline", ""),
            "fullSummary": inputs.get("fullSummary", ""),
            "keyStrengths": inputs.get("keyStrengths", []),
            "watchPoints": inputs.get("watchPoints", []),

            "displayConfidence": display_confidence,
            "scoreBreakdown": score_breakdown,

            "technicalDepth": round(candidate_complexity, 2),
            "technicalBreadth": round(float(len(all_categories)) * 10.0, 2),
            "leadershipPotential": round(candidate_leadership, 2),
            "executionStrength": round((candidate_consistency + candidate_problem_solving) / 2.0, 2),
            "trustLevel": t_candidate,

            "trustScoreMetrics": {
                "verifiedSkillRatio": round(r_skills, 2),
                "verifiedRepositoryRatio": round(r_repos, 2),
                "verifiedEvidenceRatio": round(r_evidence, 2),
                "candidateTrustScore": t_candidate
            },

            "skills": skill_proficiencies_out,
            "domainProfiles": domain_profiles_out,
            "bestFitRoles": best_fit_roles_out,
            "strengthsWeaknesses": strengths_weaknesses_out,
            
            "cvImprovementSuggestions": inputs.get("cvImprovementSuggestions", []),
            "evidenceGovernance": evidence_governance_out,
            "seniorityConflictDetected": seniority_conflict_detected,
            "seniorityConflictWarning": seniority_conflict_warning,
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


def parse_date(d_str, default_val):
    if not d_str:
        return default_val
    try:
        from datetime import datetime
        return datetime.strptime(d_str[:10], "%Y-%m-%d")
    except:
        return default_val


def calculate_discounted_experience_months(cv) -> float:
    experiences = cv.get("experiences", [])
    projects = cv.get("projects", [])
    total_discounted_months = 0.0
    from datetime import datetime

    for exp in experiences:
        duration = float(exp.get("durationMonths", 0))
        if duration <= 0:
            continue
        
        start_str = exp.get("startDate")
        end_str = exp.get("endDate")
        
        exp_start = parse_date(start_str, None)
        exp_end = parse_date(end_str, None)
        
        if not exp_start:
            has_independent = any(p.get("verificationLevel") == "Independent" for p in projects)
            if has_independent:
                total_discounted_months += duration * 0.70
            else:
                total_discounted_months += duration
            continue
            
        if not exp_end:
            exp_end = datetime.now()
            
        exp_months = []
        curr_year, curr_month = exp_start.year, exp_start.month
        while (curr_year < exp_end.year) or (curr_year == exp_end.year and curr_month <= exp_end.month):
            exp_months.append((curr_year, curr_month))
            curr_month += 1
            if curr_month > 12:
                curr_month = 1
                curr_year += 1
                
        overlapping_count = 0
        for yr, m in exp_months:
            is_overlapping = False
            for proj in projects:
                if proj.get("verificationLevel") != "Independent":
                    continue
                p_start = parse_date(proj.get("startDate"), None)
                p_end = parse_date(proj.get("endDate"), None)
                if p_start:
                    if not p_end:
                        p_end = datetime.now()
                    mid_date = datetime(yr, m, 15)
                    if p_start <= mid_date <= p_end:
                        is_overlapping = True
                        break
            if is_overlapping:
                overlapping_count += 1
        
        discounted_exp_months = (len(exp_months) - overlapping_count) + (overlapping_count * 0.70)
        if len(exp_months) > 0:
            scale_factor = duration / len(exp_months)
            total_discounted_months += discounted_exp_months * scale_factor
        else:
            total_discounted_months += duration
            
    return total_discounted_months
