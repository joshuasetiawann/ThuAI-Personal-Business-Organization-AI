"""Decision ledger. Approve/reject require APPROVE_DECISION; executing a
high/critical decision is approval-gated."""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from api.deps import get_db, get_current_user, require_permission
from core.permissions import Perm
from core.errors import AppError
from core.audit import log_audit
from db.models import Decision, ApprovalRequest
from services import decision_service, approval_service

router = APIRouter()


class DecisionCreate(BaseModel):
    title: str
    decision_text: str = ""
    summary: str = ""
    risk_level: str = "medium"
    conversation_id: str | None = None
    agent_run_id: str | None = None


class DecisionPatch(BaseModel):
    title: str | None = None
    decision_text: str | None = None
    summary: str | None = None
    risk_level: str | None = None
    status: str | None = None


@router.post("")
async def create(req: DecisionCreate, db=Depends(get_db),
                 user: dict = Depends(require_permission(Perm.CREATE_DRAFT_DECISION))):
    d = await decision_service.create_decision(db, title=req.title, decision_text=req.decision_text,
                                               summary=req.summary, risk_level=req.risk_level,
                                               conversation_id=req.conversation_id,
                                               agent_run_id=req.agent_run_id, created_by=user["email"])
    await log_audit(db, "decision_created", actor=user["email"], entity_type="decision", entity_id=str(d.id))
    await db.commit()
    return _brief(d)


@router.get("")
async def list_decisions(db=Depends(get_db), user: dict = Depends(get_current_user),
                         limit: int = Query(100, le=500), offset: int = Query(0, ge=0)):
    q = select(Decision).order_by(Decision.created_at.desc())
    if user["role"] == "viewer":          # viewers: approved only
        q = q.where(Decision.status == "approved")
    q = q.limit(limit).offset(offset)
    rows = (await db.execute(q)).scalars().all()
    return {"decisions": [_brief(d) for d in rows], "total": len(rows)}


@router.get("/{decision_id}")
async def get_decision(decision_id: str, db=Depends(get_db), user: dict = Depends(get_current_user)):
    d = await _get(db, decision_id)
    if user["role"] == "viewer" and d.status != "approved":
        raise AppError(403, "FORBIDDEN", "Viewers can only read approved decisions.")
    return {**_brief(d), "decision_text": d.decision_text, "summary": d.summary,
            "evidence": d.evidence_json, "created_by": d.created_by, "approved_by": d.approved_by}


@router.patch("/{decision_id}")
async def patch_decision(decision_id: str, req: DecisionPatch, db=Depends(get_db),
                         user: dict = Depends(require_permission(Perm.CREATE_DRAFT_DECISION))):
    d = await _get(db, decision_id)
    if user["role"] not in ("founder", "admin") and d.created_by != user["email"]:
        raise AppError(403, "FORBIDDEN", "Only the creator or an admin can edit this decision.")
    for f in ("title", "decision_text", "summary", "risk_level", "status"):
        v = getattr(req, f)
        if v is not None:
            if f == "status" and v not in decision_service.VALID_STATUS:
                raise AppError(400, "BAD_STATUS", "Invalid decision status.")
            setattr(d, f, v)
    await log_audit(db, "decision_updated", actor=user["email"], entity_type="decision", entity_id=decision_id)
    await db.commit()
    return _brief(d)


@router.post("/{decision_id}/approve")
async def approve(decision_id: str, db=Depends(get_db),
                  user: dict = Depends(require_permission(Perm.APPROVE_DECISION))):
    d = await _get(db, decision_id)
    await decision_service.set_status(db, d, "approved", by=user["email"])
    await log_audit(db, "decision_status_change", actor=user["email"], actor_role=user["role"],
                    entity_type="decision", entity_id=decision_id, metadata={"status": "approved"})
    await db.commit()
    return _brief(d)


@router.post("/{decision_id}/reject")
async def reject(decision_id: str, db=Depends(get_db),
                 user: dict = Depends(require_permission(Perm.APPROVE_DECISION))):
    d = await _get(db, decision_id)
    await decision_service.set_status(db, d, "rejected", by=user["email"])
    await log_audit(db, "decision_status_change", actor=user["email"], entity_type="decision",
                    entity_id=decision_id, metadata={"status": "rejected"})
    await db.commit()
    return _brief(d)


@router.post("/{decision_id}/execute")
async def execute(decision_id: str, approval_id: str | None = None, db=Depends(get_db),
                  user: dict = Depends(require_permission(Perm.APPROVE_DECISION))):
    d = await _get(db, decision_id)
    if d.status != "approved":
        raise AppError(409, "NOT_APPROVED", "Only an approved decision can be executed.")
    if d.risk_level in ("high", "critical") and not approval_id:
        req = await approval_service.create_request(db, "execute_decision", {"decision_id": decision_id},
                                                    d.risk_level, user["email"])
        await db.commit()
        return JSONResponse(status_code=202, content={"approval_required": True, "approval_id": str(req.id),
                                                      "risk_level": d.risk_level})
    if d.risk_level in ("high", "critical"):
        appr = (await db.execute(select(ApprovalRequest).where(
            ApprovalRequest.id == uuid.UUID(approval_id)))).scalar_one_or_none()
        if not appr or appr.status != "approved" or appr.payload_json.get("decision_id") != decision_id:
            raise AppError(403, "APPROVAL_REQUIRED", "A valid approved approval is required.")
    await decision_service.set_status(db, d, "executed", by=user["email"])
    await log_audit(db, "decision_status_change", actor=user["email"], entity_type="decision",
                    entity_id=decision_id, metadata={"status": "executed"})
    await db.commit()
    return _brief(d)


async def _get(db, decision_id: str) -> Decision:
    d = (await db.execute(select(Decision).where(Decision.id == uuid.UUID(decision_id)))).scalar_one_or_none()
    if not d:
        raise AppError(404, "NOT_FOUND", "Decision not found.")
    return d


def _brief(d: Decision) -> dict:
    return {"id": str(d.id), "title": d.title, "status": d.status, "risk_level": d.risk_level,
            "agent_run_id": str(d.agent_run_id) if d.agent_run_id else None,
            "created_at": d.created_at.isoformat()}
