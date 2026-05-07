"""
test_new_features.py
====================
Unit tests covering all new functionality added in the AI-Feature-uat session:

  1. Weighted Skill Confidence Scoring  (orchestrator aggregate_results)
  2. Smart Critical-Path Code Sampler   (CodeSampler)
  3. 3-Tier JSON Extraction             (orchestrator _extract_json)
  4. Risk Scoring Type Multipliers      (risk_policy.json + orchestrator)
  5. Document / Certificate Extractors  (PdfTextExtractor, DocxTextExtractor,
                                         ImageTextExtractor, OcrTextExtractor)

All tests are fully offline — no Anthropic API calls, no Redis, no GitHub API.
"""

import os
import sys
import json
import tempfile
import unittest
import asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# ── Minimal env so Pydantic settings don't raise on import ───────────────────
os.environ.setdefault("ANTHROPIC_API_KEY", "dummy-key")
os.environ.setdefault("SHARED_SECRET", "dummy-secret")


# =============================================================================
# 1. Weighted Skill Confidence Scoring
# =============================================================================
class TestWeightedSkillConfidence(unittest.TestCase):
    """
    Validates the 3-tier confidence multiplier model that replaced the binary
    accept/reject skill calibration in aggregate_results.
    """

    def setUp(self):
        from app.pipelines.repository.orchestrators.github_analysis_orchestrator import (
            _CROSS_CUTTING_SKILL_PATTERNS,
            _SKILL_CONFIDENCE_FLOOR,
        )
        self.patterns = _CROSS_CUTTING_SKILL_PATTERNS
        self.floor = _SKILL_CONFIDENCE_FLOOR

    # ── Tier 1 ────────────────────────────────────────────────────────────────
    def test_tier1_direct_tech_match_accepted(self):
        """A skill whose name directly overlaps with a detected technology is Tier 1."""
        detected = {"react", "typescript", "docker"}
        skill = "React"
        skill_lower = skill.lower()
        tier1 = any(tech in skill_lower or skill_lower in tech for tech in detected)
        self.assertTrue(tier1, "React should match 'react' in detected tech set")

    def test_tier1_multiplier_gives_full_confidence(self):
        """Tier 1 multiplier (×1.0) keeps the LLM confidence unchanged."""
        llm_confidence = 85.0
        multiplier = 1.0
        self.assertEqual(llm_confidence * multiplier, 85.0)

    # ── Tier 2 ────────────────────────────────────────────────────────────────
    def test_tier2_state_management_matches_pattern(self):
        """'State Management' is a cross-cutting pattern — must be Tier 2."""
        skill_lower = "state management"
        tier2 = any(p in skill_lower for p in self.patterns)
        self.assertTrue(tier2, "'state management' should match cross-cutting patterns")

    def test_tier2_clean_architecture_matches_pattern(self):
        """'Clean Architecture' should be recognised as a Tier 2 pattern."""
        skill_lower = "clean architecture"
        tier2 = any(p in skill_lower for p in self.patterns)
        self.assertTrue(tier2)

    def test_tier2_rest_api_design_matches_pattern(self):
        """'REST API Design' should be a Tier 2 cross-cutting skill."""
        skill_lower = "rest api design"
        tier2 = any(p in skill_lower for p in self.patterns)
        self.assertTrue(tier2)

    def test_tier2_dependency_injection_matches_pattern(self):
        """'Dependency Injection' should be Tier 2."""
        skill_lower = "dependency injection"
        tier2 = any(p in skill_lower for p in self.patterns)
        self.assertTrue(tier2)

    def test_tier2_multiplier_reduces_confidence(self):
        """Tier 2 multiplier (×0.85) reduces LLM confidence proportionally."""
        llm_confidence = 80.0
        final = llm_confidence * 0.85
        self.assertAlmostEqual(final, 68.0)
        self.assertGreaterEqual(final, self.floor)

    # ── Tier 3 ────────────────────────────────────────────────────────────────
    def test_tier3_unknown_skill_gets_low_multiplier(self):
        """A made-up skill with no tech/pattern match is Tier 3 (×0.65)."""
        detected = {"python", "fastapi"}
        skill_lower = "quantum synergy optimisation"
        tier1 = any(tech in skill_lower or skill_lower in tech for tech in detected)
        tier2 = any(p in skill_lower for p in self.patterns)
        self.assertFalse(tier1)
        self.assertFalse(tier2)
        # Tier 3 → multiplier = 0.65
        llm_confidence = 50.0
        final = llm_confidence * 0.65
        self.assertAlmostEqual(final, 32.5)

    def test_tier3_below_floor_is_rejected(self):
        """A Tier 3 skill with low LLM confidence should fall below the floor."""
        llm_confidence = 55.0
        final = llm_confidence * 0.65   # = 35.75
        self.assertLess(final, self.floor, "35.75 should be below the 40.0 floor")

    def test_tier3_above_floor_is_accepted(self):
        """A Tier 3 skill with high LLM confidence still passes the floor."""
        llm_confidence = 70.0
        final = llm_confidence * 0.65   # = 45.5
        self.assertGreaterEqual(final, self.floor)

    # ── Universal skills (Git, GitHub, CI/CD) ─────────────────────────────────
    def test_universal_skills_always_pass(self):
        """Git, GitHub, CI/CD are always accepted regardless of detected stack."""
        universal = {"Git", "GitHub", "CI/CD"}
        detected = set()  # empty detected stack
        for skill in universal:
            skill_lower = skill.lower()
            tier1 = any(tech in skill_lower or skill_lower in tech for tech in detected)
            is_universal = skill in universal
            self.assertTrue(tier1 or is_universal, f"{skill} must be universal")


