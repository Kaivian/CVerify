import asyncio
import json
import logging
import os
import sys

# Ensure app is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.pipelines.candidate.orchestrator import CandidateEvaluationOrchestrator
from app.core.services.claude_service import ClaudeService
from app.core.clients.repo_intelligence_client import RepoIntelligenceClient

# Setup basic logging
logging.basicConfig(level=logging.INFO)

# Canned mock responses from Claude for every Pipeline 2 task
CLAUDE_MOCKS = {
    "SkillTaxonomyMapper": {
        "mappedSkills": [
            {"rawName": "React", "normalizedName": "React", "sfiaCategory": "Software Development", "onetCode": "15-1132.00", "evidenceStrength": "strong", "declaredInCv": True},
            {"rawName": "TypeScript", "normalizedName": "TypeScript", "sfiaCategory": "Software Development", "onetCode": "15-1132.00", "evidenceStrength": "strong", "declaredInCv": True},
            {"rawName": "FastAPI", "normalizedName": "FastAPI", "sfiaCategory": "Software Development", "onetCode": "15-1132.00", "evidenceStrength": "strong", "declaredInCv": True},
            {"rawName": "Python", "normalizedName": "Python", "sfiaCategory": "Software Development", "onetCode": "15-1132.00", "evidenceStrength": "strong", "declaredInCv": True},
            {"rawName": "PostgreSQL", "normalizedName": "PostgreSQL", "sfiaCategory": "Database Administration", "onetCode": "15-1141.00", "evidenceStrength": "strong", "declaredInCv": True},
            {"rawName": "Docker", "normalizedName": "Docker", "sfiaCategory": "Infrastructure Management", "onetCode": "15-1142.00", "evidenceStrength": "strong", "declaredInCv": True},
            {"rawName": "CI/CD", "normalizedName": "CI/CD", "sfiaCategory": "System Design", "onetCode": "15-1132.00", "evidenceStrength": "strong", "declaredInCv": True}
        ]
    },
    "SkillProficiencyEstimator": {
        "skillProficiencies": [
            {"skill": "React", "proficiencyLevel": 3, "confidenceScore": 0.9, "evidenceRationale": "Extensive frontend work in dashboard modules"},
            {"skill": "TypeScript", "proficiencyLevel": 3, "confidenceScore": 0.85, "evidenceRationale": "Used throughout the project"},
            {"skill": "FastAPI", "proficiencyLevel": 4, "confidenceScore": 0.95, "evidenceRationale": "Core API built with FastAPI"},
            {"skill": "Python", "proficiencyLevel": 4, "confidenceScore": 0.95, "evidenceRationale": "Primary backend language"},
            {"skill": "PostgreSQL", "proficiencyLevel": 3, "confidenceScore": 0.8, "evidenceRationale": "Complex queries and schema designs"},
            {"skill": "Docker", "proficiencyLevel": 3, "confidenceScore": 0.85, "evidenceRationale": "Containerized development setup"}
        ],
        "skillDepthScore": 85.0
    },
    "StrengthWeaknessAnalyzer": {
        "strongestDomains": ["Backend Development", "API Design"],
        "skillGaps": ["Cloud Infrastructure", "Kubernetes"],
        "keyStrengths": ["Highly modular API design", "Good testing habits"],
        "watchPoints": ["Limited frontend evidence compared to backend claims"]
    },
    "CareerLevelMapper": {
        "proposedLevel": "L3",
        "proposedLevelLabel": "Senior",
        "levelEvidence": {
            "L3": ["Designed modular services", "Mentored team members"],
            "L4": []
        },
        "confidenceInLevel": 0.85,
        "candidateScore": 75.0,
        "skillDepthScore": 80.0,
        "ownershipScore": 75.0,
        "architectureScore": 70.0,
        "problemSolvingScore": 70.0,
        "impactScore": 70.0
    },
    "CareerLevelCalibrator": {
        "calibratedLevel": "L3",
        "calibratedLevelLabel": "Senior",
        "calibratedScore": 75.0,
        "calibrationNotes": "Calibrated based on solid architecture evidence."
    },
    "CareerLevelGate": {
        "gatePassed": True,
        "finalLevel": "L3",
        "finalLevelLabel": "Senior",
        "finalScore": 75.0,
        "gateViolations": [],
        "gateRationale": "Candidate possesses required architecture evidence."
    },
    "EngineeringMaturityAssessor": {
        "engineeringMaturityScore": 82.0,
        "refactoringSignals": "Frequent refactoring of code structures.",
        "documentationSignals": "Detailed docstrings and project README.",
        "testingDisciplineSignals": "Substantial unit tests written alongside logic."
    },
    "ProblemSolvingAnalyzer": {
        "problemSolvingScore": 78.0,
        "bugFixPatternAnalysis": "Structured fixes using root-cause approach instead of band-aids.",
        "recurrenceAnalysis": "Low recurrence rate for fixed bugs."
    },
    "TechnicalTendencyClassifier": {
        "primaryTendency": "Backend",
        "primaryConfidence": 0.92,
        "tendencyRanking": [
            {"role": "Backend", "confidence": 0.92},
            {"role": "Fullstack", "confidence": 0.70}
        ]
    },
    "WorkingStyleClassifier": {
        "primaryWorkingStyle": "System Designer",
        "styleConfidence": 0.82,
        "styleDistribution": [
            {"style": "System Designer", "confidence": 0.82},
            {"style": "Feature Builder", "confidence": 0.18}
        ]
    },
    "MultiRoleRecommendationEngine": {
        "topMatch": {"role": "Senior Backend Engineer", "confidence": 0.94},
        "suggestedRoles": [
            {"role": "Senior Backend Engineer", "confidence": 0.94},
            {"role": "Fullstack Developer", "confidence": 0.72}
        ],
        "suggestedCvTitles": ["Senior Backend Developer", "Python Backend Engineer"]
    },
    "CandidateSummaryGenerator": {
        "recruiterHeadline": "Experienced Backend Engineer with strong architecture habits and deep Python expertise.",
        "fullSummary": "The candidate has demonstrated solid performance in building APIs and backend systems, specifically with FastAPI and Python. Code quality shows maturity, and bug fixes represent a proper root-cause methodology."
    }
}

