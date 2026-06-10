"""Local model inventory + health. Never auto-pulls; surfaces manual commands
and hardware warnings."""
from __future__ import annotations
from fastapi import APIRouter, Depends
from api.deps import get_current_user
from agents.ollama_client import ollama
from agents.model_router import role_model_map, required_models, is_heavy

router = APIRouter()


@router.get("/local")
async def local_models(user: dict = Depends(get_current_user)):
    h = await ollama.health()
    detailed = []
    if h["status"] == "online":
        try:
            for m in await ollama.list_models_detailed():
                detailed.append({"name": m.get("name"),
                                 "size_gb": round(m.get("size", 0) / 1024**3, 2) if m.get("size") else None})
        except Exception:
            pass
    return {"ollama_status": h["status"], "installed": detailed or h.get("models", []),
            "role_assignment": role_model_map()}


@router.get("/health")
async def models_health(user: dict = Depends(get_current_user)):
    h = await ollama.health()
    installed = set(h.get("models", []))
    req = required_models()
    missing = [m for m in req if m not in installed]
    roles = role_model_map()
    report = []
    for role, model in roles.items():
        present = model in installed
        report.append({
            "role": role, "model": model, "installed": present,
            "heavy": is_heavy(model),
            "pull_command": None if present else f"ollama pull {model}",
            "warning": ("This model may run slowly on RX 6600 XT 8GB and 16GB RAM. "
                        "Consider using a 7B/8B quantized model for faster local inference.")
                       if is_heavy(model) else None,
        })
    return {
        "ollama_status": h["status"],
        "installed_models": sorted(installed),
        "required_models": req,
        "missing_models": missing,
        "missing_hint": ([f"ollama pull {m}" for m in missing] or None),
        "roles": report,
        "note": "Models are never auto-downloaded and there is no cloud fallback.",
    }
