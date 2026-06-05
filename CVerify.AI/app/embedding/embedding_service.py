from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class EmbeddingOptions:
    api_key: str
    model: str = "text-embedding-3-small"
    dimensions: int = 1536


class IEmbeddingService(ABC):
    @abstractmethod
    async def embed_async(self, text: str) -> list[float]:
        ...


class OpenAiEmbeddingService(IEmbeddingService):
    def __init__(self, options: EmbeddingOptions):
        self._options = options

    async def embed_async(self, text: str) -> list[float]:
        # Implementation will go here - call OpenAI embedding API
        return []
