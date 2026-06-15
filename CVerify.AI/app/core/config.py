import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

# Load .env file relative to the location of config.py
# config.py is inside CVerify.AI/app/config.py, so its parent's parent is CVerify.AI/
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
if os.path.exists(env_path):
    load_dotenv(env_path)

class Settings(BaseSettings):
    anthropic_api_key: str = Field("your_anthropic_api_key_here", validation_alias="ANTHROPIC_API_KEY")
    shared_secret: str = Field("your_hmac_shared_secret_key_here", validation_alias="SHARED_SECRET")
    client_id: str = Field("cverify-core", validation_alias="CLIENT_ID")
    host: str = Field("0.0.0.0", validation_alias="HOST")
    port: int = Field(8000, validation_alias="PORT")
    redis_url: str = Field("redis://redis:6379/0", validation_alias="REDIS_URL")  # default to redis container hostname for compose
    claude_model: str = Field("claude-3-5-sonnet-20241022", validation_alias="CLAUDE_MODEL")
    ai_debug_tokens: bool = Field(False, validation_alias="AI_DEBUG_TOKENS")
    # URL of the CVerify.Core (.NET) backend — used by Line 2 to fetch Line 1 artifacts from DB
    backend_api_url: str = Field("http://cverify-core:8080", validation_alias="BACKEND_API_URL")

    model_config = SettingsConfigDict(
        env_file=env_path if os.path.exists(env_path) else ".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

