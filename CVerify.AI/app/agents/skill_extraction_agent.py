from dataclasses import dataclass, field
from typing import Any
from app.agents.base import IAgent


@dataclass
class SkillExtractionInput:
    text: str


@dataclass
class ExtractedSkillsResult:
    skills: list[str] = field(default_factory=list)
    categories: list[str] = field(default_factory=list)
    proficiency_levels: list[str] = field(default_factory=list)


class SkillExtractionAgent(IAgent):
    async def execute_async(self, input: Any) -> ExtractedSkillsResult:
        if not isinstance(input, SkillExtractionInput):
            raise TypeError("Invalid input type for SkillExtractionAgent")

        # Implementation will go here
        return ExtractedSkillsResult()
