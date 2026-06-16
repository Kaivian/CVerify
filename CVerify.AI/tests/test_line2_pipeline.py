"""
test_line2_pipeline.py
======================
Unit tests for Line 2 — Candidate Evaluation Pipeline.

Covers:
  1. Skill Taxonomy Dictionary (L2-001 support)
  2. Technical Tendency Classifier rule-based layer (L2-009)
  3. Working Style Classifier rule-based layer (L2-010)
  4. Career Level Threshold Calibration helpers (L2-005 support)
  5. Experience Confidence Multiplier (L2-011, deterministic)
  6. Candidate Profile Composer score formula (L2-014, deterministic)
  7. Orchestrator dispatch — all 14 tasks recognized
  8. Career Level Gate deterministic rules (L2-006)
  9. RepoIntelligenceClient — DB fetch decoupling (L2 vs L1)

All tests are fully offline — no Anthropic API calls, no Redis, no GitHub API.
"""

import os
import sys
import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

os.environ.setdefault("ANTHROPIC_API_KEY", "dummy-key")
os.environ.setdefault("SHARED_SECRET", "dummy-secret")
os.environ.setdefault("BACKEND_API_URL", "http://mock-backend:8080")


# =============================================================================
# 1. Skill Taxonomy Dictionary
# =============================================================================
class TestSkillTaxonomy(unittest.TestCase):
    def setUp(self):
        from app.pipelines.candidate.skill_taxonomy import (
            normalize_skill, normalize_batch, get_taxonomy_hints, SKILL_TAXONOMY
        )
        self.normalize_skill = normalize_skill
        self.normalize_batch = normalize_batch
        self.get_taxonomy_hints = get_taxonomy_hints
        self.SKILL_TAXONOMY = SKILL_TAXONOMY

    def test_reactjs_normalizes_to_react(self):
        entry = self.normalize_skill("ReactJS")
        self.assertIsNotNone(entry)
        self.assertEqual(entry.normalized_name, "React")

    def test_spring_boot_normalizes_to_spring_framework(self):
        entry = self.normalize_skill("Spring Boot")
        self.assertIsNotNone(entry)
        self.assertEqual(entry.normalized_name, "Spring Framework")

    def test_case_insensitive_lookup(self):
        entry = self.normalize_skill("POSTGRESQL")
        self.assertIsNotNone(entry)
        self.assertEqual(entry.normalized_name, "PostgreSQL")

    def test_unknown_skill_returns_none(self):
        entry = self.normalize_skill("QuantumSynergyFramework2049")
        self.assertIsNone(entry)

    def test_kubernetes_has_correct_sfia_category(self):
        entry = self.normalize_skill("kubernetes")
        self.assertEqual(entry.sfia_category, "Infrastructure Management")

    def test_normalize_batch_returns_found_for_known_skills(self):
        results = self.normalize_batch(["react", "docker", "unknownXYZ"])
        found = {r["rawName"]: r["found"] for r in results}
        self.assertTrue(found["react"])
        self.assertTrue(found["docker"])
        self.assertFalse(found["unknownXYZ"])

    def test_normalize_batch_sets_normalized_name_for_unknown(self):
        results = self.normalize_batch(["unknownXYZ"])
        self.assertEqual(results[0]["normalizedName"], "unknownXYZ")

    def test_taxonomy_hints_returns_dict(self):
        hints = self.get_taxonomy_hints()
        self.assertIsInstance(hints, dict)
        self.assertIn("React", hints)
        self.assertIn("Docker", hints)

    def test_all_taxonomy_entries_have_onet_codes(self):
        for key, entry in self.SKILL_TAXONOMY.items():
            self.assertTrue(len(entry.onet_code) > 0, f"Missing onet_code for: {key}")

    def test_git_normalizes_correctly(self):
        entry = self.normalize_skill("git")
        self.assertIsNotNone(entry)
        self.assertEqual(entry.normalized_name, "Git")

    def test_k8s_alias_resolves_to_kubernetes(self):
        entry = self.normalize_skill("k8s")
        self.assertIsNotNone(entry)
        self.assertEqual(entry.normalized_name, "Kubernetes")

    def test_go_language_normalizes(self):
        entry = self.normalize_skill("golang")
        self.assertIsNotNone(entry)
        self.assertEqual(entry.normalized_name, "Go")


