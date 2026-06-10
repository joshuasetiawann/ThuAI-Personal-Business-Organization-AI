"""Approval gate endpoints."""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from api.deps import get_db, get_current_user
from core.errors import AppError
from core.audit import log_audit
from db.models import ApprovalRequest
from services import approval_service

router = APIRouter()


class ApprovalCreate(BaseModel):
    requested_action: str
    risk_level: str = "medium"
    payload_json: dict = {}


class ResolveRequest(BaseModel):
    confirmation: str | None = None


@router.post("")
async def create(req: ApprovalCreate, db=Depends(get_db), user: dict = Depends(get_current_user)):
    if req.risk_level not in approval_service.RISK_LEVELS:
        raise AppError(400, "BAD_RISK", f"risk_level must be one of {approval_service.RISK_LEVELS}")
    a = await approval_service.create_request(db, req.requested_action, req.payload_json,
                                              req.risk_level, user["email"])
    await log_audit(db, "approval_requested", actor=user["email"], entity_type="approval", entity_id=str(a.id),
                    metadata={"action": req.requested_action, "risk": req.risk_level})
    await db.commit()
    return _brief(a)


@router.get("")
async def list_approvals(db=Depends(get_db), user: dict = Depends(get_current_user),
                         limit: int = Query(100, le=500), offset: int = Query(0, ge=0)):
    q = select(ApprovalRequest).order_by(ApprovalRequest.created_at.desc())
    if user["role"] not in ("founder", "admin"):
        q = q.where(ApprovalRequest.requested_by == user["email"])
    q = q.limit(limit).offset(offset)
    rows = (await db.execute(q)).scalars().all()
    return {"approvals": [_brief(a) for a in rows]}


@router.get("/pending")
async def pending(db=Depends(get_db), user: dict = Depends(get_current_user),
              limit: int = Query(100, le=500), offset: int = Query(0, ge=0)):
    rows = (await db.execute(select(ApprovalRequest).where(ApprovalRequest.status == "pending")
                             .order_by(ApprovalRequest.created_at.desc())
                             .limit(limit).offset(offset))).scalars().all()
    return {"pending": [_brief(a) for a in rows]}


@router.post("/{approval_id}/approve")
async def approve(approval_id: str, req: ResolveRequest, db=Depends(get_db),
                  user: dict = Depends(get_current_user)):
    return await _resolve(db, approval_id, user, True, req.confirmation)


@router.post("/{approval_id}/reject")
async def reject(approval_id: str, db=Depends(get_db), user: dict = Depends(get_current_user)):
    return await _resolve(db, approval_id, user, False, None)


async def _resolve(db, approval_id, user, approve: bool, confirmation):
    a = (await db.execute(select(ApprovalRequest).where(
        ApprovalRequest.id == uuid.UUID(approval_id)))).scalar_one_or_none()
    if not a:
        raise AppError(404, "NOT_FOUND", "Approval request not found.")
    if a.status != "pending":
        raise AppError(409, "ALREADY_RESOLVED", f"Approval already {a.status}.")
    try:
        await approval_service.resolve(db, a, user["role"], user["email"], approve, confirmation)
    except PermissionError as e:
        raise AppError(403, "FORBIDDEN", str(e))
    except ValueError as e:
        raise AppError(400, "CONFIRMATION_REQUIRED", str(e))
    await log_audit(db, "approval_resolved", actor=user["email"], actor_role=user["role"],
                    entity_type="approval", entity_id=approval_id, metadata={"status": a.status})
    await db.commit()
    return _brief(a)


def _brief(a: ApprovalRequest) -> dict:
    return {"id": str(a.id), "requested_action": a.requested_action, "risk_level": a.risk_level,
            "status": a.status, "requested_by": a.requested_by, "approved_by": a.approved_by,
            "confirmation_phrase": a.confirmation_phrase, "created_at": a.created_at.isoformat()}
