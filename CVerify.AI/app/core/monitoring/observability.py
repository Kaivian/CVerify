import os
import re
import time
import json
import uuid
import logging
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Union
from contextlib import contextmanager
from contextvars import ContextVar
from pydantic import BaseModel, Field
import redis.asyncio as redis
from app.core.config import settings

# --- W3C / OpenTelemetry TraceContext ---
class TraceContext:
    _context = ContextVar("trace_context", default={})

    @classmethod
    def get(cls) -> Dict[str, Any]:
        return cls._context.get().copy()

    @classmethod
    def set(cls, **kwargs):
        current = cls.get()
        current.update(kwargs)
        return cls._context.set(current)

    @classmethod
    def reset(cls, token):
        cls._context.reset(token)

    @classmethod
    def clear(cls):
        cls._context.set({})

    @classmethod
    def append_event(cls, log_obj: Dict[str, Any]):
        current = cls.get()
        if "events_buffer" not in current:
            current["events_buffer"] = []
        current["events_buffer"].append(log_obj)
        cls._context.set(current)

    @classmethod
    def get_events_buffer(cls) -> List[Dict[str, Any]]:
        return cls.get().get("events_buffer", [])

@contextmanager
def span_context(stage_name: str, parent_span_id: Optional[str] = None):
    old_context = TraceContext.get()
    
    # Generate 8-byte hex string for OpenTelemetry spanId
    new_span_id = uuid.uuid4().hex[:16]
    parent = parent_span_id or old_context.get("span_id")
    trace_id = old_context.get("trace_id") or uuid.uuid4().hex
    
    # Check head-based sampling (5% of requests, 100% of errors)
    # Ensure is_sampled is preserved or generated on first span
    if "is_sampled" in old_context:
        is_sampled = old_context["is_sampled"]
    else:
        # Determine sampling (5% chance)
        is_sampled = (os.getenv("OTEL_SAMPLING_RATE", "0.05") == "1.0") or (uuid.uuid4().int % 100 < 5)
        
    new_context = {
        "trace_id": trace_id,
        "span_id": new_span_id,
        "parent_span_id": parent,
        "pipeline_stage": stage_name,
        "is_sampled": is_sampled,
        "extra": old_context.get("extra", {}).copy(),
        "events_buffer": old_context.get("events_buffer", [])
    }
    
    token = TraceContext._context.set(new_context)
    try:
        yield new_context
    finally:
        TraceContext.reset(token)

# --- Regex-Based Sensitive Data Masking ---
SENSITIVE_KEYS_RE = re.compile(
    r"(token|secret|key|password|email|credential|signature|auth|encrypted|private|token)", 
    re.IGNORECASE
)

def sanitize_sensitive_data(val: Any) -> Any:
    if isinstance(val, dict):
        return {
            k: "******" if SENSITIVE_KEYS_RE.search(k) else sanitize_sensitive_data(v)
            for k, v in val.items()
        }
    elif isinstance(val, list):
        return [sanitize_sensitive_data(item) for item in val]
    elif isinstance(val, str):
        # Mask Anthropic Claude API keys
        val = re.sub(r"sk-ant-[a-zA-Z0-9_\-]{40,}", "sk-ant-******", val)
        # Mask HTTP Authorization bearer headers
        val = re.sub(r"bearer\s+[a-zA-Z0-9_\-\.]{10,}", "Bearer ******", val, flags=re.IGNORECASE)
        # Mask generic secrets
        return val
    return val