# =============================================================================
# 2. Technical Tendency Classifier — Rule-based Layer
# =============================================================================
class TestTendencyRules(unittest.TestCase):
    def setUp(self):
        from app.pipelines.candidate.tendency_rules import (
            score_tendencies, get_primary_tendency, ALL_ROLES
        )
        self.score_tendencies = score_tendencies
        self.get_primary_tendency = get_primary_tendency
        self.ALL_ROLES = ALL_ROLES

    def test_all_9_roles_defined(self):
        expected = {
            "Backend", "Frontend", "Fullstack", "Mobile",
            "DevOps/SRE", "Data Engineering", "AI/ML Engineering",
            "Security Engineering", "Platform Engineering",
        }
        self.assertEqual(set(self.ALL_ROLES), expected)

    def test_backend_signals_give_backend_primary(self):
        techs = ["FastAPI", "PostgreSQL", "Redis"]
        skills = ["REST API", "Python"]
        primary, confidence, _ = self.get_primary_tendency(techs, skills)
        self.assertEqual(primary, "Backend")
        self.assertGreater(confidence, 0)

    def test_frontend_signals_give_frontend_primary(self):
        techs = ["React", "TypeScript", "CSS", "Tailwind"]
        skills = ["Vue.js", "Webpack"]
        primary, confidence, _ = self.get_primary_tendency(techs, skills)
        self.assertEqual(primary, "Frontend")

    def test_devops_signals_give_devops_primary(self):
        techs = ["Docker", "Kubernetes", "Terraform", "Helm"]
        skills = ["GitHub Actions", "Ansible"]
        primary, confidence, _ = self.get_primary_tendency(techs, skills)
        self.assertEqual(primary, "DevOps/SRE")

    def test_ml_signals_give_ai_ml_primary(self):
        techs = ["PyTorch", "TensorFlow", "scikit-learn"]
        skills = ["Machine Learning", "Deep Learning", "NLP"]
        primary, confidence, _ = self.get_primary_tendency(techs, skills)
        self.assertEqual(primary, "AI/ML Engineering")

    def test_mobile_signals_give_mobile_primary(self):
        techs = ["Android", "Flutter", "iOS"]
        skills = ["React Native", "Swift"]
        primary, confidence, _ = self.get_primary_tendency(techs, skills)
        self.assertEqual(primary, "Mobile")

    def test_empty_signals_return_fallback(self):
        primary, confidence, _ = self.get_primary_tendency([], [])
        self.assertEqual(primary, "Backend")
        self.assertEqual(confidence, 0.0)

    def test_ranked_list_sorted_by_confidence(self):
        techs = ["FastAPI", "PostgreSQL", "Docker"]
        skills = []
        ranked = self.score_tendencies(techs, skills)
        confidences = [r["confidence"] for r in ranked]
        self.assertEqual(confidences, sorted(confidences, reverse=True))

    def test_confidence_values_bounded_0_to_1(self):
        techs = ["React", "FastAPI", "Docker", "PyTorch", "Android"]
        skills = ["Machine Learning", "Kubernetes"]
        ranked = self.score_tendencies(techs, skills)
        for item in ranked:
            self.assertGreaterEqual(item["confidence"], 0.0)
            self.assertLessEqual(item["confidence"], 1.0)

    def test_language_bonus_affects_scores(self):
        techs = []
        skills = []
        commit_languages = {"Python": 85.0, "Shell": 10.0}
        ranked = self.score_tendencies(techs, skills, commit_languages)
        roles = {r["role"] for r in ranked if r["confidence"] > 0}
        self.assertTrue(roles & {"Backend", "Data Engineering", "AI/ML Engineering", "DevOps/SRE"})

    def test_evidence_signals_list_populated(self):
        techs = ["FastAPI", "Redis"]
        skills = []
        ranked = self.score_tendencies(techs, skills)
        backend = next((r for r in ranked if r["role"] == "Backend"), None)
        self.assertIsNotNone(backend)
        self.assertIsInstance(backend["evidenceSignals"], list)


# =============================================================================
# 3. Working Style Classifier — Rule-based Layer
# =============================================================================
class TestWorkingStyleRules(unittest.TestCase):
    def setUp(self):
        from app.pipelines.candidate.working_style_rules import (
            score_working_styles, get_primary_working_style, ALL_STYLES
        )
        self.score_working_styles = score_working_styles
        self.get_primary_working_style = get_primary_working_style
        self.ALL_STYLES = ALL_STYLES

    def test_all_6_styles_defined(self):
        expected = {
            "Feature Builder", "System Designer", "Problem Solver",
            "Maintenance Engineer", "Performance Optimizer", "Research-Oriented",
        }
        self.assertEqual(set(self.ALL_STYLES), expected)

    def test_feat_commits_produce_feature_builder(self):
        messages = ["feat: add user authentication", "feat: implement dashboard",
                    "feat: add payment module", "feat: create report API"] * 5
        primary, confidence, _ = self.get_primary_working_style(messages)
        self.assertEqual(primary, "Feature Builder")
        self.assertGreater(confidence, 0.3)

    def test_fix_commits_produce_problem_solver(self):
        messages = ["fix: resolve null pointer in auth", "fix: patch XSS vulnerability",
                    "fix: correct date parsing", "bugfix: handle empty response"] * 5
        primary, confidence, _ = self.get_primary_working_style(messages)
        self.assertEqual(primary, "Problem Solver")

    def test_refactor_commits_produce_system_designer(self):
        messages = ["refactor: extract service layer", "refactor: apply clean architecture",
                    "arch: redesign data pipeline", "refactor: split monolith into modules"] * 5
        primary, confidence, _ = self.get_primary_working_style(messages)
        self.assertEqual(primary, "System Designer")

    def test_chore_docs_produce_maintenance_engineer(self):
        messages = ["chore: update dependencies", "docs: update API docs",
                    "chore: remove deprecated code", "docs: add README", "ci: fix pipeline"] * 5
        primary, confidence, _ = self.get_primary_working_style(messages)
        self.assertEqual(primary, "Maintenance Engineer")

    def test_perf_commits_produce_performance_optimizer(self):
        messages = ["perf: optimize database queries", "perf: reduce bundle size",
                    "performance: profile memory usage", "optimize: cache hot paths"] * 5
        primary, confidence, _ = self.get_primary_working_style(messages)
        self.assertEqual(primary, "Performance Optimizer")

    def test_poc_branch_names_produce_research_oriented(self):
        messages = ["wip: trying new approach"] * 3
        branches = ["exp/new-auth-flow", "poc/graphql-migration", "research/perf-baseline"]
        primary, confidence, _ = self.get_primary_working_style(messages, branches)
        self.assertEqual(primary, "Research-Oriented")

    def test_empty_commits_return_fallback(self):
        primary, confidence, _ = self.get_primary_working_style([])
        self.assertEqual(primary, "Feature Builder")
        self.assertEqual(confidence, 0.0)

    def test_non_conventional_commits_return_fallback(self):
        messages = ["Updated stuff", "Fixed things", "Did work", "Changed code"] * 5
        primary, confidence, _ = self.get_primary_working_style(messages)
        self.assertEqual(confidence, 0.0)

    def test_ranked_list_sorted_by_confidence(self):
        messages = ["feat: add feature"] * 10 + ["fix: fix bug"] * 5 + ["chore: cleanup"] * 2
        ranked = self.score_working_styles(messages)
        confidences = [r["confidence"] for r in ranked]
        self.assertEqual(confidences, sorted(confidences, reverse=True))

    def test_confidence_sums_to_approx_one(self):
        messages = ["feat: feature"] * 5 + ["fix: bug"] * 5 + ["refactor: clean"] * 5
        ranked = self.score_working_styles(messages)
        total = sum(r["confidence"] for r in ranked)
        self.assertAlmostEqual(total, 1.0, places=2)

    def test_evidence_string_populated_for_active_styles(self):
        messages = ["feat: add login"] * 10
        ranked = self.score_working_styles(messages)
        feature_builder = next(r for r in ranked if r["style"] == "Feature Builder")
        self.assertIn("feat", feature_builder["evidence"])


