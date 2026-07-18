import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from app.pipelines.candidate.orchestrate_stream import CandidateAssessmentStreamOrchestrator
from app.pipelines.candidate.context import PipelineContext
from app.pipelines.shared.ai.runtime.task_runtime import TaskRuntime

@pytest.mark.asyncio
async def test_candidate_assess_stream_readiness_gates():
    # Verify that a repository assessment failing the readiness gates (low ownership, high clone risk)
    # is still processed and yields no unhandled crash because the orchestrator has an intentional gate bypass.
    cv = {"cvId": "test-cv-gates", "skills": ["Python"]}
    repository_assessments = [
        {
            "repositoryName": "cloned-repo",
            "overallScore": 90.0,
            "intelligenceSignal": {"ownershipSignal": 15.0}, # below 30%
            "qualityMetrics": {"cloneRiskClassification": "high_risk"} # clone risk
        }
    ]

    orchestrator = CandidateAssessmentStreamOrchestrator()
    
    # Correctly patch execute_task on the internal orchestrator
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
            events.append(event)
            
        # The orchestrator should successfully run and yield FetchLine1 progress
        assert len(events) > 0
        assert any(e.get("step") == "FetchLine1" for e in events)


def test_json_repair_resilience():
    # Directly test that task runtime's json repair helper repairs malformed outputs.
    runtime = TaskRuntime()
    malformed_json = '{"repaired_field": "value", "unclosed": [1, 2'
    
    # Standard json.loads would fail, but _repair_and_extract_json repairs it
    parsed = runtime._repair_and_extract_json(malformed_json, correlation_id="test-corr")
    assert parsed["repaired_field"] == "value"
    assert parsed["unclosed"] == [1, 2]
