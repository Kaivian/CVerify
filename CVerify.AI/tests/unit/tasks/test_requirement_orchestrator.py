import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.pipelines.requirement.orchestrator import RequirementArtifactsOrchestrator
from app.pipelines.requirement.contracts import UnifiedRequirementArtifactsResponse

# Standard expected mock output from Claude (matches Pydantic contract)
MOCK_CLAUDE_RESPONSE = {
    "schemaVersion": "1.0.0",
    "metadata": {
        "modelIdentifier": "claude-3-5-sonnet",
        "promptVersion": "2.0",
        "generatedAtUtc": "2026-07-18T09:24:00Z"
    },
    "jobDescription": {
        "markdownContent": "# Senior Developer - Engineering\n\n## Key Responsibilities\n- Code",
        "title": "Senior Developer",
        "department": "Engineering",
        "summary": "Great Dev",
        "responsibilities": ["Code"],
        "skills": ["db.query-tuning"]
    },
    "assessmentRubric": {
        "scoringRules": {
            "minimumMaturityThreshold": "Practitioner",
            "selfDeclaredMatchCeiling": 0.40,
            "additionalRules": []
        },
        "evidenceRequirements": []
    },
    "interviewBlueprint": {
        "questions": [],
        "dimensions": ["Code Quality"]
    },
    "jobPostMetadata": {
        "experienceRange": "3-5 years",
        "degreeRequirement": "Bachelor's"
    },
    "candidateDiscoveryProfile": {
        "keyKeywords": ["C#"],
        "minimumYearsOfExperience": 3,
        "priorityWeights": {},
        "trustRequirements": {}
    }
}

def mock_telemetry():
    return {
        "modelName": "claude-3-5-sonnet",
        "promptTokens": 120,
        "completionTokens": 250,
        "estimatedCostUsd": 0.002,
        "durationMs": 1500
    }

@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_requirement_orchestrator_success(mock_analyze):
    """Verify happy path of requirement artifacts generator pipeline."""
    async def side_effect(system, user, correlation_id="system", on_token=None):
        if on_token:
            import inspect
            if inspect.iscoroutinefunction(on_token):
                await on_token("Chunk 1")
            else:
                on_token("Chunk 1")
        return (json.dumps(MOCK_CLAUDE_RESPONSE), mock_telemetry())

    mock_analyze.side_effect = side_effect
    
    orchestrator = RequirementArtifactsOrchestrator()
    requirement_data = {"id": "req-123", "title": "Senior Developer"}
    
    events = []
    async for event in orchestrator.generate_all_artifacts_async(requirement_data, "test-corr"):
        events.append(event)
        
    assert len(events) > 0
    assert events[0]["step"] == "GenerateUnifiedRequirements"
    
    # Check that individual artifacts are yielded
    jd_event = next(e for e in events if e.get("artifactType") == "JobDescription")
    assert jd_event["status"] == "Running"
    assert jd_event["percentage"] == 40.0
    
    rubric_event = next(e for e in events if e.get("artifactType") == "EvaluationRubric")
    assert rubric_event["percentage"] == 60.0
    
    blueprint_event = next(e for e in events if e.get("artifactType") == "InterviewBlueprint")
    assert blueprint_event["percentage"] == 80.0
    
    final_event = events[-1]
    assert final_event["status"] == "Completed"
    assert final_event["percentage"] == 100.0

@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_requirement_orchestrator_self_correction(mock_analyze):
    """Verify orchestrator self-correction logic when LLM returns invalid JSON first."""
    # First call returns invalid format (missing required field: metadata)
    invalid_response = MOCK_CLAUDE_RESPONSE.copy()
    del invalid_response["metadata"]
    
    async def side_effect(system, user, correlation_id="system", on_token=None):
        if mock_analyze.call_count == 1:
            return (json.dumps(invalid_response), mock_telemetry())
        return (json.dumps(MOCK_CLAUDE_RESPONSE), mock_telemetry())

    mock_analyze.side_effect = side_effect
    
    orchestrator = RequirementArtifactsOrchestrator()
    requirement_data = {"id": "req-123", "title": "Senior Developer"}
    
    events = []
    async for event in orchestrator.generate_all_artifacts_async(requirement_data, "test-corr"):
        events.append(event)
        
    assert events[-1]["status"] == "Completed"
    assert mock_analyze.call_count == 2
    # Verify warning instructions were appended to prompt in self-correction attempt
    second_call_user_prompt = mock_analyze.call_args[0][1]
    assert "WARNING: Your previous response failed validation" in second_call_user_prompt

@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_requirement_orchestrator_exhaust_retries(mock_analyze):
    """Verify orchestrator fails gracefully when LLM continuously returns invalid JSON."""
    invalid_response = {"broken": "data"}
    async def side_effect(system, user, correlation_id="system", on_token=None):
        return (json.dumps(invalid_response), mock_telemetry())
    mock_analyze.side_effect = side_effect
    
    orchestrator = RequirementArtifactsOrchestrator()
    requirement_data = {"id": "req-123", "title": "Senior Developer"}
    
    events = []
    async for event in orchestrator.generate_all_artifacts_async(requirement_data, "test-corr"):
        events.append(event)
        
    assert events[-1]["status"] == "Failed"
    assert "Failed to generate valid artifact schema after 2 correction attempts" in events[-1]["message"]

def test_json_repair_capabilities():
    """Verify orchestrator can parse and repair malformed JSON blocks."""
    orchestrator = RequirementArtifactsOrchestrator()
    
    # 1. Clean JSON wrapped in markdown tags or chatter
    chatter_json = "Here is your JSON:\n```json\n{\"foo\": \"bar\"}\n```\nHope it helps!"
    parsed = orchestrator._repair_and_extract_json(chatter_json)
    assert parsed == {"foo": "bar"}
    
    # 2. Broken trailing commas
    broken_comma = '{"foo": "bar",}'
    parsed_comma = orchestrator._repair_and_extract_json(broken_comma)
    assert parsed_comma == {"foo": "bar"}
    
    # 3. Unescaped quotes in middle
    broken_quotes = '{"foo": "bar "nested" baz"}'
    parsed_quotes = orchestrator._repair_and_extract_json(broken_quotes)
    assert "foo" in parsed_quotes
