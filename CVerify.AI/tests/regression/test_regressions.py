import pytest
from app.pipelines.candidate.tasks.composer import CandidateProfileComposer
from app.pipelines.candidate.context import PipelineContext

def test_regression_composer_dependencies():
    """
    REGRESSION: Verify that CandidateProfileComposer (L2-014) lists L2-016 (SkillTreeGenerator)
    in its dependencies list, resolving the hidden dependency topological bug.
    """
    composer = CandidateProfileComposer()
    assert "L2-016" in composer.dependencies, "L2-014 must explicitly list L2-016 in its dependencies to compile the Skill Tree properly."

def test_regression_context_immutability():
    """
    REGRESSION: Verify that updating an already written key in PipelineContext raises a ValueError,
    ensuring immutable execution context guarantees across all stages.
    """
    context = PipelineContext(
        cv={"cvId": "test-cv"},
        repositoryAssessments=[],
        finalLevel="L2"
    )
    with pytest.raises(ValueError, match="already been written and is immutable"):
        context.update(finalLevel="L3")

def test_regression_taxonomy_id_generation():
    """
    REGRESSION: Verify that emerging CV skills are correctly mapped to taxonomy IDs starting with 'skill:emerging-'.
    """
    context = PipelineContext(
        cv={"cvId": "test"},
        repositoryAssessments=[],
        cvSkills=["Rust Programming"]
    )
    assert len(context.cvSkills) == 1
    assert context.cvSkills[0].skillId.startswith("skill:emerging-")
