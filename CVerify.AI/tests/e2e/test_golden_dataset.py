import os
import json
import pytest
from app.pipelines.candidate.scoring_engine import score_candidate_deterministic

def load_golden_case(name: str):
    base_dir = os.path.dirname(os.path.dirname(__file__))
    input_path = os.path.join(base_dir, "golden_dataset", "inputs", f"{name}.json")
    expected_path = os.path.join(base_dir, "golden_dataset", "expected", f"{name}_expected.json")
    
    with open(input_path, "r") as f:
        input_data = json.load(f)
    with open(expected_path, "r") as f:
        expected_data = json.load(f)
        
    return input_data, expected_data

@pytest.mark.parametrize("persona", ["junior", "senior", "ai_engineer", "devops", "qa"])
def test_golden_dataset_personas(persona):
    """Verifies that each developer persona in the Golden Dataset computes results matching the expected baselines."""
    inputs, expected = load_golden_case(persona)
    
    cv = inputs["cv"]
    repos = inputs["repositoryAssessments"]
    
    profile = score_candidate_deterministic(cv, repos)
    
    # 1. Compare candidate score within a tolerance of +/- 1.0 (to allow minor rounding/float variances)
    assert abs(profile["candidateScore"] - expected["candidateScore"]) <= 1.0
    
    # 2. Compare career level classifications exactly
    assert profile["careerLevel"] == expected["careerLevel"]
    assert profile["careerLevelLabel"] == expected["careerLevelLabel"]
    
    # 3. Compare evidence completeness rating exactly
    assert profile["evidenceCompleteness"] == expected["evidenceCompleteness"]
    
    # 4. Compare clone risk classification exactly
    assert profile["cloneRiskClassification"] == expected["cloneRiskClassification"]
    
    # 5. Check capability vector dimension calculations match expected (within 1.0 tolerance)
    expected_vector = expected["capabilityVector"]["dimensions"]
    actual_vector = profile["capabilityVector"]["dimensions"]
    for dim in ("skillDepth", "ownership", "architecture", "problemSolving", "impact"):
        assert abs(actual_vector[dim] - expected_vector[dim]) <= 1.0
        
    # 6. Check trust score metrics (within 0.05 ratio tolerance)
    expected_metrics = expected["trustScoreMetrics"]
    actual_metrics = profile["trustScoreMetrics"]
    assert abs(actual_metrics["verifiedSkillRatio"] - expected_metrics["verifiedSkillRatio"]) <= 0.05
    assert abs(actual_metrics["verifiedRepositoryRatio"] - expected_metrics["verifiedRepositoryRatio"]) <= 0.05
    assert abs(actual_metrics["verifiedEvidenceRatio"] - expected_metrics["verifiedEvidenceRatio"]) <= 0.05
    assert abs(actual_metrics["candidateTrustScore"] - expected_metrics["candidateTrustScore"]) <= 1.0
