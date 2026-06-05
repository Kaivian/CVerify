from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class CodeSample:
    file_content: list[str] = field(default_factory=list)
    file_names: list[str] = field(default_factory=list)


@dataclass
class CodeSamplingOptions:
    max_files: int = 10
    max_lines_per_file: int = 100
    extensions: list[str] = field(default_factory=list)


class ICodeSampler(ABC):
    @abstractmethod
    async def sample_async(self, repo: Any, token: str, options: CodeSamplingOptions) -> CodeSample:
        ...


class CodeSampler(ICodeSampler):
    async def sample_async(self, repo: Any, token: str, options: CodeSamplingOptions) -> CodeSample:
        # Implementation will go here
        return CodeSample()
