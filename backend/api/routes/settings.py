"""Governance settings snapshot (read-only, secrets redacted) + runtime toggles."""
from __future__ import annotations
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from api.deps import get_current_user, get_db, require_permission
from core.permissions import Perm
from core.audit import log_audit
from config import settings
from core.local_only import compliance_status, frontier_enabled
from services import app_settings_service as app_settings

router = APIRouter()


class RuntimeSettingsUpdate(BaseModel):
    auto_ingest_conversations: bool | None = None


@router.get("/runtime")
async def get_runtime_settings(db=Depends(get_db), user: dict = Depends(get_current_user)):
    """Founder-tunable runtime toggles (persisted in the DB)."""
    if db is None:
        return {"auto_ingest_conversations": app_settings.DEFAULTS["auto_ingest_conversations"]}
    return {"auto_ingest_conversations": await app_settings.get_setting(db, "auto_ingest_conversations", True)}


@router.post("/runtime")
async def update_runtime_settings(req: RuntimeSettingsUpdate, db=Depends(get_db),
                                  user: dict = Depends(require_permission(Perm.CHANGE_SETTINGS))):
    changed: dict = {}
    if req.auto_ingest_conversations is not None:
        await app_settings.set_setting(db, "auto_ingest_conversations",
                                       bool(req.auto_ingest_conversations), actor=user["email"])
        changed["auto_ingest_conversations"] = bool(req.auto_ingest_conversations)
    if changed:
        await log_audit(db, "settings_changed", actor=user["email"], actor_role=user["role"],
                        entity_type="app_setting", metadata=changed)
    await db.commit()
    return {"auto_ingest_conversations": await app_settings.get_setting(db, "auto_ingest_conversations", True)}


@router.get("")
async def get_settings(user: dict = Depends(get_current_user)):
    # NEVER expose SECRET_KEY, DB password, or n8n password.
    return {
        "app_env": settings.APP_ENV,
        "local_only_mode": settings.LOCAL_ONLY_MODE,
        "compliance_status": compliance_status(),
        "agent_execution_mode": settings.AGENT_EXECUTION_MODE,
        "max_parallel_agent_runs": settings.MAX_PARALLEL_AGENT_RUNS,
        "allowed_origins_count": len(settings.allowed_origins_list),
        "n8n_enabled": settings.N8N_ENABLED,
        "models": {
            "fast": settings.OLLAMA_MODEL_FAST, "analyst": settings.OLLAMA_MODEL_ANALYST,
            "critic": settings.OLLAMA_MODEL_CRITIC, "execution": settings.OLLAMA_MODEL_EXECUTION,
            "synthesizer": settings.OLLAMA_MODEL_SYNTHESIZER, "evaluator": settings.OLLAMA_MODEL_EVALUATOR,
            "embedding": settings.OLLAMA_MODEL_EMBEDDING, "deep_reasoning_optional": settings.OLLAMA_MODEL_DEEP_REASONING,
        },
        "hardware_profile": {"cpu": settings.HW_CPU_NAME, "gpu": settings.HW_GPU_NAME,
                             "vram_gb": settings.HW_VRAM_GB, "ram_gb": settings.HW_RAM_GB},
        # Honest frontier status — never exposes the key itself, only whether one is present.
        "frontier": {
            "enabled": frontier_enabled(),
            "provider": settings.active_frontier_provider or None,
            "model": settings.active_frontier_model if frontier_enabled() else None,
            "auto_routing": settings.ROUTE_AUTO,
            "anthropic_key_present": bool((settings.ANTHROPIC_API_KEY or "").strip()),
            "openrouter_key_present": bool((settings.OPENROUTER_API_KEY or "").strip()),
        },
        "external_ai_providers": (f"{settings.active_frontier_provider} (declared, labelled)"
                                  if frontier_enabled() else "blocked"),
    }
