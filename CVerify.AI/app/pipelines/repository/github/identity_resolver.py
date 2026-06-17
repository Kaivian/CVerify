import hashlib
import logging
import httpx
from typing import List, Optional, Dict, Any

logger = logging.getLogger("identity_resolver")

def hash_email(email: str) -> str:
    """Computes a normalized SHA-256 fingerprint for a given email address."""
    return hashlib.sha256(email.lower().strip().encode("utf-8")).hexdigest()

class GitHubIdentityService:
    @staticmethod
    async def fetch_user_identity(encrypted_token: str, correlation_id: str = "system") -> dict:
        """Discovers the authenticated user's GitHub username and email hashes from the GitHub API.
        Performs email hashing immediately to protect PII.
        """
        extra_log = {"correlation_id": correlation_id}
        headers = {
            "Authorization": f"token {encrypted_token}",
            "User-Agent": "CVerify-AI/1.0",
            "Accept": "application/vnd.github.v3+json"
        }
        
        username = None
        email_hashes = []
        
        async with httpx.AsyncClient(headers=headers, timeout=10.0) as client:
            # 1. Fetch user profile
            try:
                user_resp = await client.get("https://api.github.com/user")
                if user_resp.status_code == 200:
                    user_data = user_resp.json()
                    username = user_data.get("login")
                    public_email = user_data.get("email")
                    if public_email:
                        email_hashes.append(hash_email(public_email))
            except Exception as e:
                logger.error(f"GitHubIdentityService: Failed to fetch user profile: {e}", extra=extra_log)
            
            # 2. Fetch all user emails (including private/noreply ones)
            try:
                emails_resp = await client.get("https://api.github.com/user/emails")
                if emails_resp.status_code == 200:
                    for item in emails_resp.json():
                        email = item.get("email")
                        if email:
                            h = hash_email(email)
                            if h not in email_hashes:
                                email_hashes.append(h)
            except Exception as e:
                logger.warning(f"GitHubIdentityService: Failed to fetch user emails list: {e}", extra=extra_log)
                
        return {
            "authenticated_user_login": username,
            "user_email_hashes": email_hashes
        }

class ContributorIdentityResolver:
    def __init__(
        self,
        github_username: Optional[str] = None,
        github_email_hashes: Optional[List[str]] = None,
        repository_owner_login: Optional[str] = None,
        authenticated_user_login: Optional[str] = None,
        owner_verified: bool = False
    ):
        self.github_username = (github_username or "").lower().strip()
        self.github_email_hashes = [h.lower().strip() for h in (github_email_hashes or []) if h]
        self.repository_owner_login = (repository_owner_login or "").lower().strip()
        self.authenticated_user_login = (authenticated_user_login or "").lower().strip()
        self.owner_verified = owner_verified

    def is_user(self, email: Optional[str], name: Optional[str]) -> bool:
        """Determines if the commit author (email, name) belongs to the authenticated candidate."""
        email_clean = (email or "").lower().strip()
        name_clean = (name or "").lower().strip()

        if not email_clean and not name_clean:
            return False

        # 1. Hashed email matching
        if email_clean:
            h = hash_email(email_clean)
            if h in self.github_email_hashes:
                return True

        # 2. Match GitHub noreply emails (e.g. ID+username@users.noreply.github.com)
        if "noreply" in email_clean and "github.com" in email_clean:
            parts = email_clean.split("@")[0].split("+")
            extracted_username = parts[-1] if parts else ""
            if extracted_username and self.github_username and extracted_username == self.github_username:
                return True

        # 3. Match username/login
        if self.github_username:
            if name_clean == self.github_username:
                return True
            prefix = email_clean.split("@")[0] if "@" in email_clean else ""
            if prefix and prefix == self.github_username:
                return True
                
        if self.authenticated_user_login:
            if name_clean == self.authenticated_user_login:
                return True
            prefix = email_clean.split("@")[0] if "@" in email_clean else ""
            if prefix and prefix == self.authenticated_user_login:
                return True

        return False

    def is_bot(self, email: Optional[str], name: Optional[str]) -> bool:
        """Detects whether a commit author is a bot/CI system rather than a human developer."""
        e = (email or "").lower().strip()
        n = (name or "").lower().strip()
        bot_keywords = ["[bot]", "github-actions", "dependabot", "claude", "copilot", "action@github.com", "action", "workflow"]
        return any(kw in e or kw in n for kw in bot_keywords)