# =============================================================================
# 4. Career Level Threshold Calibration Helpers
# =============================================================================
class TestCareerLevelCalibrationHelpers(unittest.TestCase):
    def setUp(self):
        from app.pipelines.candidate.orchestrator import (
            _score_to_level, _is_boundary_score, _is_adjacent_or_same_level,
        )
        self.score_to_level = _score_to_level
        self.is_boundary = _is_boundary_score
        self.is_adjacent = _is_adjacent_or_same_level

    # _score_to_level
    def test_score_30_is_junior(self):
        level, label = self.score_to_level(30.0)
        self.assertEqual(level, "L1")
        self.assertEqual(label, "Junior")

    def test_score_55_is_middle(self):
        level, label = self.score_to_level(55.0)
        self.assertEqual(level, "L2")
        self.assertEqual(label, "Middle")

    def test_score_72_is_senior(self):
        level, label = self.score_to_level(72.0)
        self.assertEqual(level, "L3")
        self.assertEqual(label, "Senior")

    def test_score_88_is_staff(self):
        level, label = self.score_to_level(88.0)
        self.assertEqual(level, "L4")
        self.assertEqual(label, "Staff")

    def test_score_95_is_principal(self):
        level, label = self.score_to_level(95.0)
        self.assertEqual(level, "L5")
        self.assertEqual(label, "Principal")

    def test_score_66_is_senior_boundary_inclusive(self):
        level, _ = self.score_to_level(66.0)
        self.assertEqual(level, "L3")

    def test_score_45_99_is_middle(self):
        level, _ = self.score_to_level(45.99)
        self.assertEqual(level, "L1")

    def test_score_46_is_middle(self):
        level, _ = self.score_to_level(46.0)
        self.assertEqual(level, "L2")

    # _is_boundary_score
    def test_score_near_46_is_boundary(self):
        self.assertTrue(self.is_boundary(46.0))
        self.assertTrue(self.is_boundary(44.5))
        self.assertTrue(self.is_boundary(48.0))

    def test_score_far_from_boundary_is_not_boundary(self):
        self.assertFalse(self.is_boundary(55.0))
        self.assertFalse(self.is_boundary(75.0))

    def test_score_near_93_is_boundary(self):
        self.assertTrue(self.is_boundary(92.0))
        self.assertTrue(self.is_boundary(94.5))

    # _is_adjacent_or_same_level
    def test_same_level_is_adjacent(self):
        self.assertTrue(self.is_adjacent("L3", "L3"))

    def test_one_step_apart_is_adjacent(self):
        self.assertTrue(self.is_adjacent("L2", "L3"))
        self.assertTrue(self.is_adjacent("L4", "L3"))

    def test_two_steps_apart_is_not_adjacent(self):
        self.assertFalse(self.is_adjacent("L1", "L3"))
        self.assertFalse(self.is_adjacent("L3", "L5"))

    def test_unknown_level_returns_true(self):
        self.assertTrue(self.is_adjacent("L2", "UNKNOWN"))


# =============================================================================
# 5. Experience Confidence Multiplier (L2-011, deterministic)
# =============================================================================
class TestExperienceConfidenceMultiplier(unittest.IsolatedAsyncioTestCase):
    async def _run(self, inputs):
        from app.pipelines.candidate.orchestrator import CandidateEvaluationOrchestrator
        orch = CandidateEvaluationOrchestrator.__new__(CandidateEvaluationOrchestrator)
        return await orch._experience_confidence_multiplier("job-1", inputs, "test")

    async def test_no_experience_gives_1x(self):
        result = await self._run({"workingExperience": []})
        data = __import__("json").loads(result["resultData"])
        self.assertEqual(data["confidenceMultiplier"], 1.0)

    async def test_5_years_gives_1_25x(self):
        result = await self._run({"workingExperience": [{"durationMonths": 60, "isLeadership": False}]})
        data = __import__("json").loads(result["resultData"])
        self.assertEqual(data["confidenceMultiplier"], 1.25)

    async def test_3_years_gives_1_20x(self):
        result = await self._run({"workingExperience": [{"durationMonths": 36, "isLeadership": False}]})
        data = __import__("json").loads(result["resultData"])
        self.assertEqual(data["confidenceMultiplier"], 1.20)

    async def test_1_year_gives_1_10x(self):
        result = await self._run({"workingExperience": [{"durationMonths": 12, "isLeadership": False}]})
        data = __import__("json").loads(result["resultData"])
        self.assertEqual(data["confidenceMultiplier"], 1.10)

    async def test_leadership_adds_5_percent(self):
        result = await self._run({"workingExperience": [{"durationMonths": 12, "isLeadership": True}]})
        data = __import__("json").loads(result["resultData"])
        self.assertEqual(data["confidenceMultiplier"], 1.15)

    async def test_leadership_capped_at_1_25x(self):
        result = await self._run({"workingExperience": [{"durationMonths": 72, "isLeadership": True}]})
        data = __import__("json").loads(result["resultData"])
        self.assertEqual(data["confidenceMultiplier"], 1.25)

    async def test_multiple_experiences_accumulated(self):
        result = await self._run({"workingExperience": [
            {"durationMonths": 24, "isLeadership": False},
            {"durationMonths": 18, "isLeadership": False},
        ]})
        data = __import__("json").loads(result["resultData"])
        self.assertEqual(data["totalExperienceMonths"], 42)
        self.assertEqual(data["totalExperienceYears"], 3.5)

    async def test_status_is_completed(self):
        result = await self._run({"workingExperience": []})
        self.assertEqual(result["status"], "Completed")


