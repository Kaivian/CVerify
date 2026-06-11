import os
import time
import zipfile
import httpx
import logging
import tempfile
import json
import json_repair
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager

from app.core.services.claude_service import ClaudeService
from app.pipelines.repository.github.code_sampler import CodeSampler, CodeSamplingOptions
from app.pipelines.shared.ai.context.context_manager import ContextManager
from app.pipelines.shared.ai.runtime.contracts import (
    ArtifactEnvelope,
    MetadataSection,
    ConfidenceSection,
    EvidenceSection,
    LineageSection,
    InputLineage,
    TokenUsage,
    TechStackPayload,
    ArchitecturePatternsPayload,
    TrustSignalsPayload,
    SkillEvidenceGraphPayload
)

logger = logging.getLogger("task_runtime")

class TaskRuntime:
    def __init__(self, claude_service: Optional[ClaudeService] = None):
        self.claude_service = claude_service or ClaudeService()
        self.code_sampler = CodeSampler()
        self.context_manager = ContextManager()

    @asynccontextmanager
    async def _resolve_workspace(self, inputs: Dict[str, Any]):
        """
        Resolves the workspace from inputs. If CloneWorkspace is a URL, downloads and extracts it.
        If it's a local path, uses it directly.
        """
        workspace_input = inputs.get("CloneWorkspace")
        if not workspace_input:
            yield None
            return

        if isinstance(workspace_input, str) and (workspace_input.startswith("http://") or workspace_input.startswith("https://")):
            logger.info(f"Downloading workspace zip from pre-signed URL...")
            with tempfile.TemporaryDirectory() as temp_dir:
                zip_path = os.path.join(temp_dir, "workspace.zip")
                extract_dir = os.path.join(temp_dir, "repo")
                os.makedirs(extract_dir, exist_ok=True)

                async with httpx.AsyncClient() as client:
                    async with client.stream("GET", workspace_input, timeout=120.0) as response:
                        response.raise_for_status()
                        with open(zip_path, "wb") as f:
                            async for chunk in response.iter_bytes():
                                f.write(chunk)

                logger.info("Extracting workspace zip file...")
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(extract_dir)

                yield extract_dir
        elif isinstance(workspace_input, str) and os.path.exists(workspace_input):
            logger.info(f"Using local workspace directory: {workspace_input}")
            yield workspace_input
        else:
            logger.warning("No valid CloneWorkspace input path or URL found.")
            yield None

    def _repair_and_extract_json(self, text: str, correlation_id: str = "system") -> Dict[str, Any]:
        """
        Extracts JSON from the LLM output and repairs it using json_repair.
        """
        text = text.strip()
        first_brace = text.find('{')
        last_brace = text.rfind('}')
        
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            json_candidate = text[first_brace:last_brace + 1]
        else:
            json_candidate = text

        try:
            # First attempt: standard json parse
            return json.loads(json_candidate)
        except Exception:
            logger.warning("Standard JSON parsing failed, attempting json-repair.", extra={"correlation_id": correlation_id})
            
        try:
            # Second attempt: json_repair
            repaired_json = json_repair.repair_json(json_candidate)
            return json.loads(repaired_json)
        except Exception as repair_err:
            logger.error(f"json-repair failed: {repair_err}", extra={"correlation_id": correlation_id})
            raise ValueError(f"Failed to extract and repair JSON from Claude response: {repair_err}")

    def _map_payload_schema(self, task_identifier: str) -> Any:
        """
        Maps a task identifier to its corresponding Pydantic validation schema.
        """
        mapping = {
            "L1-004": TechStackPayload,
            "L1-006": ArchitecturePatternsPayload,
            "L1-017": SkillEvidenceGraphPayload,
            "L1-018": TrustSignalsPayload,
        }
        # Default to a generic dictionary validator if no specific schema is mapped
        return mapping.get(task_identifier, Dict[str, Any])

    async def execute_task(
        self,
        job_id: str,
        task_identifier: str,
        inputs: Dict[str, Any],
        system_prompt: Optional[str] = None,
        user_prompt: Optional[str] = None,
        correlation_id: str = "system"
    ) -> Dict[str, Any]:
        logger.info(f"Executing AI task {task_identifier} for job {job_id}", extra={"correlation_id": correlation_id})
        start_time = time.perf_counter()

        # 1. Resolve and Load workspace if present
        async with self._resolve_workspace(inputs) as workspace_path:
            # 2. Context Builder
            sampled_files_str = ""
            if workspace_path:
                logger.info(f"Sampling files from workspace path: {workspace_path}")
                options = CodeSamplingOptions(max_files=15, max_lines_per_file=150)
                # Note: code_sampler expects token argument, we pass empty string as it is not used in local walk
                sample = await self.code_sampler.sample_async(workspace_path, "", options)
                
                # Prune each sampled file content
                pruned_contents = []
                for name, content in zip(sample.file_names, sample.file_content):
                    pruned = self.context_manager.prune_file(name, content)
                    pruned_contents.append(f"--- FILE: {name} ---\n{pruned}\n\n")
                
                sampled_files_str = "".join(pruned_contents)

            # 3. Resolve Prompts
            resolved_system = system_prompt or (
                "You are the CVerify Repository Intelligence Engine, an expert AI Software Architect.\n"
                "Return raw JSON only. Ground all narrative fields in specific observable file names and code patterns."
            )
            
            resolved_user = user_prompt
            if not resolved_user:
                resolved_user = f"Perform analysis task {task_identifier}.\n"
                if sampled_files_str:
                    resolved_user += f"\nCode Workspace Sample:\n{sampled_files_str}"
                
                resolved_user += f"\nInput data:\n{json.dumps({k: v for k, v in inputs.items() if k != 'CloneWorkspace'}, indent=2)}"

            # 4. AI Execution
            logger.info("Calling Claude Service for task execution...")
            raw_response, telemetry = await self.claude_service.analyze_repo_with_telemetry(
                resolved_system,
                resolved_user,
                correlation_id
            )

            # 5. Extract & Repair JSON
            parsed_data = self._repair_and_extract_json(raw_response, correlation_id)

            # 6. Schema Validation & Normalization
            payload_model = self._map_payload_schema(task_identifier)
            
            raw_payload = parsed_data
            if "payload" in parsed_data:
                raw_payload = parsed_data["payload"]

            # Validate against target payload Pydantic model
            validated_payload = payload_model(**raw_payload)

            # Check if trust/confidence is returned by AI, otherwise default it
            confidence_score = 0.90
            confidence_rationale = "Task analysis completed successfully."
            if "confidence" in parsed_data:
                conf = parsed_data["confidence"]
                if isinstance(conf, dict):
                    confidence_score = conf.get("score", 0.90)
                    confidence_rationale = conf.get("rationale", confidence_rationale)
                elif isinstance(conf, (int, float)):
                    confidence_score = float(conf)

            # Check evidence returned by AI, otherwise default it
            evidence_list = []
            if "evidence" in parsed_data and isinstance(parsed_data["evidence"], list):
                for item in parsed_data["evidence"]:
                    if isinstance(item, dict):
                        evidence_list.append(
                            EvidenceSection(
                                filePath=item.get("filePath", "unknown"),
                                lineRange=item.get("lineRange", "unknown"),
                                citation=item.get("citation", "no details"),
                                category=item.get("category", "general")
                            )
                        )

            # Lineage tracking: capture inputs and checksums
            lineage_inputs = []
            for art_id, envelope in inputs.items():
                if isinstance(envelope, dict) and "metadata" in envelope:
                    lineage_inputs.append(
                        InputLineage(
                            artifactId=art_id,
                            checksum=envelope.get("checksum", "unknown")
                        )
                    )

            duration_ms = int((time.perf_counter() - start_time) * 1000)
            
            tokens = TokenUsage(
                prompt=telemetry.get("promptTokens", 0),
                completion=telemetry.get("completionTokens", 0),
                cacheRead=telemetry.get("cacheReadTokens", 0),
                cacheWrite=telemetry.get("cacheWriteTokens", 0)
            )

            envelope = ArtifactEnvelope(
                metadata=MetadataSection(
                    jobId=job_id,
                    taskIdentifier=task_identifier,
                    analyzerVersion="1.0.0",
                    promptVersion="v1.0.0",
                    modelVersion=telemetry.get("modelName", "claude-3-5-sonnet-20241022"),
                    durationMs=duration_ms,
                    costUsd=telemetry.get("estimatedCostUsd", 0.0),
                    tokens=tokens
                ),
                confidence=ConfidenceSection(
                    score=confidence_score,
                    rationale=confidence_rationale
                ),
                evidence=evidence_list,
                lineage=LineageSection(inputs=lineage_inputs),
                payload=validated_payload
            )

            return envelope.model_dump()
