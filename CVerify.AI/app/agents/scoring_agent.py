from dataclasses import dataclass, field
from typing import Any
from app.agents.base import IAgent


@dataclass
class ScoringInput:
    verified_profile: Any
    cv_data: Any
    github_data: Any


@dataclass
class ScoredProfile:
    composite_score: float = 0.0
    breakdown: dict[str, float] = field(default_factory=dict)
    percentile: int = 0


class ScoringAgent(IAgent):
    async def execute_async(self, input: Any) -> ScoredProfile:
        if not isinstance(input, ScoringInput):
            raise TypeError("Invalid input type for ScoringAgent")

        # Implementation will go here
        return ScoredProfile()