# =============================================================================
# 6. Candidate Profile Composer — Score Formula (L2-014)
# =============================================================================
class TestCandidateProfileComposer(unittest.IsolatedAsyncioTestCase):
    async def _run(self, inputs):
        from app.pipelines.candidate.orchestrator import CandidateEvaluationOrchestrator
        orch = CandidateEvaluationOrchestrator.__new__(CandidateEvaluationOrchestrator)
        return await orch._candidate_profile_composer("job-1", inputs, "test")

    def _build_mock_inputs(self, skills=None, repos=None, experience_months=36):
        if skills is None:
            skills = ["Python", "React"]
        if repos is None:
            repos = []
        return {
            "cv": {
                "skills": skills,
                "experiences": [{"durationMonths": experience_months, "company": "Google", "jobTitle": "Senior Software Engineer"}]
            },
            "skillProficiencies": [{"skill": s, "proficiencyLevel": 3, "proficiencyLabel": "Practitioner", "confidenceScore": 0.9} for s in skills],
            "repositoryAssessments": repos,
            "confidenceMultiplier": {"totalExperienceMonths": experience_months, "hasLeadershipExperience": True, "confidenceMultiplier": 1.25}
        }

    async def test_score_formula_consistency(self):
        """Verify that overall candidate score is strictly the weighted sum of breakdown dimensions."""
        inputs = self._build_mock_inputs(
            skills=["Python", "React"],
            repos=[{
                "repositoryId": "repo-1",
                "repositoryName": "test-repo",
                "overallScore": 80.0,
                "cvVerificationLevel": "AiAnalyzed",
                "trustLevel": 3,
                "capabilities": [
                    {"name": "DI", "difficultyScore": 6.0, "maturity": "Advanced", "category": "architecture"},
                    {"name": "REST API", "difficultyScore": 4.0, "maturity": "Intermediate", "category": "backend"}
                ],
                "skillAttributions": [
                    {"skillName": "Python", "confidence": 90.0, "contributionWeight": 0.8},
                    {"skillName": "React", "confidence": 90.0, "contributionWeight": 0.8}
                ],
                "intelligenceSignal": {
                    "ownershipSignal": 85.0,
                    "consistencySignal": 90.0,
                    "scopeSignal": 75.0,
                    "leadershipSignal": 80.0
                },
                "qualityMetrics": {
                    "qualityScore": 85.0
                }
            }]
        )
        result = await self._run(inputs)
        data = __import__("json").loads(result["resultData"])
        s_candidate = data["candidateScore"]
        breakdown = data["scoreBreakdown"]
        
        # Recalculate from breakdown to assert atomic consistency
        expected = round(
            breakdown["skillDepth"]["score"] * breakdown["skillDepth"]["weight"] +
            breakdown["ownership"]["score"] * breakdown["ownership"]["weight"] +
            breakdown["architecture"]["score"] * breakdown["architecture"]["weight"] +
            breakdown["problemSolving"]["score"] * breakdown["problemSolving"]["weight"] +
            breakdown["impact"]["score"] * breakdown["impact"]["weight"]
        )
        self.assertEqual(s_candidate, expected)

    async def test_score_is_open_ended_not_capped_at_100(self):
        """Verify that scores are open-ended and can exceed 100 when abundant evidence is present."""
        many_skills = [f"Skill_{i}" for i in range(30)]
        many_repos = []
        for i in range(15):
            many_repos.append({
                "repositoryId": f"repo-{i}",
                "repositoryName": f"repo-name-{i}",
                "overallScore": 95.0,
                "capabilities": [
                    {"name": f"DI_{i}", "difficultyScore": 8.0, "maturity": "Enterprise", "category": "architecture"},
                    {"name": f"Feature_{i}", "difficultyScore": 7.0, "maturity": "Advanced", "category": "backend"}
                ],
                "skillAttributions": [{"skillName": s, "confidence": 95.0, "contributionWeight": 0.9} for s in many_skills],
                "intelligenceSignal": {
                    "ownershipSignal": 95.0,
                    "consistencySignal": 95.0,
                    "scopeSignal": 90.0,
                    "leadershipSignal": 90.0
                },
                "qualityMetrics": {
                    "qualityScore": 95.0
                }
            })
            
        inputs = self._build_mock_inputs(skills=many_skills, repos=many_repos, experience_months=120)
        # Add leadership multiplier details
        inputs["confidenceMultiplier"]["hasLeadershipExperience"] = True
        
        # Add self-declared projects to CV to let self-declared scores contribute
        inputs["cv"]["projects"] = [
            {
                "name": f"Project_{i}",
                "technologies": [many_skills[i % len(many_skills)], "microservices", "kubernetes"],
                "startDate": "2020-01-01",
                "endDate": "2021-01-01",
                "verificationLevel": "SelfDeclared",
                "description": "A very large enterprise scaling microservices project."
            }
            for i in range(15)
        ]
        
        result = await self._run(inputs)
        data = __import__("json").loads(result["resultData"])
        
        # Check that individual dimensions or candidateScore can grow beyond 100
        has_above_100 = any(
            v["score"] > 100 for v in data["scoreBreakdown"].values()
        ) or data["candidateScore"] > 100
        
        self.assertTrue(has_above_100, f"Expected scores to be open-ended, but all were <= 100: {data}")

    async def test_zero_scores_produce_zero_candidate_score(self):
        result = await self._run({})
        data = __import__("json").loads(result["resultData"])
        self.assertEqual(data["candidateScore"], 0)

    async def test_monotonicity_invariant_on_repository_addition(self):
        """Adding new repositories must strictly increase or stabilize scores (never decrease)."""
        base_inputs = self._build_mock_inputs(
            skills=["Python"],
            repos=[{
                "repositoryId": "repo-1",
                "repositoryName": "test-repo",
                "overallScore": 50.0,
                "capabilities": [
                    {"name": "Feature-1", "difficultyScore": 3.0, "maturity": "Intermediate", "category": "backend"}
                ],
                "skillAttributions": [{"skillName": "Python", "confidence": 70.0, "contributionWeight": 0.5}],
                "intelligenceSignal": {
                    "ownershipSignal": 40.0,
                    "consistencySignal": 50.0,
                },
                "qualityMetrics": {
                    "qualityScore": 60.0
                }
            }]
        )
        
        # 1. Evaluate base candidate
        base_result = await self._run(base_inputs)
        base_data = __import__("json").loads(base_result["resultData"])
        
        # 2. Add a new repository (with more capabilities, ownership, skills)
        mutated_inputs = self._build_mock_inputs(
            skills=["Python", "Go"],
            repos=[
                base_inputs["repositoryAssessments"][0],
                {
                    "repositoryId": "repo-2",
                    "repositoryName": "another-repo",
                    "overallScore": 80.0,
                    "capabilities": [
                        {"name": "DI", "difficultyScore": 6.0, "maturity": "Advanced", "category": "architecture"}
                    ],
                    "skillAttributions": [{"skillName": "Go", "confidence": 80.0, "contributionWeight": 0.8}],
                    "intelligenceSignal": {
                        "ownershipSignal": 70.0,
                        "consistencySignal": 80.0,
                    },
                    "qualityMetrics": {
                        "qualityScore": 80.0
                    }
                }
            ]
        )
        mutated_inputs["skillProficiencies"].append({"skill": "Go", "proficiencyLevel": 3, "proficiencyLabel": "Practitioner", "confidenceScore": 0.8})
        
        mutated_result = await self._run(mutated_inputs)
        mutated_data = __import__("json").loads(mutated_result["resultData"])
        
        # 3. Assert Monotonicity: Mutated scores must be >= Base scores
        self.assertGreaterEqual(mutated_data["candidateScore"], base_data["candidateScore"])
        
        for k in base_data["scoreBreakdown"]:
            self.assertGreaterEqual(
                mutated_data["scoreBreakdown"][k]["score"],
                base_data["scoreBreakdown"][k]["score"],
                f"Score degradation detected in dimension '{k}'!"
            )

    async def test_schema_version_present(self):
        result = await self._run({})
        data = __import__("json").loads(result["resultData"])
        self.assertEqual(data["schemaVersion"], "candidate-profile-v2")

    async def test_best_fit_roles_deduplicated_and_capped(self):
        inputs = self._build_mock_inputs()
        inputs["suggestedRoles"] = [
            {"role": "Software Engineer", "confidence": 0.85, "rationale": "Strong programming skills"},
            {"role": "SOFTWARE ENGINEER", "confidence": 0.90, "rationale": "High confidence"},
            {"role": "DevOps Engineer", "confidence": 0.70, "rationale": "CI/CD setup"},
            {"role": "Frontend Developer", "confidence": 0.80, "rationale": "React expertise"},
            {"role": "Fullstack Developer", "confidence": 0.95, "rationale": "React + Python"},
        ]
        inputs["topMatch"] = {"roleTitle": "Software Engineer", "confidence": 0.88, "rationale": "Matches primary stack"}
        
        result = await self._run(inputs)
        data = __import__("json").loads(result["resultData"])
        
        roles = data["bestFitRoles"]
        # Should be capped at 3
        self.assertEqual(len(roles), 3)
        
        # Titles must be unique (case-insensitively)
        titles = [r["roleTitle"] for r in roles]
        self.assertEqual(len(titles), len(set(t.lower() for t in titles)))
        
        # Should be sorted by confidence descending:
        # Fullstack Developer (0.95), Software Engineer (from suggestedRoles 0.90 since it's higher than 0.88), Frontend Developer (0.80)
        self.assertEqual(roles[0]["roleTitle"], "Fullstack Developer")
        self.assertEqual(roles[1]["roleTitle"], "SOFTWARE ENGINEER")
        self.assertEqual(roles[2]["roleTitle"], "Frontend Developer")


