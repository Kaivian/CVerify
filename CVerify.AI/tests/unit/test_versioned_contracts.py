import pytest
from pydantic import BaseModel
from app.pipelines.shared.ai.validation.versioning import ContractRegistry
from app.pipelines.shared.ai.validation.validator import TaskOutputValidator

class DummyContractV2(BaseModel):
    mappedSkills: list
    unmatchedCvSkills: list

def test_contract_registry_and_validation():
    ContractRegistry.register_contract("SkillTaxonomyMapper", "2.0.0", model_cls=DummyContractV2)
    
    # Valid raw output matching contract
    raw_valid = '{"mappedSkills": [{"rawName": "C#"}], "unmatchedCvSkills": []}'
    res = TaskOutputValidator.validate_output(raw_valid, ["mappedSkills", "unmatchedCvSkills"], "SkillTaxonomyMapper", "2.0.0")
    assert res.is_valid is True

    # Invalid raw output missing key
    raw_invalid = '{"mappedSkills": [{"rawName": "C#"}]}'
    res2 = TaskOutputValidator.validate_output(raw_invalid, ["mappedSkills", "unmatchedCvSkills"], "SkillTaxonomyMapper", "2.0.0")
    assert res2.is_valid is False
    assert len(res2.errors) > 0
