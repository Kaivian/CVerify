import json
import pytest
from pydantic import ValidationError
from app.pipelines.candidate.context import PipelineContext, CvSkill, MappedSkill, SkillTreeNode, PipelineEvent
from app.pipelines.candidate.contracts import (
    TrustScoreMetricsV2,
    SkillProficiencyV2,
    DomainProfileV2,
    BestFitRoleV2,
    StrengthWeaknessV2,
    EvidenceGovernanceV2,
    ScoreDimensionV2,
    ScoreBreakdownV2,
    CapabilityVectorDimensionsV2,
    CapabilityVectorV2,
    CandidateAssessmentV3Contract
)

# -----------------------------------------------------------------------------
# 1. CvSkill Model Tests
# -----------------------------------------------------------------------------
def test_cv_skill_valid():
    data = {"originalName": "Python", "normalizedName": "Python", "skillId": "skill:python"}
    model = CvSkill.model_validate(data)
    assert model.originalName == "Python"
    assert model.normalizedName == "Python"
    assert model.skillId == "skill:python"

def test_cv_skill_invalid():
    # Missing required field
    with pytest.raises(ValidationError):
        CvSkill.model_validate({"originalName": "Python"})

# -----------------------------------------------------------------------------
# 2. MappedSkill Model Tests
# -----------------------------------------------------------------------------
def test_mapped_skill_valid():
    data = {
        "rawName": "ReactJS",
        "normalizedName": "React",
        "skillId": "skill:react",
        "sfiaCategory": "Development",
        "onetCode": "15-1132.00",
        "evidenceStrength": "strong",
        "declaredInCv": True
    }
    model = MappedSkill.model_validate(data)
    assert model.evidenceStrength == "strong"
    assert model.declaredInCv is True

def test_mapped_skill_invalid_evidence():
    # Incorrect types / fields should raise validation errors if we enforce it
    with pytest.raises(ValidationError):
        MappedSkill.model_validate({"rawName": "React"})

# -----------------------------------------------------------------------------
# 3. SkillTreeNode Model Tests (Recursive Structure)
# -----------------------------------------------------------------------------
def test_skill_tree_node_recursive():
    child = {
        "id": "child-node",
        "displayName": "Child Node",
        "category": "Subdomain",
        "proficiencyLevel": "Practitioner",
        "confidenceScore": 0.8,
        "estimatedExperience": 24.0,
        "children": []
    }
    parent = {
        "id": "parent-node",
        "displayName": "Parent Node",
        "category": "Domain",
        "proficiencyLevel": "Expert",
        "confidenceScore": 0.95,
        "estimatedExperience": 48.0,
        "children": [child]
    }
    model = SkillTreeNode.model_validate(parent)
    assert model.id == "parent-node"
    assert len(model.children) == 1
    assert model.children[0].id == "child-node"

# -----------------------------------------------------------------------------
# 4. PipelineContext Model Tests (Immutability & Helper Methods)
# -----------------------------------------------------------------------------
def test_pipeline_context_initialization():
    ctx = PipelineContext(
        cv={"cvId": "123"},
        repositoryAssessments=[],
        cvSkills=["Python", "React JS"]
    )
    assert len(ctx.cvSkills) == 2
    assert ctx.cvSkills[0].originalName == "Python"
    assert ctx.cvSkills[0].skillId.startswith("skill:emerging-")

def test_pipeline_context_immutability():
    ctx = PipelineContext(
        cv={"cvId": "123"},
        repositoryAssessments=[],
        finalLevel="L2"
    )
    # Re-writing the same key raises ValueError
    with pytest.raises(ValueError, match="already been written and is immutable"):
        ctx.update(finalLevel="L3")

    # Modifying private variables is allowed
    new_ctx = ctx.update(_hybridSource="rule_override")
    assert new_ctx._hybridSource == "rule_override"

