import os
import sys

# Ensure parent directory is in sys.path so 'app' package can be resolved when run directly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import asyncio
if sys.platform == "win32" and sys.version_info < (3, 11):
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except Exception:
        pass

import json
import logging
import redis.asyncio as redis
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Request
from fastapi.responses import StreamingResponse, JSONResponse
from app.core.config import settings
from app.core.middleware.hmac_auth import verify_hmac_signature
from app.core.services.claude_service import ClaudeService
from pydantic import BaseModel

# Initialize logging
from app.core.monitoring.observability import setup_logging, UIStreamingManager, TraceContext, span_context

setup_logging()

logger = logging.getLogger("cverify-ai")
logger.setLevel(logging.INFO)

@asynccontextmanager
async def lifespan(app: FastAPI):
    UIStreamingManager().start()
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
    redis_password = os.getenv("REDIS_PASSWORD") or os.getenv("REDIS_PASS")
    try:
        redis_url = settings.redis_url
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

import uuid
import time

@app.middleware("http")
async def add_trace_context_middleware(request: Request, call_next):
    # Parse W3C traceparent header or generate a new trace_id
    traceparent = request.headers.get("traceparent") or request.headers.get("x-trace-id")
    trace_id = None
    parent_span_id = None
    
    if traceparent and traceparent.startswith("00-"):
        parts = traceparent.split("-")
        if len(parts) >= 4:
            trace_id = parts[1]
            parent_span_id = parts[2]
            
    if not trace_id:
        trace_id = request.headers.get("x-correlation-id") or uuid.uuid4().hex
        
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    session_id = request.headers.get("x-session-id")
    correlation_id = request.headers.get("x-correlation-id") or trace_id
    
    # Check head-based sampling (5% of requests)
    is_sampled = (os.getenv("OTEL_SAMPLING_RATE", "0.05") == "1.0") or (uuid.uuid4().int % 100 < 5)
    
    span_id = uuid.uuid4().hex[:16]
    
    TraceContext.clear()
    token = TraceContext._context.set({
        "trace_id": trace_id,
        "span_id": span_id,
        "parent_span_id": parent_span_id,
        "pipeline_stage": "REQUEST_RECEIVED",
        "is_sampled": is_sampled,
        "extra": {
            "requestId": request_id,
            "sessionId": session_id,
            "correlationId": correlation_id,
            "client_ip": request.client.host if request.client else None,
            "method": request.method,
            "url": str(request.url)
        },
        "events_buffer": []
    })
    
    logger.info(
        f"Incoming request {request.method} {request.url.path}",
        extra={"eventType": "start", "status": "running"}
    )
    
    start_time = time.perf_counter()
    try:
        response = await call_next(request)
        duration = int((time.perf_counter() - start_time) * 1000)
        
        logger.info(
            f"Completed request {request.method} {request.url.path} with status {response.status_code}",
            extra={
                "eventType": "end",
                "status": "success" if response.status_code < 400 else "error",
                "latencyMs": duration,
                "status_code": response.status_code
            }
        )
        return response
    except Exception as e:
        duration = int((time.perf_counter() - start_time) * 1000)
        logger.exception(
            f"Unhandled exception during request {request.method} {request.url.path}: {e}",
            extra={
                "eventType": "end",
                "status": "error",
                "latencyMs": duration,
                "errorType": "UNKNOWN_EXCEPTION"
            }
        )
        raise e
    finally:
        TraceContext.reset(token)

from app.api.routes.analysis_router import router as analysis_router
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
    request: Request,
    request_data: ChatStreamRequest,
    correlation_id: str = Depends(verify_hmac_signature)
):
    # Log correlation ID for request tracing
    extra_log = {"correlation_id": correlation_id}
    logger.info(f"Initiated AI stream request processing", extra=extra_log)
    
    async def sse_generator():
        # Emit STARTED status event
        yield f"data: {json.dumps({'status': 'STARTED'})}\n\n"
        
        interrupted = True
        try:
            msg_list = [{"role": msg.role, "content": msg.content} for msg in request_data.messages]
            
            async for token in claude_service.stream_chat(msg_list, correlation_id):
                if await request.is_disconnected():
                    logger.warning("Client disconnected from chat stream", extra=extra_log)
                    yield f"data: {json.dumps({'status': 'ABORTED', 'event': 'AI_STREAM_ABORTED'})}\n\n"
                    return
                
                # Send the token in clean JSON SSE formatting with status STREAMING
                yield f"data: {json.dumps({'status': 'STREAMING', 'token': token})}\n\n"
            
            interrupted = False
            # Emit COMPLETED status event
            yield f"data: {json.dumps({'status': 'COMPLETED'})}\n\n"
            # Send done frame to close client loop
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Error yielding SSE stream: {e}", extra=extra_log)
            yield f"data: {json.dumps({'status': 'FAILED', 'error': str(e)})}\n\n"
        finally:
            if interrupted:
                logger.warning("Stream was interrupted or aborted", extra=extra_log)
                try:
                    yield f"data: {json.dumps({'status': 'ABORTED', 'event': 'AI_STREAM_ABORTED'})}\n\n"
                except Exception:
                    pass

    return StreamingResponse(sse_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
