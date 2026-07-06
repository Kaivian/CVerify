from pydantic import BaseModel, Field
from typing import Dict, List, Literal, Optional, Any

class TrustScoreMetricsV2(BaseModel):
    verifiedSkillRatio: float
    verifiedRepositoryRatio: float
    verifiedEvidenceRatio: float
    candidateTrustScore: float

class SkillProficiencyV2(BaseModel):
    skillName: str
    score: float
    confidence: float
    level: str
    evidenceSources: str

class DomainProfileV2(BaseModel):
    domainName: str
    score: float
    confidence: float
    seniority: str
    supportingEvidence: str

class BestFitRoleV2(BaseModel):
    roleTitle: str
    matchScore: float
    confidence: float
    rank: int
    matchingEngineVersion: str
    evidence: Optional[str] = None
    engineMetadata: Optional[str] = None

class StrengthWeaknessV2(BaseModel):
    findingType: str
    topic: str
    description: str
    evidence: Optional[str] = None

class EvidenceGovernanceV2(BaseModel):
    repositoryId: str
    repositoryName: str
    cvProjectEntryId: Optional[str] = None
    cvProjectName: Optional[str] = None
    cvVerificationLevel: Optional[str] = None
    trustLevel: int
    authorshipPercent: float
    scoreContributionPercent: float

class ScoreDimensionV2(BaseModel):
    score: float
    weight: float

class ScoreBreakdownV2(BaseModel):
    skillDepth: ScoreDimensionV2
    ownership: ScoreDimensionV2
    architecture: ScoreDimensionV2
    problemSolving: ScoreDimensionV2
    impact: ScoreDimensionV2

class CapabilityVectorDimensionsV2(BaseModel):
    skillDepth: float
    ownership: float
    architecture: float
    problemSolving: float
    impact: float

class CapabilityVectorV2(BaseModel):
    version: str = "2.0.0"
    skillDepth: float
    ownership: float
    architecture: float
    problemSolving: float
    impact: float
    dimensions: CapabilityVectorDimensionsV2
    rawSignals: Dict[str, float]

class CandidateAssessmentV3Contract(BaseModel):
    schemaVersion: Literal["candidate-profile-v3"]
    candidateScore: float
    candidateScoreLabel: str
    careerLevel: Literal["L1", "L2", "L3", "L4", "L5", "Intern"]
    careerLevelLabel: str
    careerLevelConfidence: float
    
    cohortPercentile: float
    cohortVersion: str
    cohortPercentileRange: Dict[str, float]
    
    primaryTendency: str
    primaryWorkingStyle: str
    
    recruiterHeadline: str
    fullSummary: str
    professionalBio: str
    keyStrengths: List[str]
    watchPoints: List[str]
    
    displayConfidence: float
    
    capabilityVector: CapabilityVectorV2
    
    technicalDepth: float
    technicalBreadth: float
    leadershipPotential: float
    executionStrength: float
    trustLevel: float
    
    trustScoreMetrics: TrustScoreMetricsV2
    evidenceCompleteness: Literal["FULL", "PARTIAL", "NONE"]
    cloneRiskClassification: Literal["clean", "low_risk", "medium_risk", "high_risk"]
    
    skills: List[SkillProficiencyV2]
    domainProfiles: List[DomainProfileV2]
    bestFitRoles: List[BestFitRoleV2]
    strengthsWeaknesses: List[StrengthWeaknessV2]
    evidenceGovernance: List[EvidenceGovernanceV2]
    cvImprovementSuggestions: List[dict] = Field(default_factory=list)
    scoreBreakdown: ScoreBreakdownV2

    model_config = {
        "extra": "allow"
    }
