"""n8n workflow governance. Allow-list only; high/critical risk is approval-gated;
runs persisted. Arbitrary workflow names are rejected."""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from api.deps import get_db, get_current_user, require_permission
from core.permissions import Perm
from core.errors import AppError
from core.audit import log_audit
from db.models import WorkflowRun, ApprovalRequest
from services import workflow_service, approval_service

router = APIRouter()


class TriggerRequest(BaseModel):
    workflow_name: str
    payload: dict = {}
    approval_id: str | None = None
    source_decision_id: str | None = None
    source_task_id: str | None = None


@router.get("/allowed")
async def allowed(user: dict = Depends(get_current_user)):
    return {"allowed_workflows": [
        {"name": n, "risk": meta["risk"],
         "required_permission": getattr(meta["permission"], "value", str(meta["permission"]))}
        for n, meta in workflow_service.ALLOWED_WORKFLOWS.items()]}


@router.post("/trigger")
async def trigger(req: TriggerRequest, db=Depends(get_db),
                  user: dict = Depends(require_permission(Perm.RUN_APPROVED_WORKFLOW))):
    if not workflow_service.is_allowed(req.workflow_name):
        await log_audit(db, "workflow_blocked", actor=user["email"], entity_type="workflow",
                        entity_id=req.workflow_name, metadata={"reason": "not_in_allowlist"})
        await db.commit()
        raise AppError(403, "WORKFLOW_NOT_ALLOWED",
                       f"Workflow '{req.workflow_name}' is not in the allow-list.",
                       suggested_action="Only registered workflows can be triggered.")
    if workflow_service.needs_approval(req.workflow_name) and not req.approval_id:
        a = await approval_service.create_request(db, "execute_workflow",
                                                  {"workflow_name": req.workflow_name},
                                                  workflow_service.risk_of(req.workflow_name), user["email"])
        await log_audit(db, "approval_requested", actor=user["email"], entity_type="workflow",
                        entity_id=req.workflow_name)
        await db.commit()
        return JSONResponse(status_code=202, content={
            "approval_required": True, "approval_id": str(a.id),
            "risk_level": workflow_service.risk_of(req.workflow_name)})
    if workflow_service.needs_approval(req.workflow_name):
        appr = (await db.execute(select(ApprovalRequest).where(
            ApprovalRequest.id == uuid.UUID(req.approval_id)))).scalar_one_or_none()
        if not appr or appr.status != "approved" or appr.payload_json.get("workflow_name") != req.workflow_name:
            raise AppError(403, "APPROVAL_REQUIRED", "A valid approved approval is required.")
    run = await workflow_service.trigger(
        db, req.workflow_name, user["email"],
        approval_id=uuid.UUID(req.approval_id) if req.approval_id else None,
        payload=req.payload,
        source_decision_id=uuid.UUID(req.source_decision_id) if req.source_decision_id else None,
        source_task_id=uuid.UUID(req.source_task_id) if req.source_task_id else None)
    event = "workflow_failed" if run.status == "failed" else "workflow_triggered"
    await log_audit(db, event, actor=user["email"], actor_role=user["role"],
                    entity_type="workflow", entity_id=req.workflow_name,
                    metadata={"run_id": str(run.id), "status": run.status})
    await db.commit()
    return {"run_id": str(run.id), "workflow_name": run.workflow_name, "status": run.status}


@router.get("/runs")
async def runs(db=Depends(get_db), user: dict = Depends(require_permission(Perm.RUN_APPROVED_WORKFLOW))):
    rows = (await db.execute(select(WorkflowRun).order_by(WorkflowRun.created_at.desc()).limit(100))).scalars().all()
    return {"runs": [{"id": str(r.id), "workflow_name": r.workflow_name, "status": r.status,
                      "created_at": r.created_at.isoformat()} for r in rows]}


@router.get("/runs/{run_id}")
async def run_detail(run_id: str, db=Depends(get_db),
                     user: dict = Depends(require_permission(Perm.RUN_APPROVED_WORKFLOW))):
    r = (await db.execute(select(WorkflowRun).where(WorkflowRun.id == uuid.UUID(run_id)))).scalar_one_or_none()
    if not r:
        raise AppError(404, "NOT_FOUND", "Workflow run not found.")
    return {"id": str(r.id), "workflow_name": r.workflow_name, "status": r.status, "logs": r.logs,
            "error_message": r.error_message, "approval_id": str(r.approval_id) if r.approval_id else None,
            "source_decision_id": str(r.source_decision_id) if r.source_decision_id else None,
            "source_task_id": str(r.source_task_id) if r.source_task_id else None}
