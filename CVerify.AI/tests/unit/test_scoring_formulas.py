import pytest
from app.pipelines.candidate.scoring_engine import (
    score_candidate_deterministic,
    calculate_verified_score,
    calculate_self_declared_score,
    aggregate_scores
)
from app.pipelines.candidate.tasks.career_level import calculate_vector_scores
from app.pipelines.candidate.context import PipelineContext

def test_scoring_formulas_empty_inputs():
    """Verify scoring behavior with zero repositories and empty CV."""
    cv = {"skills": [], "experiences": [], "projects": []}
    repos = []
    
    profile = score_candidate_deterministic(cv, repos)
    
    assert profile["candidateScore"] == 0
    assert profile["trustScoreMetrics"]["candidateTrustScore"] == 10.0  # Floor trust score
    assert profile["evidenceCompleteness"] == "NONE"

def test_scoring_formulas_division_by_zero():
    """Ensure that extremely empty or zero experience values do not cause division by zero."""
    cv = {
        "skills": ["Python"],
        "experiences": [{"durationMonths": 0, "company": "Test"}]
    }
    # Emulate vector score calculation
    context = PipelineContext(
        cv=cv,
        repositoryAssessments=[]
    )
    scores = calculate_vector_scores(context)
    # Impact score defaults to 12 months minimum internally if total_months == 0
    assert scores["impactScore"] > 0

def test_aggregate_scores_bounds():
    """Test that aggregated scores remain correctly bounded (0 to 100)."""
    policy = {
        "dimensions": {
            "skillDepth": {"weight": 0.35, "scale_A": 22.0, "scale_B": 0.05},
            "ownership": {"weight": 0.25, "scale_A": 22.0, "scale_B": 0.2},
            "architecture": {"weight": 0.20, "scale_A": 22.0, "scale_B": 0.05},
            "problemSolving": {"weight": 0.12, "scale_A": 22.0, "scale_B": 0.1},
            "impact": {"weight": 0.08, "scale_A": 20.0, "scale_B": 1.0}
        }
    }
    
    # 1. Underflow check
    verified_zero = {"skillDepth": 0.0, "ownership": 0.0, "architecture": 0.0, "problemSolving": 0.0, "impact": 0.0}
    self_decl_zero = {"score": 0.0, "skillDepth": 0.0, "ownership": 0.0, "architecture": 0.0, "problemSolving": 0.0, "impact": 0.0}
    res_zero = aggregate_scores(verified_zero, self_decl_zero, has_verified_repos=True, policy=policy)
    assert res_zero["score"] == 0.0
    
    # 2. Overflow/Perfect check
    verified_max = {"skillDepth": 100.0, "ownership": 100.0, "architecture": 100.0, "problemSolving": 100.0, "impact": 100.0}
    self_decl_max = {"score": 100.0, "skillDepth": 100.0, "ownership": 100.0, "architecture": 100.0, "problemSolving": 100.0, "impact": 100.0}
    res_max = aggregate_scores(verified_max, self_decl_max, has_verified_repos=True, policy=policy)
    assert res_max["score"] == 100.0

def test_self_declared_score_no_skills():
    """Verify that calculating self-declared score with empty skills returns floor score."""
    policy = {
        "dimensions": {
            "skillDepth": {"weight": 0.35, "scale_A": 22.0, "scale_B": 0.05},
            "ownership": {"weight": 0.25, "scale_A": 22.0, "scale_B": 0.2},
            "architecture": {"weight": 0.20, "scale_A": 22.0, "scale_B": 0.05},
            "problemSolving": {"weight": 0.12, "scale_A": 22.0, "scale_B": 0.1},
            "impact": {"weight": 0.08, "scale_A": 20.0, "scale_B": 1.0}
        }
    }
    res = calculate_self_declared_score(
        cv={"skills": [], "experiences": []},
        cv_skills=[],
        skill_proficiencies=[],
        repository_assessments=[],
        inputs={},
        policy=policy
    )
    assert res["score"] == 0.0
