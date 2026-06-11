import json
import logging
import asyncio
import os
import unittest
from app.core.monitoring.observability import (
    TraceContext,
    span_context,
    StructuredJsonFormatter,
    ConsoleColoredFormatter,
    SamplingAndThrottlingFilter,
    sanitize_sensitive_data,
    UIProgressEvent
)
from app.core.monitoring.ai_cost_tracker import AiCostTracker
from app.core.services.token_accounting_service import TokenAccountingService, NormalizedTokenUsage

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


class TestTokenAccounting(unittest.TestCase):
    def test_anthropic_extraction(self):
        """Verify extraction from Anthropic and standard usage objects."""
        # Mock usage object with Anthropic input/output tokens
        class MockAnthropicUsage:
            def __init__(self, input_tokens, output_tokens):
                self.input_tokens = input_tokens
                self.output_tokens = output_tokens

        usage = MockAnthropicUsage(input_tokens=150, output_tokens=75)
        prompt, completion, total = TokenAccountingService.extract_from_provider_usage(usage)
        self.assertEqual(prompt, 150)
        self.assertEqual(completion, 75)
        self.assertIsNone(total)

        # Mock standard OpenAI-like usage object
        class MockOpenAIUsage:
            def __init__(self, prompt_tokens, completion_tokens, total_tokens):
                self.prompt_tokens = prompt_tokens
                self.completion_tokens = completion_tokens
                self.total_tokens = total_tokens

        usage_std = MockOpenAIUsage(prompt_tokens=200, completion_tokens=100, total_tokens=300)
        prompt, completion, total = TokenAccountingService.extract_from_provider_usage(usage_std)
        self.assertEqual(prompt, 200)
        self.assertEqual(completion, 100)
        self.assertEqual(total, 300)

    def test_normalization_and_cost_calculation(self):
        """Verify normalization, cost calculation, and mismatch detection."""
        # 1. Normalization with matching total tokens
        usage = TokenAccountingService.normalize_usage(
            model="claude-3-5-sonnet-20241022",
            prompt_tokens=1000,
            completion_tokens=500,
            total_tokens=1500,
            cache_creation_tokens=200,
            cache_read_tokens=300
        )
        self.assertEqual(usage.prompt_tokens, 1000)
        self.assertEqual(usage.completion_tokens, 500)
        self.assertEqual(usage.total_tokens, 1500)
        self.assertEqual(usage.cache_read_tokens, 300)
        self.assertEqual(usage.cache_write_tokens, 200)
        self.assertFalse(usage.token_mismatch_detected)

        # Check Claude 3.5 Sonnet cost calculation
        # base_input = max(0, 1000 - 300 - 200) = 500
        # cost = (500 * 3.00) + (200 * 3.75) + (300 * 0.30) + (500 * 15.00) all per M
        # cost = (500 * 0.000003) + (200 * 0.00000375) + (300 * 0.0000003) + (500 * 0.000015)
        # cost = 0.0015 + 0.00075 + 0.00009 + 0.0075 = 0.00984
        self.assertAlmostEqual(usage.estimated_cost_usd, 0.00984)

        # 2. Normalization with mismatched total tokens
        usage_mismatch = TokenAccountingService.normalize_usage(
            model="claude-3-5-sonnet-20241022",
            prompt_tokens=1000,
            completion_tokens=500,
            total_tokens=2000, # mismatched
        )
        self.assertTrue(usage_mismatch.token_mismatch_detected)
        self.assertEqual(usage_mismatch.total_tokens, 2000)

        # 3. Pricing checks for other models
        usage_haiku = TokenAccountingService.normalize_usage(
            model="claude-3-haiku-20240307",
            prompt_tokens=1000,
            completion_tokens=500
        )
        # input: 1000 * 0.8 / M = 0.0008
        # output: 500 * 4.0 / M = 0.002
        # total = 0.0028
        self.assertAlmostEqual(usage_haiku.estimated_cost_usd, 0.0028)

        usage_opus = TokenAccountingService.normalize_usage(
            model="claude-3-opus-20240229",
            prompt_tokens=1000,
            completion_tokens=500
        )
        # input: 1000 * 15 / M = 0.015
        # output: 500 * 75 / M = 0.0375
        # total = 0.0525
        self.assertAlmostEqual(usage_opus.estimated_cost_usd, 0.0525)


if __name__ == "__main__":
    unittest.main()
