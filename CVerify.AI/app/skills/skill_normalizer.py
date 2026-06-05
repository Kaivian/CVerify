from app.skills.skill_ontology import ISkillOntology


class SkillNormalizer:
    def __init__(self, ontology: ISkillOntology):
        self._ontology = ontology

    async def normalize_async(self, skill_name: str) -> str:
        definition = await self._ontology.get_skill_async(skill_name)
        return definition.name if definition.name else skill_name

    async def normalize_multiple_async(self, skills: list[str]) -> list[str]:
        return [await self.normalize_async(s) for s in skills]
