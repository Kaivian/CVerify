import pytest
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock
from app.pipelines.candidate.context import PipelineEvent
from app.pipelines.candidate.orchestrate_stream import CandidateAssessmentStreamOrchestrator

@pytest.mark.asyncio
async def test_streaming_orchestrator_yields_events():
    # Arrange
    cv = {
        "cvId": "test-cv-123",
        "skills": ["Python"],
        "experiences": [{"durationMonths": 24, "company": "Google"}]
    }
    repository_assessments = [
        {
            "repositoryName": "test-repo",
            "intelligenceSignal": {"ownershipSignal": 0.85},
            "qualityMetrics": {"cloneRiskClassification": "clean"},
            "skillAttributions": [{"skillName": "Python", "confidence": 0.9, "contributionWeight": 0.8}]
        }
    ]

    orchestrator = CandidateAssessmentStreamOrchestrator()

    # Mock execute_task to simulate event emission and return completed status
    async def mock_execute_task(task_alias, job_id, inputs, correlation_id, event_callback=None):
        if event_callback:
            event = PipelineEvent(
                eventType="DIMENSION_SCORE_UPDATED",
                timestamp=123456789.0,
                correlationId=correlation_id,
                taskId=task_alias,
                payload={"dimension": "architecture", "value": 75.0},
                stateSnapshot={"partialScore": 75.0, "estimatedLevel": "L3"}
            )
            await event_callback(event)
        
        return {
            "status": "Completed",
            "errorMessage": None,
            "schemaVersion": "2.0.0",
            "resultData": json.dumps({"candidateScore": 75.0, "estimatedLevel": "L3"})
        }

    orchestrator.orchestrator.execute_task = mock_execute_task

    # Act
    events = []
    async for event in orchestrator.orchestrate_async(
        cv=cv,
        repository_assessments=repository_assessments,
        background_repositories=[],
        correlation_id="test-correlation"
    ):
        events.append(event)

    # Assert
    assert len(events) > 0
    
    # Check if the events list contains our yielded PipelineEvents wrapped under "event" key
    emitted_events = [e for e in events if "event" in e]
    assert len(emitted_events) > 0

    first_emitted = emitted_events[0]
    assert first_emitted["status"] == "Running"
    assert "event" in first_emitted
    assert first_emitted["event"]["eventType"] == "DIMENSION_SCORE_UPDATED"
    assert first_emitted["event"]["taskId"] == first_emitted["step"]
    assert first_emitted["event"]["correlationId"] == "test-correlation"


@pytest.mark.asyncio
async def test_improvement_engine_emits_events():
    from app.pipelines.candidate.tasks.improvement_engine import CandidateImprovementEngine
    from app.pipelines.candidate.context import PipelineContext
    
    context = PipelineContext(
        cv={},
        repositoryAssessments=[
            {
                "repositoryName": "low-ownership-repo",
                "intelligenceSignal": {"ownershipSignal": 0.15}
            }
        ],
        correlationId="test",
        calibratedLevel="L3",
        finalLevel="L2",
        gateViolations=["Seniority levels (L3+) require at least one verified Type 1 repository."],
        candidateProfile={
            "capabilityVector": {
                "skillDepth": 40.0,
                "ownership": 0.15,
                "architecture": 50.0,
                "problemSolving": 45.0,
                "impact": 30.0
            },
            "skills": [
                {"skillName": "React", "level": "Unverified"}
            ]
        }
    )
    
    engine = CandidateImprovementEngine()
    
    emitted_events = []
    async def mock_callback(event: PipelineEvent) -> None:
        emitted_events.append(event)
        
    await engine.run(context, "test", event_callback=mock_callback)
    
    # Check that events were emitted
    # TASK_STARTED and TASK_COMPLETED are emitted by BaseTask.run
    # IMPROVEMENT_SIGNAL_DETECTED and IMPROVEMENT_RECOMMENDATION_READY are emitted by CandidateImprovementEngine._execute_internal
    event_types = [e.eventType for e in emitted_events]
    
    assert "TASK_STARTED" in event_types
    assert "IMPROVEMENT_SIGNAL_DETECTED" in event_types
    assert "IMPROVEMENT_RECOMMENDATION_READY" in event_types
    assert "TASK_COMPLETED" in event_types


@pytest.mark.asyncio
async def test_streaming_orchestrator_unpacks_wrapped_artifacts():
    cv = {
        "cvId": "test-cv-456",
        "skills": ["Python"],
        "experiences": []
    }
    repository_assessments = []

    orchestrator = CandidateAssessmentStreamOrchestrator()

    async def mock_execute_task(task_alias, job_id, inputs, correlation_id, event_callback=None):
        # L2-014 (CandidateProfileComposer) returns wrapped candidateProfile
        if task_alias == "L2-014":
            return {
                "status": "Completed",
                "errorMessage": None,
                "schemaVersion": "2.0.0",
                "resultData": json.dumps({"candidateProfile": {"candidateScore": 85.0, "careerLevel": "L3"}})
            }
        # Other tasks return default flat dictionaries
        return {
            "status": "Completed",
            "errorMessage": None,
            "schemaVersion": "2.0.0",
            "resultData": json.dumps({})
        }

    orchestrator.orchestrator.execute_task = mock_execute_task

    events = []
    async for event in orchestrator.orchestrate_async(
        cv=cv,
        repository_assessments=repository_assessments,
        background_repositories=[],
        correlation_id="test-correlation"
    ):
        events.append(event)

    # Find the completion event for L2-014
    profile_completion = next((e for e in events if e.get("step") == "L2-014" and e.get("status") == "Completed" and "artifactType" in e), None)
    assert profile_completion is not None
    assert profile_completion["artifactType"] == "CandidateProfile"
    
    # Verify that the nested candidateProfile key was unpacked
    payload = json.loads(profile_completion["jsonData"])
    assert "candidateProfile" not in payload
    assert payload["candidateScore"] == 85.0
    assert payload["careerLevel"] == "L3"

