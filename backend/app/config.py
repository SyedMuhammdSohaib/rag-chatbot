from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent  # .../backend


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BACKEND_DIR / ".env"), extra="ignore")

    # Everything is stored under backend/data, so it all stays on the same
    # drive as the project (E:) and nothing is written to C:.
    data_dir: str = str(BACKEND_DIR / "data")

    # Chat LLM: ollama (local, default) or groq (free hosted, needs a key)
    llm_provider: str = "ollama"
    ollama_base_url: str = "http://localhost:11434"
    ollama_chat_model: str = "llama3.2:1b"
    groq_api_key: str = ""
    groq_chat_model: str = "openai/gpt-oss-20b"
    # Tried in order when the main model hits Groq's free limit (429) or is
    # not available on this account. Each model has its OWN free quota, so
    # this multiplies how much you can chat per minute and per day.
    groq_fallback_models: str = "openai/gpt-oss-120b,qwen/qwen3.8-27b"
    # Second free provider with its OWN quota (optional, recommended).
    # Free key: https://aistudio.google.com/apikey
    gemini_api_key: str = ""
    gemini_models: str = "gemini-3.8-flash,gemini-2.5-flash"

    # If every online model is out of quota, use local Ollama when it is running.
    fallback_to_ollama: bool = True

    # Same question + same documents + same prompt = answer from memory,
    # no API call at all (saves quota).
    answer_cache_size: int = 200

    # Local embeddings (fastembed, no API key)
    local_embedding_model: str = "BAAI/bge-small-en-v1.5"

    # Retrieval / ingestion
    chunk_size: int = 1000
    chunk_overlap: int = 150
    top_k: int = 4
    # Fewer/shorter old messages = fewer tokens per question = fewer limits
    history_messages: int = 6
    history_message_chars: int = 1200
    max_answer_tokens: int = 1024

    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def database_url(self) -> str:
        return f"sqlite+aiosqlite:///{Path(self.data_dir) / 'app.db'}"

    @property
    def upload_dir(self) -> str:
        return str(Path(self.data_dir) / "uploads")

    @property
    def model_cache_dir(self) -> str:
        return str(Path(self.data_dir) / "models")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
