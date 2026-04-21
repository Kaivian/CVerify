from abc import ABC, abstractmethod
from uuid import UUID


class ICvAnalysisOrchestrator(ABC):
    @abstractmethod
    async def orchestrate_async(self, submission_id: UUID) -> dict:
        ...


class CvAnalysisOrchestrator(ICvAnalysisOrchestrator):
    async def orchestrate_async(self, submission_id: UUID) -> dict:
        # Implementation will go here
        return {}
