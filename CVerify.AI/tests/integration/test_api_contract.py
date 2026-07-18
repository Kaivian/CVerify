import os
import sys
import json
import time
import hmac
import pytest
from fastapi.testclient import TestClient

# Mock settings before importing app
os.environ["ANTHROPIC_API_KEY"] = "dummy-key"
os.environ["SHARED_SECRET"] = "test_shared_secret_key_12345"

from app.core.config import settings
settings.shared_secret = "test_shared_secret_key_12345"
settings.client_id = "cverify-core"

# Mock Redis Client
class MockRedis:
    def set(self, key, value, ex=None, nx=False):
        return True

import app.core.middleware.hmac_auth as hmac_auth
hmac_auth.redis_client = MockRedis()

from app.main import app

def test_candidate_assess_stream_contract():
    client = TestClient(app)
    timestamp = str(int(time.time()))
    nonce = "contract-nonce-abc"
    correlation_id = "contract-corr-xyz"
    
    payload = {
        "cv": {"cvId": "contract-cv", "skills": ["Python"], "experiences": []},
        "repositoryAssessments": [
            {
                "repositoryName": "contract-repo",
                "overallScore": 85.0,
                "intelligenceSignal": {"ownershipSignal": 70.0},
                "qualityMetrics": {"cloneRiskClassification": "clean"}
            }
        ],
        "backgroundRepositories": []
    }
    
    body = json.dumps(payload, separators=(',', ':'))
    raw_message = f"POST/api/v1/candidate/assess/stream{body}{timestamp}{nonce}"
    computed_mac = hmac.new(
        "test_shared_secret_key_12345".encode("utf-8"),
        raw_message.encode("utf-8"),
        digestmod="sha256"
    )
    valid_signature = computed_mac.hexdigest().lower()
    
    # We patch CandidateAssessmentStreamOrchestrator to avoid hitting real Anthropic API
    from unittest.mock import AsyncMock, patch
    from app.pipelines.candidate.context import PipelineContext
    
    with patch("app.pipelines.candidate.orchestrate_stream.CandidateAssessmentStreamOrchestrator.orchestrate_async") as mock_orch:
        async def mock_generator(*args, **kwargs):
            yield {"status": "Running", "step": "FetchLine1", "percentage": 5.0, "message": "Simulated"}
            yield {"status": "Completed", "step": "Completed", "percentage": 100.0, "message": "Done"}
            
        mock_orch.side_effect = mock_generator
        
        response = client.post(
            "/api/v1/candidate/assess/stream",
            json=payload,
            headers={
                "X-Client-Id": "cverify-core",
                "X-Timestamp": timestamp,
                "X-Nonce": nonce,
                "X-Correlation-Id": correlation_id,
                "X-Signature": valid_signature
            }
        )
        
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
        
        # Read the stream content
        lines = response.text.split("\n\n")
        assert any("FetchLine1" in line for line in lines)
        assert any("Completed" in line for line in lines)
