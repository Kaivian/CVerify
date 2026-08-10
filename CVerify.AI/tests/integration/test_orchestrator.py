import pytest
from app.pipelines.candidate.orchestrator import CandidateEvaluationOrchestrator
from app.pipelines.candidate.context import PipelineContext

def test_orchestrator_dag_compilation():
    """Verify that the orchestrator compiles the DAG and sorts dependencies correctly."""
    orchestrator = CandidateEvaluationOrchestrator()
    dag = orchestrator._dag
    
    # 1. Compile/verify DAG cycles via validate()
    try:
        execution_order = dag.validate()
    except Exception as e:
        pytest.fail(f"DAG validation failed with cycle or sorting error: {e}")
        
    # 2. Check topological ordering constraints
    # Verify that L2-014 (composer) is executed AFTER L2-016 (SkillTreeGenerator)
    idx_composer = execution_order.index("L2-014")
    idx_skill_tree = execution_order.index("L2-016")
    assert idx_composer > idx_skill_tree, "Composer must execute after SkillTreeGenerator"
    
    # Verify that L2-015 (improvement engine) executes after L2-014 (composer)
    idx_improvement = execution_order.index("L2-015")
    assert idx_improvement > idx_composer, "Improvement engine must execute after Composer"
    
    # Verify that L2-006 (CareerLevelGate) executes after L2-005 (calibrator) and L2-004 (mapper)
    idx_gate = execution_order.index("L2-006")
    idx_mapper = execution_order.index("L2-004")
    idx_cal = execution_order.index("L2-005")
    assert idx_gate > idx_mapper
    assert idx_gate > idx_cal

def test_orchestrator_dag_outputs_check():
    """Verify that each task declares valid inputs and outputs that map cleanly."""
    orchestrator = CandidateEvaluationOrchestrator()
    dag = orchestrator._dag
    
    # Verify that all tasks exist in the task map
    for task_id in dag.tasks.keys():
        task = dag.tasks[task_id]
        assert task.name == task_id
        assert isinstance(task.dependencies, list)
        assert isinstance(task.input_keys, list)
        assert isinstance(task.output_keys, list)
