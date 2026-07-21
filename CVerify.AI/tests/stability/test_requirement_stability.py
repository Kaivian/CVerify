import json
import asyncio
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.pipelines.requirement.orchestrator import RequirementArtifactsOrchestrator
from tests.unit.tasks.test_requirement_orchestrator import MOCK_CLAUDE_RESPONSE, mock_telemetry

@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_requirement_stability_claude_timeout(mock_analyze):
    """Verifies that an LLM timeout from ClaudeService does not crash the pipeline and is handled gracefully."""
    mock_analyze.side_effect = asyncio.TimeoutError("LLM call timed out.")
    
    orchestrator = RequirementArtifactsOrchestrator()
    requirement_data = {"id": "req-timeout", "title": "Timeout Developer"}
    
    events = []
    async for event in orchestrator.generate_all_artifacts_async(requirement_data, "timeout-corr"):
        events.append(event)
        
    assert len(events) > 0
    assert events[-1]["status"] == "Failed"
    assert "timed out" in events[-1]["message"].lower()

@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_requirement_stability_cancellation(mock_analyze):
    """Verifies that user-triggered cancellation propagates CancelledError during generation."""
    mock_analyze.side_effect = asyncio.CancelledError("Job cancel-corr was cancelled by user.")
    
    orchestrator = RequirementArtifactsOrchestrator()
    requirement_data = {"id": "req-cancel", "title": "Cancelled Role"}
    
    with pytest.raises(asyncio.CancelledError):
        async for event in orchestrator.generate_all_artifacts_async(requirement_data, "cancel-corr"):
            pass

@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_requirement_concurrency_isolation(mock_analyze):
    """Runs multiple concurrent generation runs to ensure complete isolation and prevent crosstalk."""
    async def side_effect(system, user, corr, **kwargs):
        res = dict(MOCK_CLAUDE_RESPONSE)
        # Inject correlation ID into title to verify no crosstalk
        res["jobDescription"] = dict(res["jobDescription"])
        res["jobDescription"]["title"] = f"Developer {corr}"
        return json.dumps(res), mock_telemetry()
        
    mock_analyze.side_effect = side_effect
    
    num_runs = 5
    tasks = []
    
    for i in range(num_runs):
        req_data = {"id": f"req-{i}", "title": f"Dev {i}"}
        corr_id = f"corr-unique-req-{i}"
        orchestrator = RequirementArtifactsOrchestrator()
        
        async def run_one(c_id, req):
            events = []
            async for e in orchestrator.generate_all_artifacts_async(req, c_id):
                events.append(e)
            return c_id, events
            
        tasks.append(run_one(corr_id, req_data))
        
    results = await asyncio.gather(*tasks)
    
    # Verify that each task output has its corresponding correlation ID without leakage
    for corr_id, events in results:
        assert events[-1]["status"] == "Completed"
        jd_event = next(e for e in events if e.get("artifactType") == "JobDescription")
        jd_data = json.loads(jd_event["jsonData"])
        # Check that the title matches the specific correlation ID
        assert f"Developer {corr_id}" in jd_data["structuredContent"]["jobTitle"]
