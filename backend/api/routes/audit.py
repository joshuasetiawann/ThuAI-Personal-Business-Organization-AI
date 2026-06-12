"""Audit trail (read-only; cannot be deleted via the API)."""
from __future__ import annotations
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from api.deps import get_db, require_permission
from core.permissions import Perm
from core.errors import AppError, parse_uuid
from db.models import AuditLog

router = APIRouter()


@router.get("")
async def list_audit(db=Depends(get_db), user: dict = Depends(require_permission(Perm.VIEW_LOGS)),
                     action: str | None = None, limit: int = Query(100, le=500)):
    q = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    if action:
        q = q.where(AuditLog.action == action)
    rows = (await db.execute(q)).scalars().all()
    return {"audit": [{"id": str(a.id), "actor": a.actor, "actor_role": a.actor_role,
                       "action": a.action, "entity_type": a.entity_type, "entity_id": a.entity_id,
                       "created_at": a.created_at.isoformat(), "metadata": a.metadata_json}
                      for a in rows]}


@router.get("/{audit_id}")
async def get_audit(audit_id: str, db=Depends(get_db),
                    user: dict = Depends(require_permission(Perm.VIEW_LOGS))):
    a = (await db.execute(select(AuditLog).where(
        AuditLog.id == parse_uuid(audit_id, "audit id")))).scalar_one_or_none()
    if not a:
        raise AppError(404, "NOT_FOUND", "Audit entry not found.")
    return {"id": str(a.id), "actor": a.actor, "action": a.action, "entity_type": a.entity_type,
            "entity_id": a.entity_id, "metadata": a.metadata_json, "created_at": a.created_at.isoformat()}
