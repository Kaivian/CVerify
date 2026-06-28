import logging
import asyncio
import time
import random
from typing import AsyncGenerator
from anthropic import AsyncAnthropic
from app.core.config import settings
from app.core.monitoring.ai_cost_tracker import AiCostTracker
from app.core.services.token_accounting_service import TokenAccountingService
import redis.asyncio as redis

_redis_client = None

def get_redis_client():
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


logger = logging.getLogger("claude_service")

# Custom async retry handler
async def retry_with_exponential_backoff(
    func,
    *args,
    max_retries: int = 5,
    initial_delay: float = 1.0,
    backoff_factor: float = 2.0,
    correlation_id: str = "system",
    **kwargs
):
    delay = initial_delay
    for attempt in range(1, max_retries + 1):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            status_code = getattr(e, "status_code", None)
            is_transient = False
            if status_code in (429, 500, 502, 503, 504):
                is_transient = True
            elif "rate limit" in str(e).lower() or "timeout" in str(e).lower() or "connection" in str(e).lower():
                is_transient = True

            if not is_transient and attempt == 1:
                logger.error(
                    f"Non-transient error in Claude call: {e}",
                    extra={"correlation_id": correlation_id}
                )
                raise e

            if attempt == max_retries:
                logger.error(
                    f"Max retries reached ({max_retries}) for Claude call. Final failure: {e}",
                    extra={"correlation_id": correlation_id}
                )
                raise e

            # Add jitter
            jitter = random.uniform(0, 0.1 * delay)
            sleep_time = delay + jitter
            logger.warning(
                f"Transient error in Claude call: {e}. Retrying in {sleep_time:.2f} seconds (Attempt {attempt}/{max_retries})...",
                extra={"correlation_id": correlation_id}
            )
            await asyncio.sleep(sleep_time)
            delay *= backoff_factor

