import json
import pytest
from app.pipelines.candidate.contracts import CandidateAssessmentV3Contract
from tests.unit.test_context_and_contracts import valid_v3_profile

def test_json_serialization_fidelity(valid_v3_profile):
    """Verifies that serialization to JSON and back preserves all types and structures."""
    model = CandidateAssessmentV3Contract.model_validate(valid_v3_profile)
    
    # Serialize to JSON string
    json_str = model.model_dump_json()
    
    # Parse JSON string back to dict
    parsed_dict = json.loads(json_str)
    
    # Validate parsed dict against model again
    roundtripped_model = CandidateAssessmentV3Contract.model_validate(parsed_dict)
    
    # Assert they are equal
    assert model.model_dump() == roundtripped_model.model_dump()
    assert roundtripped_model.schemaVersion == "candidate-profile-v3"
    assert roundtripped_model.cohortPercentileRange["min"] == 80.0

def test_cs_backend_deserialization_emulation(valid_v3_profile):
    """
    Emulates the C# CandidateAssessmentService.cs deserialization & constraint checking.
    If this test fails, it means CVerify.Core would crash when parsing the Python output!
    """
    model = CandidateAssessmentV3Contract.model_validate(valid_v3_profile)
    json_str = model.model_dump_json()
    root = json.loads(json_str)
    
    # C# Check 1: Enforce strict schema version (candidate-profile-v2 or candidate-profile-v3)
    assert "schemaVersion" in root
    assert root["schemaVersion"] in ("candidate-profile-v2", "candidate-profile-v3")
    
    # C# Check 2: Enforce trustScoreMetrics object
    assert "trustScoreMetrics" in root
    assert isinstance(root["trustScoreMetrics"], dict)
    
    # C# Check 3: Enforce subproperties inside trustScoreMetrics
    metrics = root["trustScoreMetrics"]
    for prop in ("verifiedSkillRatio", "verifiedRepositoryRatio", "verifiedEvidenceRatio", "candidateTrustScore"):
        assert prop in metrics
        assert isinstance(metrics[prop], (int, float))
        
    # C# Check 4: Column length restrictions (emulating Postgres limits)
    # E.g. careerLevel VARCHAR(10), careerLevelLabel VARCHAR(100), primaryTendency VARCHAR(100), primaryWorkingStyle VARCHAR(100)
    assert len(root["careerLevel"]) <= 10
    assert len(root["careerLevelLabel"]) <= 100
    if root["primaryTendency"]:
        assert len(root["primaryTendency"]) <= 100
    if root["primaryWorkingStyle"]:
        assert len(root["primaryWorkingStyle"]) <= 100
        
    # C# Check 5: Verify types of indexed columns (must be float/double equivalent)
    assert isinstance(root.get("candidateScore"), (int, float))
    assert isinstance(root.get("technicalDepth"), (int, float))
    assert isinstance(root.get("technicalBreadth"), (int, float))
    assert isinstance(root.get("leadershipPotential"), (int, float))
    assert isinstance(root.get("executionStrength"), (int, float))
    assert isinstance(root.get("trustLevel"), (int, float))
