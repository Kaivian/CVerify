import pytest
import uuid
import time
from typing import List, Dict, Any

# Simulated State Machine and Event Store logic matching frontend use-streaming-store contract

VALID_SESSION_TRANSITIONS = {
    "Pending": {"Running", "Connecting"},
    "Connecting": {"Running", "Pending"},
    "Running": {"Completed", "Failed", "Cancelled"},
    "Completed": set(),
    "Failed": set(),
    "Cancelled": set(),
}

VALID_STAGE_TRANSITIONS = {
    "Pending": {"Running", "Completed", "Failed", "Skipped"},
    "Running": {"Completed", "Failed", "Skipped"},
    "Completed": set(),
    "Failed": {"Running"},  # Retry only
    "Skipped": {"Running"},  # Retry only
}

class StreamingStateMachineSimulator:
    def __init__(self, session_id: str, pipeline_id: str, stage_ids: List[str]):
        self.session_id = session_id
        self.pipeline_id = pipeline_id
        self.session_status = "Pending"
        self.stages = {sid: {"status": "Pending", "progress": 0, "completedAt": None} for sid in stage_ids}
        self.processed_event_ids = set()
        self.last_sequence_number = 0
        self.logs = []

    def can_transition_session(self, target: str) -> bool:
        if self.session_status == target:
            return True
        allowed = VALID_SESSION_TRANSITIONS.get(self.session_status, set())
        return target in allowed

    def can_transition_stage(self, stage_id: str, target: str, is_retry: bool = False) -> bool:
        current = self.stages[stage_id]["status"]
        if current == target:
            return True
        if is_retry and current in {"Failed", "Skipped"} and target == "Running":
            return True
        allowed = VALID_STAGE_TRANSITIONS.get(current, set())
        return target in allowed

    def process_event(self, event: Dict[str, Any]) -> bool:
        event_id = event.get("eventId")
        seq_num = event.get("sequenceNumber", 0)

        # Idempotency & sequence check
        if event_id and event_id in self.processed_event_ids:
            return False
        if seq_num > 0 and seq_num <= self.last_sequence_number:
            return False

        if event_id:
            self.processed_event_ids.add(event_id)
        if seq_num > 0:
            self.last_sequence_number = seq_num

        # Session transition check
        new_session_status = event.get("status")
        is_stage_event = event.get("eventType", "").startswith("STAGE_") or event.get("eventType") == "LOG_EVENT"
        
        if new_session_status and not is_stage_event:
            if self.can_transition_session(new_session_status):
                self.session_status = new_session_status

        # Stage transition check
        stage_id = event.get("stageId")
        if stage_id and stage_id in self.stages:
            stage_event_type = event.get("eventType")
            target_status = self.stages[stage_id]["status"]

            if stage_event_type == "STAGE_COMPLETED":
                target_status = "Completed"
            elif stage_event_type == "STAGE_FAILED":
                target_status = "Failed"
            elif stage_event_type == "STAGE_STARTED":
                target_status = "Running"
            elif event.get("stageStatus"):
                target_status = event["stageStatus"]
            elif self.stages[stage_id]["status"] == "Pending" and (stage_event_type == "STAGE_PROGRESS" or event.get("stageProgress", 0) > 0):
                target_status = "Running"

            is_retry = event.get("isRetry", False)
            if self.can_transition_stage(stage_id, target_status, is_retry):
                self.stages[stage_id]["status"] = target_status
                if target_status == "Completed":
                    self.stages[stage_id]["completedAt"] = time.time()
                if "stageProgress" in event:
                    self.stages[stage_id]["progress"] = event["stageProgress"]

        if event.get("message"):
            self.logs.append(event["message"])

        return True


# Test Cases

def test_session_state_machine_valid_transitions():
    sim = StreamingStateMachineSimulator("sess-1", "repo-analysis", ["Stage1", "Stage2"])
    assert sim.session_status == "Pending"
    
    assert sim.can_transition_session("Running") is True
    assert sim.process_event({"eventId": "e1", "sequenceNumber": 1, "status": "Running", "eventType": "SESSION_STARTED"}) is True
    assert sim.session_status == "Running"

    assert sim.can_transition_session("Completed") is True
    assert sim.process_event({"eventId": "e2", "sequenceNumber": 2, "status": "Completed", "eventType": "SESSION_COMPLETED"}) is True
    assert sim.session_status == "Completed"

    # Terminal state block
    assert sim.can_transition_session("Running") is False
    sim.process_event({"eventId": "e3", "sequenceNumber": 3, "status": "Running", "eventType": "SESSION_STARTED"})
    assert sim.session_status == "Completed"  # Must remain Completed


def test_stage_state_machine_prevents_leap_to_completed():
    sim = StreamingStateMachineSimulator("sess-2", "repo-analysis", ["TaskA", "TaskB"])
    
    # TaskA starts
    sim.process_event({"eventId": "e1", "sequenceNumber": 1, "stageId": "TaskA", "eventType": "STAGE_STARTED"})
    assert sim.stages["TaskA"]["status"] == "Running"
    assert sim.stages["TaskB"]["status"] == "Pending"

    # Event for TaskB progress must NOT auto-complete TaskA
    sim.process_event({"eventId": "e2", "sequenceNumber": 2, "stageId": "TaskB", "eventType": "STAGE_PROGRESS", "stageProgress": 50})
    assert sim.stages["TaskA"]["status"] == "Running"  # Must remain Running, not auto-completed!
    assert sim.stages["TaskB"]["status"] == "Running"


def test_out_of_order_sequence_rejection():
    sim = StreamingStateMachineSimulator("sess-3", "repo-analysis", ["TaskA"])
    
    # Send seq 1
    assert sim.process_event({"eventId": "e1", "sequenceNumber": 1, "stageId": "TaskA", "eventType": "STAGE_STARTED"}) is True
    # Send seq 3
    assert sim.process_event({"eventId": "e3", "sequenceNumber": 3, "stageId": "TaskA", "eventType": "STAGE_COMPLETED"}) is True
    assert sim.stages["TaskA"]["status"] == "Completed"

    # Delayed seq 2 arrives late -> Must be rejected by sequence check
    assert sim.process_event({"eventId": "e2", "sequenceNumber": 2, "stageId": "TaskA", "eventType": "STAGE_PROGRESS", "stageProgress": 50}) is False
    assert sim.stages["TaskA"]["status"] == "Completed"  # Must stay Completed, not regress to Running!


def test_duplicate_event_deduplication():
    sim = StreamingStateMachineSimulator("sess-4", "repo-analysis", ["TaskA"])
    
    evt = {"eventId": "unique-uuid-100", "sequenceNumber": 1, "stageId": "TaskA", "eventType": "STAGE_STARTED"}
    assert sim.process_event(evt) is True
    assert sim.process_event(evt) is False  # Duplicate eventId rejected!


def test_retry_failed_stage_transition():
    sim = StreamingStateMachineSimulator("sess-5", "repo-analysis", ["TaskA"])
    
    sim.process_event({"eventId": "e1", "sequenceNumber": 1, "stageId": "TaskA", "eventType": "STAGE_STARTED"})
    sim.process_event({"eventId": "e2", "sequenceNumber": 2, "stageId": "TaskA", "eventType": "STAGE_FAILED"})
    assert sim.stages["TaskA"]["status"] == "Failed"

    # Retry transition
    sim.process_event({"eventId": "e3", "sequenceNumber": 3, "stageId": "TaskA", "eventType": "STAGE_STARTED", "isRetry": True})
    assert sim.stages["TaskA"]["status"] == "Running"
