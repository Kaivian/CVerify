from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Callable, Awaitable
import logging
import inspect
import time
from app.pipelines.candidate.context import PipelineContext, PipelineEvent
from app.pipelines.shared.ai.recovery.policies import TaskRecoveryPolicy
from app.pipelines.shared.ai.recovery.engine import RecoveryEngine
from app.pipelines.shared.ai.recovery.retry_policy import FailureClassifier, FailureCategory

logger = logging.getLogger("candidate_evaluation_task")

class ITask(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        """The identifier of the task (e.g., L2-001)."""
        pass

    @property
    @abstractmethod
    def task_name(self) -> str:
        """The full descriptive name of the task (e.g., SkillTaxonomyMapper)."""
        pass

    @property
    @abstractmethod
    def dependencies(self) -> List[str]:
        """Keys or task IDs that this task depends on."""
        pass

    @property
    @abstractmethod
    def input_keys(self) -> List[str]:
        """Keys from PipelineContext that this task requires."""
        pass

    @property
    @abstractmethod
    def output_keys(self) -> List[str]:
        """Keys that this task will populate in PipelineContext."""
        pass

    @property
    def recovery_policy(self) -> TaskRecoveryPolicy:
        """Operational boundary recovery policy for this task."""
        return TaskRecoveryPolicy.FULL_REPAIR_ALLOWED

    @abstractmethod
    async def run(
        self,
        context: PipelineContext,
        correlation_id: str,
        event_callback: Optional[Callable[[PipelineEvent], Awaitable[None]]] = None
    ) -> PipelineContext:
        """Executes the task logic and returns an updated immutable context."""
        pass


class BaseTask(ITask):
    @property
    def dependencies(self) -> List[str]:
        return []

    @property
    def recovery_policy(self) -> TaskRecoveryPolicy:
        return TaskRecoveryPolicy.FULL_REPAIR_ALLOWED

    async def run(
        self,
        context: PipelineContext,
        correlation_id: str,
        event_callback: Optional[Callable[[PipelineEvent], Awaitable[None]]] = None
    ) -> PipelineContext:
        logger.info(f"Executing task {self.name} ({self.task_name}) under policy {self.recovery_policy.value}")
        start_time = time.time()
        
        # 1. Emit TASK_STARTED
        if event_callback:
            try:
                await event_callback(PipelineEvent(
                    eventType="TASK_STARTED",
                    timestamp=time.time(),
                    correlationId=correlation_id,
                    taskId=self.name,
                    payload={"taskName": self.task_name, "recoveryPolicy": self.recovery_policy.value},
                    stateSnapshot={
                        "partialScore": context.candidateScore or context.calibratedScore or 0.0,
                        "estimatedLevel": context.finalLevel or context.calibratedLevel or "L1"
                    }
                ))
            except Exception as ex:
                logger.warning(f"Failed to emit TASK_STARTED callback: {ex}")
                
        # Get pre-execution LLM call count
        from app.core.monitoring.ai_cost_tracker import AiCostTracker
        cost_tracker = AiCostTracker()
        pre_count = len(cost_tracker._executions.get(correlation_id, []))

        try:
            # Check if internal execution method supports the event callback
            sig = inspect.signature(self._execute_internal)
            if "event_callback" in sig.parameters or len(sig.parameters) >= 3:
                updates = await self._execute_internal(context, correlation_id, event_callback)
            else:
                updates = await self._execute_internal(context, correlation_id)
                
            # Validate output keys
            missing_keys = [k for k in self.output_keys if k not in updates or updates[k] is None]
            
            if missing_keys:
                logger.warning(f"Task {self.name} output missing keys: {missing_keys}. Attempting self-healing recovery...")
                if event_callback:
                    try:
                        await event_callback(PipelineEvent(
                            eventType="TASK_RECOVERING",
                            timestamp=time.time(),
                            correlationId=correlation_id,
                            taskId=self.name,
                            payload={"missingKeys": missing_keys, "policy": self.recovery_policy.value}
                        ))
                    except Exception as ex:
                        logger.warning(f"Failed to emit TASK_RECOVERING callback: {ex}")

                # Attempt self-healing via RecoveryEngine
                recovery_engine = RecoveryEngine(
                    audit_logger=getattr(context, "_audit_logger", None),
                    circuit_breaker=getattr(context, "_circuit_breaker", None)
                )
                raw_str = str(updates)
                from app.pipelines.shared.ai.validation.validator import ValidationResult
                val_res = ValidationResult(is_valid=False, data=updates, errors=[f"Missing key: {k}" for k in missing_keys], raw_text=raw_str)
                
                healed_data, audit_entry = await recovery_engine.attempt_recovery(
                    raw_text=raw_str,
                    validation_result=val_res,
                    output_keys=self.output_keys,
                    task_id=self.name,
                    task_name=self.task_name,
                    policy=self.recovery_policy,
                    context=context,
                    correlation_id=correlation_id
                )

                if healed_data:
                    updates = healed_data
                    logger.info(f"Task {self.name} self-healing succeeded.")
                    if event_callback:
                        try:
                            await event_callback(PipelineEvent(
                                eventType="TASK_REPAIRED",
                                timestamp=time.time(),
                                correlationId=correlation_id,
                                taskId=self.name,
                                payload={"auditEntry": audit_entry.model_dump() if audit_entry else {}}
                            ))
                        except Exception as ex:
                            logger.warning(f"Failed to emit TASK_REPAIRED callback: {ex}")

            # Filter out extra keys
            extra_keys = set(updates.keys()) - set(self.output_keys)
            if extra_keys:
                logger.warning(
                    f"Task {self.name} ({self.task_name}) produced output keys outside its declared output_keys: {list(extra_keys)}. "
                    f"These fields will be filtered out to prevent context corruption."
                )

            filtered_updates = {}
            for k in self.output_keys:
                filtered_updates[k] = updates.get(k, None)
                    
            updated_context = context.update(**filtered_updates)
            duration_ms = (time.time() - start_time) * 1000.0
            
            # Retrieve LLM calls made during this task run
            post_executions = cost_tracker._executions.get(correlation_id, [])[pre_count:]
            
            # Aggregate telemetry
            telemetry = None
            if post_executions:
                total_in = sum(ex.get("promptTokens", 0) for ex in post_executions)
                total_out = sum(ex.get("completionTokens", 0) for ex in post_executions)
                total_cost = sum(ex.get("estimatedCostUsd", 0.0) for ex in post_executions)
                last_ex = post_executions[-1]
                telemetry = {
                    "promptTokens": total_in,
                    "completionTokens": total_out,
                    "totalTokens": total_in + total_out,
                    "estimatedCostUsd": float(total_cost),
                    "modelName": last_ex.get("model", "unknown"),
                    "provider": last_ex.get("provider", "Anthropic"),
                    "durationMs": round(duration_ms, 2)
                }
            
            # 2. Emit TASK_COMPLETED
            if event_callback:
                try:
                    payload = {"durationMs": round(duration_ms, 2)}
                    if telemetry:
                        payload.update(telemetry)
                        
                    await event_callback(PipelineEvent(
                        eventType="TASK_COMPLETED",
                        timestamp=time.time(),
                        correlationId=correlation_id,
                        taskId=self.name,
                        payload=payload,
                        stateSnapshot={
                            "partialScore": updated_context.candidateScore or updated_context.calibratedScore or 0.0,
                            "estimatedLevel": updated_context.finalLevel or updated_context.calibratedLevel or "L1"
                        }
                    ))
                except Exception as ex:
                    logger.warning(f"Failed to emit TASK_COMPLETED callback: {ex}")
            
            self.last_telemetry = telemetry
            return updated_context
            
        except Exception as e:
            logger.exception(f"Error running task {self.name} ({self.task_name}): {e}")
            if event_callback:
                try:
                    await event_callback(PipelineEvent(
                        eventType="TASK_FAILED",
                        timestamp=time.time(),
                        correlationId=correlation_id,
                        taskId=self.name,
                        payload={"errorMessage": str(e), "policy": self.recovery_policy.value},
                        stateSnapshot={
                            "partialScore": context.candidateScore or context.calibratedScore or 0.0,
                            "estimatedLevel": context.finalLevel or context.calibratedLevel or "L1"
                        }
                    ))
                except Exception as ex:
                    logger.warning(f"Failed to emit TASK_FAILED callback: {ex}")
            raise e

    @abstractmethod
    async def _execute_internal(self, context: PipelineContext, correlation_id: str) -> Dict[str, Any]:
        """Internal execution method that returns a dictionary of state updates."""
        pass
