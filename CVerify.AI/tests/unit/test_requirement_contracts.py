import pytest
from pydantic import ValidationError
from app.pipelines.requirement.contracts import (
    ScoringRules,
    EvidenceRequirementItem,
    EvaluationRubricResponse,
    InterviewQuestionItem,
    InterviewBlueprintResponse,
    JobDescriptionSection,
    JobPostMetadata,
    CandidateDiscoveryProfile,
    UnifiedGenerationMetadata,
    UnifiedRequirementArtifactsResponse
)

def test_scoring_rules_valid():
    rules = ScoringRules(
        minimumMaturityThreshold="Practitioner",
        selfDeclaredMatchCeiling=0.40,
        additionalRules=["Verify experience years."]
    )
    assert rules.minimumMaturityThreshold == "Practitioner"
    assert rules.selfDeclaredMatchCeiling == 0.40
    assert len(rules.additionalRules) == 1

def test_scoring_rules_defaults():
    rules = ScoringRules(minimumMaturityThreshold="Contributor")
    assert rules.selfDeclaredMatchCeiling == 0.40
    assert rules.additionalRules == []

def test_evidence_requirement_item_valid():
    item = EvidenceRequirementItem(
        capabilityId="db.query-tuning",
        evidenceType="AstSignature",
        rationale="DB check",
        expectedMetric="blame > 40%"
    )
    assert item.capabilityId == "db.query-tuning"

def test_evaluation_rubric_response_valid():
    rules = ScoringRules(minimumMaturityThreshold="Practitioner")
    item = EvidenceRequirementItem(
        capabilityId="db.query-tuning",
        evidenceType="AstSignature",
        rationale="DB check",
        expectedMetric="blame > 40%"
    )
    rubric = EvaluationRubricResponse(
        scoringRules=rules,
        evidenceRequirements=[item]
    )
    assert len(rubric.evidenceRequirements) == 1

def test_interview_question_item_valid():
    item = InterviewQuestionItem(
        capabilityId="db.query-tuning",
        questionText="How do you optimize slow queries?",
        gradingRubric="Look for EXPLAIN output analysis"
    )
    assert item.capabilityId == "db.query-tuning"

def test_interview_blueprint_response_valid():
    item = InterviewQuestionItem(
        capabilityId="db.query-tuning",
        questionText="Test?",
        gradingRubric="Grading"
    )
    blueprint = InterviewBlueprintResponse(
        questions=[item],
        dimensions=["Code Quality"]
    )
    assert len(blueprint.questions) == 1
    assert blueprint.dimensions == ["Code Quality"]

def test_job_description_section_valid():
    section = JobDescriptionSection(
        markdownContent="# Senior Developer",
        title="Senior Developer",
        department="Engineering",
        summary="A great role",
        responsibilities=["Write code"],
        skills=["C#"]
    )
    assert section.title == "Senior Developer"

def test_job_description_section_invalid():
    with pytest.raises(ValidationError):
        JobDescriptionSection(title="Missing markdownContent")

def test_job_post_metadata_valid():
    meta = JobPostMetadata(
        experienceRange="3-5 years",
        degreeRequirement="Bachelor's"
    )
    assert meta.experienceRange == "3-5 years"
    assert meta.industryCategory == "Software Engineering"

def test_candidate_discovery_profile_valid():
    profile = CandidateDiscoveryProfile(
        keyKeywords=["C#", "Kubernetes"],
        minimumYearsOfExperience=3,
        priorityWeights={"db.query-tuning": 0.6},
        trustRequirements={"minTrust": 60.0}
    )
    assert profile.minimumYearsOfExperience == 3
    assert profile.priorityWeights["db.query-tuning"] == 0.6

def test_unified_requirement_artifacts_response_valid():
    payload = {
        "schemaVersion": "1.0.0",
        "metadata": {
            "modelIdentifier": "claude-3-5-sonnet",
            "promptVersion": "2.0",
            "generatedAtUtc": "2026-06-21T10:13:41Z"
        },
        "jobDescription": {
            "markdownContent": "# Title",
            "title": "Title",
            "department": "Dept",
            "summary": "Summary",
            "responsibilities": ["Resp1"],
            "skills": ["Skill1"]
        },
        "assessmentRubric": {
            "scoringRules": {
                "minimumMaturityThreshold": "Practitioner",
                "selfDeclaredMatchCeiling": 0.40,
                "additionalRules": []
            },
            "evidenceRequirements": []
        },
        "interviewBlueprint": {
            "questions": [],
            "dimensions": ["Code Hygiene"]
        },
        "jobPostMetadata": {
            "experienceRange": "3-5 years",
            "degreeRequirement": "Bachelor's"
        },
        "candidateDiscoveryProfile": {
            "keyKeywords": ["C#"],
            "minimumYearsOfExperience": 3,
            "priorityWeights": {},
            "trustRequirements": {}
        }
    }
    model = UnifiedRequirementArtifactsResponse.model_validate(payload)
    assert model.schemaVersion == "1.0.0"
    assert model.jobDescription.title == "Title"
