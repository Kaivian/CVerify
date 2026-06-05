import logging
from typing import AsyncGenerator
from anthropic import AsyncAnthropic
from app.config import settings

logger = logging.getLogger("claude_service")

class ClaudeService:
    def __init__(self):
        # The Anthropic client automatically picks up settings.anthropic_api_key
        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def stream_chat(self, messages: list) -> AsyncGenerator[str, None]:
        system_prompt = (
            "You are CVerify, an expert AI Travel Planner. Your goal is to design structured, highly detailed, "
            "and beautiful travel itineraries. Respond strictly using clear and beautiful Markdown formatting.\n"
            "Organize recommendations into sections, highlighting attractions, logistics, and dining tips. "
            "Include practical suggestions for hotels, transportation, and pricing where possible."
        )

        # Set up system prompt with Ephemeral Prompt Caching to optimize costs by ~90%
        system_config = [
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"}
            }
        ]

        formatted_messages = []
        for msg in messages:
            formatted_messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })

        try:
            async with self.client.messages.stream(
                model=settings.claude_model,  # Loaded dynamically from environment variable (CLAUDE_MODEL)
                max_tokens=4000,
                system=system_config,
                messages=formatted_messages,
                temperature=0.7
            ) as stream:
                async for event in stream:
                    # Capture content delta text chunks
                    if event.type == "content_block_delta" and event.delta.type == "text_delta":
                        yield event.delta.text
        except Exception as e:
            logger.error(f"Error streaming from Anthropic Claude API: {e}")
            yield f"\n\n[Error occurred in travel planner service: {str(e)}]"

    async def analyze_repo(self, system_prompt: str, user_prompt: str) -> str:
        system_config = [
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"}
            }
        ]
        try:
            response = await self.client.messages.create(
                model=settings.claude_model,
                max_tokens=4000,
                system=system_config,
                messages=[{"role": "user", "content": user_prompt}],
                temperature=0.2
            )
            return response.content[0].text
        except Exception as e:
            logger.error(f"Error calling Anthropic Claude API for repository analysis: {e}")
            raise e
