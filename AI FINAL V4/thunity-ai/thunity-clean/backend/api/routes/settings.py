"""Governance settings snapshot (read-only, secrets redacted)."""
from __future__ import annotations
from fastapi import APIRouter, Depends
from api.deps import get_current_user
from config import settings
from core.local_only import compliance_status

router = APIRouter()


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
        "external_ai_providers": "blocked",
    }