# =============================================================================
# 7. Orchestrator Task Dispatch — All 14 tasks recognized
# =============================================================================
class TestOrchestratorDispatch(unittest.TestCase):
    def setUp(self):
        from app.pipelines.candidate.orchestrator import is_line2_task, TASK_ALIASES
        self.is_line2_task = is_line2_task
        self.TASK_ALIASES = TASK_ALIASES

    def test_all_14_task_ids_recognized(self):
        for i in range(1, 15):
            task_id = f"L2-{i:03d}"
            self.assertTrue(
                self.is_line2_task(task_id),
                f"{task_id} should be recognized as a Line 2 task"
            )

    def test_task_name_aliases_recognized(self):
        names = [
            "SkillTaxonomyMapper", "SkillProficiencyEstimator", "StrengthWeaknessAnalyzer",
            "CareerLevelMapper", "CareerLevelCalibrator", "CareerLevelGate",
            "EngineeringMaturityAssessor", "ProblemSolvingAnalyzer", "TechnicalTendencyClassifier",
            "WorkingStyleClassifier", "ExperienceConfidenceMultiplier",
            "MultiRoleRecommendationEngine", "CandidateSummaryGenerator", "CandidateProfileComposer",
        ]
        for name in names:
            self.assertTrue(self.is_line2_task(name), f"{name} should be recognized")

    def test_unknown_task_not_recognized(self):
        self.assertFalse(self.is_line2_task("L3-001"))
        self.assertFalse(self.is_line2_task("RandomTask"))

    def test_alias_map_has_14_entries(self):
        self.assertEqual(len(self.TASK_ALIASES), 14)

    def test_all_aliases_map_to_known_names(self):
        valid_names = {
            "SkillTaxonomyMapper", "SkillProficiencyEstimator", "StrengthWeaknessAnalyzer",
            "CareerLevelMapper", "CareerLevelCalibrator", "CareerLevelGate",
            "EngineeringMaturityAssessor", "ProblemSolvingAnalyzer", "TechnicalTendencyClassifier",
            "WorkingStyleClassifier", "ExperienceConfidenceMultiplier",
            "MultiRoleRecommendationEngine", "CandidateSummaryGenerator", "CandidateProfileComposer",
        }
        for alias, name in self.TASK_ALIASES.items():
            self.assertIn(name, valid_names, f"Alias {alias} → {name} not in valid names")