# --- Structured JSON Formatter ---
class StructuredJsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        ctx = TraceContext.get()
        
        # Determine status
        status = "running"
        if getattr(record, "status", None):
            status = record.status
        elif record.levelno >= logging.ERROR:
            status = "error"
        elif record.levelno >= logging.INFO and any(word in record.getMessage().lower() for word in ["completed", "success", "successful"]):
            status = "success"

        # Extract stage and taskId from record extra or trace context
        stage = getattr(record, "stage", None) or ctx.get("pipeline_stage") or record.name
        task_id = getattr(record, "taskId", None) or ctx.get("extra", {}).get("taskType") or ctx.get("extra", {}).get("jobId") or "system"

        # Build payload conforming to W3C and OTEL concepts
        log_obj = {
            "trace_id": ctx.get("trace_id") or "system",
            "span_id": ctx.get("span_id") or "system",
            "parent_span_id": ctx.get("parent_span_id"),
            "timestamp": datetime.now(timezone.utc).isoformat()[:-6] + "Z",
            "version": "1.0.0",
            "pipelineStage": stage,
            "stage": stage,
            "taskId": task_id,
            "eventType": getattr(record, "eventType", "progress"),
            "message": record.getMessage(),
            "status": status
        }

        # Inject latency metrics
        if hasattr(record, "latencyMs"):
            log_obj["latencyMs"] = record.latencyMs
        elif "duration_ms" in record.__dict__:
            log_obj["latencyMs"] = record.__dict__["duration_ms"]

        # Inject token details
        if hasattr(record, "tokenUsage"):
            log_obj["tokenUsage"] = record.tokenUsage
            if isinstance(log_obj["tokenUsage"], dict) and "total" not in log_obj["tokenUsage"]:
                log_obj["tokenUsage"]["total"] = log_obj["tokenUsage"].get("input", 0) + log_obj["tokenUsage"].get("output", 0)
        elif "input_tokens" in record.__dict__ or "output_tokens" in record.__dict__:
            input_tokens = record.__dict__.get("input_tokens", 0) or 0
            output_tokens = record.__dict__.get("output_tokens", 0) or 0
            total_tokens = record.__dict__.get("total_tokens")
            if total_tokens is None:
                total_tokens = input_tokens + output_tokens
            log_obj["tokenUsage"] = {
                "input": input_tokens,
                "output": output_tokens,
                "total": total_tokens,
                "cacheRead": record.__dict__.get("cache_read_input_tokens", 0) or 0,
                "cacheWrite": record.__dict__.get("cache_creation_input_tokens", 0) or 0
            }

        # Inject estimated cost
        if hasattr(record, "cost"):
            log_obj["cost"] = record.cost
        elif "estimated_cost_usd" in record.__dict__:
            log_obj["cost"] = record.__dict__["estimated_cost_usd"]

        # Formulate metadata dictionary
        meta = ctx.get("extra", {}).copy()
        
        if hasattr(record, "correlation_id") and record.correlation_id:
            meta["correlationId"] = record.correlation_id
        if hasattr(record, "job_id") and record.job_id:
            meta["jobId"] = record.job_id
        if hasattr(record, "task_type") and record.task_type:
            meta["taskType"] = record.task_type

        # Check for standard python execution details
        if record.exc_info:
            log_obj["eventType"] = "error"
            log_obj["status"] = "error"
            meta["errorType"] = getattr(record, "errorType", "UNKNOWN_EXCEPTION")
            meta["stacktrace"] = self.formatException(record.exc_info)

        # Merge standard logger kwargs
        standard_fields = {
            "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
            "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
            "created", "msecs", "relativeCreated", "thread", "threadName",
            "processName", "process", "message", "asctime", "correlation_id", 
            "job_id", "task_type", "eventType", "status", "latencyMs", "tokenUsage", "cost", "errorType"
        }
        for k, v in record.__dict__.items():
            if k not in standard_fields and not k.startswith("_"):
                meta[k] = v

        # Apply security masking & sanitization
        meta = sanitize_sensitive_data(meta)
        log_obj["metadata"] = meta

        # Accumulate trace context events for local trace persistence
        TraceContext.append_event(log_obj)

        return json.dumps(log_obj)

