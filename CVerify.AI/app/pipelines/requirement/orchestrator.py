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
    InterviewBlueprintResponse
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
        self, system: str, user: str, pydantic_model: Any, correlation_id: str, max_retries: int = 2
    ) -> tuple[Any, dict]:
        attempt = 0
        current_user_prompt = user
        while True:
            raw, telemetry = await self.claude_service.analyze_repo_with_telemetry(system, current_user_prompt, correlation_id)
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
        extra = {"correlation_id": correlation_id, "artifact_type": artifact_type}
        req_id = requirement_data.get("id", "unknown")
        logger.info(f"Starting single-artifact stream generation ({artifact_type}) for Requirement: {req_id}", extra=extra)

        start_time = time.perf_counter()

        if artifact_type == "JobDescription":
            yield {
                "status": "Running",
                "step": "GenerateJobDescription",
                "message": "Initiating Job Description generation...",
                "percentage": 10.0
            }

            system_prompt = self.prompt_factory.get_system_prompt()
            user_prompt = self.prompt_factory.get_jd_generator_prompt(requirement_data)
            prompt_hash = self.prompt_factory.get_prompt_hash(user_prompt)
            prompt_version = self.prompt_factory.PROMPT_VERSION
            prompt_template_id = self.prompt_factory.PROMPT_TEMPLATE_ID

            full_markdown_parts = []
            stream_telemetry = None

            try:
                async for chunk in self.claude_service.stream_prompt(system_prompt, user_prompt, correlation_id):
                    # Check for client disconnect
                    if request and await request.is_disconnected():
                        logger.info("Client disconnected during Job Description streaming. Aborting generation.", extra=extra)
                        yield {
                            "status": "Failed",
                            "step": "GenerateJobDescription",
                            "message": "Client disconnected.",
                            "percentage": 100.0
                        }
                        return

                    if chunk["type"] == "content":
                        text = chunk["text"]
                        full_markdown_parts.append(text)
                        yield {
                            "status": "Generating",
                            "step": "JobDescriptionStream",
                            "chunk": text,
                            "percentage": 30.0
                        }
                    elif chunk["type"] == "telemetry":
                        stream_telemetry = chunk
                    elif chunk["type"] == "error":
                        raise Exception(chunk["message"])
            except Exception as e:
                logger.exception(f"Error streaming Job Description: {e}", extra=extra)
                yield {
                    "status": "Failed",
                    "step": "GenerateJobDescription",
                    "message": f"Job Description streaming failed: {str(e)}",
                    "percentage": 100.0
                }
                return

            full_markdown = "".join(full_markdown_parts)

            # Check client disconnect before parser call
            if request and await request.is_disconnected():
                logger.info("Client disconnected before parser call. Aborting.", extra=extra)
                return

            yield {
                "status": "Running",
                "step": "ParseJobDescription",
                "message": "Extracting structured sections from Job Description...",
                "percentage": 75.0
            }

            try:
                parser_system = self.prompt_factory.get_system_prompt()
                parser_user = self.prompt_factory.get_jd_parser_prompt(full_markdown)

                raw_json_str, parser_telemetry = await self.claude_service.analyze_repo_with_telemetry(
                    parser_system, parser_user, correlation_id
                )
                structured_content = self._repair_and_extract_json(raw_json_str, correlation_id)

                total_input_tokens = (stream_telemetry.get("promptTokens", 0) if stream_telemetry else 0) + parser_telemetry.get("promptTokens", 0)
                total_output_tokens = (stream_telemetry.get("completionTokens", 0) if stream_telemetry else 0) + parser_telemetry.get("completionTokens", 0)
                total_cost = (stream_telemetry.get("estimatedCostUsd", 0.0) if stream_telemetry else 0.0) + parser_telemetry.get("estimatedCostUsd", 0.0)

                duration_ms = int((time.perf_counter() - start_time) * 1000)

                generation_metadata = {
                    "inputTokens": total_input_tokens,
                    "outputTokens": total_output_tokens,
                    "estimatedCostUsd": total_cost,
                    "durationMs": duration_ms
                }

                final_payload = {
                    "markdownContent": full_markdown,
                    "structuredContent": structured_content,
                    "modelInfo": parser_telemetry.get("modelName", "claude-3-5-sonnet"),
                    "promptTemplateId": prompt_template_id,
                    "promptVersion": prompt_version,
                    "promptHash": prompt_hash,
                    "generationMetadata": generation_metadata
                }

                yield {
                    "status": "Running",
                    "step": "RequirementArtifactsComposer",
                    "message": "Job Description generated and parsed successfully.",
                    "percentage": 100.0,
                    "artifactType": "JobDescription",
                    "jsonData": json.dumps(final_payload)
                }

            except Exception as e:
                logger.exception(f"Error parsing generated Job Description: {e}", extra=extra)
                yield {
                    "status": "Failed",
                    "step": "ParseJobDescription",
                    "message": f"Job Description parsing failed: {str(e)}",
                    "percentage": 100.0
                }
                return

        elif artifact_type == "EvaluationRubric":
            yield {
                "status": "Running",
                "step": "GenerateEvaluationRubric",
                "message": "Generating Evaluation Rubric...",
                "percentage": 20.0
            }

            try:
                system = self.prompt_factory.get_system_prompt()
                user = self.prompt_factory.get_rubric_generator_prompt(requirement_data)
                
                rubric_validated, rubric_telemetry = await self._call_claude_with_validation(
                    system, user, EvaluationRubricResponse, correlation_id
                )

                yield {
                    "status": "Running",
                    "step": "RequirementArtifactsComposer",
                    "message": "Evaluation Rubric generated successfully.",
                    "percentage": 100.0,
                    "artifactType": "EvaluationRubric",
                    "jsonData": rubric_validated.model_dump_json()
                }
            except Exception as e:
                logger.exception(f"Error generating Evaluation Rubric: {e}", extra=extra)
                yield {
                    "status": "Failed",
                    "step": "GenerateEvaluationRubric",
                    "message": f"Evaluation Rubric generation failed: {str(e)}",
                    "percentage": 100.0
                }
                return

        elif artifact_type == "InterviewBlueprint":
            yield {
                "status": "Running",
                "step": "GenerateInterviewBlueprint",
                "message": "Generating Interview Blueprint...",
                "percentage": 20.0
            }

            try:
                system = self.prompt_factory.get_system_prompt()
                user = self.prompt_factory.get_blueprint_generator_prompt(requirement_data)

                blueprint_validated, blueprint_telemetry = await self._call_claude_with_validation(
                    system, user, InterviewBlueprintResponse, correlation_id
                )

                yield {
                    "status": "Running",
                    "step": "RequirementArtifactsComposer",
                    "message": "Interview Blueprint generated successfully.",
                    "percentage": 100.0,
                    "artifactType": "InterviewBlueprint",
                    "jsonData": blueprint_validated.model_dump_json()
                }
            except Exception as e:
                logger.exception(f"Error generating Interview Blueprint: {e}", extra=extra)
                yield {
                    "status": "Failed",
                    "step": "GenerateInterviewBlueprint",
                    "message": f"Interview Blueprint generation failed: {str(e)}",
                    "percentage": 100.0
                }
                return

        else:
            yield {
                "status": "Failed",
                "step": "RequirementArtifactsComposer",
                "message": f"Unknown artifact type: {artifact_type}",
                "percentage": 100.0
            }

    async def generate_all_artifacts_async(
        self, requirement_data: Dict[str, Any], correlation_id: str = "system"
    ) -> AsyncGenerator[Dict[str, Any], None]:
        extra = {"correlation_id": correlation_id}
        req_id = requirement_data.get("id", "unknown")
        logger.info(f"Starting Requirement Artifacts Generation Orchestrator for Requirement: {req_id}", extra=extra)

        # Stage 1: Generate Job Description
        yield {
            "status": "Running",
            "step": "GenerateJobDescription",
            "message": "Generating professional Job Description text...",
            "percentage": 10.0
        }
        try:
            system = self.prompt_factory.get_system_prompt()
            user = self.prompt_factory.get_jd_generator_prompt(requirement_data)
            
            # Since the prompt now asks for raw markdown and doesn't return JSON, we must adapt this old method.
            # But wait, this method is only kept for backwards-compatibility or not used.
            # Let's perform a direct call and construct the JSON mock or use the new single stream generator.
            # Let's just generate the JD markdown and parse it to stay robust.
            raw_md, md_telemetry = await self.claude_service.analyze_repo_with_telemetry(system, user, correlation_id)
            
            parser_user = self.prompt_factory.get_jd_parser_prompt(raw_md)
            raw_json, parse_telemetry = await self.claude_service.analyze_repo_with_telemetry(system, parser_user, correlation_id)
            structured_content = self._repair_and_extract_json(raw_json, correlation_id)

            total_input_tokens = md_telemetry.get("promptTokens", 0) + parse_telemetry.get("promptTokens", 0)
            total_output_tokens = md_telemetry.get("completionTokens", 0) + parse_telemetry.get("completionTokens", 0)
            total_cost = md_telemetry.get("estimatedCostUsd", 0.0) + parse_telemetry.get("estimatedCostUsd", 0.0)

            final_payload = {
                "markdownContent": raw_md,
                "structuredContent": structured_content,
                "modelInfo": parse_telemetry.get("modelName", "claude-3-5-sonnet"),
                "promptTemplateId": self.prompt_factory.PROMPT_TEMPLATE_ID,
                "promptVersion": self.prompt_factory.PROMPT_VERSION,
                "promptHash": self.prompt_factory.get_prompt_hash(user),
                "generationMetadata": {
                    "inputTokens": total_input_tokens,
                    "outputTokens": total_output_tokens,
                    "estimatedCostUsd": total_cost,
                    "durationMs": int(md_telemetry.get("durationMs", 0) + parse_telemetry.get("durationMs", 0))
                }
            }

            yield {
                "status": "Running",
                "step": "GenerateJobDescription",
                "message": "Job Description generated successfully.",
                "percentage": 40.0,
                "artifactType": "JobDescription",
                "jsonData": json.dumps(final_payload)
            }
        except Exception as e:
            logger.exception(f"Error generating Job Description: {e}", extra=extra)
            yield {
                "status": "Failed",
                "step": "GenerateJobDescription",
                "message": f"Job Description generation failed: {str(e)}",
                "percentage": 40.0
            }
            return

        # Stage 2: Generate Evaluation Rubric
        yield {
            "status": "Running",
            "step": "GenerateEvaluationRubric",
            "message": "Formulating evaluation rubric and evidence mapping...",
            "percentage": 50.0
        }
        try:
            user = self.prompt_factory.get_rubric_generator_prompt(requirement_data)
            rubric_validated, rubric_telemetry = await self._call_claude_with_validation(
                system, user, EvaluationRubricResponse, correlation_id
            )
            yield {
                "status": "Running",
                "step": "GenerateEvaluationRubric",
                "message": "Evaluation Rubric generated successfully.",
                "percentage": 70.0,
                "artifactType": "EvaluationRubric",
                "jsonData": rubric_validated.model_dump_json()
            }
        except Exception as e:
            logger.exception(f"Error generating Evaluation Rubric: {e}", extra=extra)
            yield {
                "status": "Failed",
                "step": "GenerateEvaluationRubric",
                "message": f"Evaluation Rubric generation failed: {str(e)}",
                "percentage": 70.0
            }
            return

        # Stage 3: Generate Interview Blueprint
        yield {
            "status": "Running",
            "step": "GenerateInterviewBlueprint",
            "message": "Designing interview questions and rubrics...",
            "percentage": 80.0
        }
        try:
            user = self.prompt_factory.get_blueprint_generator_prompt(requirement_data)
            blueprint_validated, blueprint_telemetry = await self._call_claude_with_validation(
                system, user, InterviewBlueprintResponse, correlation_id
            )
            yield {
                "status": "Running",
                "step": "GenerateInterviewBlueprint",
                "message": "Interview Blueprint generated successfully.",
                "percentage": 100.0,
                "artifactType": "InterviewBlueprint",
                "jsonData": blueprint_validated.model_dump_json()
            }
        except Exception as e:
            logger.exception(f"Error generating Interview Blueprint: {e}", extra=extra)
            yield {
                "status": "Failed",
                "step": "GenerateInterviewBlueprint",
                "message": f"Interview Blueprint generation failed: {str(e)}",
                "percentage": 100.0
            }
            return

        # Success final yield
        yield {
            "status": "Completed",
            "step": "RequirementArtifactsComposer",
            "message": "All requirement artifacts generated successfully.",
            "percentage": 100.0
        }
