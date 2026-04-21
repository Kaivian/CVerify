import json
import re
from typing import Any


class LlmResponseParser:
    def extract_json_block(self, response: str) -> Any:
        # Prefer fenced blocks: capture inner text (handles nested braces better than .*? on one line).
        fence = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", response, re.IGNORECASE)
        if fence:
            candidate = fence.group(1).strip()
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass

        stripped = response.strip()
        if stripped.startswith("{") or stripped.startswith("["):
            try:
                return json.loads(stripped)
            except json.JSONDecodeError:
                pass

        # Last resort: first top-level object/array (greedy; may fail on edge cases).
        match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", response)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass
        return {}

    def is_valid_json(self, text: str) -> bool:
        try:
            json.loads(text)
            return True
        except (json.JSONDecodeError, ValueError):
            return False
