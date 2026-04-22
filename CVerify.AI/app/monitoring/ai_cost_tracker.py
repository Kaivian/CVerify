import logging
from abc import ABC, abstractmethod
from collections import defaultdict
from decimal import Decimal
from typing import Any
from uuid import UUID

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
        return cls._instance

    def record(self, activity: Any, cost: Decimal) -> None:
        key = str(activity)
        self._costs[key] += cost
        logger.info(f"Recorded custom cost for {key}: ${cost:.6f}. Running total: ${self._costs[key]:.6f}")

    async def get_total_cost_async(self, candidate_id: UUID) -> Decimal:
        # Resolve total cost accumulated under candidate identifier
        key = str(candidate_id)
        return self._costs[key]

    def record_usage(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cache_creation_tokens: int = 0,
        cache_read_tokens: int = 0,
        correlation_id: str = "system"
    ) -> Decimal:
        """
        Calculates the cost based on Claude 3.5 Sonnet pricing and stores it by correlation_id.
        Pricing rates (per million tokens):
          - Base Input tokens: $3.00
          - Cache Write tokens: $3.75
          - Cache Read tokens: $0.30
          - Output tokens: $15.00
        """
        # Determine rates (defaulting to Claude 3.5 Sonnet prices)
        # Rates per single token
        input_base_rate = Decimal("0.000003")      # $3.00 / M
        input_write_rate = Decimal("0.00000375")   # $3.75 / M
        input_read_rate = Decimal("0.0000003")     # $0.30 / M
        output_rate = Decimal("0.000015")          # $15.00 / M

        # Adjust rates for other models if necessary
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

        # If cache read/creation are active, subtract them from the base input tokens
        # Anthropic's API returns `input_tokens` as the total input tokens (which includes cache hits and writes).
        # Therefore, base input tokens = total_input - cache_read - cache_write
        base_input_tokens = max(0, input_tokens - cache_read_tokens - cache_creation_tokens)

        cost = (
            (Decimal(base_input_tokens) * input_base_rate) +
            (Decimal(cache_creation_tokens) * input_write_rate) +
            (Decimal(cache_read_tokens) * input_read_rate) +
            (Decimal(output_tokens) * output_rate)
        )

        # Record under correlation ID
        self._costs[correlation_id] += cost
        logger.info(
            f"Calculated telemetry cost for correlation_id={correlation_id}: ${cost:.6f}. Total logged cost: ${self._costs[correlation_id]:.6f}",
            extra={"correlation_id": correlation_id}
        )
        return cost

    def get_correlation_cost(self, correlation_id: str) -> Decimal:
        return self._costs[correlation_id]
