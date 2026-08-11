from typing import List

class RepairPromptFactory:
    @staticmethod
    def get_repair_system_prompt() -> str:
        return (
            "You are a specialized JSON Repair Engine for the CVerify AI Pipeline.\n"
            "Your sole objective is to fix syntax, formatting, and schema errors in the provided corrupted JSON.\n\n"
            "CRITICAL CONSTRAINTS:\n"
            "1. Output ONLY valid, raw JSON. Do NOT include markdown code blocks (e.g. ```json), explanation, or commentary.\n"
            "2. Preserve all existing field names, values, and semantic meanings exactly as provided.\n"
            "3. Do NOT hallucinate, manufacture, or invent missing domain facts or scores.\n"
            "4. Only repair JSON structural errors, missing closing brackets, key casing, or top-level wrapper objects."
        )

    @staticmethod
    def get_repair_user_prompt(
        raw_output: str,
        output_keys: List[str],
        validation_errors: List[str]
    ) -> str:
        errors_str = "\n".join(f"- {e}" for e in validation_errors)
        keys_str = ", ".join(f"'{k}'" for k in output_keys)
        
        return (
            f"The following LLM response failed validation for expected keys [{keys_str}].\n\n"
            f"Validation Errors:\n{errors_str}\n\n"
            f"Corrupted Raw LLM Response:\n{raw_output}\n\n"
            f"Transform and fix the response into valid JSON containing keys [{keys_str}]. Output raw JSON only:"
        )