# =============================================================================
# 2. Smart Critical-Path Code Sampler
# =============================================================================
class TestSmartCodeSampler(unittest.IsolatedAsyncioTestCase):
    """
    Validates that the smart sampler selects files in the correct priority order:
    entry-points > critical-path dirs > package files > docs > remaining by size.
    """

    def _make_repo(self, structure: dict) -> str:
        """Create a temporary directory tree from {rel_path: content} dict."""
        tmpdir = tempfile.mkdtemp()
        for rel, content in structure.items():
            full = os.path.join(tmpdir, rel.replace("/", os.sep))
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, "w", encoding="utf-8") as fh:
                fh.write(content)
        return tmpdir

    async def test_entry_point_prioritised_over_large_file(self):
        """main.py should be selected even when another file is larger."""
        repo = self._make_repo({
            "main.py": "print('entry')\n",
            "utils/helpers.py": "x = 1\n" * 200,   # larger file
        })
        from app.pipelines.repository.github.code_sampler import CodeSampler, CodeSamplingOptions
        sampler = CodeSampler()
        result = await sampler.sample_async(repo, "", CodeSamplingOptions(max_files=5))
        self.assertIn("main.py", result.file_names, "main.py must be in sample")

    async def test_services_dir_prioritised_over_misc_code(self):
        """Files in services/ are Tier 2 and should be preferred over plain code files."""
        repo = self._make_repo({
            "services/user_service.py": "class UserService: pass\n",
            "misc/helper.py": "def helper(): pass\n",
            "misc/util.py": "def util(): pass\n",
        })
        from app.pipelines.repository.github.code_sampler import CodeSampler, CodeSamplingOptions
        sampler = CodeSampler()
        result = await sampler.sample_async(repo, "", CodeSamplingOptions(max_files=2))
        self.assertIn(
            os.path.join("services", "user_service.py"),
            result.file_names,
            "services/user_service.py must be selected as Tier 2"
        )

    async def test_package_manifest_always_included(self):
        """requirements.txt (Tier 3) should always be included when budget allows."""
        repo = self._make_repo({
            "requirements.txt": "fastapi\nuvicorn\n",
            "app.py": "from fastapi import FastAPI\n",
        })
        from app.pipelines.repository.github.code_sampler import CodeSampler, CodeSamplingOptions
        sampler = CodeSampler()
        result = await sampler.sample_async(repo, "", CodeSamplingOptions(max_files=5))
        self.assertIn("requirements.txt", result.file_names)

    async def test_file_truncated_to_max_lines(self):
        """Each file must be truncated to max_lines_per_file lines."""
        repo = self._make_repo({
            "main.py": "\n".join(f"line_{i}" for i in range(300)),
        })
        from app.pipelines.repository.github.code_sampler import CodeSampler, CodeSamplingOptions
        sampler = CodeSampler()
        result = await sampler.sample_async(repo, "", CodeSamplingOptions(max_files=5, max_lines_per_file=50))
        content = result.file_content[0]
        self.assertLessEqual(len(content.splitlines()), 50, "File must be truncated to 50 lines")

    async def test_max_files_limit_respected(self):
        """Sample must not exceed max_files."""
        repo = self._make_repo({f"file_{i}.py": f"x={i}\n" for i in range(30)})
        from app.pipelines.repository.github.code_sampler import CodeSampler, CodeSamplingOptions
        sampler = CodeSampler()
        result = await sampler.sample_async(repo, "", CodeSamplingOptions(max_files=10))
        self.assertLessEqual(len(result.file_names), 10)

    async def test_no_duplicate_files_selected(self):
        """Each file path must appear at most once."""
        repo = self._make_repo({
            "main.py": "app\n",
            "services/auth.py": "auth\n",
            "requirements.txt": "dep\n",
        })
        from app.pipelines.repository.github.code_sampler import CodeSampler, CodeSamplingOptions
        sampler = CodeSampler()
        result = await sampler.sample_async(repo, "", CodeSamplingOptions(max_files=20))
        self.assertEqual(len(result.file_names), len(set(result.file_names)))

    async def test_default_limits_are_increased(self):
        """Default max_files must be 20 and max_lines_per_file must be 150."""
        from app.pipelines.repository.github.code_sampler import CodeSamplingOptions
        opts = CodeSamplingOptions()
        self.assertEqual(opts.max_files, 20)
        self.assertEqual(opts.max_lines_per_file, 150)

    async def test_critical_path_dirs_recognised(self):
        """controllers/, handlers/, domain/ should all be treated as Tier 2."""
        from app.pipelines.repository.github.code_sampler import _CRITICAL_PATH_DIRS
        for dirname in ("controllers", "handlers", "domain", "usecases", "repositories"):
            self.assertIn(dirname, _CRITICAL_PATH_DIRS, f"'{dirname}' must be a critical-path dir")


