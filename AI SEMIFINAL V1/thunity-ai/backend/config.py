"""
Thunity Local AI Company OS — central configuration.

All configuration is environment-driven. Defaults here are *development*
defaults only; production startup (APP_ENV=production) is hard-blocked if any
insecure default remains (see startup_safety_check()).

Local-only principle: there is NO configuration field for any external AI /
cloud provider (OpenAI/Anthropic/Gemini/Groq/Supabase/Pinecone/...). The only
remote-capable adapter (legacy Supabase sync) lives under adapters/optional and
is gated by LOCAL_ONLY_MODE.
"""
from __future__ import annotations

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


# Values considered insecure if they survive into production.
_DEFAULT_SECRET = "change-this-with-strong-random-secret"
_DEFAULT_DB_PASSWORDS = {"CHANGE_ME", "postgres123", "postgres", "password"}
_DEFAULT_N8N_PASSWORDS = {"CHANGE_ME", "admin123", "admin", "password"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    # ── App / runtime ────────────────────────────────────────────────
    APP_ENV: str = "development"          # development | production
    LOCAL_ONLY_MODE: bool = True
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000

    # ── Security ─────────────────────────────────────────────────────
    SECRET_KEY: str = _DEFAULT_SECRET
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:8080,http://localhost:8000"

    # First-founder bootstrap (no hardcoded admin/admin123 anywhere).
    FOUNDER_EMAIL: str = ""
    FOUNDER_PASSWORD: str = ""

    # ── Ollama / models (all configurable, hardware-aware defaults) ───
    OLLAMA_URL: str = "http://ollama:11434"
    OLLAMA_MODEL_FAST: str = "qwen2.5:7b-instruct"
    OLLAMA_MODEL_ANALYST: str = "qwen2.5:7b-instruct"
    OLLAMA_MODEL_CRITIC: str = "llama3.1:8b"
    OLLAMA_MODEL_EXECUTION: str = "qwen2.5-coder:7b"
    OLLAMA_MODEL_SYNTHESIZER: str = "qwen2.5:7b-instruct"
    OLLAMA_MODEL_EVALUATOR: str = "qwen2.5:7b-instruct"
    OLLAMA_MODEL_EMBEDDING: str = "nomic-embed-text"
    OLLAMA_MODEL_DEEP_REASONING: str = "qwen2.5:14b-instruct"  # manual/optional only

    # ── Agent orchestration (hardware constraints) ───────────────────
    AGENT_EXECUTION_MODE: str = "sequential"   # never "parallel" on this hardware
    MAX_PARALLEL_AGENT_RUNS: int = 1
    MAX_CONTEXT_CHUNKS: int = 5
    MAX_AGENT_TIMEOUT_SECONDS: int = 240
    OLLAMA_NUM_CTX: int = 4096                  # keep modest for 8GB VRAM / 16GB RAM

    # ── Data / storage ───────────────────────────────────────────────
    POSTGRES_URL: str = "postgresql+asyncpg://postgres:CHANGE_ME@postgres:5432/thunity_ai"
    REDIS_URL: str = "redis://redis:6379"
    FILES_DIR: str = "/data/files"
    KNOWLEDGE_DIR: str = "/data/knowledge"
    SANDBOX_DIR: str = "/data/sandbox_runs"
    BACKUP_DIR: str = "/data/backups"
    MAX_UPLOAD_MB: int = 50

    # ── n8n (local automation, governed) ─────────────────────────────
    N8N_URL: str = "http://n8n:5678"
    N8N_ENABLED: bool = True
    N8N_BASIC_AUTH_USER: str = "admin"
    N8N_BASIC_AUTH_PASSWORD: str = "CHANGE_ME"

    # ── Optional legacy adapter (disabled by default, gated) ─────────
    ENABLE_SUPABASE_ADAPTER: bool = False  # NEVER auto-enabled; blocked under LOCAL_ONLY_MODE

    # ── Hardware profile (for warnings) ──────────────────────────────
    HW_GPU_NAME: str = "Radeon RX 6600 XT (8GB VRAM)"
    HW_VRAM_GB: int = 8
    HW_RAM_GB: int = 16
    HW_CPU_NAME: str = "AMD Ryzen 7 5800X (8c/16t)"

    # ── derived helpers ──────────────────────────────────────────────
    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.strip().lower() == "production"

    @property
    def is_secret_default(self) -> bool:
        return (not self.SECRET_KEY) or self.SECRET_KEY == _DEFAULT_SECRET or len(self.SECRET_KEY) < 16

    @property
    def db_password(self) -> str:
        # crude extract of password between ':' and '@' in the URL userinfo
        try:
            userinfo = self.POSTGRES_URL.split("://", 1)[1].split("@", 1)[0]
            return userinfo.split(":", 1)[1] if ":" in userinfo else ""
        except Exception:
            return ""


settings = Settings()


def startup_safety_check(s: Settings = settings) -> List[str]:
    """Return a list of blocking problems. In production, a non-empty list must
    refuse app start. In development, problems are surfaced as warnings."""
    problems: List[str] = []
    if not s.LOCAL_ONLY_MODE:
        problems.append("LOCAL_ONLY_MODE is not true — data sovereignty is not guaranteed.")
    if s.is_production:
        if s.is_secret_default:
            problems.append("SECRET_KEY is default/missing/too short.")
        if s.db_password in _DEFAULT_DB_PASSWORDS:
            problems.append("Database password is still a default value.")
        if s.N8N_ENABLED and s.N8N_BASIC_AUTH_PASSWORD in _DEFAULT_N8N_PASSWORDS:
            problems.append("n8n basic-auth password is still a default value.")
        if "*" in s.ALLOWED_ORIGINS:
            problems.append("ALLOWED_ORIGINS contains a wildcard (*).")
        if s.ENABLE_SUPABASE_ADAPTER:
            problems.append("An external (Supabase) adapter is enabled in production.")
    return problems
