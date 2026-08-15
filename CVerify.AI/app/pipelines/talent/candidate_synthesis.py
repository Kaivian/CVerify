import json
import logging
from typing import List, Optional
from pydantic import BaseModel, Field
from app.core.services.claude_service import ClaudeService

logger = logging.getLogger(__name__)

class CandidateSynthesisRequest(BaseModel):
    candidateName: str
    careerLevel: str
    matchScore: float
    trustLevel: float
    requirementTitle: str
    matchedCapabilities: List[str] = Field(default_factory=list)
    missingCapabilities: List[str] = Field(default_factory=list)

class CandidateSynthesisResponse(BaseModel):
    summary: str = Field(description="2-sentence executive summary of candidate fit.")
    keyStrengths: List[str] = Field(description="List of verified technical strengths.")
    keyGaps: List[str] = Field(description="List of capability gaps or missing skills.")
    riskLevel: str = Field(description="Low, Medium, or High risk level.")
    recommendedInterviewQuestions: List[str] = Field(description="3 tailored technical interview questions.")

class CandidateSynthesisOrchestrator:
    def __init__(self, claude_service: Optional[ClaudeService] = None):
        self.claude_service = claude_service or ClaudeService()

    async def synthesize_candidate(self, req: CandidateSynthesisRequest, correlation_id: str = "system") -> CandidateSynthesisResponse:
        system_prompt = (
            "You are an elite technical talent assessment AI. Synthesize a recruiter-facing evaluation "
            "for a candidate applying for a position based strictly on their evidence-backed capabilities.\n"
            "Respond ONLY with a valid JSON object matching this schema:\n"
            "{\n"
            '  "summary": "2-sentence executive summary",\n'
            '  "keyStrengths": ["Strength 1", "Strength 2"],\n'
            '  "keyGaps": ["Gap 1"],\n'
            '  "riskLevel": "Low",\n'
            '  "recommendedInterviewQuestions": ["Question 1", "Question 2", "Question 3"]\n'
            "}"
        )

        user_prompt = (
            f"CANDIDATE DATA:\n"
            f"Name: {req.candidateName}\n"
            f"Career Level: {req.careerLevel}\n"
            f"Match Score: {req.matchScore}%\n"
            f"Trust Level: {req.trustLevel}%\n"
            f"Target Role: {req.requirementTitle}\n"
            f"Matched Capabilities: {', '.join(req.matchedCapabilities)}\n"
            f"Missing Capabilities: {', '.join(req.missingCapabilities)}\n"
        )

        raw_text, _ = await self.claude_service.analyze_repo_with_telemetry(system_prompt, user_prompt, correlation_id)

        try:
            cleaned_json = raw_text.strip()
            if cleaned_json.startswith("```json"):
                cleaned_json = cleaned_json[7:]
            if cleaned_json.endswith("```"):
                cleaned_json = cleaned_json[:-3]
            parsed = json.loads(cleaned_json)
            return CandidateSynthesisResponse(**parsed)
        except Exception as e:
            logger.warning(f"Failed to parse Claude synthesis JSON response: {e}. Falling back to default.")
            return CandidateSynthesisResponse(
                summary=f"{req.candidateName} exhibits a {req.matchScore}% match for the {req.requirementTitle} position with {req.trustLevel}% evidence trust score.",
                keyStrengths=req.matchedCapabilities,
                keyGaps=req.missingCapabilities,
                riskLevel="Low" if req.trustLevel >= 70 else "Medium",
                recommendedInterviewQuestions=[
                    f"Can you explain your experience with {cap}?" for cap in req.matchedCapabilities[:3]
                ]
            )