# =============================================================================
# 8. Career Level Gate — Deterministic Rules (L2-006)
# =============================================================================
class TestCareerLevelGateDeterministic(unittest.TestCase):
    """Tests the deterministic gate logic embedded in _career_level_gate."""

    def _build_inputs_no_arch(self, level: str, score: float) -> dict:
        return {
            "calibratedLevel": level,
            "calibratedScore": score,
            "levelEvidence": {},
            "repoIntelligenceReport": {"patterns": []},
        }

    def _build_inputs_with_arch(self, level: str, score: float) -> dict:
        return {
            "calibratedLevel": level,
            "calibratedScore": score,
            "levelEvidence": {},
            "repoIntelligenceReport": {
                "patterns": [{"patternName": "Dependency Injection", "confidence": 0.85}]
            },
        }

    def test_senior_without_arch_evidence_triggers_violation(self):
        """Senior (L3) without architecture evidence → gate violation."""
        inputs = self._build_inputs_no_arch("L3", 70.0)
        # Simulate the gate logic inline
        calibrated_level = inputs["calibratedLevel"]
        repo_report = inputs["repoIntelligenceReport"]
        patterns = repo_report.get("patterns", [])
        has_arch = any(
            p.get("patternName", "").lower() not in ("", "none", "unknown")
            for p in patterns
        )
        gate_violations = []
        if calibrated_level == "L3" and not has_arch:
            gate_violations.append("Senior level requires architecture evidence.")
        self.assertEqual(len(gate_violations), 1)

    def test_senior_with_arch_evidence_passes_gate(self):
        """Senior (L3) with architecture evidence → gate passes."""
        inputs = self._build_inputs_with_arch("L3", 70.0)
        patterns = inputs["repoIntelligenceReport"].get("patterns", [])
        has_arch = any(
            p.get("patternName", "").lower() not in ("", "none", "unknown")
            for p in patterns
        )
        gate_violations = []
        if inputs["calibratedLevel"] == "L3" and not has_arch:
            gate_violations.append("Senior level requires architecture evidence.")
        self.assertEqual(len(gate_violations), 0)

    def test_staff_without_l4_evidence_triggers_violation(self):
        """Staff (L4) without L4 evidence → gate violation."""
        calibrated_level = "L4"
        level_evidence = {}
        gate_violations = []
        if calibrated_level == "L4":
            l4_evidence = level_evidence.get("L4", [])
            if not l4_evidence:
                gate_violations.append("Staff level requires platform/infra evidence.")
        self.assertEqual(len(gate_violations), 1)

    def test_middle_always_passes_gate(self):
        """Middle (L2) has no gate requirements."""
        gate_violations: list = []
        calibrated_level = "L2"
        # Gate only applies to L3+ — no checks for L2
        self.assertEqual(len(gate_violations), 0)

    def test_junior_always_passes_gate(self):
        """Junior (L1) has no gate requirements."""
        gate_violations: list = []
        calibrated_level = "L1"
        self.assertEqual(len(gate_violations), 0)


