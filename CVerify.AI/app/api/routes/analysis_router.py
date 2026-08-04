import json
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from app.core.middleware.hmac_auth import verify_hmac_signature
from app.pipelines.repository.orchestrators.github_analysis_orchestrator import GitHubAnalysisOrchestrator
from app.pipelines.candidate.orchestrator import CandidateEvaluationOrchestrator, is_line2_task
from app.pipelines.jd.orchestrator import JdMatchingOrchestrator, is_line3_task

router = APIRouter()
logger = logging.getLogger("analysis_router")


class AnalysisRequest(BaseModel):
    repositoryId: str
    repoName: str
    repoOwner: str
    encryptedToken: str
    defaultBranch: str


class TaskExecutionRequest(BaseModel):
    jobId: str
    
    # Legacy fields (optional)
    taskType: Optional[str] = None
    repositoryId: Optional[str] = None
    repoName: Optional[str] = None
    repoOwner: Optional[str] = None
    encryptedToken: Optional[str] = None
    defaultBranch: Optional[str] = None
    
    # New platform fields (optional)
    taskIdentifier: Optional[str] = None
    inputs: Optional[dict] = None
    systemPrompt: Optional[str] = None
    userPrompt: Optional[str] = None

class AggregationRequest(BaseModel):
    jobId: str
    repositoryId: str
    repoOwner: str
    repoName: str
    partialResults: dict
    deleteWorkspace: bool = False


class CandidateAssessmentRequest(BaseModel):
    cv: dict
    repositoryAssessments: List[dict]
    backgroundRepositories: Optional[List[dict]] = None

@router.post("/api/v1/analysis/orchestrate/stream")
async def orchestrate_stream(
    request_data: AnalysisRequest,
    correlation_id: str = Depends(verify_hmac_signature)
):
    extra_log = {"correlation_id": correlation_id}
    logger.info(f"Initiated repository analysis stream request for {request_data.repoOwner}/{request_data.repoName}", extra=extra_log)

    orchestrator = GitHubAnalysisOrchestrator()

    async def sse_generator():
        try:
            async for progress_event in orchestrator.orchestrate_async(
                repository_id=request_data.repositoryId,
                repo_name=request_data.repoName,
                repo_owner=request_data.repoOwner,
                encrypted_token=request_data.encryptedToken,
                default_branch=request_data.defaultBranch,
                correlation_id=correlation_id
            ):
                yield f"data: {json.dumps(progress_event)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Error during repository analysis flow: {e}", extra=extra_log)
            err_payload = {
                "status": "Failed",
                "step": "Failed",
                "message": str(e)
            }
            yield f"data: {json.dumps(err_payload)}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")


@router.post("/api/v1/candidate/assess/stream")
async def assess_candidate_stream(
    request_data: CandidateAssessmentRequest,
    correlation_id: str = Depends(verify_hmac_signature)
):
    extra_log = {"correlation_id": correlation_id}
    cv_id = request_data.cv.get("cvId", "unknown")
    logger.info(f"Initiated candidate assessment stream request for CV: {cv_id}", extra=extra_log)

    from app.pipelines.candidate.orchestrate_stream import CandidateAssessmentStreamOrchestrator
    orchestrator = CandidateAssessmentStreamOrchestrator()

    async def sse_generator():
        try:
            async for progress_event in orchestrator.orchestrate_async(
                cv=request_data.cv,
                repository_assessments=request_data.repositoryAssessments,
                background_repositories=request_data.backgroundRepositories,
                correlation_id=correlation_id
            ):
                yield f"data: {json.dumps(progress_event)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Error during candidate assessment flow: {e}", extra=extra_log)
            err_payload = {
                "status": "Failed",
                "step": "Failed",
                "message": str(e)
            }
            yield f"data: {json.dumps(err_payload)}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@router.post("/api/v1/analysis/task/execute")
