import pytest
from app.pipelines.shared.ai.recovery.policies import (
    TaskRecoveryPolicy,
    get_policy_rules
)
from app.pipelines.candidate.tasks.career_level import CareerLevelGate

def test_recovery_policy_rules():
    strict = get_policy_rules(TaskRecoveryPolicy.STRICT_FAIL_FAST)
    assert strict.allow_structural_repair is True
    assert strict.allow_deterministic_hydration is False
    assert strict.allow_ai_repair_pass is False

    det = get_policy_rules(TaskRecoveryPolicy.DETERMINISTIC_ONLY)
    assert det.allow_structural_repair is True
    assert det.allow_deterministic_hydration is True
    assert det.allow_ai_repair_pass is False

    full = get_policy_rules(TaskRecoveryPolicy.FULL_REPAIR_ALLOWED)
    assert full.allow_structural_repair is True
    assert full.allow_deterministic_hydration is True
    assert full.allow_ai_repair_pass is True

def test_career_level_gate_policy_override():
    gate = CareerLevelGate()
    assert gate.recovery_policy == TaskRecoveryPolicy.STRICT_FAIL_FAST
