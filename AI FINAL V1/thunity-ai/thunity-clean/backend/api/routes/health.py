"""Health + local-only compliance endpoints."""
from __future__ import annotations
import httpx
from fastapi import APIRouter, Depends
from api.deps import get_db
from config import settings
from core.local_only import compliance_status, external_ai_providers_enabled
from agents.ollama_client import ollama

router = APIRouter()


@router.get("")
async def health():
    return {"status": "online", "app": "Thunity Local AI Company OS", "version": "2.0.0"}


@router.get("/local-only")
async def local_only(db=Depends(get_db)):
    oll = await ollama.health()
    n8n = "offline"
    if settings.N8N_ENABLED:
        try:
            async with httpx.AsyncClient(timeout=4.0) as c:
                r = await c.get(f"{settings.N8N_URL}/healthz")
                n8n = "online" if r.status_code < 400 else "offline"
        except Exception:
            n8n = "offline"
    return {
        "local_only_mode": settings.LOCAL_ONLY_MODE,
        "ollama_status": oll["status"],
        "external_ai_providers_enabled": external_ai_providers_enabled(),
        "database": "online" if db is not None else "offline",
        "vector_store": "local_embedding_store (postgres)",
        "n8n": n8n if settings.N8N_ENABLED else "disabled",
        "status": compliance_status(),
    }
