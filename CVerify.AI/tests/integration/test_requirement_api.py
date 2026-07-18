import json
import hmac
import time
import uuid
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock

# 1. Setup mock Redis client before importing app
class MockRedis:
    def __init__(self):
        self.store = {}

    def set(self, key, value, ex=None, nx=False):
        if nx and key in self.store:
            return False
        self.store[key] = value
        return True

import app.core.middleware.hmac_auth as hmac_auth
hmac_auth.redis_client = MockRedis()

from app.main import app
from app.core.config import settings

# Setup configuration parameters matching API tests
settings.shared_secret = "test_shared_secret_key_12345"
settings.client_id = "cverify-core"

@pytest.fixture
def api_client():
    return TestClient(app)

def get_hmac_headers(method: str, path: str, body_str: str) -> dict:
    timestamp = str(int(time.time()))
    nonce = uuid.uuid4().hex
    correlation_id = "test-corr-id"
    
    # HMAC formula: HMAC_SHA256(Method + Path + Body + Timestamp + Nonce, Secret)
    raw_message = f"{method}{path}{body_str}{timestamp}{nonce}"
    computed_mac = hmac.new(
        settings.shared_secret.encode("utf-8"),
        raw_message.encode("utf-8"),
        digestmod="sha256"
    )
    signature = computed_mac.hexdigest().lower()
    
    return {
        "X-Client-Id": "cverify-core",
        "X-Timestamp": timestamp,
        "X-Nonce": nonce,
        "X-Correlation-Id": correlation_id,
        "X-Signature": signature
    }

@pytest.mark.asyncio
@patch("app.pipelines.requirement.orchestrator.RequirementArtifactsOrchestrator.generate_all_artifacts_async")
async def test_generate_requirements_stream_endpoint(mock_orchestrate, api_client):
    """Verify endpoint successfully authenticates and streams SSE data."""
    async def mock_generator(*args, **kwargs):
        yield {"status": "Running", "step": "GenerateUnifiedRequirements", "message": "Starting...", "percentage": 10.0}
        yield {"status": "Completed", "step": "RequirementArtifactsComposer", "message": "Done!", "percentage": 100.0}
        
    mock_orchestrate.return_value = mock_generator()
    
    path = "/api/v1/hiring-requirements/generate/stream"
    req_body = {"requirementData": {"id": "req-123", "title": "Staff Backend Engineer"}}
    body_str = json.dumps(req_body, separators=(',', ':'))
    
    headers = get_hmac_headers("POST", path, body_str)
    
    response = api_client.post(path, json=req_body, headers=headers)
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    
    lines = response.text.split("\n")
    assert any("GenerateUnifiedRequirements" in line for line in lines)
    assert any("RequirementArtifactsComposer" in line for line in lines)

@pytest.mark.asyncio
@patch("app.pipelines.requirement.orchestrator.RequirementArtifactsOrchestrator.generate_artifact_stream")
async def test_generate_single_artifact_stream_endpoint(mock_orchestrate, api_client):
    """Verify single artifact stream endpoint successfully authorizes and streams."""
    async def mock_generator(*args, **kwargs):
        yield {"status": "Running", "step": "GenerateJobDescription", "message": "Streaming...", "percentage": 40.0}
        
    mock_orchestrate.return_value = mock_generator()
    
    path = "/api/v1/hiring-requirements/generate-artifact/stream"
    req_body = {
        "requirementData": {"id": "req-123", "title": "Staff Backend Engineer"},
        "artifactType": "JobDescription"
    }
    body_str = json.dumps(req_body, separators=(',', ':'))
    
    headers = get_hmac_headers("POST", path, body_str)
    
    response = api_client.post(path, json=req_body, headers=headers)
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    assert any("GenerateJobDescription" in line for line in response.text.split("\n"))

def test_generate_requirements_unauthorized(api_client):
    """Endpoint should return 401 when headers are present but signature is incorrect."""
    path = "/api/v1/hiring-requirements/generate/stream"
    req_body = {"requirementData": {"id": "req-123", "title": "Staff Backend Engineer"}}
    headers = {
        "X-Client-Id": "cverify-core",
        "X-Timestamp": str(int(time.time())),
        "X-Nonce": "bad-nonce-1234",
        "X-Correlation-Id": "bad-correlation-id",
        "X-Signature": "invalid-signature-here"
    }
    response = api_client.post(path, json=req_body, headers=headers)
    assert response.status_code == 401
    assert "Invalid signature" in response.json()["detail"]
