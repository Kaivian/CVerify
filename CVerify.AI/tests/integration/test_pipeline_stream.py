import json
import pytest
from unittest.mock import AsyncMock, patch
from app.pipelines.candidate.orchestrate_stream import CandidateAssessmentStreamOrchestrator
from app.pipelines.candidate.context import PipelineContext
from tests.unit.tasks.test_pipeline_tasks import mock_claude

# Standard mock data for all tasks that call LLMs
MOCK_RESPONSES = {
    "L2-001": {"mappedSkills": [], "unmatchedCvSkills": []},
    "L2-002": {"skillProficiencies": [], "strongestDomains": []},
    "L2-003": {"strengthsWeaknesses": [], "strongestDomains": [], "skillGaps": [], "overallStrengthSummary": ""},
    "L2-004": {"candidateScore": 60, "estimatedLevel": "L2", "estimatedLevelLabel": "Mid", "scoreBreakdown": {}, "levelEvidence": {}, "levelRationale": ""},
    "L2-005": {"calibratedScore": 60, "calibratedLevel": "L2", "calibratedLevelLabel": "Mid", "confidenceInLevel": 0.8, "isBoundaryCase": False, "calibrationNotes": ""},
    "L2-006": {"gatePassed": True, "finalLevel": "L2", "finalLevelLabel": "Mid", "finalScore": 60, "gateViolations": [], "gateRationale": ""},
    "L2-007": {"engineeringMaturityScore": 60, "maturityLevel": "Intermediate", "maturitySignals": [], "maturitySummary": ""},
    "L2-008": {"avgTimeToFixDays": 3.0, "rootCauseFixRatio": 0.7, "recurrenceRate": 0.1, "complexBugHandling": "", "problemSolvingPatterns": [], "problemSolvingSummary": ""},
    "L2-009": {"primaryTendency": "Backend", "primaryConfidence": 0.8, "tendencyRanking": [], "tendencySummary": ""},
    "L2-010": {"primaryWorkingStyle": "Feature Builder", "styleConfidence": 0.8, "styleDistribution": [], "workingStyleSummary": ""},
    "L2-012": {"topMatch": {"role": "Backend", "confidence": 0.8}, "suggestedRoles": [], "suggestedCvTitles": []},
    "L2-013": {
        "recruiterHeadline": "Backend Eng",
        "fullSummary": "Summary text",
        "professionalBio": "Experienced backend systems developer specializing in robust, high-performance system development, with a proven track record of writing clean code.",
        "keyStrengths": ["Coding"],
        "watchPoints": []
    },
    "L2-016": {"skillTree": {"id": "root", "displayName": "Domain", "category": "Domain", "proficiencyLevel": "Intermediate", "confidenceScore": 0.8, "estimatedExperience": 12.0, "children": []}}
}

@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_stream_orchestrator_success(mock_analyze):
    """Test that a complete streaming pipeline run emits all lifecycle events successfully."""
    # Setup mock ClaudeService outputs based on the current prompt task calling it
    async def side_effect(system_prompt, user_prompt, correlation_id):
        # Infer task ID by looking for keywords in the prompt
        if "tree" in user_prompt.lower() or "L2-016" in system_prompt:
            task_id = "L2-016"
        elif "taxonomy" in user_prompt.lower() or "L2-001" in system_prompt:
            task_id = "L2-001"
        elif "proficiency" in user_prompt.lower() or "L2-002" in system_prompt:
            task_id = "L2-002"
        elif "strength" in user_prompt.lower() or "L2-003" in system_prompt:
            task_id = "L2-003"
        elif "mapper" in user_prompt.lower() or "L2-004" in system_prompt:
            task_id = "L2-004"
        elif "calibrat" in user_prompt.lower() or "L2-005" in system_prompt:
            task_id = "L2-005"
        elif "gate" in user_prompt.lower() or "L2-006" in system_prompt:
            task_id = "L2-006"
        elif "maturity" in user_prompt.lower() or "L2-007" in system_prompt:
            task_id = "L2-007"
        elif "solving" in user_prompt.lower() or "L2-008" in system_prompt:
            task_id = "L2-008"
        elif "tendency" in user_prompt.lower() or "L2-009" in system_prompt:
            task_id = "L2-009"
        elif "style" in user_prompt.lower() or "L2-010" in system_prompt:
            task_id = "L2-010"
        elif "recommend" in user_prompt.lower() or "L2-012" in system_prompt:
            task_id = "L2-012"
        elif "summary" in user_prompt.lower() or "L2-013" in system_prompt:
            task_id = "L2-013"
        else:
            task_id = "L2-001"
            
        return await mock_claude(MOCK_RESPONSES[task_id])()
        
    mock_analyze.side_effect = side_effect
    
    cv = {"cvId": "test-cv", "skills": ["Python"]}
    repos = [{"repositoryId": "test-repo-id", "repositoryName": "test-repo", "overallScore": 80.0, "intelligenceSignal": {"ownershipSignal": 85.0}}]
    
    orchestrator = CandidateAssessmentStreamOrchestrator()
    
    events = []
    async for event in orchestrator.orchestrate_async(
        cv=cv,
        repository_assessments=repos,
        correlation_id="stream-corr-1"
    ):
        events.append(event)
        
    # Verify events structure
    assert len(events) > 0
    
    steps = [e["step"] for e in events]
    assert "FetchLine1" in steps
    assert "Complete" in steps
    assert "L2-001" in steps
    
    # Check that CandidateProfile artifact event is yielded
    profile_events = [e for e in events if e.get("artifactType") == "CandidateProfile"]
    assert len(profile_events) == 1
    
    profile_data = json.loads(profile_events[0]["jsonData"])
    assert profile_data["schemaVersion"] == "candidate-profile-v3"
    assert profile_data["candidateScore"] == 3

@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_stream_orchestrator_failure(mock_analyze):
    """Test that a task failure aborts the pipeline stream and yields a failed event."""
    mock_analyze.side_effect = Exception("Claude is currently unavailable")
    
    cv = {"cvId": "test-cv-stream-fail", "skills": ["Python"]}
    repos = []
    
    orchestrator = CandidateAssessmentStreamOrchestrator()
    
    events = []
    async for event in orchestrator.orchestrate_async(
        cv=cv,
        repository_assessments=repos,
        correlation_id="stream-corr-2"
    ):
        events.append(event)
        
    statuses = [e["status"] for e in events]
    assert "Failed" in statuses
    
    # Verify the failed event contains error message details
    fail_event = next(e for e in events if e["status"] == "Failed")
    assert "Claude is currently unavailable" in fail_event["message"]
