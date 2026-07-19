import logging
from enum import Enum
from typing import Optional, Dict, Any

logger = logging.getLogger("failure_classifier")

class FailureCategory(str, Enum):
    RECOVERABLE = "RECOVERABLE"       # Formatting/JSON schema issue -> Self-healing Recovery Engine
    RETRYABLE = "RETRYABLE"         # Transient LLM/API error -> Exponential backoff retry call
    NON_RECOVERABLE = "NON_RECOVERABLE" # Logic bug / missing input -> Fail task, isolate DAG

class FailureClassifier:
    @staticmethod
    def classify(error: Exception, raw_output: Optional[str] = None) -> FailureCategory:
        err_str = str(error).lower()
        
        # Transient API / provider issues
        if any(x in err_str for x in ["rate limit", "429", "timeout", "overloaded", "500", "502", "503", "529", "connection"]):
            return FailureCategory.RETRYABLE

        # Output formatting & JSON errors
        if any(x in err_str for x in ["json", "parse", "schema", "syntax", "unexpected token", "missing key", "validation error"]):
            return FailureCategory.RECOVERABLE

        # If raw output is present but incomplete/truncated
        if raw_output and not raw_output.strip().endswith(("}", "]")):
            return FailureCategory.RECOVERABLE

        # Missing input or non-recoverable logic bugs
        if "missing required input" in err_str or "unregistered task" in err_str:
            return FailureCategory.NON_RECOVERABLE

        return FailureCategory.RECOVERABLE
