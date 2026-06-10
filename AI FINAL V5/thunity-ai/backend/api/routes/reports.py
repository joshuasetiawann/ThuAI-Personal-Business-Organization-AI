"""Reports — read-only access to artifacts produced by governed workflows (e.g.
generate_local_report / create_daily_brief) and the create_report tool. There is no
creation endpoint here on purpose: reports are emitted by governed automation, not
free-form. Read-only, permission-gated."""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from api.deps import get_db, get_current_user, require_permission
from core.permissions import Perm
from core.errors import AppError
from db.models import Report

router = APIRouter()


def _brief(r: Report) -> dict:
    return {"id": str(r.id), "title": r.title, "source_type": r.source_type,
            "status": r.status, "created_by": r.created_by,
            "created_at": r.created_at.isoformat() if r.created_at else None}


@router.get("")
async def list_reports(db=Depends(get_db),
                       user: dict = Depends(require_permission(Perm.READ_DASHBOARD)),
                       limit: int = Query(50, le=200), offset: int = Query(0, ge=0)):
    rows = (await db.execute(
        select(Report).order_by(Report.created_at.desc()).limit(limit).offset(offset))).scalars().all()
    total = (await db.execute(select(func.count()).select_from(Report))).scalar() or 0
    return {"reports": [_brief(r) for r in rows], "total": total}


@router.get("/{report_id}")
async def get_report(report_id: str, db=Depends(get_db),
                     user: dict = Depends(require_permission(Perm.READ_DASHBOARD))):
    try:
        rid = uuid.UUID(report_id)
    except (ValueError, AttributeError):
        raise AppError(400, "INVALID_ID", "Invalid report id.")
    r = (await db.execute(select(Report).where(Report.id == rid))).scalar_one_or_none()
    if not r:
        raise AppError(404, "NOT_FOUND", "Report not found.")
    return {**_brief(r), "content": r.content}