# --- Console Colored Formatter for Local Development ---
class ConsoleColoredFormatter(logging.Formatter):
    # ANSI Escape sequences for terminal colors
    RESET = "\033[0m"
    BOLD = "\033[1m"
    GRAY = "\033[90m"
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN = "\033[36m"

    LEVEL_COLORS = {
        logging.DEBUG: CYAN,
        logging.INFO: GREEN,
        logging.WARNING: YELLOW,
        logging.ERROR: RED,
        logging.CRITICAL: RED,
    }

    def format(self, record: logging.LogRecord) -> str:
        ctx = TraceContext.get()
        
        # Determine status
        status = "running"
        if getattr(record, "status", None):
            status = record.status
        elif record.levelno >= logging.ERROR:
            status = "error"
        elif record.levelno >= logging.INFO and any(word in record.getMessage().lower() for word in ["completed", "success", "successful"]):
            status = "success"

        # Build payload conforming to W3C and OTEL concepts (so we keep TraceContext.append_event updated)
        timestamp_iso = datetime.now(timezone.utc).isoformat()[:-6] + "Z"
        stage = getattr(record, "stage", None) or ctx.get("pipeline_stage") or record.name
        task_id = getattr(record, "taskId", None) or ctx.get("extra", {}).get("taskType") or ctx.get("extra", {}).get("jobId") or "system"
        
        log_obj = {
            "trace_id": ctx.get("trace_id") or "system",
            "span_id": ctx.get("span_id") or "system",
            "parent_span_id": ctx.get("parent_span_id"),
            "timestamp": timestamp_iso,
            "version": "1.0.0",
            "pipelineStage": stage,
            "stage": stage,
            "taskId": task_id,
            "eventType": getattr(record, "eventType", "progress"),
            "message": record.getMessage(),
            "status": status
        }

        # Inject latency metrics
        latency_ms = None
        if hasattr(record, "latencyMs"):
            latency_ms = record.latencyMs
        elif "duration_ms" in record.__dict__:
            latency_ms = record.__dict__["duration_ms"]
        
        if latency_ms is not None:
            log_obj["latencyMs"] = latency_ms

        # Inject token details
        token_usage = None
        if hasattr(record, "tokenUsage"):
            token_usage = record.tokenUsage
            if isinstance(token_usage, dict) and "total" not in token_usage:
                token_usage["total"] = token_usage.get("input", 0) + token_usage.get("output", 0)
        elif "input_tokens" in record.__dict__ or "output_tokens" in record.__dict__:
            input_tokens = record.__dict__.get("input_tokens", 0) or 0
            output_tokens = record.__dict__.get("output_tokens", 0) or 0
            total_tokens = record.__dict__.get("total_tokens")
            if total_tokens is None:
                total_tokens = input_tokens + output_tokens
            token_usage = {
                "input": input_tokens,
                "output": output_tokens,
                "total": total_tokens,
                "cacheRead": record.__dict__.get("cache_read_input_tokens", 0) or 0,
                "cacheWrite": record.__dict__.get("cache_creation_input_tokens", 0) or 0
            }
        
        if token_usage is not None:
            log_obj["tokenUsage"] = token_usage

        # Inject estimated cost
        cost = None
        if hasattr(record, "cost"):
            cost = record.cost
        elif "estimated_cost_usd" in record.__dict__:
            cost = record.__dict__["estimated_cost_usd"]
            
        if cost is not None:
            log_obj["cost"] = cost

        # Formulate metadata dictionary
        meta = ctx.get("extra", {}).copy()
        
        if hasattr(record, "correlation_id") and record.correlation_id:
            meta["correlationId"] = record.correlation_id
        if hasattr(record, "job_id") and record.job_id:
            meta["jobId"] = record.job_id
        if hasattr(record, "task_type") and record.task_type:
            meta["taskType"] = record.task_type

        # Check for standard python execution details
        if record.exc_info:
            log_obj["eventType"] = "error"
            log_obj["status"] = "error"
            meta["errorType"] = getattr(record, "errorType", "UNKNOWN_EXCEPTION")
            meta["stacktrace"] = self.formatException(record.exc_info)

        # Merge standard logger kwargs
        standard_fields = {
            "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
            "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
            "created", "msecs", "relativeCreated", "thread", "threadName",
            "processName", "process", "message", "asctime", "correlation_id", 
            "job_id", "task_type", "eventType", "status", "latencyMs", "tokenUsage", "cost", "errorType"
        }
        for k, v in record.__dict__.items():
            if k not in standard_fields and not k.startswith("_"):
                meta[k] = v

        # Apply security masking & sanitization
        meta = sanitize_sensitive_data(meta)
        log_obj["metadata"] = meta

        # Accumulate trace context events for local trace persistence (CRITICAL: identical to StructuredJsonFormatter)
        TraceContext.append_event(log_obj)

        # ---- Format output string ----
        local_time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        timestamp_part = f"{self.GRAY}[{local_time_str}]{self.RESET}"
        
        level_color = self.LEVEL_COLORS.get(record.levelno, self.RESET)
        level_name = record.levelname.ljust(5)
        level_part = f"{level_color}{self.BOLD}{level_name}{self.RESET}"
        
        stage_part = f"{self.MAGENTA}[{stage}]{self.RESET}"
        
        trace_id = log_obj["trace_id"]
        trace_part = ""
        if trace_id and trace_id != "system":
            trace_part = f" {self.GRAY}(t:{trace_id[:8]}){self.RESET}"
            
        msg_text = record.getMessage()
        
        metrics = []
        if latency_ms is not None:
            metrics.append(f"latency={latency_ms}ms")
        if cost is not None:
            metrics.append(f"cost=${cost:.4f}")
        if token_usage is not None:
            input_tokens = token_usage.get("input", 0)
            output_tokens = token_usage.get("output", 0)
            metrics.append(f"tokens=({input_tokens}i/{output_tokens}o)")
            
        metrics_part = ""
        if metrics:
            metrics_part = f" {self.CYAN}| {' '.join(metrics)}{self.RESET}"
            
        meta_items = []
        for k, v in meta.items():
            if k not in ("jobId", "taskType", "correlationId", "errorType", "stacktrace"):
                v_str = str(v)
                if len(v_str) > 100:
                    v_str = v_str[:97] + "..."
                meta_items.append(f"{k}={v_str}")
                
        meta_part = ""
        if meta_items:
            meta_part = f" {self.GRAY}({' '.join(meta_items)}){self.RESET}"
            
        formatted_line = f"{timestamp_part} {level_part} {stage_part}{trace_part} {msg_text}{metrics_part}{meta_part}"
        
        if record.exc_info:
            stack_trace = self.formatException(record.exc_info)
            formatted_line += f"\n{self.RED}{stack_trace}{self.RESET}"
            
        return formatted_line

