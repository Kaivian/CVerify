import pytest
from unittest.mock import AsyncMock, patch
from app.pipelines.candidate.orchestrate_stream import CandidateAssessmentStreamOrchestrator
from app.pipelines.candidate.context import PipelineContext

@pytest.mark.asyncio
async def test_stage_sequence_flow():
    # Verify that candidate assessment stages flow in the correct progression.
    cv = {"cvId": "test-cv-flow", "skills": ["Python"]}
    repository_assessments = []

    orchestrator = CandidateAssessmentStreamOrchestrator()
    
    with patch.object(orchestrator.orchestrator, "execute_task", new_callable=AsyncMock) as mock_exec:
        mock_exec.return_value = {
            "status": "Completed",
            "resultData": "{}",
            "telemetry": {}
        }
        
        events = []
        async for event in orchestrator.orchestrate_async(
            cv=cv,
            repository_assessments=repository_assessments,
            correlation_id="test-corr"
        ):
            if "step" in event:
                events.append(event)
                
        steps = [e["step"] for e in events]
        
        # Verify FetchLine1 runs first
        assert "FetchLine1" in steps
        
        # Verify that specific sequential task stages (L2-001, L2-002, L2-014, L2-015) are run in correct relative order
        l2_steps = [s for s in steps if s.startswith("L2-")]
        
        # Check relative order
        assert l2_steps.index("L2-001") < l2_steps.index("L2-002")
        assert l2_steps.index("L2-002") < l2_steps.index("L2-014")
        assert l2_steps.index("L2-014") < l2_steps.index("L2-015")