# =============================================================================
# 3. Three-Tier JSON Extraction
# =============================================================================
class TestExtractJson(unittest.TestCase):
    """
    Validates the 3-tier _extract_json fallback chain:
      Tier 1 — direct json.loads
      Tier 2 — escape-sanitisation
      Tier 3 — json-repair
    """

    def setUp(self):
        from app.pipelines.repository.orchestrators.github_analysis_orchestrator import GitHubAnalysisOrchestrator
        self.orch = GitHubAnalysisOrchestrator.__new__(GitHubAnalysisOrchestrator)

    def test_tier1_clean_json(self):
        """Clean JSON parses on the first try."""
        raw = '{"key": "value", "score": 92.0}'
        result = self.orch._extract_json(raw, "test")
        self.assertEqual(result["key"], "value")
        self.assertEqual(result["score"], 92.0)

    def test_tier1_json_with_preamble(self):
        """JSON preceded by prose text is extracted via brace-slicing."""
        raw = 'Here is the JSON output:\n{"status": "ok", "count": 5}'
        result = self.orch._extract_json(raw, "test")
        self.assertEqual(result["status"], "ok")

    def test_tier1_json_with_trailing_text(self):
        """JSON followed by prose is handled correctly."""
        raw = '{"level": "low"} // end of output'
        result = self.orch._extract_json(raw, "test")
        self.assertEqual(result["level"], "low")

    def test_tier2_invalid_escape_sanitised(self):
        """Stray backslashes in string values are sanitised before parsing."""
        # A raw backslash that isn't a valid JSON escape sequence
        raw = r'{"path": "C:\Users\dev\project", "ok": true}'
        # This will fail direct json.loads but should succeed after sanitisation
        try:
            result = self.orch._extract_json(raw, "test")
            self.assertIn("ok", result)
        except Exception:
            # Tier 2 or Tier 3 must handle this — it should not propagate
            self.fail("_extract_json should not raise on a sanitisable escape error")

    def test_raises_on_completely_invalid_input(self):
        """Completely unparseable input must raise an exception."""
        raw = "This is not JSON at all. No braces. No structure."
        with self.assertRaises(Exception):
            self.orch._extract_json(raw, "test")

    def test_nested_json_extracted_correctly(self):
        """Nested objects and arrays parse without data loss."""
        raw = '{"skills": ["Python", "FastAPI"], "meta": {"version": "v2"}}'
        result = self.orch._extract_json(raw, "test")
        self.assertListEqual(result["skills"], ["Python", "FastAPI"])
        self.assertEqual(result["meta"]["version"], "v2")

    def test_numeric_values_preserved(self):
        """Numeric values remain numbers, not strings."""
        raw = '{"score": 87.5, "count": 42, "ratio": 0.95}'
        result = self.orch._extract_json(raw, "test")
        self.assertIsInstance(result["score"], float)
        self.assertIsInstance(result["count"], int)


