import json
import logging
import time
import json_repair
from typing import Any, Dict, AsyncGenerator, Optional

from app.core.services.claude_service import ClaudeService
from app.pipelines.shared.ai.prompts.requirement_prompt_factory import RequirementPromptFactory
from app.pipelines.requirement.contracts import (
    JobDescriptionResponse,
    EvaluationRubricResponse,
    InterviewBlueprintResponse,
    UnifiedRequirementArtifactsResponse
)

logger = logging.getLogger("requirement_artifacts_orchestrator")

class RequirementArtifactsOrchestrator:
    def __init__(self):
        self.claude_service = ClaudeService()
        self.prompt_factory = RequirementPromptFactory()

    def _repair_and_extract_json(self, text: str, correlation_id: str = "system") -> Dict[str, Any]:
        text = text.strip()
        first_brace = text.find('{')
        last_brace = text.rfind('}')
        
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            json_candidate = text[first_brace:last_brace + 1]
        else:
            json_candidate = text

        try:
            return json.loads(json_candidate)
        except Exception:
            logger.warning("Standard JSON parsing failed, attempting json-repair.", extra={"correlation_id": correlation_id})
            
        try:
            repaired_json = json_repair.repair_json(json_candidate)
            return json.loads(repaired_json)
        except Exception as repair_err:
            logger.error(f"json-repair failed: {repair_err}", extra={"correlation_id": correlation_id})
            raise ValueError(f"Failed to extract and repair JSON from Claude response: {repair_err}")

    async def _call_claude_with_validation(
        self, system: str, user: str, pydantic_model: Any, correlation_id: str, max_retries: int = 2, on_token = None
    ) -> tuple[Any, dict]:
        attempt = 0
        current_user_prompt = user
        while True:
            raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, current_user_prompt, correlation_id, on_token=on_token)
            try:
                parsed = self._repair_and_extract_json(raw, correlation_id)
                validated = pydantic_model(**parsed)
                return validated, telemetry
            except Exception as e:
                attempt += 1
                if attempt > max_retries:
                    raise ValueError(f"Failed to generate valid artifact schema after {max_retries} correction attempts. Error: {e}")
                logger.warning(f"Schema validation failed on attempt {attempt}: {e}. Retrying self-correction...")
                current_user_prompt = (
                    f"{user}\n\n"
                    f"WARNING: Your previous response failed validation with the following error: {e}.\n"
                    f"Please correct the JSON format and structure and return only the valid JSON payload matching the requested schema."
                )

    async def generate_artifact_stream(
        self,
        requirement_data: Dict[str, Any],
        artifact_type: str,
        request: Any = None,
        correlation_id: str = "system"
    ) -> AsyncGenerator[Dict[str, Any], None]:
        # Regenerate all artifacts together to ensure data consistency
        async for progress in self.generate_all_artifacts_async(requirement_data, correlation_id):
            yield progress

    async def generate_all_artifacts_async(
        self, requirement_data: Dict[str, Any], correlation_id: str = "system"
    ) -> AsyncGenerator[Dict[str, Any], None]:
        import asyncio
        extra = {"correlation_id": correlation_id}
        req_id = requirement_data.get("id", "unknown")
        logger.info(f"Starting Requirement Artifacts Generation Orchestrator for Requirement: {req_id}", extra=extra)

        # Stage 1: Generate Job Description and all other unified elements
        yield {
            "status": "Running",
            "step": "GenerateUnifiedRequirements",
            "message": "Generating unified hiring requirement package...",
            "percentage": 10.0
        }
        try:
            system = self.prompt_factory.get_system_prompt()
            user = self.prompt_factory.get_unified_requirements_prompt(requirement_data)
            
            token_queue: asyncio.Queue = asyncio.Queue()

            async def on_token_received(token: str):
                await token_queue.put(token)

            async def run_claude():
                try:
                    res, tele = await self._call_claude_with_validation(
                        system, user, UnifiedRequirementArtifactsResponse, correlation_id, on_token=on_token_received
                    )
                    await token_queue.put(("DONE", res, tele))
                except BaseException as ex:
                    await token_queue.put(("ERROR", ex))

            claude_task = asyncio.create_task(run_claude())

            unified_validated = None
            telemetry = {}

            while True:
                item = await token_queue.get()
                if isinstance(item, tuple):
                    status_type = item[0]
                    if status_type == "DONE":
                        unified_validated = item[1]
                        telemetry = item[2]
                        break
                    elif status_type == "ERROR":
                        raise item[1]
                else:
                    # Token chunk
                    yield {
                        "status": "Running",
                        "step": "GenerateUnifiedRequirements",
                        "message": "Generating unified hiring requirement package...",
                        "percentage": 25.0,
                        "chunk": item
                    }

            await claude_task

            # Extract JD
            jd_payload = {
                "markdownContent": unified_validated.jobDescription.markdownContent,
                "structuredContent": {
                    "jobTitle": unified_validated.jobDescription.title,
                    "positionSummary": unified_validated.jobDescription.summary,
                    "companyOverview": f"Company details for {unified_validated.jobDescription.title} in the {unified_validated.jobDescription.department} department.",
                    "responsibilities": unified_validated.jobDescription.responsibilities,
                    "technicalSkills": unified_validated.jobDescription.skills,
                    "preferredSkills": [],
                    "experienceRequirements": unified_validated.jobPostMetadata.experienceRange,
                    "qualifications": [unified_validated.jobPostMetadata.degreeRequirement],
                    "softSkills": [],
                    "successCriteria": [],
                    "benefits": [],
                    "hiringProcess": []
                },
                "modelInfo": telemetry.get("modelName", "claude-3-5-sonnet"),
                "promptTemplateId": self.prompt_factory.PROMPT_TEMPLATE_ID,
                "promptVersion": self.prompt_factory.PROMPT_VERSION,
                "promptHash": self.prompt_factory.get_prompt_hash(user),
                "generationMetadata": {
                    "inputTokens": telemetry.get("promptTokens", 0),
                    "outputTokens": telemetry.get("completionTokens", 0),
                    "estimatedCostUsd": telemetry.get("estimatedCostUsd", 0.0),
                    "durationMs": telemetry.get("durationMs", 0),
                    "ttftMs": telemetry.get("ttftMs", 0)
                }
            }

            yield {
                "status": "Running",
                "step": "GenerateJobDescription",
                "message": "Job Description generated successfully.",
                "percentage": 40.0,
                "artifactType": "JobDescription",
                "jsonData": json.dumps(jd_payload)
            }

            # Extract Rubric
            yield {
                "status": "Running",
                "step": "GenerateEvaluationRubric",
                "message": "Evaluation Rubric generated successfully.",
                "percentage": 60.0,
                "artifactType": "EvaluationRubric",
                "jsonData": unified_validated.assessmentRubric.model_dump_json()
            }

            # Extract Blueprint
            yield {
                "status": "Running",
                "step": "GenerateInterviewBlueprint",
                "message": "Interview Blueprint generated successfully.",
                "percentage": 80.0,
                "artifactType": "InterviewBlueprint",
                "jsonData": unified_validated.interviewBlueprint.model_dump_json()
            }

            # Extract Job Post Metadata (Staging context)
            yield {
                "status": "Running",
                "step": "GenerateJobPostMetadata",
                "message": "Job Post Metadata generated successfully.",
                "percentage": 90.0,
                "artifactType": "JobPostMetadata",
                "jsonData": unified_validated.jobPostMetadata.model_dump_json()
            }

            # Extract Candidate Discovery Profile (Staging context)
            yield {
                "status": "Running",
                "step": "GenerateCandidateDiscoveryProfile",
                "message": "Candidate Discovery Profile generated successfully.",
                "percentage": 95.0,
                "artifactType": "CandidateDiscoveryProfile",
                "jsonData": unified_validated.candidateDiscoveryProfile.model_dump_json()
            }

            # Success final yield
            yield {
                "status": "Completed",
                "step": "RequirementArtifactsComposer",
                "message": "All requirement package artifacts generated successfully.",
                "percentage": 100.0
            }
        except Exception as e:
            logger.exception(f"Error generating unified requirements: {e}", extra=extra)
            yield {
                "status": "Failed",
                "step": "RequirementArtifactsComposer",
                "message": f"Requirements generation failed: {str(e)}",
                "percentage": 100.0
            }
            return

