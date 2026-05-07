from typing import Any
from app.pipelines.shared.ai.prompts.prompt_factory import IPromptFactory


class MatchingPromptFactory(IPromptFactory):
    def get_system_prompt(self) -> str:
        # Implementation will go here
        return ""

    def get_user_prompt(self, input: Any) -> str:
        # Implementation will go here
        return ""
