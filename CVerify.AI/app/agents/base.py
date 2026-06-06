from abc import ABC, abstractmethod
from typing import Any


class IAgent(ABC):
    @abstractmethod
    async def execute_async(self, input: Any) -> Any:
        ...
