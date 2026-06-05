from abc import ABC, abstractmethod
from uuid import UUID


class IJobMatchingOrchestrator(ABC):
    @abstractmethod
    async def orchestrate_async(self, candidate_id: UUID) -> list:
        ...


class JobMatchingOrchestrator(IJobMatchingOrchestrator):
    async def orchestrate_async(self, candidate_id: UUID) -> list:
        # Implementation will go here
        return []
