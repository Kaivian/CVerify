from abc import ABC, abstractmethod


class ITextExtractor(ABC):
    @abstractmethod
    async def extract_async(self, file_content: bytes) -> str:
        ...
