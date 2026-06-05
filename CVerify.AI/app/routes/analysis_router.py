import json
import logging
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.middleware.hmac_auth import verify_hmac_signature
from app.orchestrators.github_analysis_orchestrator import GitHubAnalysisOrchestrator

router = APIRouter()
logger = logging.getLogger("analysis_router")


class AnalysisRequest(BaseModel):
    repositoryId: str
    repoName: str
    repoOwner: str
    encryptedToken: str
    defaultBranch: str


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
                default_branch=request_data.defaultBranch
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
