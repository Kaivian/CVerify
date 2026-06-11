from typing import Generic, TypeVar, List, Dict, Any, Optional
from pydantic import BaseModel, Field

TPayload = TypeVar('TPayload')

class TokenUsage(BaseModel):
    prompt: int = 0
    completion: int = 0
    cacheRead: int = 0
    cacheWrite: int = 0

class MetadataSection(BaseModel):
    jobId: str
    taskIdentifier: str
    analyzerVersion: str
    promptVersion: str
    modelVersion: str
    durationMs: int
    costUsd: float
    tokens: TokenUsage

class ConfidenceSection(BaseModel):
    score: float
    rationale: str

class EvidenceSection(BaseModel):
    filePath: str
    lineRange: str
    citation: str
    category: str

class InputLineage(BaseModel):
    artifactId: str
    checksum: str

class LineageSection(BaseModel):
    inputs: List[InputLineage] = Field(default_factory=list)

class ArtifactEnvelope(BaseModel, Generic[TPayload]):
    metadata: MetadataSection
    confidence: ConfidenceSection
    evidence: List[EvidenceSection] = Field(default_factory=list)
    lineage: LineageSection
    payload: TPayload

# Specific task payloads based on CVerify.Core models

class TechStackPayload(BaseModel):
    primaryLanguage: str
    frameworks: List[str] = Field(default_factory=list)
    packageFiles: List[str] = Field(default_factory=list)
    languages: Dict[str, float] = Field(default_factory=list)

class ArchitecturePatternItem(BaseModel):
    patternName: str
    confidence: float

class ArchitecturePatternsPayload(BaseModel):
    patterns: List[ArchitecturePatternItem] = Field(default_factory=list)
    explanation: str

class ContributorRatio(BaseModel):
    username: str
    commitRatio: float

class OwnershipScorePayload(BaseModel):
    userCommitRatio: float
    totalCommits: int
    isPrimaryAuthor: bool
    architecturalOwnershipPct: float
    criticalPathOwnershipPct: float
    maintenanceDurationMonths: int
    explanation: str
    contributorDistribution: List[ContributorRatio] = Field(default_factory=list)
    busFactor: int
    activeContributors: int

class TrustSignalsPayload(BaseModel):
    classification: str
    confidence: float
    ruleFlags: List[str] = Field(default_factory=list)
    aiFindings: List[str] = Field(default_factory=list)
    explanation: str

class GraphNode(BaseModel):
    id: str
    type: str
    data: Dict[str, Any] = Field(default_factory=dict)

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str
    weight: Optional[float] = None

class SkillEvidenceGraphPayload(BaseModel):
    nodes: List[GraphNode] = Field(default_factory=list)
    edges: List[GraphEdge] = Field(default_factory=list)