# --- Log Throttling & Sampling Filter ---
class SamplingAndThrottlingFilter(logging.Filter):
    def __init__(self):
        super().__init__()
        self._last_error_time = {}
        self._error_counts = {}

    def filter(self, record: logging.LogRecord) -> bool:
        ctx = TraceContext.get()
        
        # 1. Log Throttling: prevent log floods for warning/error logs
        if record.levelno >= logging.WARNING:
            msg_key = f"{record.module}:{record.lineno}:{record.msg}"
            now = time.time()
            last_time = self._last_error_time.get(msg_key, 0)
            if now - last_time < 1.0:
                count = self._error_counts.get(msg_key, 0) + 1
                self._error_counts[msg_key] = count
                if count > 5:
                    return False
            else:
                self._last_error_time[msg_key] = now
                self._error_counts[msg_key] = 1

        # 2. Trace Sampling: 100% of errors/warnings are always logged
        if record.levelno >= logging.WARNING:
            return True

        # Check if sampled out
        return ctx.get("is_sampled", True)

# --- Pydantic Schema Event Contract Validation ---
class UIProgressEvent(BaseModel):
    jobId: str
    taskType: str
    taskStatus: str
    level: str = "Info"
    message: str
    progress: Optional[float] = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat()[:-6] + "Z")
    tokenChunk: Optional[str] = None
    isFinal: bool = False

