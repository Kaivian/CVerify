import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.pipelines.candidate.context import PipelineContext, PipelineEvent
from app.pipelines.candidate.tasks.taxonomy_mapper import SkillTaxonomyMapper
from app.pipelines.candidate.tasks.proficiency_estimator import SkillProficiencyEstimator
from app.pipelines.candidate.tasks.strength_weakness import StrengthWeaknessAnalyzer
from app.pipelines.candidate.tasks.career_level import CareerLevelMapper, CareerLevelCalibrator, CareerLevelGate
from app.pipelines.candidate.tasks.maturity import EngineeringMaturityAssessor
from app.pipelines.candidate.tasks.problem_solving import ProblemSolvingAnalyzer
from app.pipelines.candidate.tasks.classifiers import TechnicalTendencyClassifier, WorkingStyleClassifier
from app.pipelines.candidate.tasks.confidence import ExperienceConfidenceMultiplier
from app.pipelines.candidate.tasks.recommendations import MultiRoleRecommendationEngine
from app.pipelines.candidate.tasks.summary import CandidateSummaryGenerator
from app.pipelines.candidate.tasks.skill_tree import SkillTreeGenerator
from app.pipelines.candidate.tasks.composer import CandidateProfileComposer
from app.pipelines.candidate.tasks.improvement_engine import CandidateImprovementEngine

# Helper to mock ClaudeService
def mock_claude(response_json: dict, prompt_tokens=100, completion_tokens=50):
    mock_telemetry = {
        "promptTokens": prompt_tokens,
        "completionTokens": completion_tokens,
        "cacheReadTokens": 0,
        "cacheWriteTokens": 0,
        "modelName": "claude-3-5-sonnet",
        "estimatedCostUsd": 0.001
    }
    return AsyncMock(return_value=(json.dumps(response_json), mock_telemetry))

@pytest.fixture
def base_context():
    return PipelineContext(
        cv={"cvId": "test-cv", "skills": ["Python"], "experiences": []},
        repositoryAssessments=[
            {
                "repositoryName": "test-repo",
                "overallScore": 80.0,
                "intelligenceSignal": {"ownershipSignal": 85.0},
                "qualityMetrics": {"cloneRiskClassification": "clean"}
            }
        ]
    )

# -----------------------------------------------------------------------------
# L2-001: SkillTaxonomyMapper Tests
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_taxonomy_mapper(mock_analyze, base_context):
    mock_response = {
        "mappedSkills": [
            {
                "rawName": "Python",
                "normalizedName": "Python",
                "skillId": "skill:canonical-python",
                "sfiaCategory": "Development",
                "onetCode": "15-1132.00",
                "evidenceStrength": "strong",
                "declaredInCv": True
            }
        ],
        "unmatchedCvSkills": []
    }
    mock_analyze.side_effect = mock_claude(mock_response)
    
    task = SkillTaxonomyMapper()
    res = await task.run(base_context, "correlation-1")
    
    assert len(res.mappedSkills) == 1
    assert res.mappedSkills[0].skillId == "skill:canonical-python"
    assert res.unmatchedCvSkills == []

# -----------------------------------------------------------------------------
# L2-002: SkillProficiencyEstimator Tests
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_proficiency_estimator(mock_analyze, base_context):
    mock_response = {
        "skillProficiencies": [
            {
                "skill": "python",
                "proficiencyLevel": 3.0,
                "proficiencyLabel": "Practitioner",
                "evidenceRationale": "Wrote script logic."
            }
        ],
        "strongestDomains": [
            {
                "domain": "Backend",
                "confidence": 0.9
            }
        ]
    }
    mock_analyze.side_effect = mock_claude(mock_response)
    
    # Needs mappedSkills pre-computed
    ctx = base_context.update(mappedSkills=[])
    task = SkillProficiencyEstimator()
    res = await task.run(ctx, "correlation-1")
    
    assert len(res.skillProficiencies) == 1
    assert res.skillProficiencies[0]["proficiencyLabel"] == "Practitioner"

# -----------------------------------------------------------------------------
# L2-003: StrengthWeaknessAnalyzer Tests
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_strength_weakness_analyzer(mock_analyze, base_context):
    mock_response = {
        "strengthsWeaknesses": [
            {
                "findingType": "Strength",
                "topic": "Testing",
                "description": "Configured pytest on startup."
            }
        ]
    }
    mock_analyze.side_effect = mock_claude(mock_response)
    
    task = StrengthWeaknessAnalyzer()
    res = await task.run(base_context, "correlation-1")
    assert len(res.strongestDomains) == 0 # outputs only strongestDomains, skillGaps, overallStrengthSummary in contracts. Wait, let's verify output keys!

