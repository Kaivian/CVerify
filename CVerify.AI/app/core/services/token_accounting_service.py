import logging
from typing import Optional, Any
from decimal import Decimal
from pydantic import BaseModel, Field

logger = logging.getLogger("token_accounting_service")

class NormalizedTokenUsage(BaseModel):
    prompt_tokens: int = Field(default=0, ge=0)
    completion_tokens: int = Field(default=0, ge=0)
    total_tokens: int = Field(default=0, ge=0)
    cache_read_tokens: int = Field(default=0, ge=0)
    cache_write_tokens: int = Field(default=0, ge=0)
    estimated_cost_usd: float = Field(default=0.0, ge=0.0)
    token_mismatch_detected: bool = Field(default=False)


class TokenAccountingService:
    @staticmethod
    def calculate_cost(
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        cache_creation_tokens: int = 0,
        cache_read_tokens: int = 0
    ) -> Decimal:
        """
        Calculates cost based on model pricing rules.
        """
        # Default rates (Claude 3.5 Sonnet: $3.00 / M input, $15.00 / M output)
        input_base_rate = Decimal("0.000003")      # $3.00 / M
        input_write_rate = Decimal("0.00000375")   # Cache Write: $3.75 / M
        input_read_rate = Decimal("0.0000003")     # Cache Read: $0.30 / M
        output_rate = Decimal("0.000015")          # Output: $15.00 / M

        model_lower = model.lower()
        if "haiku" in model_lower:
            input_base_rate = Decimal("0.0000008")  # $0.80 / M
            input_write_rate = Decimal("0.000001")  # $1.00 / M
            input_read_rate = Decimal("0.00000008") # $0.08 / M
            output_rate = Decimal("0.000004")       # $4.00 / M
        elif "opus" in model_lower:
            input_base_rate = Decimal("0.000015")   # $15.00 / M
            input_write_rate = Decimal("0.00001875")# $18.75 / M
            input_read_rate = Decimal("0.0000015")  # $1.50 / M
            output_rate = Decimal("0.000075")       # $75.00 / M

        # Anthropic returns total input tokens including cache creation and reads.
        base_input_tokens = max(0, prompt_tokens - cache_read_tokens - cache_creation_tokens)

        cost = (
            (Decimal(base_input_tokens) * input_base_rate) +
            (Decimal(cache_creation_tokens) * input_write_rate) +
            (Decimal(cache_read_tokens) * input_read_rate) +
            (Decimal(completion_tokens) * output_rate)
        )
        return cost

    @classmethod
    def normalize_usage(
        cls,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        total_tokens: Optional[int] = None,
        cache_creation_tokens: int = 0,
        cache_read_tokens: int = 0
    ) -> NormalizedTokenUsage:
        """
        Normalizes token usage values, validates prompt + completion = total invariant,
        calculates estimated cost, and flags any mismatches.
        """
        calculated_total = prompt_tokens + completion_tokens
        final_total = total_tokens if total_tokens is not None else calculated_total

        # Enforce consistency check
        mismatch = False
        if calculated_total != final_total:
            logger.warning(
                f"Token usage mismatch detected: prompt_tokens={prompt_tokens}, "
                f"completion_tokens={completion_tokens}, total_tokens={final_total} "
                f"(expected={calculated_total}). Flagging for debugging."
            )
            mismatch = True

        cost = cls.calculate_cost(
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            cache_creation_tokens=cache_creation_tokens,
            cache_read_tokens=cache_read_tokens
        )

        return NormalizedTokenUsage(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=final_total,
            cache_read_tokens=cache_read_tokens,
            cache_write_tokens=cache_creation_tokens,
            estimated_cost_usd=float(cost),
            token_mismatch_detected=mismatch
        )

    @classmethod
    def extract_from_provider_usage(cls, usage_obj: Any) -> tuple[int, int, Optional[int]]:
        """
        Extract prompt_tokens, completion_tokens, and total_tokens from different provider formats safely.
        """
        if usage_obj is None:
            return 0, 0, None

        # OpenAI standard fields
        prompt = getattr(usage_obj, "prompt_tokens", None)
        completion = getattr(usage_obj, "completion_tokens", None)
        total = getattr(usage_obj, "total_tokens", None)

        # Anthropic fields fallback
        if prompt is None:
            prompt = getattr(usage_obj, "input_tokens", None)
        if completion is None:
            completion = getattr(usage_obj, "output_tokens", None)

        # Defaults
        prompt = prompt or 0
        completion = completion or 0

        return prompt, completion, total
