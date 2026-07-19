import pytest
from app.pipelines.candidate.dag import PipelineDAG
from app.pipelines.candidate.base_task import BaseTask

class TaskA(BaseTask):
    @property
    def name(self) -> str: return "A"
    @property
    def task_name(self) -> str: return "Task A"
    @property
    def output_keys(self) -> list: return ["cvSkills"]
    @property
    def input_keys(self) -> list: return ["cv"]
    async def _execute_internal(self, context, correlation_id): return {}

class TaskB(BaseTask):
    @property
    def name(self) -> str: return "B"
    @property
    def task_name(self) -> str: return "Task B"
    @property
    def dependencies(self) -> list: return ["A"]
    @property
    def output_keys(self) -> list: return ["mappedSkills"]
    @property
    def input_keys(self) -> list: return ["cvSkills"]
    async def _execute_internal(self, context, correlation_id): return {}

class TaskC(BaseTask):
    @property
    def name(self) -> str: return "C"
    @property
    def task_name(self) -> str: return "Task C"
    @property
    def output_keys(self) -> list: return ["skillDepthScore"]
    @property
    def input_keys(self) -> list: return ["cv"]
    async def _execute_internal(self, context, correlation_id): return {}

def test_dag_downstream_dependents():
    dag = PipelineDAG([TaskA(), TaskB(), TaskC()])
    deps = dag.get_downstream_dependents("A")
    assert "B" in deps
    assert "C" not in deps

def test_dag_compute_pipeline_status():
    dag = PipelineDAG([TaskA(), TaskB(), TaskC()])
    
    # All tasks completed -> Completed
    status1 = dag.compute_pipeline_status({"A": "COMPLETED", "B": "COMPLETED", "C": "COMPLETED"})
    assert status1 == "Completed"

    # Task A failed, Task B skipped, Task C completed -> CompletedWithWarnings
    status2 = dag.compute_pipeline_status({"A": "FAILED", "B": "SKIPPED", "C": "COMPLETED"})
    assert status2 == "CompletedWithWarnings"