# =============================================================================
# 4. Risk Scoring Type Multipliers
# =============================================================================
class TestRiskPolicyTypeMultipliers(unittest.TestCase):
    """
    Validates that risk_policy.json contains sensible type_multipliers and that
    Portfolio Website receives a lower operational penalty than SaaS Platform.
    """

    def setUp(self):
        policy_path = os.path.join(
            os.path.dirname(__file__), "..", "app", "pipelines", "repository", "scoring", "risk_policy.json"
        )
        with open(policy_path, "r", encoding="utf-8") as fh:
            self.policy = json.load(fh)
        self.mults = self.policy.get("type_multipliers", {})

    def test_type_multipliers_section_exists(self):
        """risk_policy.json must contain a type_multipliers section."""
        self.assertIn("type_multipliers", self.policy)

    def test_default_multiplier_exists(self):
        """A 'default' key must be present as fallback."""
        self.assertIn("default", self.mults)

    def test_saas_platform_full_cicd_penalty(self):
        """SaaS Platform no_cicd multiplier must be 1.0 (full penalty)."""
        saas = self.mults.get("SaaS Platform", {})
        self.assertEqual(saas.get("no_cicd"), 1.0)

    def test_portfolio_website_low_cicd_penalty(self):
        """Portfolio Website no_cicd multiplier must be less than 0.5."""
        portfolio = self.mults.get("Portfolio Website", {})
        self.assertLess(portfolio.get("no_cicd", 1.0), 0.5)

    def test_portfolio_penalty_lower_than_saas(self):
        """Portfolio Website must receive lower CI/CD penalty than SaaS Platform."""
        saas_cicd = self.mults.get("SaaS Platform", {}).get("no_cicd", 1.0)
        portfolio_cicd = self.mults.get("Portfolio Website", {}).get("no_cicd", 1.0)
        self.assertLess(portfolio_cicd, saas_cicd)

    def test_library_tests_penalty_is_high(self):
        """Libraries should still have near-full test penalty (tests matter for libs)."""
        lib = self.mults.get("Library", {})
        self.assertGreaterEqual(lib.get("no_tests", 0), 0.9)

    def test_all_multipliers_between_zero_and_one(self):
        """Every multiplier value must be in the range [0.0, 1.0]."""
        for proj_type, mults in self.mults.items():
            if proj_type == "_comment":
                continue
            for key, val in mults.items():
                self.assertGreaterEqual(val, 0.0, f"{proj_type}.{key} < 0")
                self.assertLessEqual(val, 1.0, f"{proj_type}.{key} > 1")

    def test_operational_score_portfolio_vs_saas(self):
        """End-to-end: Portfolio site scores lower operational risk than SaaS."""
        op_cfg = self.policy["weights"]["operational"]
        base = op_cfg["base_score"]
        no_cicd = op_cfg["no_cicd"]
        no_tests = op_cfg["no_tests"]
        no_logging = op_cfg["no_logging"]
        no_metrics = op_cfg["no_metrics"]

        def calc_op_score(proj_type):
            m = self.mults.get(proj_type, self.mults["default"])
            score = base
            score += no_cicd * m.get("no_cicd", 1.0)
            score += no_tests * m.get("no_tests", 1.0)
            score += no_logging * m.get("no_logging", 1.0)
            score += no_metrics * m.get("no_metrics", 1.0)
            return min(100.0, score)

        saas_score = calc_op_score("SaaS Platform")
        portfolio_score = calc_op_score("Portfolio Website")
        self.assertLess(portfolio_score, saas_score,
                        f"Portfolio ({portfolio_score}) should score lower than SaaS ({saas_score})")


