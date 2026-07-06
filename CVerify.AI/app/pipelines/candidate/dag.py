import logging
from typing import List, Dict, Any, Set
from app.pipelines.candidate.base_task import ITask
from app.pipelines.candidate.context import PipelineContext

logger = logging.getLogger("pipeline_dag")

class PipelineValidationError(Exception):
    pass

# Non-task consumers at system boundaries (streaming SSE response, DB persistence models)
EXTERNAL_CONSUMERS: Dict[str, Set[str]] = {
    "ClientStreamResponse": {
        "overallStrengthSummary", "estimatedLevel", "estimatedLevelLabel", "levelRationale",
        "calibratedLevelLabel", "confidenceInLevel", "isBoundaryCase", "calibrationNotes",
        "gatePassed", "finalScore", "gateViolations", "gateRationale",
        "engineeringMaturityScore", "maturityLevel", "maturitySignals",
        "avgTimeToFixDays", "rootCauseFixRatio", "recurrenceRate", "complexBugHandling", "problemSolvingPatterns",
        "primaryConfidence", "tendencySummary", "_hybridSource", "_ruleBasedPrimary",
        "styleConfidence", "styleDistribution", "workingStyleSummary", "_ruleBasedStyle",
        "totalExperienceYears", "hasLeadershipExperience", "multiplierRationale",
        "skillDepthScore", "ownershipScore", "architectureScore", "impactScore", "problemSolvingScore",
        "candidateProfile", "improvementPlan", "skillTree"
    },
    "DatabaseProjection": {
        "candidateScore", "finalLevel", "finalLevelLabel", "primaryTendency", "primaryWorkingStyle",
        "recruiterHeadline", "fullSummary", "professionalBio", "keyStrengths", "watchPoints",
        "technicalDepth", "technicalBreadth", "leadershipPotential", "executionStrength", "trustLevel"
    }
}


class PipelineDAG:
    def __init__(self, tasks: List[ITask]):
        self.tasks: Dict[str, ITask] = {task.name: task for task in tasks}
        self.adjacency_list: Dict[str, List[str]] = {t.name: [] for t in tasks}
        self.in_degree: Dict[str, int] = {t.name: 0 for t in tasks}
        self._build_graph()

    def _build_graph(self):
        for task_name, task in self.tasks.items():
            for dep in task.dependencies:
                # Check if dependency exists in our registered task list
                if dep not in self.tasks:
                    raise PipelineValidationError(
                        f"Task '{task_name}' ({task.task_name}) depends on unregistered task ID: '{dep}'."
                    )
                self.adjacency_list[dep].append(task_name)
                self.in_degree[task_name] += 1

    def validate(self):
        """Runs compile-time checks on the graph topology and schema compatibility."""
        # 1. Topological Sorting (Cycle Detection)
        in_degree_copy = self.in_degree.copy()
        queue = [t for t, degree in in_degree_copy.items() if degree == 0]
        topo_order = []
        
        while queue:
            node = queue.pop(0)
            topo_order.append(node)
            for neighbor in self.adjacency_list[node]:
                in_degree_copy[neighbor] -= 1
                if in_degree_copy[neighbor] == 0:
                    queue.append(neighbor)
                    
        if len(topo_order) != len(self.tasks):
            cyclic_nodes = [t for t, degree in in_degree_copy.items() if degree > 0]
            raise PipelineValidationError(
                f"Circular dependency detected in Pipeline 2 graph. Cyclic tasks: {cyclic_nodes}"
            )

        # 2. Schema Compatibility Verification
        context_fields = set(PipelineContext.model_fields.keys()) | {
            "_hybridSource", "_ruleBasedPrimary", "_ruleBasedStyle"
        }
        
        # Verify inputs and outputs are defined in PipelineContext schema
        for task_name, task in self.tasks.items():
            for key in task.input_keys:
                if key not in context_fields:
                    raise PipelineValidationError(
                        f"Task '{task_name}' ({task.task_name}) requires input key '{key}' which is missing from PipelineContext schema."
                    )
            for key in task.output_keys:
                if key not in context_fields:
                    raise PipelineValidationError(
                        f"Task '{task_name}' ({task.task_name}) declares output key '{key}' which is missing from PipelineContext schema."
                    )

        # 3. Unused Output Scan (explicitly modeling non-task consumers)
        used_inputs: Set[str] = set()
        for task in self.tasks.values():
            for key in task.input_keys:
                used_inputs.add(key)
                
        # Accumulate all keys consumed by non-task external consumers
        external_consumed_keys: Set[str] = set()
        for keys in EXTERNAL_CONSUMERS.values():
            external_consumed_keys.update(keys)

        for task_name, task in self.tasks.items():
            unused = [key for key in task.output_keys if key not in used_inputs and key not in external_consumed_keys]
            if unused:
                logger.warning(
                    f"Compile-time Warning: Task '{task_name}' ({task.task_name}) produces unused outputs: {unused}"
                )

        logger.info("Pipeline 2 graph compilation and schema validation completed successfully.")
        return topo_order