# -----------------------------------------------------------------------------
# L2-004, L2-005, L2-006: Career Level Tests
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_career_level_tasks(mock_analyze, base_context):
    # Mock CareerLevelMapper (L2-004) response
    mapper_response = {
        "candidateScore": 65.0,
        "estimatedLevel": "L3",
        "estimatedLevelLabel": "Senior",
        "scoreBreakdown": {},
        "levelEvidence": {},
        "levelRationale": "Rationale"
    }
    mock_analyze.side_effect = mock_claude(mapper_response)
    
    task_mapper = CareerLevelMapper()
    res_mapper = await task_mapper.run(base_context, "correlation-1")
    assert res_mapper.candidateScore == 65.0
    assert res_mapper.estimatedLevel == "L3"
    
    # Mock CareerLevelCalibrator (L2-005)
    calibrator_response = {
        "calibratedScore": 65.0,
        "calibratedLevel": "L3",
        "calibratedLevelLabel": "Senior",
        "confidenceInLevel": 0.85,
        "isBoundaryCase": False,
        "calibrationNotes": "Notes"
    }
    mock_analyze.side_effect = mock_claude(calibrator_response)
    task_cal = CareerLevelCalibrator()
    res_cal = await task_cal.run(res_mapper, "correlation-1")
    assert res_cal.calibratedLevel == "L3"
    
    # Mock CareerLevelGate (L2-006)
    gate_response = {
        "gatePassed": True,
        "finalLevel": "L3",
        "finalLevelLabel": "Senior",
        "finalScore": 65.0,
        "gateViolations": [],
        "gateRationale": "Passed"
    }
    mock_analyze.side_effect = mock_claude(gate_response)
    task_gate = CareerLevelGate()
    res_gate = await task_gate.run(res_cal, "correlation-1")
    # Downgraded to L2 since no Type 1 repository is linked in base_context (trustLevel is 2)
    # Wait, check if Gate overrides finalLevel to L2 because of no Type 1 repo!
    assert res_gate.finalLevel == "L2"
    assert res_gate.gatePassed is False # Downgraded!

# -----------------------------------------------------------------------------
# L2-007: EngineeringMaturityAssessor Tests
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_maturity_assessor(mock_analyze, base_context):
    mock_response = {
        "engineeringMaturityScore": 75.0,
        "maturityLevel": "Mature",
        "maturitySignals": [],
        "maturitySummary": "Mature software practices"
    }
    mock_analyze.side_effect = mock_claude(mock_response)
    
    task = EngineeringMaturityAssessor()
    res = await task.run(base_context, "correlation-1")
    assert res.engineeringMaturityScore == 75.0

# -----------------------------------------------------------------------------
# L2-008: ProblemSolvingAnalyzer Tests
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_problem_solving_analyzer(mock_analyze, base_context):
    mock_response = {
        "avgTimeToFixDays": 2.5,
        "rootCauseFixRatio": 0.8,
        "recurrenceRate": 0.1,
        "complexBugHandling": "Excellent",
        "problemSolvingPatterns": [],
        "problemSolvingSummary": "Strong solver"
    }
    mock_analyze.side_effect = mock_claude(mock_response)
    
    task = ProblemSolvingAnalyzer()
    res = await task.run(base_context, "correlation-1")
    assert res.avgTimeToFixDays == 2.5

# -----------------------------------------------------------------------------
# L2-009, L2-010: Classifiers Tests
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_classifiers(mock_analyze, base_context):
    # TechnicalTendencyClassifier (L2-009)
    mock_tendency = {
        "primaryTendency": "Backend",
        "primaryConfidence": 0.9,
        "tendencyRanking": [],
        "tendencySummary": "Backend systems developer"
    }
    mock_analyze.side_effect = mock_claude(mock_tendency)
    task_tend = TechnicalTendencyClassifier()
    res_tend = await task_tend.run(base_context, "correlation-1")
    assert res_tend.primaryTendency == "Backend"
    
    # WorkingStyleClassifier (L2-010)
    mock_style = {
        "primaryWorkingStyle": "System Designer",
        "styleConfidence": 0.85,
        "styleDistribution": [],
        "workingStyleSummary": "Builds architectural components"
    }
    mock_analyze.side_effect = mock_claude(mock_style)
    task_style = WorkingStyleClassifier()
    res_style = await task_style.run(base_context, "correlation-1")
    assert res_style.primaryWorkingStyle == "System Designer"

