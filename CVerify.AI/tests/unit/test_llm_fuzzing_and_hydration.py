import pytest
from app.pipelines.candidate.context import PipelineContext, MappedSkill, SkillTreeNode
from app.pipelines.candidate.tasks.taxonomy_mapper import SkillTaxonomyMapper
from app.pipelines.candidate.tasks.skill_tree import SkillTreeGenerator

def test_pipeline_context_mapped_skills_fuzzing_hydration():
    # Simulate incomplete LLM output missing declaredInCv, onetCode, and evidenceStrength
    incomplete_mapped_skills = [
        {
            "rawName": "Axios HTTP Client",
            "normalizedName": "Axios",
            "skillId": "skill:emerging-axios",
        },
        {
            "rawName": "React",
            "normalizedName": "React",
            "skillId": "skill:react",
            "sfiaCategory": "Frontend Development",
            "declaredInCv": True,
        }
    ]

    context = PipelineContext(
        cv={"profile": {"fullName": "Test Engineer"}},
        repositoryAssessments=[],
        mappedSkills=incomplete_mapped_skills,
    )

    assert context.mappedSkills is not None
    assert len(context.mappedSkills) == 2
    assert isinstance(context.mappedSkills[0], MappedSkill)
    assert context.mappedSkills[0].rawName == "Axios HTTP Client"
    assert context.mappedSkills[0].declaredInCv is False
    assert context.mappedSkills[0].evidenceStrength == "weak"
    assert context.mappedSkills[0].onetCode == "15-1252.00"

def test_pipeline_context_skill_tree_fuzzing_hydration():
    # Simulate incomplete LLM output with missing node fields
    incomplete_tree = {
        "id": "software-engineering",
        "displayName": "Software Engineering",
        "category": "Domain",
        "proficiencyLevel": "Practitioner",
        "confidenceScore": 0.9,
        "estimatedExperience": 36.0,
        "children": [
            {
                "id": "software-engineering/backend",
                # missing displayName, category, proficiencyLevel, etc.
                "children": []
            }
        ]
    }

    context = PipelineContext(
        cv={"profile": {"fullName": "Test Engineer"}},
        repositoryAssessments=[],
        skillTree=incomplete_tree,
    )

    assert context.skillTree is not None
    assert isinstance(context.skillTree, SkillTreeNode)
    assert len(context.skillTree.children) == 1
    child = context.skillTree.children[0]
    assert child.displayName == "Backend"
    assert child.category == "Technology"
    assert child.confidenceScore == 0.5

@pytest.mark.asyncio
async def test_skill_taxonomy_mapper_deterministic_hydration():
    mapper = SkillTaxonomyMapper()
    context = PipelineContext(
        cv={
            "profile": {"fullName": "Jane Doe"},
            "skills": ["C#", ".NET Core"],
            "experiences": [],
            "projects": []
        },
        cvSkills=["C#", ".NET Core"],
        skillEvidenceGraph={
            "nodes": [
                {
                    "id": "csharp",
                    "data": {"name": "C#", "commitCount": 10, "fileCount": 5}
                }
            ]
        },
        repositoryAssessments=[],
    )

    # Inject mock Claude response omitting declaredInCv and evidenceStrength
    async def mock_analyze_repo(*args, **kwargs):
        json_resp = (
            '{"mappedSkills": ['
            '{"rawName": "C#", "normalizedName": "C#", "skillId": "skill:csharp"}, '
            '{"rawName": "Docker", "normalizedName": "Docker", "skillId": "skill:docker"}'
            '], "unmatchedCvSkills": []}'
        )
        return json_resp, {}

    mapper.claude_service.analyze_repo_with_telemetry = mock_analyze_repo

    res = await mapper._execute_internal(context, "test-corr-id")
    mapped = res.get("mappedSkills", [])

    csharp_skill = next((s for s in mapped if s["rawName"] == "C#"), None)
    assert csharp_skill is not None
    assert csharp_skill["declaredInCv"] is True
    assert csharp_skill["evidenceStrength"] == "strong"

    docker_skill = next((s for s in mapped if s["rawName"] == "Docker"), None)
    assert docker_skill is not None
    assert docker_skill["declaredInCv"] is False
    assert docker_skill["evidenceStrength"] == "none"

@pytest.mark.asyncio
async def test_skill_tree_generator_node_sanitization():
    generator = SkillTreeGenerator()
    context = PipelineContext(
        cv={"profile": {"fullName": "Jane Doe"}},
        repositoryAssessments=[],
        totalExperienceMonths=24.0,
    )

    async def mock_analyze_repo(*args, **kwargs):
        json_resp = (
            '{"skillTree": {'
            '"id": "root", "displayName": "Root", "category": "Domain", '
            '"proficiencyLevel": "Practitioner", "confidenceScore": 0.8, "estimatedExperience": 24.0, '
            '"children": [{"id": "root/sub-node"}]'
            '}}'
        )
        return json_resp, {}

    generator.claude_service.analyze_repo_with_telemetry = mock_analyze_repo

    res = await generator._execute_internal(context, "test-corr-id")
    tree = res.get("skillTree", {})
    assert tree["id"] == "root"
    assert len(tree["children"]) == 1
    assert tree["children"][0]["displayName"] == "Sub Node"
    assert tree["children"][0]["confidenceScore"] == 0.5
