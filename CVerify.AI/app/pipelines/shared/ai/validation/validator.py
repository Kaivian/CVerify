import json
import logging
import json_repair
from typing import Dict, Any, List, Tuple, Optional
from app.pipelines.shared.ai.validation.versioning import ContractRegistry, DEFAULT_SCHEMA_VERSION

logger = logging.getLogger("task_output_validator")

class ValidationResult:
    def __init__(self, is_valid: bool, data: Optional[Dict[str, Any]], errors: List[str], raw_text: str):
        self.is_valid = is_valid
        self.data = data or {}
        self.errors = errors
        self.raw_text = raw_text

class TaskOutputValidator:
    @staticmethod
    def extract_and_parse_json(text: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Extracts and parses JSON from text. Returns (dict_data, error_message)."""
        if not text or not text.strip():
            return None, "Empty LLM output received"
            
        cleaned = text.strip()
        first_brace = cleaned.find('{')
        last_brace = cleaned.rfind('}')
        
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            json_candidate = cleaned[first_brace:last_brace + 1]
        else:
            json_candidate = cleaned

        try:
            parsed = json.loads(json_candidate)
            if isinstance(parsed, dict):
                return parsed, None
            elif isinstance(parsed, list):
                return {"items": parsed}, None
        except Exception:
            pass

        # Second attempt: json_repair
        try:
            repaired_str = json_repair.repair_json(json_candidate)
            parsed = json.loads(repaired_str)
            if isinstance(parsed, dict):
                return parsed, None
            elif isinstance(parsed, list):
                return {"items": parsed}, None
        except Exception as e:
            return None, f"JSON parsing failed: {e}"

        return None, "Output is not a valid JSON object or list"

    @classmethod
    def validate_output(
        cls,
        raw_text: str,
        output_keys: List[str],
        task_name: str,
        schema_version: str = DEFAULT_SCHEMA_VERSION
    ) -> ValidationResult:
        errors: List[str] = []
        
        # 1. Parse JSON
        parsed, parse_err = cls.extract_and_parse_json(raw_text)
        if parse_err:
            return ValidationResult(is_valid=False, data=None, errors=[parse_err], raw_text=raw_text)

        # 2. Key Presence Check
        for key in output_keys:
            if key not in parsed or parsed[key] is None:
                errors.append(f"Missing required output key: '{key}'")

        # 3. Versioned Schema Check (if contract registered)
        contract = ContractRegistry.get_contract(task_name, schema_version)
        if contract:
            model_cls = contract.get("model_cls")
            if model_cls:
                try:
                    model_cls(**parsed)
                except Exception as pydantic_err:
                    errors.append(f"Contract v{schema_version} schema violation: {pydantic_err}")
            
            custom_validator = contract.get("custom_validator")
            if custom_validator:
                try:
                    custom_errs = custom_validator(parsed)
                    if custom_errs:
                        errors.extend(custom_errs)
                except Exception as val_err:
                    errors.append(f"Custom validator error: {val_err}")

        is_valid = len(errors) == 0
        return ValidationResult(is_valid=is_valid, data=parsed, errors=errors, raw_text=raw_text)
