import json
import pytest
from unittest.mock import patch, AsyncMock
from app.pipelines.candidate.orchestrate_stream import CandidateAssessmentStreamOrchestrator
from tests.integration.test_pipeline_stream import MOCK_RESPONSES, mock_claude

@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_e2e_pipeline_zero_repositories(mock_analyze):
    """Verifies that a candidate with zero repositories gets locked into the floor trust score of 10.0."""
    async def side_effect(system, user, corr):
        # We can just return standard mock responses
        task_id = "L2-001"
        if "tree" in user.lower():
            task_id = "L2-016"
        elif "summary" in user.lower():
            task_id = "L2-013"
        elif "recommend" in user.lower():
            task_id = "L2-012"
        elif "style" in user.lower():
            task_id = "L2-010"
        elif "tendency" in user.lower():
            task_id = "L2-009"
        elif "solving" in user.lower():
            task_id = "L2-008"
        elif "maturity" in user.lower():
            task_id = "L2-007"
        elif "gate" in user.lower():
            task_id = "L2-006"
        elif "calibrat" in user.lower():
            task_id = "L2-005"
        elif "mapper" in user.lower():
            task_id = "L2-004"
        elif "strength" in user.lower():
            task_id = "L2-003"
        elif "proficiency" in user.lower():
            task_id = "L2-002"
            
        return await mock_claude(MOCK_RESPONSES[task_id])()
        
    mock_analyze.side_effect = side_effect
    
    cv = {
        "cvId": "test-cv-zero-repos",
        "skills": ["Python", "Docker"]
    }
    repos = [] # Zero repositories!
    
    orchestrator = CandidateAssessmentStreamOrchestrator()
    events = []
    async for event in orchestrator.orchestrate_async(cv, repos, correlation_id="e2e-zero-repos"):
        events.append(event)
        
    # Get the final CandidateProfile artifact
    profile_event = next(e for e in events if e.get("artifactType") == "CandidateProfile")
    profile = json.loads(profile_event["jsonData"])
    
    # Assertions for zero repositories scenario
    assert profile["candidateScore"] == 0
    assert profile["trustScoreMetrics"]["candidateTrustScore"] == 10.0
    assert profile["evidenceCompleteness"] == "NONE"

@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_e2e_pipeline_senior_with_type1_repos(mock_analyze):
    """Verifies that a senior candidate with active Type 1 repositories passes the career gate checks."""
    async def side_effect(system, user, corr):
        task_id = "L2-001"
        if "tree" in user.lower():
            task_id = "L2-016"
        elif "summary" in user.lower():
            task_id = "L2-013"
        elif "recommend" in user.lower():
            task_id = "L2-012"
        elif "style" in user.lower():
            task_id = "L2-010"
        elif "tendency" in user.lower():
            task_id = "L2-009"
        elif "solving" in user.lower():
            task_id = "L2-008"
        elif "maturity" in user.lower():
            task_id = "L2-007"
        elif "gate" in user.lower():
            # Return gate passed
            return await mock_claude({
                "gatePassed": True, "finalLevel": "L3", "finalLevelLabel": "Senior", "finalScore": 75.0, "gateViolations": [], "gateRationale": ""
            })()
        elif "calibrat" in user.lower():
            return await mock_claude({
                "calibratedLevel": "L3", "calibratedScore": 75.0, "calibratedLevelLabel": "Senior", "confidenceInLevel": 0.8, "isBoundaryCase": False, "calibrationNotes": ""
            })()
        elif "mapper" in user.lower():
            # Return L3
            return await mock_claude({
                "candidateScore": 75.0, "estimatedLevel": "L3", "estimatedLevelLabel": "Senior", "scoreBreakdown": {}, "levelEvidence": {}, "levelRationale": ""
            })()
        elif "strength" in user.lower():
            task_id = "L2-003"
        elif "proficiency" in user.lower():
            task_id = "L2-002"
            
        return await mock_claude(MOCK_RESPONSES[task_id])()
        
    mock_analyze.side_effect = side_effect
    
    cv = {
        "cvId": "test-cv-senior-type1",
        "skills": ["Python", "Golang"]
    }
    
    # Active Type 1 repo (overallScore high, trustLevel >= 3, cvVerificationLevel = AiAnalyzed)
    repos = [
        {
            "repositoryId": "repo-high-trust-1",
            "repositoryName": "go-microservice",
            "overallScore": 90.0,
            "cvVerificationLevel": "AiAnalyzed",
            "trustLevel": 3,
            "intelligenceSignal": {
                "ownershipSignal": 85.0
            },
            "qualityMetrics": {
                "cloneRiskClassification": "clean",
                "complexityScore": 120.0
            },
            "capabilities": [
                {"name": "Database Scaling", "category": "database", "difficultyScore": 8.0, "maturity": "Advanced"},
                {"name": "Cache Architecture", "category": "architecture", "difficultyScore": 8.5, "maturity": "Advanced"}
            ],
            "patterns": ["cqrs", "clean architecture"]
        }
    ]
    
    orchestrator = CandidateAssessmentStreamOrchestrator()
    events = []
    async for event in orchestrator.orchestrate_async(cv, repos, correlation_id="e2e-senior-type1"):
        events.append(event)
        
    profile_event = next(e for e in events if e.get("artifactType") == "CandidateProfile")
    profile = json.loads(profile_event["jsonData"])
    
    # Asserts that they are not downgraded since they have an active Type 1 repo
    assert profile["careerLevel"] == "L3"
    assert profile["careerLevelLabel"] == "Senior"
