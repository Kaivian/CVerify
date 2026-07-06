import pytest
from unittest.mock import MagicMock
from app.pipelines.candidate.context import PipelineContext
from app.pipelines.candidate.dag import PipelineDAG, PipelineValidationError
from app.pipelines.candidate.base_task import BaseTask
from app.pipelines.candidate.tasks.career_level import calculate_vector_scores
from app.pipelines.candidate.tasks.improvement_engine import CandidateImprovementEngine

class DummyTask(BaseTask):
    def __init__(self, name: str, dependencies: list, inputs: list, outputs: list):
        self._name = name
        self._deps = dependencies
        self._inputs = inputs
        self._outputs = outputs

    @property
    def name(self) -> str:
        return self._name

    @property
    def task_name(self) -> str:
        return f"Dummy{self._name}"

    @property
    def dependencies(self) -> list:
        return self._deps

    @property
    def input_keys(self) -> list:
        return self._inputs

    @property
    def output_keys(self) -> list:
        return self._outputs

    async def _execute_internal(self, context: PipelineContext, correlation_id: str) -> dict:
        return {k: "dummy" for k in self._outputs}


def test_pipeline_context_immutability():
    ctx = PipelineContext(
        cv={"cvId": "123"},
        repositoryAssessments=[],
        backgroundRepositories=[],
        correlationId="test"
    )
    assert ctx.cv["cvId"] == "123"
    
    # Successful update
    new_ctx = ctx.update(finalLevel="L2")
    assert new_ctx.finalLevel == "L2"
    
    # Trying to mutate an already written key should raise ValueError
    with pytest.raises(ValueError, match="State key 'finalLevel' has already been written"):
        new_ctx.update(finalLevel="L3")


def test_dag_validation_cycle_detection():
    # A depends on B, B depends on A (Cycle)
    task_a = DummyTask("L2-A", ["L2-B"], ["cv"], ["finalLevel"])
    task_b = DummyTask("L2-B", ["L2-A"], ["cv"], ["gatePassed"])
    
    dag = PipelineDAG([task_a, task_b])
    with pytest.raises(PipelineValidationError, match="Circular dependency detected"):
        dag.validate()


def test_dag_validation_missing_key_detection():
    # Task requires an input key not defined in PipelineContext schema
    task_invalid = DummyTask("L2-Invalid", [], ["nonExistentKeyInContext"], ["gatePassed"])
    dag = PipelineDAG([task_invalid])
    with pytest.raises(PipelineValidationError, match="requires input key 'nonExistentKeyInContext' which is missing"):
        dag.validate()


def test_vector_scoring_computations():
    # Construct a test context with mock repository assessments
    context = PipelineContext(
        cv={
            "skills": ["Python", "Docker"],
            "experiences": [
                {"durationMonths": 24, "company": "Google", "jobTitle": "Senior Software Engineer"}
            ]
        },
        repositoryAssessments=[
            {
                "repositoryName": "test-repo",
                "cvVerificationLevel": "AiAnalyzed",
                "trustLevel": 3,
                "intelligenceSignal": {
                    "ownershipSignal": 0.85 # High ownership
                },
                "qualityMetrics": {
                    "complexityScore": 80.0
                },
                "capabilities": [
                    {"name": "Dependency Injection", "category": "architecture", "difficultyScore": 8.0, "maturity": "Advanced"}
                ],
                "verifiedPatterns": ["dependency injection"]
            }
        ],
        backgroundRepositories=[],
        cvSkills=["Python", "Docker"],
        workingExperience=[
            {"durationMonths": 24, "company": "Google", "jobTitle": "Senior Software Engineer"}
        ]
    )
    
    scores = calculate_vector_scores(context)
    
    # Assertions based on growth equations:
    assert abs(scores["ownershipScore"] - 24.46) < 0.5  # Tolerance-based check for logarithmic ownership scale
    assert scores["architectureScore"] > 0.0  # DI pattern multiplier should scale up
    assert scores["problemSolvingScore"] > 0.0  # Complexity score sigmoid response
    assert scores["impactScore"] > 0.0  # Google + Senior power law compounding duration


@pytest.mark.asyncio
async def test_improvement_engine_logic():
    # Setup context simulating L2-006 downgrade (L3 calibrated downgraded to L2 due to lack of Type 1 repo)
    context = PipelineContext(
        cv={},
        repositoryAssessments=[
            {
                "repositoryName": "low-ownership-repo",
                "intelligenceSignal": {"ownershipSignal": 0.15} # < 30% threshold
            }
        ],
        correlationId="test",
        calibratedLevel="L3",
        finalLevel="L2",
        gateViolations=["Seniority levels (L3+) require at least one verified Type 1 repository."],
        candidateProfile={
            "capabilityVector": {
                "skillDepth": 40.0,
                "ownership": 0.15,
                "architecture": 50.0,
                "problemSolving": 45.0,
                "impact": 30.0
            },
            "skills": [
                {"skillName": "React", "level": "Unverified"}
            ]
        }
    )
    
    engine = CandidateImprovementEngine()
    result = await engine.run(context, "test")
    
    plan = result.candidateProfile["improvementPlan"]
    assert plan["targetLevel"] == "L3"
    
    recommendations = plan["recommendations"]
    assert len(recommendations) >= 1
    
    # Assert prioritizing gate violations
    high_prio = [r for r in recommendations if r["priority"] == "High"]
    assert len(high_prio) > 0
    assert any("Type 1" in r["observation"] for r in high_prio)
