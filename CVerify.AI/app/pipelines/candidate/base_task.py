from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Callable, Awaitable
import logging
import inspect
import time
from app.pipelines.candidate.context import PipelineContext, PipelineEvent

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

    async def run(
        self,
        context: PipelineContext,
        correlation_id: str,
        event_callback: Optional[Callable[[PipelineEvent], Awaitable[None]]] = None
    ) -> PipelineContext:
        logger.info(f"Executing task {self.name} ({self.task_name})")
        start_time = time.time()
        
        # 1. Emit TASK_STARTED
        if event_callback:
            try:
                await event_callback(PipelineEvent(
                    eventType="TASK_STARTED",
                    timestamp=time.time(),
                    correlationId=correlation_id,
                    taskId=self.name,
                    payload={"taskName": self.task_name},
                    stateSnapshot={
                        "partialScore": context.candidateScore or context.calibratedScore or 0.0,
                        "estimatedLevel": context.finalLevel or context.calibratedLevel or "L1"
                    }
                ))
            except Exception as ex:
                logger.warning(f"Failed to emit TASK_STARTED callback: {ex}")
                
        try:
            # Check if internal execution method supports the event callback
            sig = inspect.signature(self._execute_internal)
            if "event_callback" in sig.parameters or len(sig.parameters) >= 3:
                updates = await self._execute_internal(context, correlation_id, event_callback)
            else:
                updates = await self._execute_internal(context, correlation_id)
                
            # Detect output keys outside declared output_keys contract
            extra_keys = set(updates.keys()) - set(self.output_keys)
            if extra_keys:
                logger.warning(
                    f"Task {self.name} ({self.task_name}) produced output keys outside its declared output_keys: {list(extra_keys)}. "
                    f"These fields will be filtered out to prevent context corruption.",
                    extra={"task_id": self.name, "task_name": self.task_name, "extra_keys": list(extra_keys)}
                )

            # Enforce that all declared output keys are populated, filtering out undeclared ones
            filtered_updates = {}
            for k in self.output_keys:
                if k not in updates:
                    logger.warning(f"Task {self.name} failed to return output key: {k}. Setting to None.")
                    filtered_updates[k] = None
                else:
                    filtered_updates[k] = updates[k]
                    
            updated_context = context.update(**filtered_updates)
            duration_ms = (time.time() - start_time) * 1000.0
            
            # 2. Emit TASK_COMPLETED
            if event_callback:
                try:
                    await event_callback(PipelineEvent(
                        eventType="TASK_COMPLETED",
                        timestamp=time.time(),
                        correlationId=correlation_id,
                        taskId=self.name,
                        payload={"durationMs": round(duration_ms, 2)},
                        stateSnapshot={
                            "partialScore": updated_context.candidateScore or updated_context.calibratedScore or 0.0,
                            "estimatedLevel": updated_context.finalLevel or updated_context.calibratedLevel or "L1"
                        }
                    ))
                except Exception as ex:
                    logger.warning(f"Failed to emit TASK_COMPLETED callback: {ex}")
            return updated_context
            
        except Exception as e:
            logger.exception(f"Error running task {self.name} ({self.task_name}): {e}")
            # Emit TASK_FAILED
            if event_callback:
                try:
                    await event_callback(PipelineEvent(
                        eventType="TASK_FAILED",
                        timestamp=time.time(),
                        correlationId=correlation_id,
                        taskId=self.name,
                        payload={"errorMessage": str(e)},
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
