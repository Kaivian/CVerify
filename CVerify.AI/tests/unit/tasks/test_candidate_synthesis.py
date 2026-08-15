import json
import pytest
from unittest.mock import patch, MagicMock
from app.pipelines.talent.candidate_synthesis import (
    CandidateSynthesisOrchestrator,
    CandidateSynthesisRequest,
    CandidateSynthesisResponse
)

MOCK_SYNTHESIS_RESPONSE = {
    "summary": "Senior engineer with strong verified database tuning expertise.",
    "keyStrengths": ["db.query-tuning", "code.quality"],
    "keyGaps": ["cloud.aws"],
    "riskLevel": "Low",
    "recommendedInterviewQuestions": [
        "How do you optimize slow query execution plans in PostgreSQL?",
        "Describe your experience with distributed transactions.",
        "What patterns do you use for caching?"
    ]
}

def mock_telemetry():
    return {
        "modelName": "claude-3-5-sonnet",
        "promptTokens": 100,
        "completionTokens": 150,
        "estimatedCostUsd": 0.001,
        "durationMs": 950
    }

@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_candidate_synthesis_success(mock_analyze):
    """Verify happy path of candidate synthesis pipeline."""
    async def side_effect(system, user, correlation_id="system", on_token=None):
        return (json.dumps(MOCK_SYNTHESIS_RESPONSE), mock_telemetry())

    mock_analyze.side_effect = side_effect

    orchestrator = CandidateSynthesisOrchestrator()
    request = CandidateSynthesisRequest(
        candidateName="Alex Rivera",
        careerLevel="Senior",
        matchScore=88.5,
        trustLevel=92.0,
        requirementTitle="Staff Backend Engineer",
        matchedCapabilities=["db.query-tuning"],
        missingCapabilities=["cloud.aws"]
    )

    response = await orchestrator.synthesize_candidate(request)

    assert response.summary == MOCK_SYNTHESIS_RESPONSE["summary"]
    assert response.riskLevel == "Low"
    assert len(response.recommendedInterviewQuestions) == 3
