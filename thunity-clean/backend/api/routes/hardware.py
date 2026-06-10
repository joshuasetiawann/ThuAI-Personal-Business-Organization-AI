"""Hardware awareness endpoint (CPU/RAM/disk + GPU acceleration / CPU-fallback warning)."""
from __future__ import annotations
from fastapi import APIRouter, Depends
from api.deps import get_current_user
from agents.ollama_client import ollama
from agents.model_router import required_models
from services.hardware import hardware_status

router = APIRouter()


@router.get("/status")
async def hardware(user: dict = Depends(get_current_user)):
    hw = hardware_status()
    h = await ollama.health()
    installed = set(h.get("models", []))
    hw["ollama"] = {"status": h["status"],
                    "missing_models": [m for m in required_models() if m not in installed]}
    return hw
