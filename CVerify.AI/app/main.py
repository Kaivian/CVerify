import os
import sys

# Ensure parent directory is in sys.path so 'app' package can be resolved when run directly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import asyncio
if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except Exception:
        pass

import json
import logging
import redis.asyncio as redis
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.responses import StreamingResponse, JSONResponse
from app.config import settings
from app.middleware.hmac_auth import verify_hmac_signature
from app.services.claude_service import ClaudeService
from pydantic import BaseModel

# Initialize logging
class CorrelationIdFormatter(logging.Formatter):
    def format(self, record):
        if not hasattr(record, "correlation_id"):
            record.correlation_id = "system"
        return super().format(record)

handler = logging.StreamHandler()
handler.setFormatter(CorrelationIdFormatter(
    "%(asctime)s [%(levelname)s] (%(name)s) CorrelationId: %(correlation_id)s - %(message)s"
))

root_logger = logging.getLogger()
for h in root_logger.handlers[:]:
    root_logger.removeHandler(h)
root_logger.setLevel(logging.INFO)
root_logger.addHandler(handler)

logger = logging.getLogger("cverify-ai")
logger.setLevel(logging.INFO)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AI microservice starting...")
    
    # 1. Validate Anthropic API key exists
    anthropic_api_key = os.getenv("ANTHROPIC_API_KEY") or getattr(settings, "anthropic_api_key", None)
    anthropic_configured = bool(anthropic_api_key and anthropic_api_key != "your_anthropic_api_key_here")
    logger.info("Anthropic API Key Configured: %s", anthropic_configured)
    if not anthropic_configured:
        logger.warning("WARNING: Anthropic API Key is missing or using a placeholder!")

    # 2. Log model configuration
    logger.info("Core AI Model Configuration: %s (Claude Sonnet)", settings.claude_model)

    # 3. Validate Redis connectivity
    redis_host = os.getenv("REDIS_HOST")
    redis_password = os.getenv("REDIS_PASSWORD") or os.getenv("REDIS_PASS")
    try:
        if redis_host:
            redis_port = int(os.getenv("REDIS_PORT", 6379))
            logger.info("Connecting to Redis at %s:%d...", redis_host, redis_port)
            redis_client = redis.Redis(
                host=redis_host,
                port=redis_port,
                password=redis_password,
                decode_responses=True,
                socket_connect_timeout=2.0
            )
        else:
            redis_url = os.getenv("REDIS_URL") or getattr(settings, "redis_url", "redis://localhost:6379/0")
            logger.info("Connecting to Redis via URL %s...", redis_url)
            redis_client = redis.from_url(
                redis_url,
                password=redis_password,
                decode_responses=True,
                socket_connect_timeout=2.0
            )

        await redis_client.ping()
        await redis_client.close()
        logger.info("Redis connectivity: CONNECTED successfully.")
    except Exception as ex:
        logger.error("Redis connectivity: FAILED to connect: %s", str(ex))

    logger.info("AI microservice bootstrap verification completed. Startup readiness: %s", "READY" if (anthropic_configured) else "UNREADY")
    yield

app = FastAPI(title="CVerify.AI Microservice", version="1.0.0", lifespan=lifespan)

from app.routes.analysis_router import router as analysis_router
app.include_router(analysis_router)

claude_service = ClaudeService()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatStreamRequest(BaseModel):
    messages: list[ChatMessage]

from fastapi import Response

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "CVerify.AI"}

@app.get("/health/ready")
@app.get("/readiness")
async def readiness():
    try:
        anthropic_key_exists = bool(os.getenv("ANTHROPIC_API_KEY") or getattr(settings, "anthropic_api_key", None))

        redis_host = os.getenv("REDIS_HOST")
        redis_password = os.getenv("REDIS_PASSWORD") or os.getenv("REDIS_PASS")
        if redis_host:
            redis_port = int(os.getenv("REDIS_PORT", 6379))
            redis_client = redis.Redis(
                host=redis_host,
                port=redis_port,
                password=redis_password,
                decode_responses=True,
                socket_connect_timeout=2.0
            )
        else:
            redis_url = os.getenv("REDIS_URL") or getattr(settings, "redis_url", "redis://localhost:6379/0")
            redis_client = redis.from_url(
                redis_url,
                password=redis_password,
                decode_responses=True,
                socket_connect_timeout=2.0
            )

        await redis_client.ping()
        await redis_client.close()

        return {
            "status": "ready",
            "anthropicConfigured": anthropic_key_exists,
            "redis": "connected"
        }

    except Exception as ex:
        logger.error("FastAPI readiness check failed: %s", str(ex))
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(ex)
            }
        )

@app.post("/api/v1/chat/stream")
async def chat_stream(
    request_data: ChatStreamRequest,
    correlation_id: str = Depends(verify_hmac_signature)
):
    # Log correlation ID for request tracing
    extra_log = {"correlation_id": correlation_id}
    logger.info(f"Initiated AI stream request processing", extra=extra_log)
    
    async def sse_generator():
        try:
            msg_list = [{"role": msg.role, "content": msg.content} for msg in request_data.messages]
            
            async for token in claude_service.stream_chat(msg_list, correlation_id):
                # Send the token in clean JSON SSE formatting
                yield f"data: {json.dumps({'token': token})}\n\n"
            
            # Send done frame to close client loop
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Error yielding SSE stream: {e}", extra=extra_log)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
