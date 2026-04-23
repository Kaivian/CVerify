import json
import logging
import asyncio
import os
import unittest
from app.monitoring.observability import (
    TraceContext,
    span_context,
    StructuredJsonFormatter,
    ConsoleColoredFormatter,
    SamplingAndThrottlingFilter,
    sanitize_sensitive_data,
    UIProgressEvent
)
from app.monitoring.ai_cost_tracker import AiCostTracker

class TestObservabilityCore(unittest.IsolatedAsyncioTestCase):
    async def test_trace_context_propagation(self):
        """Verify trace context contextvars propagate and reset properly."""
        TraceContext.clear()
        self.assertEqual(TraceContext.get(), {})

        TraceContext.set(trace_id="test-trace-123", extra={"jobId": "job-abc"})
        self.assertEqual(TraceContext.get()["trace_id"], "test-trace-123")
        self.assertEqual(TraceContext.get()["extra"]["jobId"], "job-abc")

        # Test parent-child nesting
        with span_context("SUB_STAGE") as child:
            self.assertEqual(child["trace_id"], "test-trace-123")
            self.assertEqual(child["pipeline_stage"], "SUB_STAGE")
            self.assertIsNone(child["parent_span_id"]) # First span parent is None or previous
            self.assertEqual(len(child["span_id"]), 16) # OTEL style spanId length

            with span_context("NESTED_SUB_STAGE") as nested:
                self.assertEqual(nested["trace_id"], "test-trace-123")
                self.assertEqual(nested["pipeline_stage"], "NESTED_SUB_STAGE")
                self.assertEqual(nested["parent_span_id"], child["span_id"])

        # Verify context resets
        self.assertEqual(TraceContext.get()["trace_id"], "test-trace-123")
        self.assertIsNone(TraceContext.get().get("pipeline_stage"))

    def test_sensitive_data_masking(self):
        """Verify sensitive variables, access keys, and bearer tokens are redacted."""
        raw_payload = {
            "candidate_email": "candidate@cverify.com",
            "api_key": "sk-ant-abc123xyz789foo456bar789baz123",
            "password": "super-secret-password-123",
            "nested": {
                "token": "ghp_somegitkey12345"
            },
            "safe_field": "public-repo-name"
        }

        sanitized = sanitize_sensitive_data(raw_payload)

        self.assertEqual(sanitized["candidate_email"], "******")
        self.assertEqual(sanitized["api_key"], "******")
        self.assertEqual(sanitized["password"], "******")
        self.assertEqual(sanitized["nested"]["token"], "******")
        self.assertEqual(sanitized["safe_field"], "public-repo-name")

        # Test string substitutions
        raw_str = "Connecting using bearer ghp_12345abcde to download code."
        self.assertIn("Bearer ******", sanitize_sensitive_data(raw_str))

        anthropic_key_log = "API Call sk-ant-abcdefghijklmnopqrstuvwxyz01234567890123 initiated"
        self.assertIn("sk-ant-******", sanitize_sensitive_data(anthropic_key_log))

    def test_structured_json_formatter(self):
        """Verify formatted log records produce compliant structured JSON schema."""
        TraceContext.clear()
        TraceContext.set(
            trace_id="trace-abc",
            span_id="span-1",
            parent_span_id="parent-0",
            pipeline_stage="TEST_PIPELINE",
            extra={"jobId": "job-1", "taskType": "TestTask", "secret_var": "private_data"}
        )

        formatter = StructuredJsonFormatter()
        record = logging.LogRecord(
            name="test_logger",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="Task started successfully.",
            args=(),
            exc_info=None
        )
        
        # Add dummy attributes representing performance and billing telemetry
        record.latencyMs = 250.50
        record.tokenUsage = {"input": 100, "output": 50, "cacheRead": 20}
        record.cost = 0.0012

        formatted_str = formatter.format(record)
        log_json = json.loads(formatted_str)

        self.assertEqual(log_json["trace_id"], "trace-abc")
        self.assertEqual(log_json["span_id"], "span-1")
        self.assertEqual(log_json["parent_span_id"], "parent-0")
        self.assertEqual(log_json["pipelineStage"], "TEST_PIPELINE")
        self.assertEqual(log_json["message"], "Task started successfully.")
        self.assertEqual(log_json["status"], "success")
        self.assertEqual(log_json["latencyMs"], 250.50)
        self.assertEqual(log_json["tokenUsage"]["input"], 100)
        self.assertEqual(log_json["cost"], 0.0012)

        # Verify metadata is present and sensitive details are masked
        self.assertEqual(log_json["metadata"]["jobId"], "job-1")
        self.assertEqual(log_json["metadata"]["taskType"], "TestTask")
        self.assertEqual(log_json["metadata"]["secret_var"], "******")

    def test_console_colored_formatter(self):
        """Verify ConsoleColoredFormatter produces clean, colored output while recording identical telemetry."""
        TraceContext.clear()
        TraceContext.set(
            trace_id="trace-abc",
            span_id="span-1",
            parent_span_id="parent-0",
            pipeline_stage="TEST_PIPELINE",
            extra={"jobId": "job-1", "taskType": "TestTask", "secret_var": "private_data"}
        )

        formatter = ConsoleColoredFormatter()
        record = logging.LogRecord(
            name="test_logger",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="Task started successfully.",
            args=(),
            exc_info=None
        )
        
        record.latencyMs = 250.50
        record.tokenUsage = {"input": 100, "output": 50, "cacheRead": 20}
        record.cost = 0.0012

        formatted_str = formatter.format(record)

        # Assert format matches clean colored pattern containing stage, message, metrics, and trace short
        self.assertIn("[TEST_PIPELINE]", formatted_str)
        self.assertIn("Task started successfully.", formatted_str)
        self.assertIn("latency=250.5ms", formatted_str)
        self.assertIn("cost=$0.0012", formatted_str)
        self.assertIn("tokens=(100i/50o)", formatted_str)
        self.assertIn("(t:trace-ab)", formatted_str)
        
        # Verify TraceContext.events_buffer was populated identically to structured JSON formatter
        events = TraceContext.get_events_buffer()
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["trace_id"], "trace-abc")
        self.assertEqual(events[0]["latencyMs"], 250.50)
        self.assertEqual(events[0]["metadata"]["secret_var"], "******")

    def test_cost_tracker_billing_details(self):
        """Verify cost tracker compiles detailed retry and tool accounting registers."""
        tracker = AiCostTracker()
        correlation_id = "job-cost-correlation-id"
        tracker.clear_executions(correlation_id)

        # Record first model execution
        tracker.record_execution(
            correlation_id=correlation_id,
            model="claude-3-5-sonnet-20241022",
            execution_type="llm_call",
            input_tokens=1000,
            output_tokens=500,
            cache_creation_tokens=500,
            cache_read_tokens=0,
            duration_ms=1200
        )

        # Record a tool retry attempt
        tracker.record_execution(
            correlation_id=correlation_id,
            model="claude-3-5-sonnet-20241022",
            execution_type="retry_attempt",
            input_tokens=1200,
            output_tokens=100,
            cache_creation_tokens=0,
            cache_read_tokens=1000,
            duration_ms=800
        )

        executions = tracker.get_executions(correlation_id)
        self.assertEqual(len(executions), 2)
        self.assertEqual(executions[0]["executionType"], "llm_call")
        self.assertEqual(executions[1]["executionType"], "retry_attempt")
        self.assertEqual(executions[0]["promptTokens"], 1000)
        self.assertEqual(executions[1]["cacheReadTokens"], 1000)
        self.assertGreater(executions[0]["estimatedCostUsd"], 0)
        self.assertGreater(executions[1]["estimatedCostUsd"], 0)

    def test_ui_progress_schema_validation(self):
        """Verify UI progress events conform to versioned Pydantic schemas."""
        # Complete valid payload
        event_data = {
            "jobId": "job-123",
            "taskType": "CommitIntelligence",
            "taskStatus": "Running",
            "level": "Info",
            "message": "Auditing commits",
            "progress": 50.0,
            "tokenChunk": "token text"
        }

        event = UIProgressEvent(**event_data)
        self.assertEqual(event.jobId, "job-123")
        self.assertEqual(event.progress, 50.0)
        self.assertFalse(event.isFinal)
        self.assertTrue(event.timestamp.endswith("Z"))

        # Invalid payload check
        invalid_data = {
            "jobId": "job-123",
            "taskType": "CommitIntelligence"
            # Missing required taskStatus and message
        }
        with self.assertRaises(ValueError):
            UIProgressEvent(**invalid_data)

if __name__ == "__main__":
    unittest.main()
