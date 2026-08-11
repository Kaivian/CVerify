from enum import Enum
from dataclasses import dataclass
from typing import Dict, Any, Optional

class TaskRecoveryPolicy(str, Enum):
    STRICT_FAIL_FAST = "STRICT_FAIL_FAST"
    DETERMINISTIC_ONLY = "DETERMINISTIC_ONLY"
    FULL_REPAIR_ALLOWED = "FULL_REPAIR_ALLOWED"
    CONTENT_GEN_FLEXIBLE = "CONTENT_GEN_FLEXIBLE"

@dataclass(frozen=True)
class PolicyRules:
    policy: TaskRecoveryPolicy
    allow_structural_repair: bool
    allow_deterministic_hydration: bool
    allow_ai_repair_pass: bool
    allow_default_fallbacks: bool

POLICY_CONFIG: Dict[TaskRecoveryPolicy, PolicyRules] = {
    TaskRecoveryPolicy.STRICT_FAIL_FAST: PolicyRules(
        policy=TaskRecoveryPolicy.STRICT_FAIL_FAST,
        allow_structural_repair=True,     # Basic JSON unwrap/casing repair permitted
        allow_deterministic_hydration=False, # No field hydration
        allow_ai_repair_pass=False,          # Strictly no AI re-prompting
        allow_default_fallbacks=False        # No default fabrication
    ),
    TaskRecoveryPolicy.DETERMINISTIC_ONLY: PolicyRules(
        policy=TaskRecoveryPolicy.DETERMINISTIC_ONLY,
        allow_structural_repair=True,
        allow_deterministic_hydration=True,  # Hydrate missing metadata from context
        allow_ai_repair_pass=False,          # No AI re-prompting to avoid hallucinating metrics
        allow_default_fallbacks=False
    ),
    TaskRecoveryPolicy.FULL_REPAIR_ALLOWED: PolicyRules(
        policy=TaskRecoveryPolicy.FULL_REPAIR_ALLOWED,
        allow_structural_repair=True,
        allow_deterministic_hydration=True,
        allow_ai_repair_pass=True,           # AI repair pass permitted
        allow_default_fallbacks=False
    ),
    TaskRecoveryPolicy.CONTENT_GEN_FLEXIBLE: PolicyRules(
        policy=TaskRecoveryPolicy.CONTENT_GEN_FLEXIBLE,
        allow_structural_repair=True,
        allow_deterministic_hydration=True,
        allow_ai_repair_pass=True,
        allow_default_fallbacks=True         # Safe fallback summaries allowed
    )
}

def get_policy_rules(policy: TaskRecoveryPolicy) -> PolicyRules:
    return POLICY_CONFIG.get(policy, POLICY_CONFIG[TaskRecoveryPolicy.FULL_REPAIR_ALLOWED])
