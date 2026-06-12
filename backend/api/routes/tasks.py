"""Task layer / mission board."""
from __future__ import annotations
import uuid
from datetime import date, datetime
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from api.deps import get_db, get_current_user, require_permission
from core.permissions import Perm
from core.errors import AppError, parse_uuid
from core.audit import log_audit
from db.models import Task, Decision
from services import task_service

router = APIRouter()


class TaskCreate(BaseModel):
    title: str
    description: str = ""
    priority: str = "medium"
    owner: str | None = None
    risk_level: str = "low"
    due_date: str | None = None


class TaskPatch(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: str | None = None
    status: str | None = None
    owner: str | None = None
    due_date: str | None = None


def _parse_date(s):
    return date.fromisoformat(s) if s else None


@router.post("")
async def create(req: TaskCreate, db=Depends(get_db),
                 user: dict = Depends(require_permission(Perm.CREATE_TASKS))):
    t = await task_service.create_task(db, title=req.title, description=req.description,
                                       priority=req.priority, owner=req.owner, risk_level=req.risk_level,
                                       due_date=_parse_date(req.due_date), created_by=user["email"])
    await log_audit(db, "task_created", actor=user["email"], entity_type="task", entity_id=str(t.id))
    await db.commit()
    return _brief(t)


@router.get("")
async def list_tasks(status: str | None = None, db=Depends(get_db),
                     user: dict = Depends(require_permission(Perm.CREATE_TASKS)),
                     limit: int = Query(100, le=500), offset: int = Query(0, ge=0)):
    q = select(Task).order_by(Task.created_at.desc())
    if status:
        q = q.where(Task.status == status)
    q = q.limit(limit).offset(offset)
    rows = (await db.execute(q)).scalars().all()
    return {"tasks": [_brief(t) for t in rows], "total": len(rows)}


@router.get("/{task_id}")
async def get_task(task_id: str, db=Depends(get_db),
                   user: dict = Depends(require_permission(Perm.CREATE_TASKS))):
    t = await _get(db, task_id)
    return {**_brief(t), "description": t.description,
            "source_decision_id": str(t.source_decision_id) if t.source_decision_id else None}


@router.patch("/{task_id}")
async def patch_task(task_id: str, req: TaskPatch, db=Depends(get_db),
                     user: dict = Depends(require_permission(Perm.CREATE_TASKS))):
    t = await _get(db, task_id)
    if req.status and req.status not in task_service.VALID_STATUS:
        raise AppError(400, "BAD_STATUS", f"status must be one of {sorted(task_service.VALID_STATUS)}")
    for f in ("title", "description", "priority", "status", "owner"):
        v = getattr(req, f)
        if v is not None:
            setattr(t, f, v)
    if req.due_date is not None:
        t.due_date = _parse_date(req.due_date)
    await log_audit(db, "task_change", actor=user["email"], entity_type="task", entity_id=task_id,
                    metadata={"status": t.status})
    await db.commit()
    return _brief(t)


@router.post("/from-decision/{decision_id}")
async def from_decision(decision_id: str, db=Depends(get_db),
                        user: dict = Depends(require_permission(Perm.CREATE_TASKS))):
    d = (await db.execute(select(Decision).where(
        Decision.id == parse_uuid(decision_id, "decision id")))).scalar_one_or_none()
    if not d:
        raise AppError(404, "NOT_FOUND", "Decision not found.")
    t = await task_service.create_from_decision(db, d, created_by=user["email"])
    await log_audit(db, "task_created", actor=user["email"], entity_type="task", entity_id=str(t.id),
                    metadata={"from_decision": decision_id})
    await db.commit()
    return _brief(t)


async def _get(db, task_id: str) -> Task:
    t = (await db.execute(select(Task).where(
        Task.id == parse_uuid(task_id, "task id")))).scalar_one_or_none()
    if not t:
        raise AppError(404, "NOT_FOUND", "Task not found.")
    return t


def _brief(t: Task) -> dict:
    overdue = bool(t.due_date and t.status not in ("done", "cancelled") and t.due_date < date.today())
    return {"id": str(t.id), "title": t.title, "status": t.status, "priority": t.priority,
            "owner": t.owner, "risk_level": t.risk_level,
            "due_date": t.due_date.isoformat() if t.due_date else None, "overdue": overdue,
            "created_at": t.created_at.isoformat()}
