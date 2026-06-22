from typing import List, Optional, Dict, Any
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

class JobDescriptionSection(BaseModel):
    markdownContent: str = Field(description="The complete Job Description text formatted in markdown matching the required 13 sections.")
    title: str = Field(description="The role title.")
    department: str = Field(description="The department.")
    summary: str = Field(description="Brief position summary.")
    responsibilities: List[str] = Field(description="Core responsibilities.")
    skills: List[str] = Field(description="Core technical capabilities.")

class JobPostMetadata(BaseModel):
    experienceRange: str = Field(description="Calibrated experience years/range, e.g. '3-5 years' or '1-2 years'.")
    degreeRequirement: str = Field(description="Educational degree requirements.")
    industryCategory: str = Field(default="Software Engineering", description="Job industry category.")
    coverUrl: str = Field(default="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=600&auto=format&fit=crop", description="Cover image URL.")
    tags: List[str] = Field(default_factory=list, description="Descriptive search and category tags.")

class CandidateDiscoveryProfile(BaseModel):
    keyKeywords: List[str] = Field(default_factory=list, description="Keywords for search index matching.")
    minimumYearsOfExperience: int = Field(default=0, description="Minimum years of experience required.")
    priorityWeights: Dict[str, float] = Field(default_factory=dict, description="Recommended weights per capability ID.")
    trustRequirements: Dict[str, Any] = Field(default_factory=dict, description="Custom trust requirements.")

class UnifiedGenerationMetadata(BaseModel):
    modelIdentifier: str = Field(description="Name/version of the LLM model used.")
    promptVersion: str = Field(description="Version of the prompt template used.")
    generatedAtUtc: str = Field(description="ISO 8601 UTC timestamp of generation.")

class UnifiedRequirementArtifactsResponse(BaseModel):
    schemaVersion: str = Field(default="1.0.0", description="Schema version of the JSON contract.")
    metadata: UnifiedGenerationMetadata
    jobDescription: JobDescriptionSection
    assessmentRubric: EvaluationRubricResponse
    interviewBlueprint: InterviewBlueprintResponse
    jobPostMetadata: JobPostMetadata
    candidateDiscoveryProfile: CandidateDiscoveryProfile