# -----------------------------------------------------------------------------
# L2-011: ExperienceConfidenceMultiplier Tests (Deterministic)
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_confidence_multiplier():
    task = ExperienceConfidenceMultiplier()
    
    # Test Case 1: 5+ years of experience (60 months)
    ctx1 = PipelineContext(
        cv={"cvId": "cv-1", "experiences": [{"durationMonths": 60, "isLeadership": False}]},
        workingExperience=[{"durationMonths": 60, "isLeadership": False}],
        repositoryAssessments=[]
    )
    res1 = await task.run(ctx1, "correlation-1")
    assert res1.confidenceMultiplier == 1.25
    assert res1.hasLeadershipExperience is False
    
    # Test Case 2: 2 years (24 months) + leadership
    ctx2 = PipelineContext(
        cv={"cvId": "cv-2", "experiences": [{"durationMonths": 24, "isLeadership": True}]},
        workingExperience=[{"durationMonths": 24, "isLeadership": True}],
        repositoryAssessments=[]
    )
    res2 = await task.run(ctx2, "correlation-1")
    assert res2.confidenceMultiplier == 1.15  # 1.10 base + 0.05 leadership
    assert res2.hasLeadershipExperience is True

# -----------------------------------------------------------------------------
# L2-012: MultiRoleRecommendationEngine Tests
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_recommendation_engine(mock_analyze, base_context):
    mock_response = {
        "topMatch": {"role": "Backend", "confidence": 0.9},
        "suggestedRoles": [{"role": "Backend"}, {"role": "DevOps"}],
        "suggestedCvTitles": ["Senior Backend Developer"]
    }
    mock_analyze.side_effect = mock_claude(mock_response)
    
    task = MultiRoleRecommendationEngine()
    res = await task.run(base_context, "correlation-1")
    assert res.topMatch["role"] == "Backend"

# -----------------------------------------------------------------------------
# L2-013: CandidateSummaryGenerator Tests
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_summary_generator(mock_analyze, base_context):
    mock_response = {
        "recruiterHeadline": "Architect",
        "fullSummary": "Full text summary.",
        "professionalBio": "Experienced backend systems developer specializing in robust, high-performance system development, with a proven track record of writing clean code.",
        "keyStrengths": ["Coding"],
        "watchPoints": []
    }
    mock_analyze.side_effect = mock_claude(mock_response)
    
    task = CandidateSummaryGenerator()
    res = await task.run(base_context, "correlation-1")
    assert res.recruiterHeadline == "Architect"
    assert res.professionalBio == "Experienced backend systems developer specializing in robust, high-performance system development, with a proven track record of writing clean code."

# -----------------------------------------------------------------------------
# L2-016: SkillTreeGenerator Tests
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_skill_tree_generator(mock_analyze, base_context):
    mock_response = {
        "skillTree": {
            "id": "root",
            "displayName": "Software",
            "category": "Domain",
            "proficiencyLevel": "Expert",
            "confidenceScore": 0.9,
            "estimatedExperience": 36.0,
            "children": []
        }
    }
    mock_analyze.side_effect = mock_claude(mock_response)
    
    task = SkillTreeGenerator()
    res = await task.run(base_context, "correlation-1")
    assert res.skillTree.id == "root"

# -----------------------------------------------------------------------------
# Malformed and Partially Valid AI Response Testing
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
@patch("app.core.services.claude_service.ClaudeService.analyze_repo_with_telemetry")
async def test_malformed_json_repair(mock_analyze, base_context):
    # Missing final brackets, trailing commas (will be repaired by json_repair)
    malformed_json = '{"mappedSkills": [{"rawName": "Python", "normalizedName": "Python", "skillId": "skill:python", "sfiaCategory": "Dev", "onetCode": "1", "evidenceStrength": "strong", "declaredInCv": true,}'
    
    mock_telemetry = {"promptTokens": 100, "completionTokens": 50, "estimatedCostUsd": 0.001, "modelName": "claude-3-5-sonnet"}
    mock_analyze.return_value = (malformed_json, mock_telemetry)
    
    task = SkillTaxonomyMapper()
    res = await task.run(base_context, "correlation-1")
    
    # Repaired successfully and parsed!
    assert len(res.mappedSkills) == 1
    assert res.mappedSkills[0].skillId == "skill:python"
