import json
import time
import hmac
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

client = TestClient(app)

def get_hmac_headers(method: str, path: str, body: str, correlation_id: str = "test-corr-1"):
    timestamp = str(int(time.time()))
    nonce = f"nonce-{timestamp}-{correlation_id}"
    
    # Formula: HTTP_METHOD + URL + BODY + TIMESTAMP + NONCE
    raw_message = f"{method.upper()}{path}{body}{timestamp}{nonce}"
    
    key_bytes = settings.shared_secret.strip('"').encode("utf-8")
    message_bytes = raw_message.encode("utf-8")
    signature = hmac.new(key_bytes, message_bytes, digestmod="sha256").hexdigest().lower()
    
    return {
        "X-Client-Id": settings.client_id.strip('"'),
        "X-Timestamp": timestamp,
        "X-Nonce": nonce,
        "X-Correlation-Id": correlation_id,
        "X-Signature": signature,
        "Content-Type": "application/json"
    }

@pytest.fixture(autouse=True)
def mock_redis():
    """Mock Redis client to bypass nonce verification failures when Redis is offline."""
    with patch("app.core.middleware.hmac_auth.redis_client") as mock_client:
        mock_client.set.return_value = True
        yield mock_client

# -----------------------------------------------------------------------------
# 1. Signature Authentication Tests
# -----------------------------------------------------------------------------
def test_api_endpoint_missing_headers():
    response = client.post("/api/v1/candidate/assess/score", json={})
    assert response.status_code == 422 # FastAPI validation error for headers

def test_api_endpoint_invalid_signature():
    headers = {
        "X-Client-Id": "invalid-client",
        "X-Timestamp": str(int(time.time())),
        "X-Nonce": "nonce-1",
        "X-Correlation-Id": "corr-1",
        "X-Signature": "invalid-signature"
    }
    response = client.post("/api/v1/candidate/assess/score", json={}, headers=headers)
    assert response.status_code == 401
    assert "Unauthorized client" in response.json()["detail"] or "Invalid signature" in response.json()["detail"]

# -----------------------------------------------------------------------------
# 2. Score Calculation Endpoint Tests
# -----------------------------------------------------------------------------
@patch("app.pipelines.candidate.scoring_engine.score_candidate_deterministic")
def test_api_score_calculation_success(mock_score):
    mock_profile = {
        "schemaVersion": "candidate-profile-v3",
        "candidateScore": 85,
        "candidateScoreLabel": "Senior",
        "careerLevel": "L3",
        "careerLevelLabel": "Senior",
        "careerLevelConfidence": 0.9,
        "cohortPercentile": 80.0,
        "cohortVersion": "1.0.0",
        "cohortPercentileRange": {"min": 75.0, "max": 85.0},
        "evidenceCompleteness": "FULL",
        "cloneRiskClassification": "clean",
        "technicalDepth": 8.0,
        "technicalBreadth": 40.0,
        "leadershipPotential": 0.8,
        "executionStrength": 80.0,
        "trustLevel": 85.0,
        "trustScoreMetrics": {
            "verifiedSkillRatio": 0.8,
            "verifiedRepositoryRatio": 0.9,
            "verifiedEvidenceRatio": 0.75,
            "candidateTrustScore": 85.0
        },
        "capabilityVector": {
            "version": "2.0.0",
            "skillDepth": 75.0,
            "ownership": 80.0,
            "architecture": 70.0,
            "problemSolving": 85.0,
            "impact": 65.0,
            "dimensions": {
                "skillDepth": 75.0,
                "ownership": 80.0,
                "architecture": 70.0,
                "problemSolving": 85.0,
                "impact": 65.0
            },
            "rawSignals": {}
        },
        "keyStrengths": [],
        "watchPoints": [],
        "skills": [],
        "domainProfiles": [],
        "bestFitRoles": [],
        "strengthsWeaknesses": [],
        "evidenceGovernance": [],
        "scoreBreakdown": {
            "skillDepth": {"score": 85.0, "weight": 0.35},
            "ownership": {"score": 80.0, "weight": 0.25},
            "architecture": {"score": 75.0, "weight": 0.20},
            "problemSolving": {"score": 90.0, "weight": 0.12},
            "impact": {"score": 70.0, "weight": 0.08}
        }
    }
    mock_score.return_value = mock_profile
    
    payload = {
        "cv": {"cvId": "cv-1", "skills": ["Python"]},
        "repositoryAssessments": []
    }
    
    payload_str = json.dumps(payload, separators=(',', ':'))
    path = "/api/v1/candidate/assess/score"
    headers = get_hmac_headers("POST", path, payload_str)
    
    # Needs headers with matching raw body string format (no spaces around keys/values for HMAC alignment)
    response = client.post(path, content=payload_str, headers=headers)
    assert response.status_code == 200
    assert response.json()["candidateScore"] == 85
    assert response.json()["schemaVersion"] == "candidate-profile-v3"

# -----------------------------------------------------------------------------
# 3. Stream Ingestion Endpoint Tests
# -----------------------------------------------------------------------------
@patch("app.pipelines.candidate.orchestrate_stream.CandidateAssessmentStreamOrchestrator.orchestrate_async")
def test_api_stream_ingestion_success(mock_stream_method):
    # Mock stream generator yielding events
    async def mock_generator(*args, **kwargs):
        yield {
            "status": "Running",
            "step": "FetchLine1",
            "message": "Mapping profiles...",
            "percentage": 5.0
        }
        yield {
            "status": "Completed",
            "step": "Complete",
            "message": "Completed successfully.",
            "percentage": 100.0
        }
        
    mock_stream_method.return_value = mock_generator()
    
    payload = {
        "cv": {"cvId": "cv-1", "skills": ["Python"]},
        "repositoryAssessments": []
    }
    payload_str = json.dumps(payload, separators=(',', ':'))
    path = "/api/v1/candidate/assess/stream"
    headers = get_hmac_headers("POST", path, payload_str)
    
    response = client.post(path, content=payload_str, headers=headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/event-stream; charset=utf-8"
    
    # Verify stream content has events
    content = response.content.decode("utf-8")
    assert "FetchLine1" in content
    assert "Complete" in content