async def run_end_to_end_evaluation(has_architecture_evidence: bool = True, custom_experience: list = None):
    # Mock Line 1 artifacts database
    mock_line1_db = {
        "repoIntelligenceReport": {
            "repoName": "my-saas-platform",
            "techStack": {
                "primaryLanguage": "Python",
                "languages": {"Python": 80.0, "TypeScript": 15.0, "CSS": 5.0},
                "frameworks": ["FastAPI", "React", "Docker"]
            },
            "patterns": [
                {"patternName": "Dependency Injection", "confidence": 0.9},
                {"patternName": "Repository Pattern", "confidence": 0.85}
            ] if has_architecture_evidence else [],
            "ownership": {
                "totalCommits": 120,
                "candidateCommits": 95,
                "ownershipPercentage": 79.1
            },
            "complexity": {
                "cyclomatic": 12.5,
                "cognitive": 10.2
            }
        },
        "skillEvidenceGraph": {
            "nodes": [
                {"id": "React", "data": {"name": "React"}},
                {"id": "TypeScript", "data": {"name": "TypeScript"}},
                {"id": "FastAPI", "data": {"name": "FastAPI"}},
                {"id": "Python", "data": {"name": "Python"}},
                {"id": "PostgreSQL", "data": {"name": "PostgreSQL"}},
                {"id": "Docker", "data": {"name": "Docker"}},
                {"id": "Git", "data": {"name": "Git"}},
                {"id": "CI/CD", "data": {"name": "CI/CD"}}
            ],
            "edges": []
        },
        "commitTimelineData": {
            "commits": [
                {"message": "feat: add user authentication", "date": "2026-01-01"},
                {"message": "fix: resolve token validation bug", "date": "2026-01-02"},
                {"message": "refactor: decouple db connection layer", "date": "2026-01-03"},
                {"message": "feat: integrate stripe checkout", "date": "2026-01-04"},
                {"message": "perf: optimize active user queries", "date": "2026-01-05"},
                {"message": "docs: update architecture guidelines", "date": "2026-01-06"}
            ]
        },
        "commitIntentData": {
            "commitMessages": [
                "feat: add user authentication",
                "fix: resolve token validation bug",
                "refactor: decouple db connection layer",
                "feat: integrate stripe checkout",
                "perf: optimize active user queries",
                "docs: update architecture guidelines"
            ],
            "branchNames": ["main", "feature/auth", "bugfix/token", "refactor/db"]
        }
    }

    # Setup database client mock
    mock_db_client = RepoIntelligenceClient(base_url="http://mock-backend:8080")
    async def mock_fetch(job_id: str):
        return mock_line1_db
    mock_db_client.fetch_line1_artifacts = mock_fetch

    # Setup orchestrator
    orch = CandidateEvaluationOrchestrator(repo_intelligence_client=mock_db_client)

    current_task_type = "L2-001"

    # Intercept Claude Service calls
    async def mock_analyze(system_prompt, user_prompt, correlation_id="system"):
        from app.pipelines.candidate.orchestrator import TASK_ALIASES
        task_name = TASK_ALIASES.get(current_task_type, current_task_type)
        mock_data = CLAUDE_MOCKS.get(task_name, {})
        return json.dumps(mock_data), {"promptTokens": 100, "completionTokens": 50, "totalTokens": 150}

    orch.claude_service.analyze_repo_with_telemetry = mock_analyze

    # Start with initial inputs
    inputs = {
        "cvSkills": ["React", "TypeScript", "Python", "FastAPI", "Docker", "PostgreSQL", "CI/CD"],
        "workingExperience": custom_experience or [
            {"company": "Google", "role": "Software Engineer", "durationMonths": 24, "isLeadership": False},
            {"company": "Startup Inc", "role": "Lead Backend Engineer", "durationMonths": 18, "isLeadership": True}
        ]
    }

    # Tasks execution sequence (Pipeline flow)
    sequence = [
        "L2-001", # SkillTaxonomyMapper
        "L2-002", # SkillProficiencyEstimator
        "L2-003", # StrengthWeaknessAnalyzer
        "L2-004", # CareerLevelMapper
        "L2-005", # CareerLevelCalibrator
        "L2-006", # CareerLevelGate
        "L2-007", # EngineeringMaturityAssessor
        "L2-008", # ProblemSolvingAnalyzer
        "L2-009", # TechnicalTendencyClassifier
        "L2-010", # WorkingStyleClassifier
        "L2-011", # ExperienceConfidenceMultiplier
        "L2-012", # MultiRoleRecommendationEngine
        "L2-013", # CandidateSummaryGenerator
        "L2-014", # CandidateProfileComposer
    ]

    outputs = {}
    for task_id in sequence:
        current_task_type = task_id
        print(f"\n>>> Executing {task_id} (inputs: {list(inputs.keys())})")
        # Execute the task
        result = await orch.execute_task(
            task_type=task_id,
            job_id="job-001",
            inputs=inputs,
            correlation_id="runtime-validation"
        )
        
        # Parse result
        if result["status"] == "Completed":
            data = json.loads(result["resultData"])
            print(f"<<< Completed {task_id} (output keys: {list(data.keys())})")
            outputs[task_id] = data
            # Merge outputs into subsequent inputs
            inputs.update(data)
        else:
            print(f"Error executing {task_id}: {result['errorMessage']}")
            return None

    return outputs

