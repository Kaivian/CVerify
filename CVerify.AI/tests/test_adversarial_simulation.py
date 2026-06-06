import os
import sys
import unittest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, AsyncMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Set dummy environment variables
os.environ["ANTHROPIC_API_KEY"] = "dummy-key"
os.environ["SHARED_SECRET"] = "dummy-secret"

from app.github.repo_classifier import classify_repository, RepoClassification

class TestAdversarialSimulation(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        self.mock_token = "dummy_github_token"
        self.repo_owner = "test_owner"
        self.repo_name = "test_repo"

    @patch("httpx.AsyncClient.get")
    async def test_adversarial_history_rewriting_simulation(self, mock_get):
        """Simulates history rewriting via compressed commit timestamps and verifies detection."""
        
        # Mock responses (synchronous MagicMock)
        # 1. /user
        mock_user = MagicMock()
        mock_user.status_code = 200
        mock_user.json.return_value = {"login": "test_developer", "email": "dev@cverify.ai"}
        
        # 2. /repos/test_owner/test_repo
        mock_repo = MagicMock()
        mock_repo.status_code = 200
        mock_repo.json.return_value = {
            "fork": False,
            "stargagers_count": 0,
            "forks_count": 0,
            "created_at": "2026-01-01T00:00:00Z",
            "owner": {"type": "User"}
        }

        # 3. Commits API showing rapid compressed dates (e.g. 5 commits spaced 0.5s apart)
        base_time = datetime.utcnow()
        mock_commits = []
        for i in range(5):
            commit_time = (base_time + timedelta(seconds=i * 0.5)).strftime("%Y-%m-%dT%H:%M:%SZ")
            mock_commits.append({
                "sha": f"sha_{i}",
                "commit": {
                    "author": {
                        "name": "test_developer",
                        "email": "dev@cverify.ai",
                        "date": commit_time
                    },
                    "verification": {
                        "verified": True
                    }
                },
                "author": {"login": "test_developer"}
            })
        
        mock_commits_resp = MagicMock()
        mock_commits_resp.status_code = 200
        mock_commits_resp.json.return_value = mock_commits

        # Single commit details mock
        mock_single_commit = MagicMock()
        mock_single_commit.status_code = 200
        mock_single_commit.json.return_value = {"stats": {"additions": 0}}

        # 4. Empty/Default mock response for rest of endpoints
        mock_default = MagicMock()
        mock_default.status_code = 200
        mock_default.json.return_value = []

        # Setup mock router based on URLs
        def mock_router(url, *args, **kwargs):
            if "/user" in url and "repos" not in url:
                return mock_user
            elif f"/repos/{self.repo_owner}/{self.repo_name}/commits/" in url or any(url.endswith(f"commits/{c['sha']}") for c in mock_commits):
                return mock_single_commit
            elif f"/repos/{self.repo_owner}/{self.repo_name}/commits" in url:
                return mock_commits_resp
            elif f"/repos/{self.repo_owner}/{self.repo_name}" in url and "commits" not in url and "contributors" not in url and "branches" not in url:
                return mock_repo
            return mock_default

        mock_get.side_effect = mock_router

        # Execute classification
        result = await classify_repository(self.repo_owner, self.repo_name, self.mock_token)
        
        # Asserts
        self.assertIsInstance(result, RepoClassification)
        # Ratio of compressed commits: 4 intervals of 0.5s, all 4 are <= 1s, ratio should be 1.0
        self.assertEqual(result.timestamp_compression_ratio, 1.0)
        # Should detect that commits are unverified (none)
        self.assertEqual(result.unverified_commits_count, 0)
        self.assertEqual(result.uncalibrated_identities_count, 0)

    @patch("httpx.AsyncClient.get")
    async def test_unverified_and_uncalibrated_identity_simulation(self, mock_get):
        """Simulates identity hijacking and signature omissions to verify classification flags."""
        
        # Mock user
        mock_user = MagicMock()
        mock_user.status_code = 200
        mock_user.json.return_value = {"login": "target_user", "email": "target@cverify.ai"}

        # Mock repo
        mock_repo = MagicMock()
        mock_repo.status_code = 200
        mock_repo.json.return_value = {
            "fork": False,
            "stargagers_count": 5,
            "forks_count": 1,
            "created_at": "2025-01-01T00:00:00Z",
            "owner": {"type": "User"}
        }

        # Mock commits:
        # - 3 commits in total:
        #   - commit 1: unverified, uncalibrated (author: None)
        #   - commit 2: unverified, uncalibrated (author: None)
        #   - commit 3: verified, calibrated
        mock_commits = [
            {
                "sha": "sha_1",
                "commit": {
                    "author": {"name": "target_user", "email": "target@cverify.ai", "date": "2025-06-01T00:00:00Z"},
                    "verification": {"verified": False}
                },
                "author": None # Unregistered/Uncalibrated
            },
            {
                "sha": "sha_2",
                "commit": {
                    "author": {"name": "Anonymous Hijacker", "email": "spoof@hack.com", "date": "2025-06-02T00:00:00Z"},
                    "verification": {"verified": False}
                },
                "author": None # Unregistered/Uncalibrated
            },
            {
                "sha": "sha_3",
                "commit": {
                    "author": {"name": "target_user", "email": "target@cverify.ai", "date": "2025-06-03T00:00:00Z"},
                    "verification": {"verified": True}
                },
                "author": {"login": "target_user"}
            }
        ]

        mock_commits_resp = MagicMock()
        mock_commits_resp.status_code = 200
        mock_commits_resp.json.return_value = mock_commits

        # Single commit details mock
        mock_single_commit = MagicMock()
        mock_single_commit.status_code = 200
        mock_single_commit.json.return_value = {"stats": {"additions": 0}}

        # Empty/Default mock response for rest of endpoints
        mock_default = MagicMock()
        mock_default.status_code = 200
        mock_default.json.return_value = []

        def mock_router(url, *args, **kwargs):
            if "/user" in url and "repos" not in url:
                return mock_user
            elif f"/repos/{self.repo_owner}/{self.repo_name}/commits/" in url or any(url.endswith(f"commits/{c['sha']}") for c in mock_commits):
                return mock_single_commit
            elif f"/repos/{self.repo_owner}/{self.repo_name}/commits" in url:
                return mock_commits_resp
            elif f"/repos/{self.repo_owner}/{self.repo_name}" in url and "commits" not in url and "contributors" not in url and "branches" not in url:
                return mock_repo
            return mock_default

        mock_get.side_effect = mock_router

        # Execute classification
        result = await classify_repository(self.repo_owner, self.repo_name, self.mock_token)

        # Asserts
        self.assertEqual(result.unverified_commits_count, 2) # sha_1 and sha_2
        self.assertEqual(result.uncalibrated_identities_count, 2) # sha_1 and sha_2 has author: None
        self.assertEqual(result.timestamp_compression_ratio, 0.0) # spaced by 1 day, no compression

if __name__ == "__main__":
    unittest.main()