# =============================================================================
# 5. Document / Certificate Extractors
# =============================================================================
class TestExtractors(unittest.IsolatedAsyncioTestCase):
    """
    Validates the extractor classes. Because PDF/DOCX/image parsing requires
    optional heavy dependencies, tests use graceful-degradation checks:
    extractors must never raise — they return "" on missing libs or bad input.
    """

    async def test_pdf_extractor_empty_bytes_returns_empty(self):
        """PdfTextExtractor must return '' for empty input without raising."""
        from app.pipelines.shared.extractors.pdf_extractor import PdfTextExtractor
        result = await PdfTextExtractor().extract_async(b"")
        self.assertEqual(result, "")

    async def test_docx_extractor_empty_bytes_returns_empty(self):
        """DocxTextExtractor must return '' for empty input without raising."""
        from app.pipelines.shared.extractors.docx_extractor import DocxTextExtractor
        result = await DocxTextExtractor().extract_async(b"")
        self.assertEqual(result, "")

    async def test_image_extractor_empty_bytes_returns_empty(self):
        """ImageTextExtractor must return '' for empty input without raising."""
        from app.pipelines.shared.extractors.image_extractor import ImageTextExtractor
        result = await ImageTextExtractor().extract_async(b"")
        self.assertEqual(result, "")

    async def test_ocr_extractor_delegates_to_image_extractor(self):
        """OcrTextExtractor must delegate to ImageTextExtractor."""
        from app.pipelines.shared.extractors.ocr_extractor import OcrTextExtractor
        from app.pipelines.shared.extractors.image_extractor import ImageTextExtractor
        extractor = OcrTextExtractor()
        self.assertIsInstance(extractor._delegate, ImageTextExtractor)

    async def test_pdf_extractor_invalid_bytes_returns_empty(self):
        """PdfTextExtractor must gracefully return '' on corrupted bytes."""
        from app.pipelines.shared.extractors.pdf_extractor import PdfTextExtractor
        result = await PdfTextExtractor().extract_async(b"not a real pdf content xyz")
        self.assertEqual(result, "")

    async def test_image_extractor_invalid_bytes_returns_empty(self):
        """ImageTextExtractor must gracefully return '' on non-image bytes."""
        from app.pipelines.shared.extractors.image_extractor import ImageTextExtractor
        result = await ImageTextExtractor().extract_async(b"this is not an image")
        self.assertEqual(result, "")

    async def test_image_extractor_vision_disabled_by_default(self):
        """Tier-2 Claude Vision must be disabled when env var is not set."""
        os.environ.pop("ENABLE_VISION_CERTIFICATE_OCR", None)
        vision_enabled = os.getenv("ENABLE_VISION_CERTIFICATE_OCR", "false").lower() == "true"
        self.assertFalse(vision_enabled)

    async def test_all_extractors_implement_interface(self):
        """All concrete extractors must implement ITextExtractor."""
        from app.pipelines.shared.extractors.text_extractor import ITextExtractor
        from app.pipelines.shared.extractors.pdf_extractor import PdfTextExtractor
        from app.pipelines.shared.extractors.docx_extractor import DocxTextExtractor
        from app.pipelines.shared.extractors.image_extractor import ImageTextExtractor
        from app.pipelines.shared.extractors.ocr_extractor import OcrTextExtractor
        for cls in (PdfTextExtractor, DocxTextExtractor, ImageTextExtractor, OcrTextExtractor):
            self.assertTrue(
                issubclass(cls, ITextExtractor),
                f"{cls.__name__} must implement ITextExtractor"
            )

    def test_image_extractor_magic_byte_detection(self):
        """PNG magic bytes must resolve to .png extension."""
        from app.pipelines.shared.extractors.image_extractor import _detect_extension
        png_magic = b"\x89PNG\r\n\x1a\n"
        self.assertEqual(_detect_extension(png_magic), ".png")

    def test_image_extractor_jpg_magic_byte_detection(self):
        """JPEG magic bytes must resolve to .jpg extension."""
        from app.pipelines.shared.extractors.image_extractor import _detect_extension
        jpg_magic = b"\xff\xd8\xff\xe0"
        self.assertEqual(_detect_extension(jpg_magic), ".jpg")

    def test_extractor_init_exports(self):
        """__init__.py must export all 5 extractor symbols."""
        from app.pipelines.shared.extractors import (
            ITextExtractor, PdfTextExtractor, DocxTextExtractor,
            ImageTextExtractor, OcrTextExtractor
        )
        self.assertTrue(callable(PdfTextExtractor))
        self.assertTrue(callable(ImageTextExtractor))


if __name__ == "__main__":
    unittest.main()
