"""
Unit tests for ContributorIdentityResolver, GitHubIdentityService, and the L1 fallback rules.
"""

import os
import sys
import unittest
from unittest.mock import MagicMock, AsyncMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# ── Minimal env so Pydantic settings don't raise on import ───────────────────
os.environ.setdefault("ANTHROPIC_API_KEY", "dummy-key")
os.environ.setdefault("SHARED_SECRET", "dummy-secret")

from app.pipelines.repository.github.identity_resolver import (
    hash_email,
    ContributorIdentityResolver,
    GitHubIdentityService
)
from app.pipelines.repository.orchestrators.github_analysis_orchestrator import GitHubAnalysisOrchestrator
from app.core.config import settings

class TestContributorIdentityResolver(unittest.TestCase):
    def test_hash_email(self):
        """Verifies that hash_email produces a normalized SHA-256 fingerprint."""
        email = " LucFr@example.com "
        expected = "5a0dfcac8e9d3ddbde37a2db4c4b37c0c77d5ed5d336cc487921cee54a4570e6" # SHA-256 of lucfr@example.com
        self.assertEqual(hash_email(email), expected)

    def test_resolver_matching(self):
        """Verifies that ContributorIdentityResolver resolves user identity by username, emails, or noreply aliases."""
        user_email = "test-user@example.com"
        resolver = ContributorIdentityResolver(
            github_username="testusername",
            github_email_hashes=[hash_email(user_email)],
            repository_owner_login="testusername",
            authenticated_user_login="testusername",
            owner_verified=True
        )

        # 1. Matching by email hash
        self.assertTrue(resolver.is_user(user_email, "Some Random Name"))
        self.assertTrue(resolver.is_user("test-user@example.com", None))

        # 2. Matching by noreply email pattern
        self.assertTrue(resolver.is_user("12345+testusername@users.noreply.github.com", "Some Name"))
        self.assertFalse(resolver.is_user("12345+other@users.noreply.github.com", "Some Name"))

        # 3. Matching by name/login
        self.assertTrue(resolver.is_user("other@example.com", "testusername"))
        self.assertTrue(resolver.is_user("testusername@example.com", "Other"))

        # 4. Bot matching
        self.assertTrue(resolver.is_bot("action@github.com", "GitHub Actions"))
        self.assertTrue(resolver.is_bot(None, "dependabot[bot]"))
        self.assertFalse(resolver.is_bot("test-user@example.com", "Developer Name"))

class TestOrchestratorAttributionFallback(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.orch = GitHubAnalysisOrchestrator.__new__(GitHubAnalysisOrchestrator)
        # Mock public publish_task_event method
        self.orch.publish_task_event = AsyncMock()

    @patch("app.pipelines.repository.orchestrators.github_analysis_orchestrator.settings")
    async def test_clone_detection_disabled(self, mock_settings):
        """Verifies that clone detection returns not_evaluated when disabled."""
        mock_settings.clone_detection_enabled = False
        
        # Call analyze_clone_detection
        res = await self.orch.analyze_clone_detection("dummy_job", "token", "corr")
        self.assertEqual(res["data"]["classification"], "not_evaluated")
        self.assertEqual(res["data"]["clone_risk_score"], 0.0)

    async def test_analyze_ownership_single_author_fallback(self):
        """Verifies that single human contributor with verified owner sets 1.0 ownership and fallback method."""
        meta = {
            "owner_verified": True,
            "user_email_hashes": [hash_email("test@example.com")],
            "username": "lucfr",
            "repo_type": "ORIGINAL"
        }
        blame_cache = {
            "overall_author_ratio": 0.0,
            "file_authorship": [
                {"file": "main.py", "user_lines": 0, "total_lines": 100}
            ],
            "ownership_method": "unresolved"
        }
        commit_cache = {
            "ownership": {
                "human_contributors_count": 1,
                "ownership_method": "unresolved"
            }
        }
        clone_cache = {"clone_similarity_score": 0.0}
        timeline_cache = {"refactor_initiative": 0.0, "bug_to_fix_ratio": 0.0}

        self.orch._read_meta = MagicMock(return_value=meta)
        self.orch._read_task_cache = MagicMock(side_effect=lambda j, task: {
            "GitBlame": blame_cache,
            "CommitIntelligence": commit_cache,
            "CloneDetection": clone_cache,
            "CommitTimeline": timeline_cache
        }[task])

        res = await self.orch.analyze_ownership("dummy_job", "token", "corr")
        data = res["data"]
        self.assertEqual(data["ownership_score"], 1.0)
        self.assertEqual(data["attribution_metadata"]["ownership_method"], "fallback_single_author")
        self.assertEqual(data["attribution_metadata"]["ownership_confidence"], 1.0)
        self.assertEqual(data["attribution_metadata"]["attribution_strategy"], "owner_verified_single_author")
        self.assertEqual(data["module_ownership"]["root"], 1.0)  # Verify all lines mapped

    async def test_analyze_ownership_mismatch_unresolved(self):
        """Verifies that unresolved attribution sets ownership score to 0.0."""
        meta = {
            "owner_verified": False,
            "user_email_hashes": [hash_email("test@example.com")],
            "username": "lucfr",
            "repo_type": "ORIGINAL"
        }
        blame_cache = {
            "overall_author_ratio": 0.0,
            "file_authorship": [
                {"file": "main.py", "user_lines": 0, "total_lines": 100}
            ],
            "ownership_method": "unresolved"
        }
        commit_cache = {
            "ownership": {
                "human_contributors_count": 3,
                "ownership_method": "unresolved"
            }
        }
        clone_cache = {"clone_similarity_score": 0.0}
        timeline_cache = {"refactor_initiative": 0.0, "bug_to_fix_ratio": 0.0}

        self.orch._read_meta = MagicMock(return_value=meta)
        self.orch._read_task_cache = MagicMock(side_effect=lambda j, task: {
            "GitBlame": blame_cache,
            "CommitIntelligence": commit_cache,
            "CloneDetection": clone_cache,
            "CommitTimeline": timeline_cache
        }[task])

        res = await self.orch.analyze_ownership("dummy_job", "token", "corr")
        data = res["data"]
        self.assertEqual(data["ownership_score"], 0.0)
        self.assertEqual(data["attribution_metadata"]["ownership_method"], "unresolved")

if __name__ == "__main__":
    unittest.main()