async def execute_task(
    request_data: TaskExecutionRequest,
    correlation_id: str = Depends(verify_hmac_signature)
):
    import time
    from typing import Optional, Dict, Any, List
    
    # Check if this is a new platform task execution request
    if request_data.taskIdentifier:
        extra_log = {"correlation_id": correlation_id, "job_id": request_data.jobId, "task_identifier": request_data.taskIdentifier}
        logger.info(f"Received platform execute task request", extra=extra_log)
        
        from app.pipelines.shared.ai.runtime.task_runtime import TaskRuntime
        runtime = TaskRuntime()
        try:
            result_envelope = await runtime.execute_task(
                job_id=request_data.jobId,
                task_identifier=request_data.taskIdentifier,
                inputs=request_data.inputs or {},
                system_prompt=request_data.systemPrompt,
                user_prompt=request_data.userPrompt,
                correlation_id=correlation_id
            )
            return {
                "status": "Completed",
                "errorMessage": None,
                "schemaVersion": "2.0.0",
                "resultData": json.dumps(result_envelope),
                "telemetry": result_envelope["metadata"]["tokens"],
                "events": []
            }
        except Exception as e:
            logger.exception(f"Error executing platform task {request_data.taskIdentifier} for job {request_data.jobId}: {e}", extra=extra_log)
            return {
                "status": "Failed",
                "errorMessage": str(e),
                "errorCode": "EXECUTION_ERROR",
                "retryable": True,
                "taskId": request_data.taskIdentifier,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "schemaVersion": "2.0.0",
                "resultData": None,
                "telemetry": None,
                "events": []
            }
            
    # Fallback to legacy task execution — route by pipeline prefix
    task_type = request_data.taskType or ""
    extra_log = {"correlation_id": correlation_id, "job_id": request_data.jobId, "task_type": task_type}
    logger.info(f"Received legacy execute task request", extra=extra_log)

    if is_line2_task(task_type):
        orchestrator_l2 = CandidateEvaluationOrchestrator()
        result = await orchestrator_l2.execute_task(
            task_type=task_type,
            job_id=request_data.jobId,
            inputs=request_data.inputs or {},
            correlation_id=correlation_id
        )
    elif is_line3_task(task_type):
        orchestrator_l3 = JdMatchingOrchestrator()
        result = await orchestrator_l3.execute_task(
            task_type=task_type,
            job_id=request_data.jobId,
            inputs=request_data.inputs or {},
            correlation_id=correlation_id
        )
    else:
        orchestrator = GitHubAnalysisOrchestrator()
        result = await orchestrator.execute_task(
            task_type=task_type,
            job_id=request_data.jobId,
            repository_id=request_data.repositoryId or "",
            repo_owner=request_data.repoOwner or "",
            repo_name=request_data.repoName or "",
            encrypted_token=request_data.encryptedToken or "",
            default_branch=request_data.defaultBranch or "main",
            correlation_id=correlation_id
        )
    return result


@router.post("/api/v1/analysis/task/aggregate")
async def aggregate_results(
    request_data: AggregationRequest,
    correlation_id: str = Depends(verify_hmac_signature)
):
    extra_log = {"correlation_id": correlation_id, "job_id": request_data.jobId}
    logger.info(f"Received aggregate results request", extra=extra_log)
    
    orchestrator = GitHubAnalysisOrchestrator()
    try:
        report = await orchestrator.aggregate_results(
            job_id=request_data.jobId,
            repository_id=request_data.repositoryId,
            repo_owner=request_data.repoOwner,
            repo_name=request_data.repoName,
            partial_results=request_data.partialResults,
            delete_workspace=request_data.deleteWorkspace,
            correlation_id=correlation_id
        )
        return {"status": "Success", "reportData": json.dumps(report)}
    except FileNotFoundError as fnf:
        logger.info(f"Workspace metadata not found for job {request_data.jobId} (likely already cleaned up or not initialized): {fnf}", extra=extra_log)
        return JSONResponse(
            status_code=404,
            content={"status": "Failed", "errorMessage": str(fnf)}
        )
    except Exception as e:
        logger.warning(f"Failed to aggregate results: {e}", extra=extra_log)
        return JSONResponse(
            status_code=400,
            content={"status": "Failed", "errorMessage": str(e)}
        )


class RepositoryAssessRequest(BaseModel):
    jobId: str
    repositoryId: str


