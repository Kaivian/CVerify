import time
import logging
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional

logger = logging.getLogger("recovery_audit_logger")

class AuditEntry(BaseModel):
    taskId: str
    taskName: str
    policyEnforced: str
    recoveryStrategy: str
    originalRawOutput: Optional[str] = None
    repairedOutputSummary: Optional[Dict[str, Any]] = None
    repairDiff: List[Dict[str, Any]] = Field(default_factory=list)
    recoveryReason: str = ""
    attemptCount: int = 1
    durationMs: float = 0.0
    tokenAndCostImpact: Dict[str, Any] = Field(default_factory=dict)
    timestamp: float = Field(default_factory=time.time)

class RecoveryAuditLogger:
    def __init__(self):
        self.entries: List[AuditEntry] = []

    def log_recovery(
        self,
        task_id: str,
        task_name: str,
        policy_enforced: str,
        recovery_strategy: str,
        original_raw: Optional[str],
        repaired_output: Optional[Dict[str, Any]],
        repair_diff: List[Dict[str, Any]],
        reason: str,
        attempt_count: int = 1,
        duration_ms: float = 0.0,
        token_cost_impact: Optional[Dict[str, Any]] = None
    ) -> AuditEntry:
        entry = AuditEntry(
            taskId=task_id,
            taskName=task_name,
            policyEnforced=policy_enforced,
            recoveryStrategy=recovery_strategy,
            originalRawOutput=original_raw[:2000] if original_raw else None, # Truncate large raw string if necessary
            repairedOutputSummary=self._summarize_repaired(repaired_output),
            repairDiff=repair_diff,
            recoveryReason=reason,
            attemptCount=attempt_count,
            durationMs=round(duration_ms, 2),
            tokenAndCostImpact=token_cost_impact or {},
            timestamp=time.time()
        )
        self.entries.append(entry)
        logger.info(
            f"Audit Log recorded for task {task_id} ({task_name}): strategy={recovery_strategy}, "
            f"policy={policy_enforced}, reason='{reason}'",
            extra={"task_id": task_id, "recovery_strategy": recovery_strategy}
        )
        return entry

    def _summarize_repaired(self, output: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not isinstance(output, dict):
            return None
        summary = {}
        for k, v in output.items():
            if isinstance(v, list):
                summary[k] = f"list(len={len(v)})"
            elif isinstance(v, dict):
                summary[k] = f"dict(keys={list(v.keys())})"
            elif isinstance(v, str) and len(v) > 100:
                summary[k] = v[:97] + "..."
            else:
                summary[k] = v
        return summary

    def get_summary(self) -> List[Dict[str, Any]]:
        return [entry.model_dump() for entry in self.entries]
