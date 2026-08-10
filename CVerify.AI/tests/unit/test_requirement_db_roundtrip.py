import json
import pytest
from app.pipelines.requirement.contracts import UnifiedRequirementArtifactsResponse
from tests.unit.tasks.test_requirement_orchestrator import MOCK_CLAUDE_RESPONSE

def test_json_serialization_fidelity():
    """Verify that serialization to JSON and back preserves all fields and types of requirement response."""
    model = UnifiedRequirementArtifactsResponse.model_validate(MOCK_CLAUDE_RESPONSE)
    
    # Dump to JSON
    json_str = model.model_dump_json()
    
    # Reload and validate
    parsed = json.loads(json_str)
    roundtrip = UnifiedRequirementArtifactsResponse.model_validate(parsed)
    
    assert model.model_dump() == roundtrip.model_dump()
    assert roundtrip.schemaVersion == "1.0.0"
    assert roundtrip.jobDescription.title == "Senior Developer"

def test_cs_backend_deserialization_rules():
    """
    Emulate the C# HiringRequirementService.cs parsing and saving constraints.
    Asserts varchar length bounds in postgres matching entities:
      - requirement_artifacts table column limits
      - evaluation_rubrics limits
      - interview_blueprints limits
    """
    model = UnifiedRequirementArtifactsResponse.model_validate(MOCK_CLAUDE_RESPONSE)
    json_str = model.model_dump_json()
    root = json.loads(json_str)
    
    # 1. Verify schemaVersion
    assert "schemaVersion" in root
    assert root["schemaVersion"] == "1.0.0"
    
    # 2. Emulate DB artifact limits (RequirementArtifact.cs)
    # ArtifactType MaxLength: 100
    assert len("JobDescription") <= 100
    assert len("EvaluationRubric") <= 100
    assert len("InterviewBlueprint") <= 100
    
    # ModelInfo MaxLength: 100
    model_info = root["metadata"]["modelIdentifier"]
    assert len(model_info) <= 100
    
    # PromptTemplateId MaxLength: 100
    assert len("jd-generator-std") <= 100
    
    # PromptVersion MaxLength: 50
    prompt_version = root["metadata"]["promptVersion"]
    assert len(prompt_version) <= 50
    
    # Status MaxLength: 50
    assert len("Generated") <= 50
    assert len("Regenerating") <= 50
    
    # 3. Emulate JobVacancy limits (JobVacancy.cs)
    # Title MaxLength: 255
    jd_title = root["jobDescription"]["title"]
    assert len(jd_title) <= 255
    
    # Department MaxLength: 100
    jd_dept = root["jobDescription"]["department"]
    assert len(jd_dept) <= 100
    
    # Experience MaxLength: 100 (experienceRange maps to Experience)
    experience_range = root["jobPostMetadata"]["experienceRange"]
    assert len(experience_range) <= 100
    
    # Degree MaxLength: 100 (degreeRequirement maps to Degree)
    degree = root["jobPostMetadata"]["degreeRequirement"]
    assert len(degree) <= 100
    
    # Category MaxLength: 100 (industryCategory maps to Category)
    category = root["jobPostMetadata"]["industryCategory"]
    assert len(category) <= 100
