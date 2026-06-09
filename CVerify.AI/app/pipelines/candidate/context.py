from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any

class PipelineContext(BaseModel):
    # Core Raw Inputs
    cv: Dict[str, Any]
    repositoryAssessments: List[Dict[str, Any]]
    backgroundRepositories: List[Dict[str, Any]] = Field(default_factory=list)
    correlationId: str = "system"
    
    # Pre-computed consolidations (from Fetch/Consolidate steps)
    repoIntelligenceReport: Dict[str, Any] = Field(default_factory=dict)
    skillEvidenceGraph: Dict[str, Any] = Field(default_factory=dict)
    maturityInputs: Dict[str, Any] = Field(default_factory=dict)
    problemsInputs: Dict[str, Any] = Field(default_factory=dict)
    cvSkills: List[str] = Field(default_factory=list)
    workingExperience: List[Dict[str, Any]] = Field(default_factory=list)

    # Vector Scoring Outputs
    skillDepthScore: Optional[float] = None
    ownershipScore: Optional[float] = None
    architectureScore: Optional[float] = None
    problemSolvingScore: Optional[float] = None
    impactScore: Optional[float] = None

    rawSkillDepth: Optional[float] = None
    rawOwnership: Optional[float] = None
    rawArchitecture: Optional[float] = None
    rawProblemSolving: Optional[float] = None
    rawImpact: Optional[float] = None

    # Step Outputs (CamelCase to match prompt requirements & payload JSON)
    mappedSkills: Optional[List[Dict[str, Any]]] = None
    unmatchedCvSkills: Optional[List[str]] = None
    skillProficiencies: Optional[List[Dict[str, Any]]] = None
    strongestDomains: Optional[List[Dict[str, Any]]] = None
    skillGaps: Optional[List[Dict[str, Any]]] = None
    overallStrengthSummary: Optional[str] = None
    
    # Career Level
    candidateScore: Optional[float] = None
    estimatedLevel: Optional[str] = None
    estimatedLevelLabel: Optional[str] = None
    scoreBreakdown: Optional[Dict[str, Any]] = None
    levelEvidence: Optional[Dict[str, Any]] = None
    levelRationale: Optional[str] = None
    
    calibratedScore: Optional[float] = None
    calibratedLevel: Optional[str] = None
    calibratedLevelLabel: Optional[str] = None
    confidenceInLevel: Optional[float] = None
    isBoundaryCase: Optional[bool] = None
    calibrationNotes: Optional[str] = None
    
    gatePassed: Optional[bool] = None
    finalLevel: Optional[str] = None
    finalLevelLabel: Optional[str] = None
    finalScore: Optional[float] = None
    gateViolations: Optional[List[str]] = None
    gateRationale: Optional[str] = None

    # Maturity and Problem Solving
    engineeringMaturityScore: Optional[float] = None
    maturityLevel: Optional[str] = None
    maturitySignals: Optional[List[Dict[str, Any]]] = None
    maturitySummary: Optional[str] = None
    
    avgTimeToFixDays: Optional[float] = None
    rootCauseFixRatio: Optional[float] = None
    recurrenceRate: Optional[float] = None
    complexBugHandling: Optional[str] = None
    problemSolvingPatterns: Optional[List[Dict[str, Any]]] = None
    problemSolvingSummary: Optional[str] = None

    # Classifiers
    primaryTendency: Optional[str] = None
    primaryConfidence: Optional[float] = None
    tendencyRanking: Optional[List[Dict[str, Any]]] = None
    tendencySummary: Optional[str] = None
    _hybridSource: Optional[str] = None
    _ruleBasedPrimary: Optional[str] = None
    
    primaryWorkingStyle: Optional[str] = None
    styleConfidence: Optional[float] = None
    styleDistribution: Optional[List[Dict[str, Any]]] = None
    workingStyleSummary: Optional[str] = None
    _ruleBasedStyle: Optional[str] = None

    # Experience Confidence Multiplier
    confidenceMultiplier: Optional[float] = None
    totalExperienceMonths: Optional[float] = None
    totalExperienceYears: Optional[float] = None
    hasLeadershipExperience: Optional[bool] = None
    multiplierRationale: Optional[str] = None

    # Recommendations & Summaries
    topMatch: Optional[Dict[str, Any]] = None
    suggestedRoles: Optional[List[Dict[str, Any]]] = None
    suggestedCvTitles: Optional[List[str]] = None
    cvImprovementSuggestions: Optional[List[Dict[str, Any]]] = None
    recruiterHeadline: Optional[str] = None
    fullSummary: Optional[str] = None
    keyStrengths: Optional[List[str]] = None
    watchPoints: Optional[List[str]] = None
    
    # Composites
    candidateProfile: Optional[Dict[str, Any]] = None
    improvementPlan: Optional[Dict[str, Any]] = None
    skillTree: Optional[Dict[str, Any]] = None

    def update(self, **kwargs) -> "PipelineContext":
        """Creates a new instance of PipelineContext with updated attributes, enforcing immutability."""
        current_data = self.model_dump()
        allowed_private = {"_hybridSource", "_ruleBasedPrimary", "_ruleBasedStyle"}
        
        for key, value in kwargs.items():
            if key not in current_data and key not in allowed_private:
                raise ValueError(f"Context field '{key}' is not defined in PipelineContext schema.")
            
            # Check immutability for normal fields
            if key in current_data:
                if current_data[key] is not None and key not in ["candidateProfile", "cvImprovementSuggestions", "keyStrengths", "watchPoints", "watchpoints", "problemSolvingScore", "skillTree"]:
                    raise ValueError(f"State key '{key}' has already been written and is immutable.")
        
        # Merge values for normal fields
        normal_kwargs = {k: v for k, v in kwargs.items() if k not in allowed_private}
        new_data = {**current_data, **normal_kwargs}
        new_instance = PipelineContext(**new_data)
        
        # Set private attributes
        for key, value in kwargs.items():
            if key in allowed_private:
                setattr(new_instance, key, value)
                
        return new_instance

    def to_legacy_dict(self) -> dict:
        """Returns a legacy compatible dictionary representing the flat execution context."""
        legacy = self.model_dump()
        
        # Add sub-structures that the prompts/orchestrator expect in a specific shape
        legacy["commitTimelineData"] = {"commits": self.maturityInputs.get("commits", []) if self.maturityInputs else []}
        legacy["commitIntentData"] = {
            "commitMessages": self.problemsInputs.get("commitMessages", []) if self.problemsInputs else [],
            "commits": self.problemsInputs.get("commits", []) if self.problemsInputs else []
        }
        legacy["codeQualityData"] = self.maturityInputs.get("codeQualityData", {}) if self.maturityInputs else {}
        legacy["cvSkills"] = self.cvSkills
        legacy["workingExperience"] = self.workingExperience
        
        return legacy


class PipelineEvent(BaseModel):
    eventType: str = Field(..., description="E.g., TASK_STARTED, SCORE_DELTA_UPDATED, etc.")
    timestamp: float = Field(..., description="Epoch timestamp in seconds")
    correlationId: str
    taskId: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    stateSnapshot: Dict[str, Any] = Field(default_factory=dict)