class ClaudeService:
    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.cost_tracker = AiCostTracker()

    async def _check_cancellation(self, correlation_id: str):
        if correlation_id and correlation_id != "system":
            try:
                redis_client = get_redis_client()
                if await redis_client.get(f"ai:cancel:{correlation_id}"):
                    logger.warning(f"Job {correlation_id} cancellation detected. Aborting LLM execution.", extra={"correlation_id": correlation_id})
                    raise asyncio.CancelledError(f"Job {correlation_id} was cancelled by user.")
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error(f"Error checking cancellation in Redis: {e}", extra={"correlation_id": correlation_id})


    async def stream_chat(self, messages: list, correlation_id: str = "system") -> AsyncGenerator[str, None]:
        extra_log = {"correlation_id": correlation_id}
        system_prompt = (
            "You are the CVerify Repository Intelligence Engine, an expert AI Software Architect and talent intelligence advisor.\n"
            "Answer developer and recruiter questions about repository architecture, code quality, skill patterns, "
            "and verification findings.\n\n"
            "When citing evidence from a repository analysis, reference specific file names, class structures, "
            "or detected technologies — never give generic summaries. "
            "Format responses using clean, readable Markdown."
        )

        system_config = [
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"}
            }
        ]

        formatted_messages = []
        for msg in messages:
            formatted_messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })

        logger.info("Starting conversational chat stream", extra=extra_log)
        start_time = time.perf_counter()

        try:
            # We wrap the creation of the stream in retry logic
            async def get_stream():
                return await self.client.messages.create(
                    model=settings.claude_model,
                    max_tokens=8192,
                    system=system_config,
                    messages=formatted_messages,
                    temperature=0.7,
                    stream=True
                )

            await self._check_cancellation(correlation_id)
            stream = await retry_with_exponential_backoff(get_stream, correlation_id=correlation_id)
            
            prompt_tokens = 0
            completion_tokens = 0
            total_tokens = None
            cache_creation = 0
            cache_read = 0

            async for event in stream:
                await self._check_cancellation(correlation_id)
                if event.type == "content_block_delta" and event.delta.type == "text_delta":
                    yield event.delta.text
                elif event.type == "message_start":
                    p, c, t = TokenAccountingService.extract_from_provider_usage(event.message.usage)
                    prompt_tokens = p
                    cache_creation = getattr(event.message.usage, "cache_creation_input_tokens", 0) or 0
                    cache_read = getattr(event.message.usage, "cache_read_input_tokens", 0) or 0
                elif event.type == "message_delta":
                    p, c, t = TokenAccountingService.extract_from_provider_usage(event.usage)
                    completion_tokens = c
                    if t is not None:
                        total_tokens = t

            duration = int((time.perf_counter() - start_time) * 1000)
            
            # Normalize token usage
            normalized = TokenAccountingService.normalize_usage(
                model=settings.claude_model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                cache_creation_tokens=cache_creation,
                cache_read_tokens=cache_read
            )

            # Record cost
            cost = self.cost_tracker.record_usage(
                model=settings.claude_model,
                input_tokens=normalized.prompt_tokens,
                output_tokens=normalized.completion_tokens,
                cache_creation_tokens=normalized.cache_write_tokens,
                cache_read_tokens=normalized.cache_read_tokens,
                correlation_id=correlation_id,
                total_tokens=normalized.total_tokens
            )

            logger.info(
                f"Conversational chat stream finished. Tokens: In={normalized.prompt_tokens}, Out={normalized.completion_tokens}, Total={normalized.total_tokens}, Cost=${cost:.6f}, Duration={duration}ms",
                extra={
                    "correlation_id": correlation_id,
                    "duration_ms": duration,
                    "input_tokens": normalized.prompt_tokens,
                    "output_tokens": normalized.completion_tokens,
                    "total_tokens": normalized.total_tokens,
                    "estimated_cost_usd": float(cost),
                    "token_mismatch_flag": normalized.token_mismatch_detected
                }
            )

        except Exception as e:
            logger.error(f"Error streaming from Anthropic Claude API: {e}", extra=extra_log)
            yield f"\n\n[Error occurred in CVerify Repository Intelligence Engine: {str(e)}]"

    async def stream_prompt(self, system_prompt: str, user_prompt: str, correlation_id: str = "system") -> AsyncGenerator[dict, None]:
        extra_log = {"correlation_id": correlation_id}
        system_config = [
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"}
            }
        ]

        logger.info("Starting prompt token stream", extra=extra_log)
        start_time = time.perf_counter()

        try:
            async def get_stream():
                return await self.client.messages.create(
                    model=settings.claude_model,
                    max_tokens=8192,
                    system=system_config,
                    messages=[{"role": "user", "content": user_prompt}],
                    temperature=0.2,
                    stream=True
                )

            await self._check_cancellation(correlation_id)
            stream = await retry_with_exponential_backoff(get_stream, correlation_id=correlation_id)
            
            prompt_tokens = 0
            completion_tokens = 0
            total_tokens = None
            cache_creation = 0
            cache_read = 0

            async for event in stream:
                await self._check_cancellation(correlation_id)
                if event.type == "content_block_delta" and event.delta.type == "text_delta":
                    yield {"type": "content", "text": event.delta.text}
                elif event.type == "message_start":
                    p, c, t = TokenAccountingService.extract_from_provider_usage(event.message.usage)
                    prompt_tokens = p
                    cache_creation = getattr(event.message.usage, "cache_creation_input_tokens", 0) or 0
                    cache_read = getattr(event.message.usage, "cache_read_input_tokens", 0) or 0
                elif event.type == "message_delta":
                    p, c, t = TokenAccountingService.extract_from_provider_usage(event.usage)
                    completion_tokens = c
                    if t is not None:
                        total_tokens = t

            duration = int((time.perf_counter() - start_time) * 1000)
            
            normalized = TokenAccountingService.normalize_usage(
                model=settings.claude_model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                cache_creation_tokens=cache_creation,
                cache_read_tokens=cache_read
            )

            cost = self.cost_tracker.record_usage(
                model=settings.claude_model,
                input_tokens=normalized.prompt_tokens,
                output_tokens=normalized.completion_tokens,
                cache_creation_tokens=normalized.cache_write_tokens,
                cache_read_tokens=normalized.cache_read_tokens,
                correlation_id=correlation_id,
                total_tokens=normalized.total_tokens
            )

            logger.info(
                f"Prompt stream finished. Tokens: In={normalized.prompt_tokens}, Out={normalized.completion_tokens}, Total={normalized.total_tokens}, Cost=${cost:.6f}, Duration={duration}ms",
                extra={
                    "correlation_id": correlation_id,
                    "duration_ms": duration,
                    "input_tokens": normalized.prompt_tokens,
                    "output_tokens": normalized.completion_tokens,
                    "total_tokens": normalized.total_tokens,
                    "estimated_cost_usd": float(cost),
                    "token_mismatch_flag": normalized.token_mismatch_detected
                }
            )

            yield {
                "type": "telemetry",
                "promptTokens": normalized.prompt_tokens,
                "completionTokens": normalized.completion_tokens,
                "totalTokens": normalized.total_tokens,
                "cacheReadTokens": normalized.cache_read_tokens,
                "cacheWriteTokens": normalized.cache_write_tokens,
                "estimatedCostUsd": float(cost),
                "modelName": settings.claude_model,
                "provider": "Anthropic",
                "durationMs": duration
            }

        except Exception as e:
            logger.error(f"Error streaming prompt from Anthropic Claude API: {e}", extra=extra_log)
            yield {
                "type": "error",
                "message": f"Error occurred during prompt stream: {str(e)}"
            }

    async def analyze_repo(self, system_prompt: str, user_prompt: str, correlation_id: str = "system") -> str:
        text, _ = await self.analyze_repo_with_telemetry(system_prompt, user_prompt, correlation_id)
        return text

    async def analyze_repo_with_telemetry(self, system_prompt: str, user_prompt: str, correlation_id: str = "system") -> tuple[str, dict]:
        from app.core.monitoring.observability import TraceContext, UIStreamingManager, span_context
        
        ctx = TraceContext.get()
        job_id = ctx.get("extra", {}).get("jobId")
        task_type = ctx.get("extra", {}).get("taskType") or "LLM_CALL"
        
        extra_log = {"correlation_id": correlation_id}
        system_config = [
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"}
            }
        ]
        
        # Determine if debug mode is active
        debug_mode = ctx.get("extra", {}).get("debug", False)
        
        logger.info(
            "Invoking Claude analysis with telemetry in streaming mode",
            extra={
                "eventType": "llm_call_start",
                "status": "running",
                "correlation_id": correlation_id,
                # Mask prompt logs in stdout: only expose if debug_mode is true
                "rawPrompt": f"System: {system_prompt}\nUser: {user_prompt}" if debug_mode else "[MASKED]"
            }
        )
        
        start_time = time.perf_counter()
        
        try:
            async def get_stream():
                return await self.client.messages.create(
                    model=settings.claude_model,
                    max_tokens=8192,
                    system=system_config,
                    messages=[{"role": "user", "content": user_prompt}],
                    temperature=0.2,
                    stream=True
                )

            await self._check_cancellation(correlation_id)
            stream = await retry_with_exponential_backoff(get_stream, correlation_id=correlation_id)
            
            prompt_tokens = 0
            completion_tokens = 0
            total_tokens = None
            cache_creation = 0
            cache_read = 0
            text_chunks = []
            
            async for event in stream:
                await self._check_cancellation(correlation_id)
                if event.type == "content_block_delta" and event.delta.type == "text_delta":
                    token_text = event.delta.text
                    text_chunks.append(token_text)
                elif event.type == "message_start":
                    p, c, t = TokenAccountingService.extract_from_provider_usage(event.message.usage)
                    prompt_tokens = p
                    cache_creation = getattr(event.message.usage, "cache_creation_input_tokens", 0) or 0
                    cache_read = getattr(event.message.usage, "cache_read_input_tokens", 0) or 0
                elif event.type == "message_delta":
                    p, c, t = TokenAccountingService.extract_from_provider_usage(event.usage)
                    completion_tokens = c
                    if t is not None:
                        total_tokens = t

            full_text = "".join(text_chunks)
            duration = int((time.perf_counter() - start_time) * 1000)
            
            # Normalize token usage
            normalized = TokenAccountingService.normalize_usage(
                model=settings.claude_model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                cache_creation_tokens=cache_creation,
                cache_read_tokens=cache_read
            )

            # Record cost
            cost = self.cost_tracker.record_execution(
                correlation_id=correlation_id,
                model=settings.claude_model,
                execution_type="llm_call",
                input_tokens=normalized.prompt_tokens,
                output_tokens=normalized.completion_tokens,
                cache_creation_tokens=normalized.cache_write_tokens,
                cache_read_tokens=normalized.cache_read_tokens,
                duration_ms=duration,
                total_tokens=normalized.total_tokens,
                provider="Anthropic"
            )

            telemetry = {
                "promptTokens": normalized.prompt_tokens,
                "completionTokens": normalized.completion_tokens,
                "totalTokens": normalized.total_tokens,
                "cacheReadTokens": normalized.cache_read_tokens,
                "cacheWriteTokens": normalized.cache_write_tokens,
                "estimatedCostUsd": float(cost),
                "modelName": settings.claude_model,
                "provider": "Anthropic",
                "durationMs": duration,
                "tokenMismatchFlag": normalized.token_mismatch_detected
            }

            logger.info(
                f"Claude telemetry call successful. Tokens: In={normalized.prompt_tokens} (CacheWrite={normalized.cache_write_tokens}, CacheRead={normalized.cache_read_tokens}), Out={normalized.completion_tokens}, Total={normalized.total_tokens}, Cost=${cost:.6f}, Duration={duration}ms",
                extra={
                    "eventType": "llm_call_end",
                    "status": "success",
                    "correlation_id": correlation_id,
                    "duration_ms": duration,
                    "input_tokens": normalized.prompt_tokens,
                    "output_tokens": normalized.completion_tokens,
                    "total_tokens": normalized.total_tokens,
                    "cache_creation_input_tokens": normalized.cache_write_tokens,
                    "cache_read_input_tokens": normalized.cache_read_tokens,
                    "estimated_cost_usd": float(cost),
                    "token_mismatch_flag": normalized.token_mismatch_detected
                }
            )
            return full_text, telemetry

        except Exception as e:
            duration = int((time.perf_counter() - start_time) * 1000)
            # Classify errors into standard categories
            err_str = str(e).lower()
            error_type = "UNKNOWN_EXCEPTION"
            if "timeout" in err_str or "time out" in err_str:
                error_type = "LLM_TIMEOUT"
            elif "invalid_prompt" in err_str or "bad request" in err_str or "system prompt" in err_str:
                error_type = "INVALID_PROMPT"
            elif "rate limit" in err_str or "overloaded" in err_str or "connection" in err_str:
                error_type = "TOOL_FAILURE"

            # Log classified error details
            logger.error(
                f"Error calling Anthropic Claude API for repository analysis: {e}",
                exc_info=True,
                extra={
                    "eventType": "llm_call_end",
                    "status": "error",
                    "correlation_id": correlation_id,
                    "duration_ms": duration,
                    "errorType": error_type
                }
            )
            raise e
