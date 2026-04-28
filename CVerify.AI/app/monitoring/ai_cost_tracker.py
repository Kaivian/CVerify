import logging
from abc import ABC, abstractmethod
from collections import defaultdict
from decimal import Decimal
from typing import Any, List, Dict, Optional
from uuid import UUID
from datetime import datetime, timezone
from app.monitoring.observability import TraceContext
from app.services.token_accounting_service import TokenAccountingService

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
            "totalTokens": 0,
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
        Calculates cost using centralized accounting service rules.
        """
        return TokenAccountingService.calculate_cost(
            model=model,
            prompt_tokens=input_tokens,
            completion_tokens=output_tokens,
            cache_creation_tokens=cache_creation_tokens,
            cache_read_tokens=cache_read_tokens
        )

    def record_usage(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cache_creation_tokens: int = 0,
        cache_read_tokens: int = 0,
        correlation_id: str = "system",
        total_tokens: Optional[int] = None
    ) -> Decimal:
        normalized = TokenAccountingService.normalize_usage(
            model=model,
            prompt_tokens=input_tokens,
            completion_tokens=output_tokens,
            total_tokens=total_tokens,
            cache_creation_tokens=cache_creation_tokens,
            cache_read_tokens=cache_read_tokens
        )
        cost = Decimal(str(normalized.estimated_cost_usd))
        
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
            duration_ms=0,
            total_tokens=total_tokens
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
        status: str = "success",
        total_tokens: Optional[int] = None
    ) -> Decimal:
        normalized = TokenAccountingService.normalize_usage(
            model=model,
            prompt_tokens=input_tokens,
            completion_tokens=output_tokens,
            total_tokens=total_tokens,
            cache_creation_tokens=cache_creation_tokens,
            cache_read_tokens=cache_read_tokens
        )
        cost = Decimal(str(normalized.estimated_cost_usd))
        
        execution_record = {
            "model": model,
            "executionType": execution_type,
            "promptTokens": normalized.prompt_tokens,
            "completionTokens": normalized.completion_tokens,
            "totalTokens": normalized.total_tokens,
            "cacheWriteTokens": normalized.cache_write_tokens,
            "cacheReadTokens": normalized.cache_read_tokens,
            "estimatedCostUsd": normalized.estimated_cost_usd,
            "durationMs": duration_ms,
            "status": status,
            "tokenMismatchFlag": normalized.token_mismatch_detected,
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
