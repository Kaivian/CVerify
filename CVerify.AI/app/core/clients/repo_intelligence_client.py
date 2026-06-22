"""
repo_intelligence_client.py
============================
HTTP client for fetching Line 1 (Repository Intelligence) artifacts from the
CVerify.Core (.NET) backend database.

Line 2 tasks must NOT receive Line 1 data as direct request inputs.
Instead they call this client with a jobId to load the stored artifacts.

Fetched artifacts:
  - repoIntelligenceReport  : the full unified Line 1 report
  - skillEvidenceGraph       : L1-017 Skill Evidence Graph
  - commitTimelineData       : L1-007 Commit Timeline Analysis
  - commitIntentData         : L1-009 Commit Intent Classification

Endpoint convention (CVerify.Core):
  GET {BACKEND_API_URL}/api/v1/ai-jobs/{jobId}/artifacts/{artifactKey}

The client returns None per artifact on any fetch error, so Line 2 tasks
degrade gracefully when an artifact is not yet available.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger("repo_intelligence_client")

# Map from the artifact key used inside Line 2 → the artifact identifier stored
# by CVerify.Core.  Update these if the .NET team changes their naming.
_ARTIFACT_KEY_MAP: dict[str, str] = {
    "repoIntelligenceReport": "repo-intelligence-report",
    "skillEvidenceGraph": "L1-017",
    "commitTimelineData": "L1-007",
    "commitIntentData": "L1-009",
}


class RepoIntelligenceClient:
    """
    Thin async HTTP client that retrieves stored Line 1 artifacts for a job.

    Usage:
        client = RepoIntelligenceClient()
        artifacts = await client.fetch_line1_artifacts("job-abc-123")
        report = artifacts["repoIntelligenceReport"]   # dict | None
    """

    def __init__(self, base_url: str | None = None, timeout: float = 30.0) -> None:
        self._base_url = (base_url or settings.backend_api_url).rstrip("/")
        self._timeout = timeout

    async def fetch_artifact(self, job_id: str, artifact_key: str) -> dict[str, Any] | None:
        """
        Fetch a single artifact by its internal key name.

        Returns the parsed JSON dict, or None if the request fails or the
        artifact does not exist yet.  Retries on transient network errors.
        """
        import asyncio

        backend_key = _ARTIFACT_KEY_MAP.get(artifact_key, artifact_key)
        url = f"{self._base_url}/api/v1/ai-jobs/{job_id}/artifacts/{backend_key}"

        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self._timeout) as client:
                    response = await client.get(url)
                    if response.status_code == 404:
                        logger.warning(
                            "Artifact '%s' not found for job %s (404)",
                            artifact_key, job_id
                        )
                        return None
                    response.raise_for_status()
                    payload = response.json()
                    # Core may wrap the artifact in an envelope; unwrap if so
                    if isinstance(payload, dict) and "data" in payload:
                        return payload["data"]
                    return payload
            except httpx.TimeoutException:
                logger.error(
                    "Timeout fetching artifact '%s' for job %s from %s",
                    artifact_key, job_id, url
                )
                return None
            except httpx.HTTPStatusError as exc:
                logger.error(
                    "HTTP %s fetching artifact '%s' for job %s: %s",
                    exc.response.status_code, artifact_key, job_id, exc
                )
                return None
            except OSError as exc:
                # Transient DNS/network errors (e.g. [Errno 11001] getaddrinfo failed)
                if attempt < max_retries:
                    delay = 0.5 * (attempt + 1)
                    logger.warning(
                        "Transient network error fetching artifact '%s' for job %s (attempt %d/%d): %s. Retrying in %.1fs...",
                        artifact_key, job_id, attempt + 1, max_retries + 1, exc, delay
                    )
                    await asyncio.sleep(delay)
                    continue
                logger.error(
                    "Network error fetching artifact '%s' for job %s after %d attempts: %s",
                    artifact_key, job_id, max_retries + 1, exc
                )
                return None
            except Exception as exc:
                logger.error(
                    "Unexpected error fetching artifact '%s' for job %s: %s",
                    artifact_key, job_id, exc
                )
                return None
        return None

    async def fetch_line1_artifacts(self, job_id: str) -> dict[str, Any | None]:
        """
        Fetch all Line 1 artifacts needed by Line 2 in parallel.

        Returns a dict with keys:
          repoIntelligenceReport, skillEvidenceGraph,
          commitTimelineData, commitIntentData

        Each value is the parsed JSON dict or None if unavailable.
        """
        import asyncio

        keys = list(_ARTIFACT_KEY_MAP.keys())
        results = await asyncio.gather(
            *[self.fetch_artifact(job_id, key) for key in keys],
            return_exceptions=False,
        )
        artifacts = dict(zip(keys, results))
        logger.info(
            "Fetched Line 1 artifacts for job %s: %s",
            job_id,
            {k: ("ok" if v is not None else "missing") for k, v in artifacts.items()},
        )
        return artifacts
