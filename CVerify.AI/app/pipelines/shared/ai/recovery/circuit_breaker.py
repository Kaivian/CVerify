import logging
from typing import Dict, Any

logger = logging.getLogger("pipeline_circuit_breaker")

class CircuitBreakerState:
    CLOSED = "CLOSED"           # Normal execution mode
    DEGRADED = "DEGRADED"       # Budget exhausted or consecutive warnings; downgrades repair policies
    TRIPPED = "TRIPPED"         # Severe outage / rate limit lock; bypasses non-critical tasks

class PipelineCircuitBreaker:
    def __init__(
        self,
        max_ai_repairs: int = 3,
        consecutive_failure_limit: int = 2
    ):
        self.max_ai_repairs = max_ai_repairs
        self.consecutive_failure_limit = consecutive_failure_limit
        
        self.ai_repair_count = 0
        self.consecutive_failures = 0
        self.total_failures = 0
        self.state = CircuitBreakerState.CLOSED
        self.trip_reason: str = ""

    def can_attempt_ai_repair(self) -> bool:
        if self.state in (CircuitBreakerState.DEGRADED, CircuitBreakerState.TRIPPED):
            return False
        return self.ai_repair_count < self.max_ai_repairs

    def record_ai_repair(self):
        self.ai_repair_count += 1
        logger.info(
            f"Circuit Breaker recorded AI Repair Pass ({self.ai_repair_count}/{self.max_ai_repairs})."
        )
        if self.ai_repair_count >= self.max_ai_repairs:
            self.state = CircuitBreakerState.DEGRADED
            self.trip_reason = f"Exhausted AI repair budget limit ({self.max_ai_repairs})."
            logger.warning(f"Circuit Breaker state changed to DEGRADED: {self.trip_reason}")

    def record_success(self):
        self.consecutive_failures = 0

    def record_failure(self, is_transient_outage: bool = False, reason: str = ""):
        self.total_failures += 1
        self.consecutive_failures += 1
        
        if is_transient_outage or "429" in reason or "rate limit" in reason.lower():
            self.state = CircuitBreakerState.TRIPPED
            self.trip_reason = f"Provider outage / rate limit detected: {reason}"
            logger.error(f"Circuit Breaker TRIPPED due to provider outage: {reason}")
        elif self.consecutive_failures >= self.consecutive_failure_limit:
            if self.state == CircuitBreakerState.CLOSED:
                self.state = CircuitBreakerState.DEGRADED
                self.trip_reason = f"Reached consecutive task failure limit ({self.consecutive_failure_limit})."
                logger.warning(f"Circuit Breaker DEGRADED: {self.trip_reason}")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "state": self.state,
            "aiRepairCount": self.ai_repair_count,
            "maxAiRepairs": self.max_ai_repairs,
            "consecutiveFailures": self.consecutive_failures,
            "totalFailures": self.total_failures,
            "tripReason": self.trip_reason
        }
