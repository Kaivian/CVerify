import pytest
from app.pipelines.shared.ai.recovery.circuit_breaker import PipelineCircuitBreaker, CircuitBreakerState

def test_circuit_breaker_repair_budget():
    cb = PipelineCircuitBreaker(max_ai_repairs=2)
    assert cb.can_attempt_ai_repair() is True
    
    cb.record_ai_repair()
    assert cb.can_attempt_ai_repair() is True
    
    cb.record_ai_repair()
    assert cb.can_attempt_ai_repair() is False
    assert cb.state == CircuitBreakerState.DEGRADED

def test_circuit_breaker_consecutive_failures():
    cb = PipelineCircuitBreaker(consecutive_failure_limit=2)
    cb.record_failure(reason="JSON syntax error")
    assert cb.state == CircuitBreakerState.CLOSED
    
    cb.record_failure(reason="JSON syntax error")
    assert cb.state == CircuitBreakerState.DEGRADED

def test_circuit_breaker_outage_tripped():
    cb = PipelineCircuitBreaker()
    cb.record_failure(is_transient_outage=True, reason="HTTP 429 Too Many Requests")
    assert cb.state == CircuitBreakerState.TRIPPED
