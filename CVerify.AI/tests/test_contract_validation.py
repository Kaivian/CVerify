import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import unittest
from pydantic import ValidationError
from app.orchestrators.github_analysis_orchestrator import (
    ReportV2Contract, ClassificationV2, SectionV2, RiskV2
)

class TestContractValidation(unittest.TestCase):
    def setUp(self):
        self.valid_payload = {
            "schemaVersion": "v2",
            "repoId": "ace07176-a2ad-494f-838d-4f5686e13156",
            "classification": {
                "primaryDomain": "Library / Package",
                "subDomain": "Python, JavaScript",
                "confidence": 0.85,
                "isVerified": True,
                "trustScore": 0.9
            },
            "sections": [
                {
                    "type": "engineering_practices",
                    "items": ["Testing configured (pytest)", "CI/CD enabled"]
                },
                {
                    "type": "security_findings",
                    "items": ["No vulnerabilities detected"]
                },
                {
                    "type": "architecture_insights",
                    "items": ["Clean architecture observed"]
                }
            ],
            "risk": {
                "score": 15.0,
                "level": "low",
                "reasons": ["Authentic history"]
            },
            # Allow legacy fields for backward compatibility
            "facts": {},
            "ai_conclusions": {}
        }

    def test_valid_payload_passes(self):
        """Verifies that a valid schema v2 payload parses successfully."""
        try:
            ReportV2Contract.model_validate(self.valid_payload)
        except ValidationError as e:
            self.fail(f"ValidationError raised unexpectedly: {e}")

    def test_missing_schema_version(self):
        """Verifies that missing schemaVersion raises ValidationError."""
        payload = self.valid_payload.copy()
        del payload["schemaVersion"]
        with self.assertRaises(ValidationError):
            ReportV2Contract.model_validate(payload)

    def test_invalid_schema_version(self):
        """Verifies that wrong schemaVersion raises ValidationError."""
        payload = self.valid_payload.copy()
        payload["schemaVersion"] = "v3"
        with self.assertRaises(ValidationError):
            ReportV2Contract.model_validate(payload)

    def test_invalid_confidence_range(self):
        """Verifies that confidence > 1.0 raises ValidationError."""
        payload = self.valid_payload.copy()
        payload["classification"] = payload["classification"].copy()
        payload["classification"]["confidence"] = 1.5
        with self.assertRaises(ValidationError):
            ReportV2Contract.model_validate(payload)

    def test_invalid_risk_level(self):
        """Verifies that incorrect risk level value raises ValidationError."""
        payload = self.valid_payload.copy()
        payload["risk"] = payload["risk"].copy()
        payload["risk"]["level"] = "very-high"
        with self.assertRaises(ValidationError):
            ReportV2Contract.model_validate(payload)

    def test_invalid_section_type(self):
        """Verifies that unsupported section type raises ValidationError."""
        payload = self.valid_payload.copy()
        payload["sections"] = [
            {
                "type": "invalid_section_type",
                "items": ["something"]
            }
        ]
        with self.assertRaises(ValidationError):
            ReportV2Contract.model_validate(payload)

    def test_valid_cv_synthesis_passes(self):
        """Verifies that a valid CvSynthesisContract payload parses successfully."""
        from app.orchestrators.github_analysis_orchestrator import CvSynthesisContract
        valid_cv = {
            "schemaVersion": "v2",
            "title": "SaaS Platform Developer",
            "skills": ["Python", "FastAPI", "React"],
            "summary": "Led the architectural design and full-stack development of the CVerify platform, implementing robust OAuth2 authorization flows, optimizing Postgres database queries to achieve a 40% reduction in API response latency, and establishing automated CI/CD workflows using GitHub Actions.",
            "highlights": [
                {"signal": "Implemented OAuth token authorization controls.", "impact": "positive"},
                {"signal": "Optimized SQL query response latency.", "impact": "positive"}
            ],
            "ownershipProfile": "High contribution profile"
        }
        try:
            CvSynthesisContract.model_validate(valid_cv)
        except ValidationError as e:
            self.fail(f"ValidationError raised unexpectedly on CvSynthesisContract: {e}")

    def test_invalid_ownership_profile(self):
        """Verifies that an invalid ownershipProfile raises ValidationError."""
        from app.orchestrators.github_analysis_orchestrator import CvSynthesisContract
        invalid_cv = {
            "schemaVersion": "v2",
            "title": "SaaS Platform Developer",
            "skills": ["Python"],
            "summary": "Led the architectural design and full-stack development of the CVerify platform, implementing robust OAuth2 authorization flows, optimizing Postgres database queries to achieve a 40% reduction in API response latency, and establishing automated CI/CD workflows using GitHub Actions.",
            "highlights": [
                {"signal": "Implemented OAuth controls.", "impact": "positive"}
            ],
            "ownershipProfile": "Very active developer"  # Invalid enum value
        }
        with self.assertRaises(ValidationError):
            CvSynthesisContract.model_validate(invalid_cv)

    def test_valid_payload_with_dict_sections_passes(self):
        """Verifies that a v2 payload containing dictionary section items passes validation."""
        payload = self.valid_payload.copy()
        payload["sections"] = [
            {
                "type": "engineering_practices",
                "items": [
                    {"title": "Testing", "content": "Pytest configured (configured)"},
                    "CI/CD enabled"
                ]
            },
            {
                "type": "security_findings",
                "items": [
                    {"title": "No critical vulnerabilities", "content": "No warning findings detected."}
                ]
            }
        ]
        try:
            ReportV2Contract.model_validate(payload)
        except ValidationError as e:
            self.fail(f"ValidationError raised unexpectedly on dictionary section items: {e}")

    def test_json_repair_scanner(self):
        """Verifies that the internal JSON repair scanner correctly fixes malformed JSON."""
        from app.orchestrators.github_analysis_orchestrator import GitHubAnalysisOrchestrator
        orchestrator = GitHubAnalysisOrchestrator()
        
        test_cases = [
            (
                r'{"evidence": ["Uses "Streams API" in UserService.java"]}',
                {"evidence": ["Uses \"Streams API\" in UserService.java"]}
            ),
            (
                '{"summary": "Line 1.\nLine 2."}',
                {"summary": "Line 1.\nLine 2."}
            ),
            (
                r'{"skills": ["Java", "C#",], "meta": {"a": 1,}}',
                {"skills": ["Java", "C#"], "meta": {"a": 1}}
            ),
            (
                r'{"msg": "He said \"hello\""}',
                {"msg": 'He said "hello"'}
            ),
            (
                r'{"my "key"": "val"}',
                {"my \"key\"": "val"}
            ),
            (
                r'{"path": "client\\package.json"}',
                {"path": "client\\package.json"}
            ),
            (
                r'{"path": "client\package.json"}',
                {"path": "client\\package.json"}
            ),
            (
                r'{"path": "C:\Users\LucFr\.gemini\temp"}',
                {"path": r"C:\Users\LucFr\.gemini\temp"}
            ),
            (
                r'{"path": "C:\Users\LucFr\.gemini\temp\new\path"}',
                {"path": r"C:\Users\LucFr\.gemini\temp\new\path"}
            ),
            (
                r'{"a": {"b": [1, 2, "hello"',
                {"a": {"b": [1, 2, "hello"]}}
            ),
            (
                r'{"a": {"b": [1, 2, 3',
                {"a": {"b": [1, 2, 3]}}
            ),
            (
                r'{"a": {"b": [1, 2, 3, ',
                {"a": {"b": [1, 2, 3]}}
            ),
            (
                r'{"schemaVersion": "2.0.0", "data": {"skills": [{"skill": "Monorepo", "evidence": ["CVerify.sln',
                {"schemaVersion": "2.0.0", "data": {"skills": [{"skill": "Monorepo", "evidence": ["CVerify.sln"]}]}}
            )
        ]
        
        for raw, expected in test_cases:
            repaired = orchestrator._repair_json_string(raw)
            try:
                import json
                parsed = json.loads(repaired)
                self.assertEqual(parsed, expected)
            except Exception as e:
                self.fail(f"Failed to parse repaired JSON: {repaired}. Error: {e}")

if __name__ == "__main__":
    unittest.main()
