from dataclasses import dataclass, field
from typing import Any
from uuid import UUID
from app.agents.base import IAgent


@dataclass
class CvAgentInput:
    submission_id: UUID
    raw_text: str


@dataclass
class CvAgentResult:
    skills: list[str] = field(default_factory=list)
    experience: list[str] = field(default_factory=list)
    education: list[str] = field(default_factory=list)
    completeness_score: float = 0.0
    raw_sections: dict = field(default_factory=dict)


class CvAgent(IAgent):
    async def execute_async(self, input: Any) -> CvAgentResult:
        if not isinstance(input, CvAgentInput):
            raise TypeError("Invalid input type for CvAgent")

        # Implementation will go here
        return CvAgentResult()
