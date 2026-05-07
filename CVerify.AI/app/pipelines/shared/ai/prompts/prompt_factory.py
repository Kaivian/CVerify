from abc import ABC, abstractmethod
from typing import Any


class IPromptFactory(ABC):
    @abstractmethod
    def get_system_prompt(self) -> str:
        ...

    @abstractmethod
    def get_user_prompt(self, input: Any) -> str:
        ...
