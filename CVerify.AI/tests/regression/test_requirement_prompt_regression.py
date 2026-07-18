import pytest
from app.pipelines.shared.ai.prompts.requirement_prompt_factory import RequirementPromptFactory

@pytest.fixture
def sample_requirement():
    return {
        "id": "req-test-uuid",
        "title": "Staff Backend Engineer",
        "department": "Platform Services",
        "seniority": "Staff",
        "workplaceType": "Remote",
        "city": "Denver",
        "employmentType": "Full-Time",
        "salaryMin": 150000.0,
        "salaryMax": 200000.0,
        "currency": "USD",
        "timezoneRange": "UTC-7 to UTC-5",
        "degreeRequirement": "Bachelor's degree in CS",
        "benefits": ["Equity", "PTO"],
        "languageRequirements": ["English"],
        "headcount": 1,
        "hiringReason": "Platform scaling",
        "businessProblem": "DB bottleneck",
        "outcomes": ["Reduce db query latency by 50%"],
        "responsibilities": [
          {"text": "Design scalable DB layout", "priority": "MustHave", "ownershipLevel": "Owner", "isLeadership": True}
        ],
        "capabilities": [
          {"capabilityId": "db.scaling", "name": "DB Scaling", "category": "Database", "priority": "MustHave", "ownershipLevel": "Owner", "expectedProficiency": 5}
        ],
        "skills": [
          {"name": "PostgreSQL", "priority": "MustHave", "sfiaLevel": 5}
        ]
    }

def test_requirement_system_prompt_snapshot(snapshot_verify):
    """Verify that system prompt matches snapshot."""
    factory = RequirementPromptFactory()
    prompt = factory.get_system_prompt()
    snapshot_verify("requirement_system_prompt", {"prompt": prompt})

def test_unified_requirements_prompt_interpolation(snapshot_verify, sample_requirement):
    """Verify context interpolation in unified requirements prompt matches snapshot."""
    factory = RequirementPromptFactory()
    prompt = factory.get_unified_requirements_prompt(sample_requirement)
    
    # Assert specific parameters are injected into prompt string
    assert "Staff Backend Engineer" in prompt
    assert "Platform Services" in prompt
    assert "db.scaling" in prompt
    assert "PostgreSQL" in prompt
    
    snapshot_verify("unified_requirements_prompt", {"prompt": prompt})

def test_prompt_factory_hashes():
    """Verify metadata version checks in prompt factory."""
    factory = RequirementPromptFactory()
    assert factory.PROMPT_TEMPLATE_ID == "jd-generator-std"
    assert factory.PROMPT_VERSION == "1.2"
    
    hash1 = factory.get_prompt_hash("Test prompt content")
    hash2 = factory.get_prompt_hash("Test prompt content")
    hash3 = factory.get_prompt_hash("Different prompt")
    
    assert hash1 == hash2
    assert hash1 != hash3