# --- Async Bounded UI Queue Manager & Batcher (Backpressure Safe) ---
class UIStreamingManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(UIStreamingManager, cls).__new__(cls)
            cls._instance._queue = asyncio.Queue(maxsize=500)
            cls._instance._redis_client = redis.from_url(settings.redis_url, decode_responses=True)
            cls._instance._worker_task = None
            cls._instance._logger = logging.getLogger("ui_streaming_manager")
        return cls._instance

    def start(self):
        if self._worker_task is None or self._worker_task.done():
            self._worker_task = asyncio.create_task(self._process_queue_loop())
            self._logger.info("UI progress streaming worker daemon initiated.")

    async def enqueue_ui_event(
        self,
        job_id: str,
        task_type: str,
        task_status: str,
        message: str,
        level: str = "Info",
        progress: Optional[float] = None,
        token_chunk: Optional[str] = None,
        is_final: bool = False
    ):
        event = {
            "jobId": job_id,
            "taskType": task_type,
            "taskStatus": task_status,
            "level": level,
            "message": message,
            "progress": progress,
            "tokenChunk": token_chunk,
            "isFinal": is_final
        }
        
        try:
            # Backpressure: non-blocking try put, if queue full, log warning and drop/defer event
            self._queue.put_nowait(event)
        except asyncio.QueueFull:
            self._logger.warning(
                f"UI Stream Queue is full (size={self._queue.qsize()}). Dropping telemetry chunk: jobId={job_id}, stage={task_type}."
            )

    async def _process_queue_loop(self):
        while True:
            try:
                event = await self._queue.get()
                
                # Aggregative Token Batcher
                # If we encounter a token chunk, check if subsequent events in the queue are also token chunks
                # for the same job and task. If so, batch them together.
                if event.get("tokenChunk") is not None and not event.get("isFinal"):
                    batch_tokens = [event["tokenChunk"]]
                    batch_msg = event["message"]
                    job_id = event["jobId"]
                    task_type = event["taskType"]
                    
                    # Accumulate for up to 10 tokens or until queue empty or non-matching event found
                    while len(batch_tokens) < 10 and not self._queue.empty():
                        next_event = self._queue.get_nowait()
                        if (
                             next_event.get("tokenChunk") is not None and
                             next_event.get("jobId") == job_id and
                             next_event.get("taskType") == task_type and
                             not next_event.get("isFinal")
                        ):
                            batch_tokens.append(next_event["tokenChunk"])
                            batch_msg = next_event["message"]
                            self._queue.task_done()
                        else:
                            # Re-enqueue non-matching event
                            await self._queue.put(next_event)
                            break
                            
                    event["tokenChunk"] = "".join(batch_tokens)
                    event["message"] = batch_msg

                # Strict Pydantic Validation & Sanitization
                # Strip raw prompts and sensitive variables from message
                event["message"] = sanitize_sensitive_data(event["message"])
                if event["tokenChunk"]:
                    event["tokenChunk"] = sanitize_sensitive_data(event["tokenChunk"])

                try:
                    validated_event = UIProgressEvent(**event)
                    
                    # Publish to Redis channel
                    channel = f"repository:analysis:progress:{event['jobId']}"
                    await self._redis_client.publish(channel, validated_event.model_dump_json())
                except Exception as ex:
                    self._logger.error(f"Event schema validation failed: {ex}. Dropping event: {event}")

                self._queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                self._logger.exception(f"Exception in UI streaming worker loop: {e}")
                await asyncio.sleep(0.5)

# --- Durable Trace Persistence Helper ---
def persist_trace_logs(job_id: str, debug_mode: bool = False):
    """
    Saves the accumulated log buffer from TraceContext to local files.
    - traces/{jobId}_trace.json : Clean logs (system and info level).
    - traces/{jobId}_debug.json : Heavy telemetry, raw prompts, and tool calls.
    """
    events = TraceContext.get_events_buffer()
    if not events:
        return

    os.makedirs("traces", exist_ok=True)
    
    clean_events = []
    debug_events = []
    
    for ev in events:
        # Separate clean events from debug logs containing prompt context
        meta = ev.get("metadata", {})
        if "debug" in meta or "rawPrompt" in meta or ev.get("eventType") == "debug":
            debug_events.append(ev)
        else:
            clean_events.append(ev)
            debug_events.append(ev) # Debug file has full fidelity trace

    # Write trace
    trace_path = os.path.join("traces", f"{job_id}_trace.json")
    try:
        with open(trace_path, "w", encoding="utf-8") as f:
            json.dump(clean_events, f, indent=2)
    except IOError as e:
        logging.getLogger("observability").error(f"Failed to persist trace logs: {e}")

    # Write debug (if debug mode is enabled, or if we want to save detailed failure trace)
    if debug_mode or any(ev.get("status") == "error" for ev in events):
        debug_path = os.path.join("traces", f"{job_id}_debug.json")
        try:
            with open(debug_path, "w", encoding="utf-8") as f:
                json.dump(debug_events, f, indent=2)
        except IOError as e:
            logging.getLogger("observability").error(f"Failed to persist debug logs: {e}")

