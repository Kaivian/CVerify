from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class RepoSelectionCriteria:
    max_repos: int = 5
    min_commits: int = 1
    prefer_owned_over: bool = True
    sort_by: str = "updated"


class IRepoSelector(ABC):
    @abstractmethod
    def select(self, repos: list[Any], criteria: RepoSelectionCriteria) -> list[Any]:
        ...


class RepoSelector(IRepoSelector):
    def select(self, repos: list[Any], criteria: RepoSelectionCriteria) -> list[Any]:
        # Implementation will go here
        return repos
