import logging
from abc import ABC, abstractmethod
from collections import defaultdict
from decimal import Decimal
from typing import Any, List, Dict
from uuid import UUID
from datetime import datetime, timezone
from app.monitoring.observability import TraceContext

logger = logging.getLogger("ai_cost_tracker")

class IAiCostTracker(ABC):
    @abstractmethod
    def record(self, activity: Any, cost: Decimal) -> None:
        ...

    @abstractmethod
    async def get_total_cost_async(self, candidate_id: UUID) -> Decimal:
        ...

class AiCostTracker(IAiCostTracker):
    _instance = None

    def __new__(cls):
        # Implement singleton pattern to preserve cost registry state across service lifespans
        if cls._instance is None:
            cls._instance = super(AiCostTracker, cls).__new__(cls)
            cls._instance._costs = defaultdict(Decimal)
            cls._instance._executions = defaultdict(list)
        return cls._instance

    def record(self, activity: Any, cost: Decimal) -> None:
        key = str(activity)
        self._costs[key] += cost
        logger.info(f"Recorded custom cost for {key}: ${cost:.6f}. Running total: ${self._costs[key]:.6f}")

        # Record in trace context
        ctx = TraceContext.get()
        if "executions" not in ctx:
            TraceContext.set(executions=[])
        
        TraceContext.get().setdefault("executions", []).append({
            "model": "custom_activity",
            "executionType": "custom_cost",
            "promptTokens": 0,
            "completionTokens": 0,
            "cacheWriteTokens": 0,
            "cacheReadTokens": 0,
            "estimatedCostUsd": float(cost),
            "durationMs": 0,
            "status": "success",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

    async def get_total_cost_async(self, candidate_id: UUID) -> Decimal:
        # Resolve total cost accumulated under candidate identifier
        key = str(candidate_id)
        return self._costs[key]

    def calculate_cost(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cache_creation_tokens: int = 0,
        cache_read_tokens: int = 0
    ) -> Decimal:
        """
        Calculates cost based on model pricing rules.
        """
        input_base_rate = Decimal("0.000003")      # Claude 3.5 Sonnet: $3.00 / M
        input_write_rate = Decimal("0.00000375")   # Claude 3.5 Sonnet Cache Write: $3.75 / M
        input_read_rate = Decimal("0.0000003")     # Claude 3.5 Sonnet Cache Read: $0.30 / M
        output_rate = Decimal("0.000015")          # Claude 3.5 Sonnet Output: $15.00 / M

        model_lower = model.lower()
        if "haiku" in model_lower:
            input_base_rate = Decimal("0.0000008")  # $0.80 / M
            input_write_rate = Decimal("0.000001")  # $1.00 / M
            input_read_rate = Decimal("0.00000008") # $0.08 / M
            output_rate = Decimal("0.000004")       # $4.00 / M
        elif "opus" in model_lower:
            input_base_rate = Decimal("0.000015")   # $15.00 / M
            input_write_rate = Decimal("0.00001875")# $18.75 / M
            input_read_rate = Decimal("0.0000015")  # $1.50 / M
            output_rate = Decimal("0.000075")       # $75.00 / M

        # Anthropic returns total input tokens including cache creation and reads.
        base_input_tokens = max(0, input_tokens - cache_read_tokens - cache_creation_tokens)

        cost = (
            (Decimal(base_input_tokens) * input_base_rate) +
            (Decimal(cache_creation_tokens) * input_write_rate) +
            (Decimal(cache_read_tokens) * input_read_rate) +
            (Decimal(output_tokens) * output_rate)
        )
        return cost

    def record_usage(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cache_creation_tokens: int = 0,
        cache_read_tokens: int = 0,
        correlation_id: str = "system"
    ) -> Decimal:
        cost = self.calculate_cost(model, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens)
        
        # Record under correlation ID
        self._costs[correlation_id] += cost
        logger.info(
            f"Calculated telemetry cost for correlation_id={correlation_id}: ${cost:.6f}. Total logged cost: ${self._costs[correlation_id]:.6f}",
            extra={"correlation_id": correlation_id}
        )

        # Record detailed execution ledger
        self.record_execution(
            correlation_id=correlation_id,
            model=model,
            execution_type="llm_call",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cache_creation_tokens=cache_creation_tokens,
            cache_read_tokens=cache_read_tokens,
            duration_ms=0
        )
        return cost

    def record_execution(
        self,
        correlation_id: str,
        model: str,
        execution_type: str,
        input_tokens: int,
        output_tokens: int,
        cache_creation_tokens: int = 0,
        cache_read_tokens: int = 0,
        duration_ms: int = 0,
        status: str = "success"
    ) -> Decimal:
        cost = self.calculate_cost(model, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens)
        
        execution_record = {
            "model": model,
            "executionType": execution_type,
            "promptTokens": input_tokens,
            "completionTokens": output_tokens,
            "cacheWriteTokens": cache_creation_tokens,
            "cacheReadTokens": cache_read_tokens,
            "estimatedCostUsd": float(cost),
            "durationMs": duration_ms,
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        self._executions[correlation_id].append(execution_record)
        
        # Save to async contextvars TraceContext
        ctx = TraceContext.get()
        if "executions" not in ctx:
            TraceContext.set(executions=[])
        
        TraceContext.get().setdefault("executions", []).append(execution_record)
        
        return cost

    def get_correlation_cost(self, correlation_id: str) -> Decimal:
        return self._costs[correlation_id]

    def get_executions(self, correlation_id: str) -> List[Dict[str, Any]]:
        return self._executions[correlation_id]

    def clear_executions(self, correlation_id: str):
        if correlation_id in self._executions:
            del self._executions[correlation_id]
