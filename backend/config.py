"""
Thunity Local AI Company OS — central configuration.

All configuration is environment-driven. Defaults here are *development*
defaults only; startup is HARD-BLOCKED in ANY environment if a truly dangerous
insecure default survives (see security_audit() / startup_safety_check()).

Local-first, honest-hybrid principle: the default inference path is local
Ollama. A SINGLE frontier provider (Anthropic Claude or OpenRouter) may be
DECLARED via a key + FRONTIER_ENABLED. It is reachable ONLY when the founder has
explicitly turned LOCAL_ONLY_MODE OFF — LOCAL_ONLY_MODE is the master data-
sovereignty switch and, while it is true (the default), Thunity is 100% local and
NO external AI path is reachable at all (this matches docs/LOCAL_ONLY_COMPLIANCE).
When declared AND local-only is off, heavy/strategic requests may be answered by
the frontier — always after injecting local memory + knowledge, and always
labelled honestly (compliance_status() → "hybrid"; every frontier answer is
tagged in the UI). There is never a silent cloud fallback. The legacy Supabase
sync adapter remains gated and off by default.
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
    # OFF by default — the cloud lane is OPT-IN. To use it the founder must
    # explicitly (1) set FRONTIER_ENABLED=true, (2) provide a key, AND
    # (3) set LOCAL_ONLY_MODE=false. With LOCAL_ONLY_MODE=true (the default) the
    # frontier lane is hard-disabled even if a key is present, so a stray ambient
    # ANTHROPIC_API_KEY can never silently route your data to the cloud.
    FRONTIER_ENABLED: bool = False
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
    MAX_RETRIEVAL_TOP_K: int = 50               # hard server-side cap on any top_k
    MIN_RELEVANCE: float = 0.15                 # drop retrieved chunks below this cosine score
    RETRIEVAL_CHUNK_CHARS: int = 900            # max chars of each chunk injected into a prompt
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
        """True when ANY declared frontier provider is keyed AND enabled.
        NOTE: this does NOT mean the frontier is reachable — LOCAL_ONLY_MODE still
        gates it. Use `frontier_active` (or core.local_only.frontier_enabled()) to
        know whether a cloud call can actually happen."""
        return self.anthropic_configured or self.openrouter_configured

    @property
    def frontier_active(self) -> bool:
        """True only when a frontier provider is declared AND LOCAL_ONLY_MODE is off.
        This is the single source of truth for 'can a cloud AI call actually happen'."""
        return self.frontier_configured and not self.LOCAL_ONLY_MODE

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


def security_audit(s: Settings = settings) -> tuple[List[str], List[str]]:
    """Return (fatal, warnings).

    `fatal` problems MUST refuse app start in ANY environment — they are insecure
    defaults that would compromise the system regardless of APP_ENV. This closes
    the prior gap where the real deployment never set APP_ENV=production, leaving
    the production hard-block inert. `warnings` surface posture without blocking."""
    fatal: List[str] = []
    warnings: List[str] = []

    # ── Always-fatal: insecure defaults dangerous in every environment ──
    if s.is_secret_default:
        fatal.append("SECRET_KEY is default/missing/too short — set a strong random value "
                     "(`openssl rand -hex 32`).")
    if s.db_password in _DEFAULT_DB_PASSWORDS:
        fatal.append("Database password is still a default/placeholder value (e.g. CHANGE_ME).")
    if s.N8N_ENABLED and s.N8N_BASIC_AUTH_PASSWORD in _DEFAULT_N8N_PASSWORDS:
        fatal.append("n8n basic-auth password is still a default/placeholder value.")
    if "*" in s.ALLOWED_ORIGINS:
        fatal.append("ALLOWED_ORIGINS contains a wildcard (*) — unsafe with credentialed CORS.")
    if s.ENABLE_SUPABASE_ADAPTER and s.LOCAL_ONLY_MODE:
        fatal.append("Supabase adapter is enabled while LOCAL_ONLY_MODE is true — contradictory config.")

    # ── Warnings: explain the active data-sovereignty posture ──
    if not s.LOCAL_ONLY_MODE:
        warnings.append("LOCAL_ONLY_MODE is OFF — the declared frontier (cloud) lane is permitted; "
                        "data sovereignty is not absolute.")
    if s.LOCAL_ONLY_MODE and s.frontier_configured:
        warnings.append("A frontier key is set but LOCAL_ONLY_MODE is true → the cloud lane is DISABLED. "
                        "Set LOCAL_ONLY_MODE=false to actually use it.")
    if not s.LOCAL_ONLY_MODE and s.frontier_configured:
        warnings.append(f"Hybrid mode ACTIVE: declared frontier provider '{s.active_frontier_provider}' "
                        "may answer heavy requests (always labelled in the UI).")
    if s.is_secret_default is False and len(s.SECRET_KEY) < 32:
        warnings.append("SECRET_KEY is shorter than 32 chars — consider `openssl rand -hex 32` for full entropy.")

    return fatal, warnings


def startup_safety_check(s: Settings = settings) -> List[str]:
    """Back-compat: flat list of all problems (fatal first). Prefer security_audit()."""
    fatal, warnings = security_audit(s)
    return fatal + warnings
