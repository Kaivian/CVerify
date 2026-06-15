import json
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends
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
    jobIds: List[str]
    cvSkills: List[str]
    workingExperience: List[dict]

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
    logger.info(f"Initiated candidate assessment stream request for jobs: {request_data.jobIds}", extra=extra_log)

    from app.pipelines.candidate.orchestrate_stream import CandidateAssessmentStreamOrchestrator
    orchestrator = CandidateAssessmentStreamOrchestrator()

    async def sse_generator():
        try:
            async for progress_event in orchestrator.orchestrate_async(
                job_ids=request_data.jobIds,
                cv_skills=request_data.cvSkills,
                working_experience=request_data.workingExperience,
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
    except Exception as e:
        logger.warning(f"Failed to aggregate results: {e}", extra=extra_log)
        return JSONResponse(
            status_code=400,
            content={"status": "Failed", "errorMessage": str(e)}
        )

