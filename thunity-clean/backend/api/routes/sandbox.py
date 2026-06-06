"""Local sandbox (BASIC) — records runs/logs only; no arbitrary code execution yet."""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from api.deps import get_db, require_permission
from core.permissions import Perm
from db.models import SandboxRun
from services import sandbox_service

router = APIRouter()


class SandboxCreate(BaseModel):
    task_type: str = "analysis"
    input_files: list = []
    logs: str = ""


@router.post("")
async def create(req: SandboxCreate, db=Depends(get_db),
                 user: dict = Depends(require_permission(Perm.RUN_ANALYSIS))):
    run = await sandbox_service.create_run(db, requested_by=user["email"], task_type=req.task_type,
                                           input_files=req.input_files, logs=req.logs)
    await db.commit()
    return {"id": str(run.id), "status": run.status, "no_network": sandbox_service.NO_NETWORK,
            "timeout_seconds": sandbox_service.DEFAULT_TIMEOUT_SECONDS,
            "note": "Records run metadata only; code execution sandbox is a documented later phase."}


@router.get("")
async def list_runs(db=Depends(get_db), user: dict = Depends(require_permission(Perm.RUN_ANALYSIS))):
    rows = (await db.execute(select(SandboxRun).order_by(SandboxRun.created_at.desc()))).scalars().all()
    return {"runs": [{"id": str(r.id), "task_type": r.task_type, "status": r.status,
                      "created_at": r.created_at.isoformat()} for r in rows]}