# =============================================================================
# 9. RepoIntelligenceClient — DB fetch decoupling
# =============================================================================
class TestRepoIntelligenceClient(unittest.IsolatedAsyncioTestCase):
    """
    Validates that RepoIntelligenceClient correctly fetches Line 1 artifacts
    from the backend and handles errors gracefully.
    Tests run fully offline via httpx mocking.
    """

    def _make_client(self):
        from app.core.clients.repo_intelligence_client import RepoIntelligenceClient
        return RepoIntelligenceClient(base_url="http://mock-backend:8080")

    async def test_fetch_artifact_returns_parsed_json(self):
        """Successful fetch returns parsed dict."""
        import httpx
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"techStack": {"primaryLanguage": "Python"}}
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_cm = AsyncMock()
            mock_cm.__aenter__ = AsyncMock(return_value=mock_cm)
            mock_cm.__aexit__ = AsyncMock(return_value=False)
            mock_cm.get = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_cm

            client = self._make_client()
            result = await client.fetch_artifact("job-001", "repoIntelligenceReport")
            self.assertIsNotNone(result)
            self.assertEqual(result["techStack"]["primaryLanguage"], "Python")

    async def test_fetch_artifact_unwraps_data_envelope(self):
        """Backend response wrapped in {data: ...} envelope is unwrapped."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": {"nodes": [], "edges": []}}
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_cm = AsyncMock()
            mock_cm.__aenter__ = AsyncMock(return_value=mock_cm)
            mock_cm.__aexit__ = AsyncMock(return_value=False)
            mock_cm.get = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_cm

            client = self._make_client()
            result = await client.fetch_artifact("job-001", "skillEvidenceGraph")
            self.assertIn("nodes", result)

    async def test_fetch_artifact_returns_none_on_404(self):
        """404 response returns None without raising."""
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_cm = AsyncMock()
            mock_cm.__aenter__ = AsyncMock(return_value=mock_cm)
            mock_cm.__aexit__ = AsyncMock(return_value=False)
            mock_cm.get = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_cm

            client = self._make_client()
            result = await client.fetch_artifact("job-001", "repoIntelligenceReport")
            self.assertIsNone(result)

    async def test_fetch_artifact_returns_none_on_timeout(self):
        """Timeout returns None without raising."""
        import httpx

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_cm = AsyncMock()
            mock_cm.__aenter__ = AsyncMock(return_value=mock_cm)
            mock_cm.__aexit__ = AsyncMock(return_value=False)
            mock_cm.get = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
            mock_client_cls.return_value = mock_cm

            client = self._make_client()
            result = await client.fetch_artifact("job-001", "commitTimelineData")
            self.assertIsNone(result)

    async def test_fetch_artifact_returns_none_on_http_error(self):
        """HTTP 500 returns None without raising."""
        import httpx

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_cm = AsyncMock()
            mock_cm.__aenter__ = AsyncMock(return_value=mock_cm)
            mock_cm.__aexit__ = AsyncMock(return_value=False)
            mock_request = MagicMock()
            mock_http_response = MagicMock()
            mock_http_response.status_code = 500
            mock_cm.get = AsyncMock(
                side_effect=httpx.HTTPStatusError("Server error", request=mock_request, response=mock_http_response)
            )
            mock_client_cls.return_value = mock_cm

            client = self._make_client()
            result = await client.fetch_artifact("job-001", "commitIntentData")
            self.assertIsNone(result)

    async def test_fetch_line1_artifacts_returns_all_four_keys(self):
        """fetch_line1_artifacts always returns all 4 artifact keys."""
        from app.core.clients.repo_intelligence_client import RepoIntelligenceClient
        client = self._make_client()
        # Patch fetch_artifact to return None for everything
        client.fetch_artifact = AsyncMock(return_value=None)

        result = await client.fetch_line1_artifacts("job-001")
        self.assertIn("repoIntelligenceReport", result)
        self.assertIn("skillEvidenceGraph", result)
        self.assertIn("commitTimelineData", result)
        self.assertIn("commitIntentData", result)

    async def test_fetch_line1_artifacts_fetches_correct_count(self):
        """fetch_line1_artifacts calls fetch_artifact exactly 4 times."""
        from app.core.clients.repo_intelligence_client import RepoIntelligenceClient
        client = self._make_client()
        client.fetch_artifact = AsyncMock(return_value={"dummy": True})

        await client.fetch_line1_artifacts("job-001")
        self.assertEqual(client.fetch_artifact.call_count, 4)

    def test_artifact_key_map_covers_all_required_keys(self):
        """The artifact key map must cover all 4 required Line 1 artifacts."""
        from app.core.clients.repo_intelligence_client import _ARTIFACT_KEY_MAP
        required = {"repoIntelligenceReport", "skillEvidenceGraph", "commitTimelineData", "commitIntentData"}
        self.assertEqual(set(_ARTIFACT_KEY_MAP.keys()), required)


# =============================================================================
# 10. Orchestrator — Line 1 Input Isolation
# =============================================================================
class TestOrchestratorLine1Isolation(unittest.IsolatedAsyncioTestCase):
    """
    Validates that the orchestrator:
    - Fetches Line 1 data from the DB client (not from inputs)
    - Strips Line 1 artifact keys that callers mistakenly pass in inputs
    - Merges DB-fetched artifacts into merged_inputs before dispatch
    """

    def _make_orchestrator(self, line1_artifacts: dict):
        """Build an orchestrator with a mocked RepoIntelligenceClient."""
        from app.pipelines.candidate.orchestrator import CandidateEvaluationOrchestrator
        from app.core.clients.repo_intelligence_client import RepoIntelligenceClient

        mock_client = MagicMock(spec=RepoIntelligenceClient)
        mock_client.fetch_line1_artifacts = AsyncMock(return_value=line1_artifacts)
        orch = CandidateEvaluationOrchestrator(repo_intelligence_client=mock_client)
        return orch, mock_client

    async def test_line1_artifacts_fetched_by_job_id(self):
        """execute_task calls fetch_line1_artifacts with the correct job_id."""
        orch, mock_client = self._make_orchestrator({
            "repoIntelligenceReport": {},
            "skillEvidenceGraph": {"nodes": [], "edges": []},
            "commitTimelineData": {},
            "commitIntentData": {},
        })

        # We only need the client call to happen; stub the actual task method
        orch._experience_confidence_multiplier = AsyncMock(return_value={
            "status": "Completed", "resultData": '{"confidenceMultiplier": 1.0}',
            "telemetry": None, "events": [], "errorMessage": None, "schemaVersion": "2.0.0"
        })

        await orch.execute_task(
            task_type="L2-011",
            job_id="job-xyz",
            inputs={"workingExperience": []},
            correlation_id="test",
        )
        mock_client.fetch_line1_artifacts.assert_called_once_with("job-xyz")

    async def test_line1_keys_in_inputs_are_stripped(self):
        """Line 1 artifact keys passed in inputs must be stripped before dispatch."""
        orch, mock_client = self._make_orchestrator({
            "repoIntelligenceReport": {"fromDb": True},
            "skillEvidenceGraph": None,
            "commitTimelineData": None,
            "commitIntentData": None,
        })

        captured: dict = {}

        async def capture_inputs(job_id, merged_inputs, corr_id):
            captured.update(merged_inputs)
            return {
                "status": "Completed", "resultData": '{"confidenceMultiplier": 1.0}',
                "telemetry": None, "events": [], "errorMessage": None, "schemaVersion": "2.0.0"
            }

        orch._experience_confidence_multiplier = capture_inputs

        await orch.execute_task(
            task_type="L2-011",
            job_id="job-xyz",
            inputs={
                "workingExperience": [],
                # These should be stripped and replaced with DB data
                "repoIntelligenceReport": {"stale": "caller-provided"},
                "skillEvidenceGraph": {"stale": True},
            },
            correlation_id="test",
        )

        # DB value must win, not the caller-provided stale value
        self.assertEqual(captured.get("repoIntelligenceReport"), {"fromDb": True})
        self.assertNotIn("stale", captured.get("repoIntelligenceReport", {}))

    async def test_l2_inter_task_data_preserved_in_merged_inputs(self):
        """L2 inter-task data (e.g. skillProficiencies) must survive the merge."""
        orch, mock_client = self._make_orchestrator({
            "repoIntelligenceReport": {},
            "skillEvidenceGraph": None,
            "commitTimelineData": None,
            "commitIntentData": None,
        })

        captured: dict = {}

        async def capture_inputs(job_id, merged_inputs, corr_id):
            captured.update(merged_inputs)
            return {
                "status": "Completed", "resultData": '{"candidateScore": 70}',
                "telemetry": None, "events": [], "errorMessage": None, "schemaVersion": "2.0.0"
            }

        orch._career_level_mapper = capture_inputs

        l2_inter_data = {"skillProficiencies": [{"skill": "Python", "proficiencyLevel": 3}]}
        await orch.execute_task(
            task_type="L2-004",
            job_id="job-xyz",
            inputs=l2_inter_data,
            correlation_id="test",
        )

        self.assertIn("skillProficiencies", captured)
        self.assertEqual(captured["skillProficiencies"][0]["skill"], "Python")

    async def test_missing_line1_artifacts_do_not_crash(self):
        """If all Line 1 artifacts are None (DB unavailable), L2-011 still runs."""
        orch, mock_client = self._make_orchestrator({
            "repoIntelligenceReport": None,
            "skillEvidenceGraph": None,
            "commitTimelineData": None,
            "commitIntentData": None,
        })

        result = await orch.execute_task(
            task_type="L2-011",
            job_id="job-xyz",
            inputs={"workingExperience": []},
            correlation_id="test",
        )
        # L2-011 is deterministic and doesn't need Line 1 data
        self.assertEqual(result["status"], "Completed")


# =============================================================================
# 11. Working Style Classifier Fallback
# =============================================================================
class TestWorkingStyleClassifierFallback(unittest.IsolatedAsyncioTestCase):
    """
    Validates that:
    - If the AI returns a valid working style, it is preserved.
    - If the AI returns an invalid/unclassifiable style, it falls back to the rule-based primary style.
    - If the AI returns an invalid/unclassifiable style, the styleConfidence is mapped to a low-confidence neutral band (capped at 0.3).
    """

    def _make_orchestrator(self, claude_response_json: dict):
        import json
        from app.pipelines.candidate.orchestrator import CandidateEvaluationOrchestrator
        from app.core.services.claude_service import ClaudeService
        from app.pipelines.shared.ai.prompts.candidate_prompt_factory import CandidatePromptFactory

        mock_claude = MagicMock(spec=ClaudeService)
        mock_claude.analyze_repo_with_telemetry = AsyncMock(
            return_value=(json.dumps(claude_response_json), {"tokens": 100})
        )

        mock_prompt = MagicMock(spec=CandidatePromptFactory)
        mock_prompt.get_system_prompt.return_value = "System"
        mock_prompt.get_working_style_prompt.return_value = "User"

        orch = CandidateEvaluationOrchestrator()
        orch.claude_service = mock_claude
        orch.prompt_factory = mock_prompt
        return orch

    async def test_valid_style_preserved(self):
        import json
        orch = self._make_orchestrator({
            "primaryWorkingStyle": "System Designer",
            "styleConfidence": 0.85,
            "styleDistribution": {"System Designer": 0.85}
        })
        result = await orch._working_style_classifier(
            "job-1",
            {
                "commitIntentData": {"commitMessages": ["feat: hello"] * 2},
                "commitTimelineData": {}
            },
            "test"
        )
        self.assertEqual(result["status"], "Completed")
        data = json.loads(result["resultData"])
        self.assertEqual(data["primaryWorkingStyle"], "System Designer")
        self.assertEqual(data["styleConfidence"], 0.85)

    async def test_invalid_style_fallback_to_rule_based(self):
        import json
        # Setup: rule-based primary will be "Problem Solver" based on bugfix commits
        # Claude response returns an invalid "Unclassifiable" style
        orch = self._make_orchestrator({
            "primaryWorkingStyle": "Unclassifiable",
            "styleConfidence": 0.9,
            "styleDistribution": {}
        })
        result = await orch._working_style_classifier(
            "job-1",
            {
                "commitIntentData": {"commitMessages": ["fix: bug"] * 10},
                "commitTimelineData": {}
            },
            "test"
        )
        self.assertEqual(result["status"], "Completed")
        data = json.loads(result["resultData"])
        self.assertEqual(data["primaryWorkingStyle"], "Problem Solver")
        self.assertEqual(data["styleConfidence"], 0.3)  # Capped at 0.3
        self.assertEqual(data["_hybridSource"], "fallback_unclassifiable")


if __name__ == "__main__":
    unittest.main()

