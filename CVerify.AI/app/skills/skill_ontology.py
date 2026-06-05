import json
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class SkillDefinition:
    name: str
    category: str
    aliases: list[str] = field(default_factory=list)
    proficiency: int = 0


class ISkillOntology(ABC):
    @abstractmethod
    async def get_skill_async(self, skill_name: str) -> SkillDefinition:
        ...

    @abstractmethod
    async def get_all_skills_async(self) -> list[str]:
        ...

    @abstractmethod
    async def get_skills_by_category(self, category: str) -> list[str]:
        ...


_DATA_FILE = Path(__file__).parent / "data" / "skill_ontology.json"


class SkillOntologyService(ISkillOntology):
    def __init__(self):
        self._skills: dict[str, SkillDefinition] = {}
        self._load()

    def _load(self) -> None:
        if not _DATA_FILE.exists():
            return
        with open(_DATA_FILE, encoding="utf-8") as f:
            data = json.load(f)
        for entry in data.get("skills", []):
            skill = SkillDefinition(
                name=entry["name"],
                category=entry.get("category", ""),
                aliases=entry.get("aliases", []),
                proficiency=entry.get("proficiency", 0),
            )
            self._skills[entry["id"]] = skill
            for alias in skill.aliases:
                self._skills[alias.lower()] = skill

    async def get_skill_async(self, skill_name: str) -> SkillDefinition:
        return self._skills.get(skill_name.lower(), SkillDefinition(name=skill_name, category=""))

    async def get_all_skills_async(self) -> list[str]:
        return [s.name for s in set(self._skills.values())]

    async def get_skills_by_category(self, category: str) -> list[str]:
        return [s.name for s in set(self._skills.values()) if s.category == category]
