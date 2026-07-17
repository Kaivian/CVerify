import json
import asyncio
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.pipelines.candidate.orchestrate_stream import CandidateAssessmentStreamOrchestrator
from app.pipelines.candidate.orchestrator import CandidateEvaluationOrchestrator
from tests.integration.test_pipeline_stream import MOCK_RESPONSES, mock_claude

@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_stability_claude_timeout(mock_analyze):
    """Verifies that a task-level timeout from the AI service does not crash the process and is handled gracefully."""
    # Mock analyze_repo_with_telemetry to raise asyncio.TimeoutError
    mock_analyze.side_effect = asyncio.TimeoutError("Claude Service timed out after 30 seconds.")
    
    cv = {"cvId": "timeout-cv", "skills": ["Python"]}
    repos = []
    
    orchestrator = CandidateAssessmentStreamOrchestrator()
    events = []
    
    # We expect the pipeline to yield failure progress events but complete without crashing the runner
    async for event in orchestrator.orchestrate_async(cv, repos, correlation_id="timeout-corr"):
        events.append(event)
        
    # Check that a task failure event was emitted
    fail_events = [e for e in events if e.get("status") == "Failed"]
    assert len(fail_events) > 0, "A Failed status event should have been emitted due to Claude timeout."
    assert "timed out" in fail_events[0]["message"].lower()

@pytest.mark.asyncio
@patch("app.pipelines.candidate.orchestrator.RepoIntelligenceClient.fetch_line1_artifacts")
async def test_stability_database_disconnect(mock_fetch):
    """Verifies that database client connection issues are caught and result in a controlled task exception."""
    # Simulate database connection drop
    mock_fetch.side_effect = ConnectionError("Could not connect to CVerify.Core database.")
    
    orchestrator = CandidateEvaluationOrchestrator()
    cv = {"cvId": "db-disconnect-cv", "skills": ["Python"]}
    
    # Executing the task should fail with the DB connection exception
    result = await orchestrator.execute_task(
        task_type="SkillTaxonomyMapper",
        job_id="db-job-1",
        inputs={"cv": cv},
        correlation_id="db-corr"
    )
    
    assert result["status"] == "Failed"
    assert "Could not connect to CVerify.Core database" in result["errorMessage"]

@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_concurrency_pipeline_isolation(mock_analyze):
    """Runs multiple pipeline instances concurrently to verify strict isolation and context integrity."""
    async def side_effect(system, user, corr):
        # Determine persona from the CV details passed in the prompt or correlation_id
        # We can customize the output to reflect the correlation ID to verify no leakage
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
            
        res = dict(MOCK_RESPONSES[task_id])
        # Inject correlation id in the response if it's summary to track flow
        if task_id == "L2-013":
            res["professionalBio"] = f"This is a very long professional biography for candidate under correlation ID {corr} that definitely exceeds the one hundred and twenty character limit to pass validation checks."
            
        return await mock_claude(res)()
        
    mock_analyze.side_effect = side_effect
    
    # Run 5 pipelines simultaneously
    num_runs = 5
    tasks = []
    
    for i in range(num_runs):
        cv = {"cvId": f"cv-concurrent-{i}", "skills": ["Python"]}
        repos = [{"repositoryId": f"repo-c-{i}", "repositoryName": f"repo-{i}", "overallScore": 70.0}]
        corr_id = f"corr-unique-{i}"
        
        orchestrator = CandidateAssessmentStreamOrchestrator()
        
        async def run_one(c_id, cv_d, repos_l):
            events = []
            async for e in orchestrator.orchestrate_async(cv_d, repos_l, correlation_id=c_id):
                events.append(e)
            return c_id, events
            
        tasks.append(run_one(corr_id, cv, repos))
        
    results = await asyncio.gather(*tasks)
    
    # Assert that each run completed successfully and context was strictly isolated
    for corr_id, events in results:
        profile_event = next(e for e in events if e.get("artifactType") == "CandidateProfile")
        profile = json.loads(profile_event["jsonData"])
        
        # Verify the bio contains the correct correlation ID injected for that run
        assert f"correlation ID {corr_id}" in profile["professionalBio"], f"Leakage detected! Expected {corr_id} but got {profile['professionalBio']}"
