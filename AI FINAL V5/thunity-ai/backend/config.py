"""
Thunity Local AI Company OS — central configuration.

All configuration is environment-driven. Defaults here are *development*
defaults only; production startup (APP_ENV=production) is hard-blocked if any
insecure default remains (see startup_safety_check()).

Local-first, honest-hybrid principle: the default inference path is local
Ollama. A SINGLE frontier provider (Anthropic Claude) may be DECLARED via
ANTHROPIC_API_KEY + FRONTIER_ENABLED. When declared, Thunity may route selected
(heavy / strategic) requests to Claude — but ALWAYS after injecting local memory
+ knowledge, and ALWAYS labelled honestly (compliance_status() → "hybrid", and
every frontier answer is tagged in the UI). There is still NO silent cloud
fallback: an undeclared external call is blocked by LOCAL_ONLY_MODE. The legacy
Supabase sync adapter remains gated and off by default.
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
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://localhost:8000"

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

    # ── Frontier AI (optional, governed, opt-in hybrid) ──────────────
    # Set ANTHROPIC_API_KEY in .env to ENABLE. Never commit a real key. When a
    # key is present and FRONTIER_ENABLED is true, heavy/strategic requests may
    # be answered by Claude — always grounded in local memory + knowledge, and
    # always labelled. No key ⇒ Thunity stays 100% local automatically.
    FRONTIER_ENABLED: bool = True
    # Pick the frontier provider when more than one key is present.
    FRONTIER_PROVIDER: str = "auto"   # auto | anthropic | openrouter
    # ── Anthropic Claude (paid) ──
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-opus-4-8"               # heavy / strategic route
    ANTHROPIC_FAST_MODEL: str = "claude-haiku-4-5-20251001"  # optional cheaper frontier
    ANTHROPIC_BASE_URL: str = "https://api.anthropic.com"
    ANTHROPIC_VERSION: str = "2023-06-01"
    ANTHROPIC_MAX_TOKENS: int = 2048
    ANTHROPIC_TIMEOUT_SECONDS: int = 120
    # ── OpenRouter (OpenAI-compatible aggregator; FREE models available) ──
    # One key → many models. FREE remote models (e.g. *:free) are far larger than
    # the local 7B and cost $0 (rate-limited). Get a key at https://openrouter.ai/keys.
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "deepseek/deepseek-chat-v3-0324:free"  # strong free default; verify slug at openrouter.ai/models
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_TIMEOUT_SECONDS: int = 120
    # Auto-routing: longer messages or heavy-intent keywords escalate to frontier.
    ROUTE_AUTO: bool = True
    ROUTE_HEAVY_CHAR_THRESHOLD: int = 280

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
    # Bind-mounted to a real folder on the host (see docker-compose) so the founder can
    # browse every conversation as .md + .json files in Finder.
    CONVERSATIONS_EXPORT_DIR: str = "/exports"
    CONVERSATIONS_EXPORT_ENABLED: bool = True

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
    def anthropic_configured(self) -> bool:
        return bool(self.FRONTIER_ENABLED and (self.ANTHROPIC_API_KEY or "").strip())

    @property
    def openrouter_configured(self) -> bool:
        return bool(self.FRONTIER_ENABLED and (self.OPENROUTER_API_KEY or "").strip())

    @property
    def frontier_configured(self) -> bool:
        """True when ANY declared frontier provider is keyed."""
        return self.anthropic_configured or self.openrouter_configured

    @property
    def active_frontier_provider(self) -> str:
        """Which frontier provider runs. Explicit FRONTIER_PROVIDER wins; otherwise
        prefer OpenRouter when keyed (the founder's cost-free choice), else Anthropic."""
        p = (self.FRONTIER_PROVIDER or "auto").strip().lower()
        if p == "anthropic" and self.anthropic_configured:
            return "anthropic"
        if p == "openrouter" and self.openrouter_configured:
            return "openrouter"
        if self.openrouter_configured:
            return "openrouter"
        if self.anthropic_configured:
            return "anthropic"
        return ""

    @property
    def active_frontier_model(self) -> str:
        return self.OPENROUTER_MODEL if self.active_frontier_provider == "openrouter" else self.ANTHROPIC_MODEL

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
