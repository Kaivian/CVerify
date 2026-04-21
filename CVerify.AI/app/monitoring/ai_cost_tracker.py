from abc import ABC, abstractmethod
from collections import defaultdict
from decimal import Decimal
from typing import Any
from uuid import UUID


class IAiCostTracker(ABC):
    @abstractmethod
    def record(self, activity: Any, cost: Decimal) -> None:
        ...

    @abstractmethod
    async def get_total_cost_async(self, candidate_id: UUID) -> Decimal:
        ...


class AiCostTracker(IAiCostTracker):
    def __init__(self):
        self._costs: dict[str, Decimal] = defaultdict(Decimal)

    def record(self, activity: Any, cost: Decimal) -> None:
        # Implementation will go here - track cost per request
        pass

    async def get_total_cost_async(self, candidate_id: UUID) -> Decimal:
        # Implementation will go here
        return Decimal("0")
