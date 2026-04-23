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

if __name__ == "__main__":
    unittest.main()