@router.post("/api/v1/repository/assess")
async def assess_repository(
    request_data: RepositoryAssessRequest,
    correlation_id: str = Depends(verify_hmac_signature)
):
    extra_log = {"correlation_id": correlation_id, "job_id": request_data.jobId}
    logger.info(f"Initiated repository L2 assessment for job: {request_data.jobId}", extra=extra_log)

    from app.core.clients.repo_intelligence_client import RepoIntelligenceClient
    from app.core.services.claude_service import ClaudeService
    from app.pipelines.shared.ai.prompts.candidate_prompt_factory import CandidatePromptFactory

    client = RepoIntelligenceClient()
    claude = ClaudeService()
    prompt_factory = CandidatePromptFactory()

    try:
        # Fetch L1 artifacts
        artifacts = await client.fetch_line1_artifacts(request_data.jobId)
        
        # Prepare inputs
        inputs = {
            **artifacts,
            "repositoryId": request_data.repositoryId,
            "jobId": request_data.jobId
        }

        system = prompt_factory.get_system_prompt()
        user = prompt_factory.get_repository_assessment_prompt(inputs)

        # Call AI
        raw, telemetry = await claude.analyze_repo_with_telemetry(system, user, correlation_id)
        
        # Parse output JSON
        def extract_json(text: str) -> dict:
            text = text.strip()
            first_brace = text.find('{')
            last_brace = text.rfind('}')
            if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
                candidate = text[first_brace:last_brace + 1]
                try:
                    return json.loads(candidate)
                except Exception:
                    pass
            try:
                import json_repair
                repaired = json_repair.repair_json(text[first_brace:] if first_brace != -1 else text)
                return json.loads(repaired)
            except Exception as e:
                raise ValueError(f"Failed to parse Claude JSON output: {e}")

        data = extract_json(raw)

        # Ensure repositoryId, repositoryName and verifiedCommitSha are populated if missing
        if "repositoryId" not in data or not data["repositoryId"]:
            data["repositoryId"] = request_data.repositoryId
            
        repo_report = artifacts.get("repoIntelligenceReport") or {}
        if "repositoryName" not in data or not data["repositoryName"]:
            meta = repo_report.get("meta", {})
            data["repositoryName"] = meta.get("repo_name", "unknown")
            
        if "verifiedCommitSha" not in data or not data["verifiedCommitSha"]:
            meta = repo_report.get("meta", {})
            data["verifiedCommitSha"] = meta.get("commit_sha", "unknown")

        return data
    except Exception as e:
        logger.exception(f"Error during repository assessment: {e}", extra=extra_log)
        return JSONResponse(
            status_code=400,
            content={"status": "Failed", "errorMessage": str(e)}
        )


class HiringRequirementGenerateRequest(BaseModel):
    requirementData: dict


@router.post("/api/v1/hiring-requirements/generate/stream")
async def generate_requirement_artifacts_stream(
    request_data: HiringRequirementGenerateRequest,
    correlation_id: str = Depends(verify_hmac_signature)
):
    extra_log = {"correlation_id": correlation_id}
    req_id = request_data.requirementData.get("id", "unknown")
    logger.info(f"Initiated hiring requirement artifacts stream request for requirement: {req_id}", extra=extra_log)

    from app.pipelines.requirement.orchestrator import RequirementArtifactsOrchestrator
    orchestrator = RequirementArtifactsOrchestrator()

    async def sse_generator():
        try:
            async for progress_event in orchestrator.generate_all_artifacts_async(
                requirement_data=request_data.requirementData,
                correlation_id=correlation_id
            ):
                yield f"data: {json.dumps(progress_event)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Error during requirement artifacts generation: {e}", extra=extra_log)
            err_payload = {
                "status": "Failed",
                "step": "Failed",
                "message": str(e)
            }
            yield f"data: {json.dumps(err_payload)}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")


class GenerateArtifactBody(BaseModel):
    requirementData: dict
    artifactType: str


