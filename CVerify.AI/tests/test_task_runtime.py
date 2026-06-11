import os
import sys
import json
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Set dummy env vars for settings validation
os.environ.setdefault("ANTHROPIC_API_KEY", "dummy-key")
os.environ.setdefault("SHARED_SECRET", "dummy-secret")

from app.pipelines.shared.ai.runtime.task_runtime import TaskRuntime
from app.pipelines.shared.ai.runtime.contracts import ArtifactEnvelope, TechStackPayload, ArchitecturePatternsPayload
from app.pipelines.shared.ai.context.context_manager import ContextManager

class TestTaskRuntime(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_claude_service = MagicMock()
        self.runtime = TaskRuntime(claude_service=self.mock_claude_service)

    def test_schema_mapping(self):
        """Verify task identifier maps to appropriate payload schemas."""
        self.assertEqual(self.runtime._map_payload_schema("L1-004"), TechStackPayload)
        self.assertEqual(self.runtime._map_payload_schema("L1-006"), ArchitecturePatternsPayload)
        from typing import Dict, Any
        self.assertEqual(self.runtime._map_payload_schema("L1-999"), Dict[str, Any])

    def test_json_repair_and_extract(self):
        """Verify JSON repair handles minor syntax issues and returns dict."""
        raw_text = "Here is the response: {\"primaryLanguage\": \"Python\", \"frameworks\": [\"FastAPI\",]}"
        parsed = self.runtime._repair_and_extract_json(raw_text)
        self.assertEqual(parsed["primaryLanguage"], "Python")
        self.assertEqual(parsed["frameworks"], ["FastAPI"])

    def test_ast_pruner_python(self):
        """Verify Python AST pruner prunes function bodies while retaining signatures."""
        code = (
            "class MyService:\n"
            "    def perform_action(self, x: int) -> str:\n"
            "        \"\"\"This is a docstring.\"\"\"\n"
            "        y = x + 1\n"
            "        return str(y)\n"
        )
        pruned = ContextManager.prune_python_ast(code)
        self.assertIn("def perform_action(self, x: int) -> str:", pruned)
        self.assertIn("This is a docstring.", pruned)
        self.assertNotIn("y = x + 1", pruned)
        self.assertIn("pass", pruned)

    def test_brace_pruner_c_style(self):
        """Verify curly-brace pruner trims bodies for C-style languages."""
        code = (
            "public class Program {\n"
            "    public static void Main(string[] args) {\n"
            "        Console.WriteLine(\"Hello\");\n"
            "        if (true) {\n"
            "            DoSomething();\n"
            "        }\n"
            "    }\n"
            "}"
        )
        pruned = ContextManager.prune_c_style_structure(code)
        self.assertIn("public class Program", pruned)
        self.assertIn("public static void Main(string[] args)", pruned)
        self.assertNotIn("Console.WriteLine", pruned)

    @patch("httpx.AsyncClient")
    async def test_execute_task_success(self, mock_client_cls):
        """Verify execute_task parses and wraps a successful Claude call in ArtifactEnvelope."""
        # Mock Claude response
        mock_telemetry = {
            "promptTokens": 100,
            "completionTokens": 50,
            "cacheReadTokens": 10,
            "cacheWriteTokens": 20,
            "modelName": "claude-3-5-sonnet",
            "estimatedCostUsd": 0.0015
        }
        mock_response = json.dumps({
            "payload": {
                "primaryLanguage": "TypeScript",
                "frameworks": ["React", "Express"],
                "packageFiles": ["package.json"],
                "languages": {"TypeScript": 90.0, "CSS": 10.0}
            },
            "confidence": {
                "score": 0.95,
                "rationale": "Clear indicators"
            },
            "evidence": [
                {
                    "filePath": "package.json",
                    "lineRange": "1-10",
                    "citation": "React dep found",
                    "category": "framework"
                }
            ]
        })
        self.mock_claude_service.analyze_repo_with_telemetry = AsyncMock(return_value=(mock_response, mock_telemetry))

        inputs = {
            "ParentTask": {
                "metadata": {"jobId": "job-1", "taskIdentifier": "L1-001"},
                "checksum": "sha-parent-123"
            }
        }

        result = await self.runtime.execute_task(
            job_id="job-1",
            task_identifier="L1-004",
            inputs=inputs,
            system_prompt="system",
            user_prompt="user"
        )

        # Parse with ArtifactEnvelope to validate structure
        envelope = ArtifactEnvelope[TechStackPayload].model_validate(result)
        self.assertEqual(envelope.metadata.jobId, "job-1")
        self.assertEqual(envelope.metadata.taskIdentifier, "L1-004")
        self.assertEqual(envelope.metadata.costUsd, 0.0015)
        self.assertEqual(envelope.confidence.score, 0.95)
        self.assertEqual(envelope.payload.primaryLanguage, "TypeScript")
        self.assertEqual(envelope.payload.frameworks, ["React", "Express"])
        self.assertEqual(envelope.evidence[0].filePath, "package.json")
        self.assertEqual(envelope.lineage.inputs[0].artifactId, "ParentTask")
        self.assertEqual(envelope.lineage.inputs[0].checksum, "sha-parent-123")

if __name__ == "__main__":
    unittest.main()
