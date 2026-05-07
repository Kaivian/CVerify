from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class SanitizationResult:
    safe_version: str
    is_suspicious: bool
    reasons: list[str] = field(default_factory=list)


class IPromptSanitizer(ABC):
    @abstractmethod
    def sanitize(self, input: str) -> SanitizationResult:
        ...


class PromptSanitizer(IPromptSanitizer):
    def sanitize(self, input: str) -> SanitizationResult:
        # Implementation will go here - detect prompt injection patterns
        return SanitizationResult(safe_version=input, is_suspicious=False)