@router.post("/api/v1/hiring-requirements/generate-artifact/stream")
async def generate_artifact_stream_endpoint(
    request: Request,
    request_data: GenerateArtifactBody,
    correlation_id: str = Depends(verify_hmac_signature)
):
    extra_log = {"correlation_id": correlation_id}
    req_id = request_data.requirementData.get("id", "unknown")
    logger.info(f"Initiated single requirement artifact stream request ({request_data.artifactType}) for requirement: {req_id}", extra=extra_log)

    from app.pipelines.requirement.orchestrator import RequirementArtifactsOrchestrator
    orchestrator = RequirementArtifactsOrchestrator()

    async def sse_generator():
        try:
            async for progress_event in orchestrator.generate_artifact_stream(
                requirement_data=request_data.requirementData,
                artifact_type=request_data.artifactType,
                request=request,
                correlation_id=correlation_id
            ):
                yield f"data: {json.dumps(progress_event)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Error during single requirement artifact generation: {e}", extra=extra_log)
            err_payload = {
                "status": "Failed",
                "step": "Failed",
                "message": str(e)
            }
            yield f"data: {json.dumps(err_payload)}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")


@router.post("/api/v1/analysis/jobs/{job_id}/cancel")
async def cancel_job_endpoint(job_id: str):
    from app.core.monitoring.observability import UIStreamingManager
    redis_client = UIStreamingManager()._redis_client
    await redis_client.set(f"ai:cancel:{job_id}", "true", ex=300)
    logger.info(f"Registered cancellation signal for job {job_id} in Redis.")
    return {"status": "Cancelled", "jobId": job_id}


class ScoreCalculationRequest(BaseModel):
    cv: dict
    repositoryAssessments: List[dict]
    skillProficiencies: Optional[List[dict]] = None
    historicalMaturityScore: Optional[float] = None
    historicalProblemSolvingScore: Optional[float] = None


@router.post("/api/v1/candidate/assess/score")
async def calculate_scores_endpoint(
    request_data: ScoreCalculationRequest,
    correlation_id: str = Depends(verify_hmac_signature)
):
    extra_log = {"correlation_id": correlation_id}
    logger.info("Initiated deterministic scoring calculation", extra=extra_log)
    try:
        from app.pipelines.candidate.scoring_engine import score_candidate_deterministic
        from app.pipelines.candidate.contracts import CandidateAssessmentV2Contract
        
        profile = score_candidate_deterministic(
            cv=request_data.cv,
            repository_assessments=request_data.repositoryAssessments,
            skill_proficiencies=request_data.skillProficiencies,
            historical_maturity_score=request_data.historicalMaturityScore,
            historical_problem_solving_score=request_data.historicalProblemSolvingScore
        )
        
        # Enforce contract verification boundary
        CandidateAssessmentV2Contract.model_validate(profile)
        return profile
    except Exception as e:
        logger.error(f"Error during deterministic scoring: {e}", extra=extra_log)
        return JSONResponse(status_code=500, content={"error": str(e)})


class TaxonomyNormalizeRequest(BaseModel):
    skills: List[str]


@router.post("/api/v1/taxonomy/normalize")
async def taxonomy_normalize(
    request_data: TaxonomyNormalizeRequest,
    correlation_id: str = Depends(verify_hmac_signature)
):
    from app.pipelines.candidate.skill_taxonomy import normalize_batch
    results = normalize_batch(request_data.skills)
    return {"results": results}


@router.get("/api/v1/taxonomy/skills")
async def get_taxonomy_skills(
    correlation_id: str = Depends(verify_hmac_signature)
):
    from app.pipelines.candidate.skill_taxonomy import SKILL_TAXONOMY
    skills_list = []
    seen = set()
    for raw_name, entry in SKILL_TAXONOMY.items():
        # clean slug name is computed by lowercasing and replacing spaces/chars
        from app.pipelines.candidate.skill_taxonomy import make_skill_id
        slug = make_skill_id(entry.normalized_name)
        skill_id = f"skill:{slug}"
        if skill_id not in seen:
            seen.add(skill_id)
            skills_list.append({
                "skillId": skill_id,
                "displayName": entry.normalized_name,
                "sfiaCategory": entry.sfia_category,
                "onetCode": entry.onet_code
            })
    return {"skills": skills_list}