import functools

def trace_stage(stage_name: str):
    """
    Decorator to wrap async orchestrator steps in an OpenTelemetry sub-span.
    Automatically logs stage start/end, measures latency, captures errors,
    compiles cumulative cost/token records, and maps variables.
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract jobId and correlationId from arguments
            job_id = kwargs.get("job_id") or (args[1] if len(args) > 1 and isinstance(args[1], str) else None)
            correlation_id = kwargs.get("correlation_id") or kwargs.get("correlationId") or "system"
            
            # Setup context sub-attributes
            TraceContext.set(
                pipeline_stage=stage_name,
                extra={
                    "jobId": job_id,
                    "taskType": stage_name,
                    "correlationId": correlation_id
                }
            )
            
            with span_context(stage_name) as span:
                logger = logging.getLogger(func.__module__)
                logger.info(
                    f"Starting stage {stage_name}",
                    extra={"eventType": "start", "status": "running"}
                )
                
                start_time = time.perf_counter()
                try:
                    result = await func(*args, **kwargs)
                    duration = int((time.perf_counter() - start_time) * 1000)
                    
                    # Accumulate all sub-call executions registered during this stage span
                    executions = TraceContext.get().get("executions", [])
                    task_prompt_tokens = sum(e.get("promptTokens", 0) for e in executions)
                    task_completion_tokens = sum(e.get("completionTokens", 0) for e in executions)
                    task_cache_read = sum(e.get("cacheReadTokens", 0) for e in executions)
                    task_cache_write = sum(e.get("cacheWriteTokens", 0) for e in executions)
                    task_cost = sum(e.get("estimatedCostUsd", 0) for e in executions)
                    
                    # Clear this task's executions to avoid cross-pollution across sibling spans
                    TraceContext.set(executions=[])
                    
                    # Inject telemetry back into dict returns
                    if isinstance(result, dict):
                        result["telemetry"] = {
                            "promptTokens": task_prompt_tokens,
                            "completionTokens": task_completion_tokens,
                            "totalTokens": task_prompt_tokens + task_completion_tokens,
                            "cacheReadTokens": task_cache_read,
                            "cacheWriteTokens": task_cache_write,
                            "estimatedCostUsd": float(task_cost),
                            "durationMs": duration,
                            "modelName": executions[0].get("model") if executions else settings.claude_model,
                            "provider": "Anthropic"
                        }
                    
                    logger.info(
                        f"Completed stage {stage_name} successfully",
                        extra={
                            "eventType": "end",
                            "status": "success",
                            "latencyMs": duration,
                            "tokenUsage": {
                                "input": task_prompt_tokens,
                                "output": task_completion_tokens,
                                "total": task_prompt_tokens + task_completion_tokens,
                                "cacheRead": task_cache_read,
                                "cacheWrite": task_cache_write
                            },
                            "cost": float(task_cost)
                        }
                    )
                    return result
                except Exception as e:
                    duration = int((time.perf_counter() - start_time) * 1000)
                    
                    # Classify exception types
                    err_str = str(e).lower()
                    error_type = "UNKNOWN_EXCEPTION"
                    if "git" in err_str or "clone" in err_str or "directory" in err_str or "repo" in err_str:
                        error_type = "TOOL_FAILURE"
                    elif "json" in err_str or "parse" in err_str or "format" in err_str:
                        error_type = "PARSING_ERROR"
                    elif "timeout" in err_str or "time out" in err_str:
                        error_type = "LLM_TIMEOUT"
                        
                    logger.error(
                        f"Failed stage {stage_name} with error: {e}",
                        exc_info=True,
                        extra={
                            "eventType": "end",
                            "status": "error",
                            "latencyMs": duration,
                            "errorType": error_type
                        }
                    )
                    raise e
        return wrapper
    return decorator

# --- Observability Center Real-Time Forwarder ---
import urllib.request
import threading

class ObservabilityStreamHandler(logging.Handler):
    """
    Asynchronously forwards structured AI log events to CVerify.Core Observability Center.
    """
    def __init__(self, backend_url: str = None):
        super().__init__()
        self.candidate_urls = []
        if os.getenv("CORE_BACKEND_OBSERVABILITY_URL"):
            self.candidate_urls.append(os.getenv("CORE_BACKEND_OBSERVABILITY_URL"))
        base_url = os.getenv("BACKEND_API_URL", "").rstrip("/")
        if base_url:
            self.candidate_urls.append(f"{base_url}/api/v1/admin/observability/logs/ai")
        self.candidate_urls.extend([
            "http://cverify-core:5000/api/v1/admin/observability/logs/ai",
            "http://localhost:5247/api/v1/admin/observability/logs/ai",
            "http://localhost:5000/api/v1/admin/observability/logs/ai"
        ])

    def emit(self, record: logging.LogRecord):
        try:
            ctx = TraceContext.get()
            severity = "INFO"
            if record.levelno >= logging.CRITICAL: severity = "CRITICAL"
            elif record.levelno >= logging.ERROR: severity = "ERROR"
            elif record.levelno >= logging.WARNING: severity = "WARNING"
            elif record.levelno <= logging.DEBUG: severity = "DEBUG"

            payload = {
                "id": uuid.uuid4().hex,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "severity": severity,
                "service": "AI Backend",
                "source": record.name,
                "message": record.getMessage(),
                "traceId": ctx.get("trace_id"),
                "spanId": ctx.get("span_id"),
                "correlationId": ctx.get("extra", {}).get("correlationId"),
                "jobId": ctx.get("extra", {}).get("jobId"),
                "status": getattr(record, "status", None),
                "latencyMs": getattr(record, "latencyMs", None),
                "tokenUsage": getattr(record, "tokenUsage", None),
                "cost": getattr(record, "cost", None)
            }

            # Fire and forget async thread
            threading.Thread(target=self._send, args=(payload,), daemon=True).start()
        except Exception:
            pass

    def _send(self, payload: dict):
        data = json.dumps(payload).encode("utf-8")
        for target_url in self.candidate_urls:
            try:
                req = urllib.request.Request(
                    target_url,
                    data=data,
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=1.5):
                    return
            except Exception:
                continue


def setup_logging():
    """
    Configures the root logger and overrides default uvicorn and fastapi loggers
    to output clean, colored human-readable logs for development, or structured JSON for production.
    """
    # Create the unified stream handler
    handler = logging.StreamHandler()
    if os.getenv("JSON_LOGGING", "false").lower() == "true":
        handler.setFormatter(StructuredJsonFormatter())
    else:
        handler.setFormatter(ConsoleColoredFormatter())
    handler.addFilter(SamplingAndThrottlingFilter())

    obs_handler = ObservabilityStreamHandler()

    # Configure root logger
    root_logger = logging.getLogger()
    for h in root_logger.handlers[:]:
        root_logger.removeHandler(h)
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(handler)
    root_logger.addHandler(obs_handler)

    # Standardize uvicorn, fastapi, and application loggers
    loggers_to_configure = [
        "uvicorn",
        "uvicorn.error",
        "uvicorn.access",
        "fastapi",
        "cverify-ai",
        "claude_service",
        "github_analysis_orchestrator",
        "analysis_router"
    ]
    for logger_name in loggers_to_configure:
        log = logging.getLogger(logger_name)
        log.setLevel(logging.INFO)
        # Clear existing handlers to prevent duplicate or plain text formatting
        for h in log.handlers[:]:
            log.removeHandler(h)
        log.addHandler(handler)
        log.addHandler(obs_handler)
        log.propagate = False

