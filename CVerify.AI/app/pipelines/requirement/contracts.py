from typing import List, Optional
from pydantic import BaseModel, Field

class JobDescriptionResponse(BaseModel):
    markdownContent: str = Field(description="The complete Job Description text formatted in markdown.")

class ScoringRules(BaseModel):
    minimumMaturityThreshold: str = Field(description="Minimum proficiency requirement, e.g. Contributor or Practitioner.")
    selfDeclaredMatchCeiling: float = Field(default=0.40, description="Capped scoring factor for self-declared skills (usually 0.40).")
    additionalRules: List[str] = Field(default_factory=list, description="Additional rules for assessing capability match.")

class EvidenceRequirementItem(BaseModel):
    capabilityId: str = Field(description="Canonical Capability ID, e.g. db.query-tuning.")
    evidenceType: str = Field(description="Evidence type, e.g. AstSignature or BlameAuthorship.")
    rationale: str = Field(description="Why this evidence is suitable for this capability.")
    expectedMetric: str = Field(description="Expected code verification metric, e.g. >40% blame ownership.")

class EvaluationRubricResponse(BaseModel):
    scoringRules: ScoringRules
    evidenceRequirements: List[EvidenceRequirementItem] = Field(default_factory=list)

class InterviewQuestionItem(BaseModel):
    capabilityId: str = Field(description="Canonical Capability ID.")
    questionText: str = Field(description="Targeted situational or behavioral question text.")
    gradingRubric: str = Field(description="Expected developer details and signals in their answer.")

class InterviewBlueprintResponse(BaseModel):
    questions: List[InterviewQuestionItem] = Field(default_factory=list)
    dimensions: List[str] = Field(default_factory=list, description="Evaluation dimensions.")
