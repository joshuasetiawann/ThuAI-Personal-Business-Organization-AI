from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str = "supersecretkey123changeme"

    OLLAMA_URL: str = "http://ollama:11434"
    OLLAMA_MODEL_ANALYST: str = "llama3.1:8b"
    OLLAMA_MODEL_CRITIC: str = "llama3.1:8b"
    OLLAMA_MODEL_SYNTHESIZER: str = "llama3.1:8b"

    POSTGRES_URL: str = "postgresql+asyncpg://postgres:postgres123@postgres:5432/ai_ecosystem"
    REDIS_URL: str = "redis://redis:6379"

    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    N8N_URL: str = "http://n8n:5678"
    FILES_DIR: str = "/data/files"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
