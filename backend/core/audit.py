"""Audit + error + model-usage logging helpers. Never logs secrets."""
from __future__ import annotations
from typing import Optional
from db.models import AuditLog, ErrorLog, ModelUsageLog

_SENSITIVE = {"password", "token", "secret", "jwt", "secret_key", "authorization"}

def _scrub(meta: Optional[dict]) -> dict:
    if not meta:
        return {}
    out = {}
    for k, v in meta.items():
        if any(s in str(k).lower() for s in _SENSITIVE):
            out[k] = "[redacted]"
        else:
            out[k] = v
    return out

async def log_audit(db, action: str, actor: Optional[str] = None, actor_role: Optional[str] = None,
                    entity_type: Optional[str] = None, entity_id: Optional[str] = None,
                    ip: Optional[str] = None, metadata: Optional[dict] = None) -> None:
    if db is None:
        return
    db.add(AuditLog(actor=actor, actor_role=actor_role, action=action,
                    entity_type=entity_type, entity_id=str(entity_id) if entity_id else None,
                    ip=ip, metadata_json=_scrub(metadata)))
    await db.flush()

async def log_error(db, code: str, message: str, detail: str = "", path: str = "") -> None:
    if db is None:
        return
    db.add(ErrorLog(code=code, message=message[:2000], detail=detail[:2000], path=path))
    await db.flush()

async def log_model_usage(db, model: str, agent_name: str = None, agent_run_id=None,
                          latency_ms: int = None, token_estimate: int = 0, status: str = "ok") -> None:
    if db is None:
        return
    db.add(ModelUsageLog(model=model, agent_name=agent_name, agent_run_id=agent_run_id,
                         latency_ms=latency_ms, token_estimate=token_estimate, status=status))
    await db.flush()
