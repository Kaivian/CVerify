from dataclasses import dataclass, field
from typing import Any
from uuid import UUID
from app.agents.base import IAgent


@dataclass
class MatchingInput:
    candidate_id: UUID
    scored_profile: Any
    jobs: list


@dataclass
class MatchResult:
    job_id: UUID
    candidate_id: UUID
    overall_score: float
    skill_match_score: float
    experience_score: float
    strengths: list[str] = field(default_factory=list)
    gaps: list[str] = field(default_factory=list)
    explanation: str = ""


class MatchingAgent(IAgent):
    async def execute_async(self, input: Any) -> list[MatchResult]:
        if not isinstance(input, MatchingInput):
            raise TypeError("Invalid input type for MatchingAgent")

        # Implementation will go here
        return []
