import pytest
from app.pipelines.candidate.scoring_engine import score_candidate_deterministic
from app.pipelines.candidate.contracts import CandidateAssessmentV2Contract

def test_empty_candidate_profile():
    # Empty skills, empty repository assessments
    cv = {
        "skills": [],
        "projects": []
    }
    repository_assessments = []
    
    profile = score_candidate_deterministic(cv, repository_assessments)
    
    assert profile["schemaVersion"] == "candidate-profile-v2"
    assert "trustScoreMetrics" in profile
    metrics = profile["trustScoreMetrics"]
    assert metrics["verifiedSkillRatio"] == 0.0  # Reset to 0 when no repos
    assert metrics["verifiedRepositoryRatio"] == 0.0  # Reset to 0 when no repos
    assert metrics["verifiedEvidenceRatio"] == 0.0
    assert metrics["candidateTrustScore"] == 10.0  # Floor of 10.0
    assert profile["trustLevel"] == 10.0
    assert profile["evidenceCompleteness"] == "NONE"
    assert profile["cloneRiskClassification"] == "clean"

    # Validate against CandidateAssessmentV2Contract (SSOT)
    try:
        # Mock missing LLM-owned fields needed for contract validation
        mock_full_profile = profile.copy()
        mock_full_profile.update({
            "primaryTendency": "Backend",
            "primaryWorkingStyle": "Consistent",
            "recruiterHeadline": "Experienced Engineer",
            "fullSummary": "Full summary here",
            "keyStrengths": ["Coding"],
            "watchPoints": ["Testing"],
            "displayConfidence": 0.85
        })
        CandidateAssessmentV2Contract.model_validate(mock_full_profile)
    except Exception as ex:
        pytest.fail(f"Profile failed schema contract validation: {ex}")

def test_partial_candidate_profile():
    # Missing ownership scores, mixed repository ownership levels
    cv = {
        "skills": ["Python", "JavaScript", "Docker"],
        "projects": []
    }
    repository_assessments = [
        {
            "repositoryId": "repo-1",
            "repositoryName": "repo-1",
            "overallScore": 80.0,
            "intelligenceSignal": {
                "ownershipSignal": 0.15  # fails 30% gate
            },
            "skillAttributions": [
                {"skillName": "Python", "contributionWeight": 0.5}
            ]
        },
        {
            "repositoryId": "repo-2",
            "repositoryName": "repo-2",
            "overallScore": 90.0,
            "intelligenceSignal": {
                "ownershipSignal": 85.0  # passes 30% gate (value > 1.0 divided by 100 -> 0.85)
            },
            "skillAttributions": [
                {"skillName": "JavaScript", "contributionWeight": 0.9}
            ]
        }
    ]
    
    profile = score_candidate_deterministic(cv, repository_assessments)
    
    assert "trustScoreMetrics" in profile
    metrics = profile["trustScoreMetrics"]
    
    # 2 out of 3 skills verified (Python and JavaScript)
    assert abs(metrics["verifiedSkillRatio"] - 0.67) < 0.01
    
    # 1 out of 2 repos pass gate (ownershipSignal 85% passes, 15% fails)
    assert metrics["verifiedRepositoryRatio"] == 0.50
    
    # Evidence ratio is ownershipScore / candidateScore (both positive, clamped)
    assert 0.0 <= metrics["verifiedEvidenceRatio"] <= 1.0
    
    # Trust score is properly clamped
    assert 0.0 <= metrics["candidateTrustScore"] <= 100.0
    assert profile["trustLevel"] == metrics["candidateTrustScore"]
    assert profile["evidenceCompleteness"] in ("FULL", "PARTIAL", "NONE")

def test_full_candidate_profile():
    # Standard repository assessments and CV skills where everything passes
    cv = {
        "skills": ["Python", "Go"],
        "projects": []
    }
    repository_assessments = [
        {
            "repositoryId": "repo-1",
            "repositoryName": "repo-1",
            "overallScore": 95.0,
            "cvVerificationLevel": "AiAnalyzed",
            "trustLevel": 3,
            "intelligenceSignal": {
                "ownershipSignal": 90.0  # passes
            },
            "capabilities": [
                {"name": "Dependency Injection", "category": "architecture", "difficultyScore": 8.5, "maturity": "Advanced"}
            ],
            "skillAttributions": [
                {"skillName": "Python", "contributionWeight": 0.9},
                {"skillName": "Go", "contributionWeight": 0.8}
            ]
        }
    ]
    
    profile = score_candidate_deterministic(cv, repository_assessments)
    
    metrics = profile["trustScoreMetrics"]
    assert metrics["verifiedSkillRatio"] == 1.0
    assert metrics["verifiedRepositoryRatio"] == 1.0
    assert metrics["verifiedEvidenceRatio"] > 0.0
    assert metrics["candidateTrustScore"] > 60.0
    assert profile["trustLevel"] == metrics["candidateTrustScore"]
    assert profile["evidenceCompleteness"] == "FULL"

def test_domain_seniority_cascade_and_historical_metrics():
    cv = {
        "skills": [],
        "projects": [
            {
                "cvProjectId": "project-1",
                "name": "Project 1",
                "description": "Built backend systems using python",
                "technologies": ["Python"]
            }
        ]
    }
    repository_assessments = [
        {
            "repositoryId": "repo-1",
            "repositoryName": "repo-1",
            "overallScore": 95.0,
            "intelligenceSignal": {
                "ownershipSignal": 90.0,
                "leadershipSignal": 70.0
            },
            "capabilities": [
                {"name": "Architecture design", "category": "architecture", "difficultyScore": 10.0, "maturity": "Expert"},
                {"name": "Database scaling", "category": "infrastructure", "difficultyScore": 10.0, "maturity": "Expert"},
                {"name": "API Optimization", "category": "backend", "difficultyScore": 10.0, "maturity": "Expert"},
                {"name": "Security Audit", "category": "security", "difficultyScore": 10.0, "maturity": "Expert"},
                {"name": "CI/CD Pipeline", "category": "devops", "difficultyScore": 10.0, "maturity": "Expert"},
                {"name": "Monitoring System", "category": "infrastructure", "difficultyScore": 10.0, "maturity": "Expert"},
                {"name": "Cache Layer", "category": "backend", "difficultyScore": 10.0, "maturity": "Expert"}
            ],
            "domains": [
                {"domainName": "Backend Development", "weight": 1.0}
            ]
        }
    ]
    
    # Run deterministic scoring with historical maturity 80.0 (Staff) and problem solving 80.0
    profile = score_candidate_deterministic(
        cv=cv, 
        repository_assessments=repository_assessments,
        historical_maturity_score=80.0,
        historical_problem_solving_score=85.0
    )
    
    # Complexity: 9.0 * 10 = 90.0 (passes L5 >= 85)
    # Leadership: 70.0 (passes L4 >= 65)
    # Maturity: 80.0 (passes L4 >= 75 but fails L5 >= 85)
    # Ownership: 90.0 (passes L4 >= 60)
    # Overall level should be L4 (Staff) because maturity is 80.0
    assert profile["careerLevel"] == "L4"
    assert profile["careerLevelLabel"] == "Staff"
    assert profile["executionStrength"] == (0.0 + 85.0) / 2.0  # (consistency (0.0) + problem solving (85.0)) / 2.0 = 42.5
    
    # Verify domain level cascade: dom_complexity = 90.0 * 1.0 = 90.0
    # Since 90 >= 85, domain level should be L5 (Principal)
    domain_backend = next(d for d in profile["domainProfiles"] if d["domainName"] == "Backend Development")
    assert domain_backend["seniority"] == "Principal"

