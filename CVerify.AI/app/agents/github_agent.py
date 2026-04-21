from dataclasses import dataclass, field
from typing import Any
from uuid import UUID
from app.agents.base import IAgent


@dataclass
class GitHubAgentInput:
    candidate_id: UUID
    encrypted_token: str


@dataclass
class GitHubAgentResult:
    repo_analyses: list = field(default_factory=list)
    overall_activity_score: float = 0.0
    overall_contribution_score: float = 0.0


class GitHubAgent(IAgent):
    async def execute_async(self, input: Any) -> GitHubAgentResult:
        if not isinstance(input, GitHubAgentInput):
            raise TypeError("Invalid input type for GitHubAgent")

        # Implementation will go here
        return GitHubAgentResult()