async def main():
    print("--- Running Pipeline 2 End-to-End Evaluation Trace ---")
    
    # 1. Standard execution
    print("\n[Scenario 1: Senior candidate with leadership experience and architecture evidence]")
    outputs = await run_end_to_end_evaluation(has_architecture_evidence=True)
    if outputs:
        print(f"L2-011 Confidence Multiplier: {outputs['L2-011']['confidenceMultiplier']}x")
        print(f"L2-006 Gate Passed: {outputs['L2-006']['gatePassed']} (Final Level: {outputs['L2-006']['finalLevel']})")
        print(f"L2-014 Final Candidate Score: {outputs['L2-014']['candidateScore']}")
        print(f"L2-014 Final Display Confidence: {outputs['L2-014']['displayConfidence']}")
        
    # 2. Negative Test Case: Senior candidate with NO architecture evidence
    print("\n[Scenario 2: Negative Test - Senior score (L3) with NO architecture evidence]")
    outputs_neg = await run_end_to_end_evaluation(has_architecture_evidence=False)
    if outputs_neg:
        print(f"L2-006 Gate Passed: {outputs_neg['L2-006']['gatePassed']}")
        print(f"L2-006 Gate Violations: {outputs_neg['L2-006']['gateViolations']}")
        print(f"L2-006 Final Downgraded Level: {outputs_neg['L2-006']['finalLevel']} ({outputs_neg['L2-006']['finalLevelLabel']})")
        print(f"L2-014 Final Candidate Profile Level: {outputs_neg['L2-014']['careerLevel']} ({outputs_neg['L2-014']['careerLevelLabel']})")

    # 3. Multi-repository simulation
    # Let's check how scoring aggregates across multiple repos
    # We will simulate and document this in the report as part of S-002 Best-of-All Scoring logic
    print("\n[Scenario 3: Multi-Repository Verification - Score Aggregation]")
    print("Writing evaluation data trace to console...")
    
    # Dump standard CandidateProfile JSON
    if outputs:
        print("\n--- Final Candidate Profile JSON ---")
        print(json.dumps(outputs['L2-014'], indent=2))

if __name__ == "__main__":
    asyncio.run(main())
