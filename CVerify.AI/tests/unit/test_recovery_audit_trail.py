import pytest
from app.pipelines.shared.ai.recovery.audit import RecoveryAuditLogger

def test_recovery_audit_logger():
    logger = RecoveryAuditLogger()
    entry = logger.log_recovery(
        task_id="L2-001",
        task_name="SkillTaxonomyMapper",
        policy_enforced="FULL_REPAIR_ALLOWED",
        recovery_strategy="STRUCTURAL_REPAIR",
        original_raw='{"data": {"mappedSkills": []}}',
        repaired_output={"mappedSkills": []},
        repair_diff=[{"field": "data", "action": "unwrapped_nested_dict"}],
        reason="Unwrapped nested object wrapper",
        attempt_count=1,
        duration_ms=12.5,
        token_cost_impact={"promptTokens": 100, "completionTokens": 50, "estimatedCostUsd": 0.001}
    )

    assert entry.taskId == "L2-001"
    assert entry.recoveryStrategy == "STRUCTURAL_REPAIR"
    assert len(entry.repairDiff) == 1
    assert entry.tokenAndCostImpact["estimatedCostUsd"] == 0.001

    summary = logger.get_summary()
    assert len(summary) == 1
    assert summary[0]["taskId"] == "L2-001"
