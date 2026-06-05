from abc import ABC, abstractmethod


class IPercentileService(ABC):
    @abstractmethod
    async def get_percentile_async(self, score: float) -> int:
        ...


class PercentileService(IPercentileService):
    async def get_percentile_async(self, score: float) -> int:
        # Implementation will go here - calculate percentile rank against stored scores
        return 0
