"""Long-term memory — read + founder control.

The founder can see exactly what Thunity remembers about them, add a memory by
hand, or forget one (archived, not hard-deleted, so the trail stays honest).
Memory is private per user and never touches the governance ledgers.
"""
from __future__ import annotations
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from api.deps import get_db, get_current_user
from core.errors import AppError
from core.audit import log_audit
from db.models import Memory
from services import memory_service as ms

router = APIRouter()


class MemoryCreate(BaseModel):
    content: str
    kind: str = "fact"
    importance: int = 3


def _serialize(m: Memory) -> dict:
    return {"id": str(m.id), "kind": m.kind, "content": m.content, "importance": m.importance,
            "source": m.source, "status": m.status, "use_count": m.use_count,
            "last_used_at": m.last_used_at.isoformat() if m.last_used_at else None,
            "created_at": m.created_at.isoformat() if m.created_at else None}


@router.get("")
async def list_memory(limit: int = 200, kind: str | None = None,
                      db=Depends(get_db), user: dict = Depends(get_current_user)):
    rows = await ms.list_memories(db, user.get("id"), limit=limit, kind=kind)
    total = await ms.count_memories(db, user.get("id"))
    return {"memories": [_serialize(m) for m in rows], "total": total}


@router.get("/count")
async def count_memory(db=Depends(get_db), user: dict = Depends(get_current_user)):
    return {"total": await ms.count_memories(db, user.get("id"))}


@router.post("")
async def add_memory(req: MemoryCreate, db=Depends(get_db), user: dict = Depends(get_current_user)):
    if not req.content.strip():
        raise AppError(400, "EMPTY_MEMORY", "content must not be empty.")
    m = await ms.store_memory(db, user.get("id"), req.content, kind=req.kind,
                              importance=req.importance, source="founder")
    await log_audit(db, "memory_write", actor=user.get("email"), entity_type="memory",
                    entity_id=str(m.id), metadata={"source": "founder"})
    await db.commit()
    return _serialize(m)


@router.delete("/{memory_id}")
async def forget_memory(memory_id: str, db=Depends(get_db), user: dict = Depends(get_current_user)):
    try:
        mid = uuid.UUID(memory_id)
    except (ValueError, AttributeError):
        raise AppError(400, "INVALID_ID", "Invalid memory id.")
    res = await db.execute(select(Memory).where(Memory.id == mid))
    m = res.scalar_one_or_none()
    if not m:
        raise AppError(404, "NOT_FOUND", "Memory not found.")
    if user["role"] not in ("founder", "admin") and (not m.user_id or str(m.user_id) != user.get("id")):
        raise AppError(403, "FORBIDDEN", "Not your memory.")
    m.status = "archived"
    await log_audit(db, "memory_archived", actor=user.get("email"), entity_type="memory", entity_id=memory_id)
    await db.commit()
    return {"id": memory_id, "status": "archived"}