# -----------------------------------------------------------------------------
# 5. PipelineEvent Model Tests
# -----------------------------------------------------------------------------
def test_pipeline_event_valid():
    evt = PipelineEvent(
        eventType="TASK_STARTED",
        timestamp=1600000000.0,
        correlationId="corr-1",
        taskId="L2-001",
        payload={"foo": "bar"}
    )
    assert evt.eventType == "TASK_STARTED"
    assert evt.payload["foo"] == "bar"

# -----------------------------------------------------------------------------
# 6. CandidateAssessmentV3Contract Model Tests
# -----------------------------------------------------------------------------
@pytest.fixture
def valid_v3_profile():
    return {
        "schemaVersion": "candidate-profile-v3",
        "candidateScore": 75,
        "candidateScoreLabel": "Senior",
        "careerLevel": "L3",
        "careerLevelLabel": "Senior",
        "careerLevelConfidence": 0.9,
        "cohortPercentile": 85.0,
        "cohortVersion": "1.0.0",
        "cohortPercentileRange": {"min": 80.0, "max": 90.0},
        "primaryTendency": "Backend",
        "primaryWorkingStyle": "System Designer",
        "recruiterHeadline": "Experienced Backend Architect",
        "fullSummary": "Full narrative here",
        "professionalBio": "Professional bio here",
        "keyStrengths": ["System Design", "Caching"],
        "watchPoints": ["No major risks"],
        "displayConfidence": 0.9,
        "capabilityVector": {
            "version": "2.0.0",
            "skillDepth": 75.0,
            "ownership": 80.0,
            "architecture": 70.0,
            "problemSolving": 85.0,
            "impact": 65.0,
            "dimensions": {
                "skillDepth": 75.0,
                "ownership": 80.0,
                "architecture": 70.0,
                "problemSolving": 85.0,
                "impact": 65.0
            },
            "rawSignals": {}
        },
        "technicalDepth": 8.0,
        "technicalBreadth": 50.0,
        "leadershipPotential": 0.7,
        "executionStrength": 78.0,
        "trustLevel": 85.0,
        "evidenceCompleteness": "FULL",
        "cloneRiskClassification": "clean",
        "trustScoreMetrics": {
            "verifiedSkillRatio": 0.8,
            "verifiedRepositoryRatio": 0.9,
            "verifiedEvidenceRatio": 0.75,
            "candidateTrustScore": 85.0
        },
        "skills": [],
        "domainProfiles": [],
        "bestFitRoles": [],
        "strengthsWeaknesses": [],
        "evidenceGovernance": [],
        "scoreBreakdown": {
            "skillDepth": {"score": 75.0, "weight": 0.35},
            "ownership": {"score": 80.0, "weight": 0.25},
            "architecture": {"score": 70.0, "weight": 0.20},
            "problemSolving": {"score": 85.0, "weight": 0.12},
            "impact": {"score": 65.0, "weight": 0.08}
        }
    }

def test_v3_contract_valid(valid_v3_profile):
    model = CandidateAssessmentV3Contract.model_validate(valid_v3_profile)
    assert model.schemaVersion == "candidate-profile-v3"
    assert model.candidateScore == 75

def test_v3_contract_optional_fields_missing(valid_v3_profile):
    # Strip optional fields
    payload = valid_v3_profile.copy()
    del payload["primaryTendency"]
    del payload["primaryWorkingStyle"]
    del payload["recruiterHeadline"]
    del payload["fullSummary"]
    del payload["professionalBio"]
    del payload["displayConfidence"]

    model = CandidateAssessmentV3Contract.model_validate(payload)
    assert model.primaryTendency is None
    assert model.fullSummary is None
    assert model.professionalBio is None

def test_v3_contract_invalid_career_level(valid_v3_profile):
    payload = valid_v3_profile.copy()
    payload["careerLevel"] = "L6" # Invalid enum
    with pytest.raises(ValidationError):
        CandidateAssessmentV3Contract.model_validate(payload)
