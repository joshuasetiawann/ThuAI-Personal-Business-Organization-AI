"""Local backup — founder/admin-triggered, IN-PROCESS database snapshot written to
the local BACKUP_DIR volume. No external upload, ever; secrets (password_hash) are
NEVER exported. This is the in-container counterpart to scripts/backup-local.sh
(which needs host docker access for a full pg_dump): it captures the structured
"company brain" as a timestamped local JSON snapshot the founder can trigger from the
UI, so the irreplaceable local data finally has an accessible safety net.
Restore stays CLI-only (destructive) by design."""
from __future__ import annotations
import json
import os
import uuid as _uuid
from datetime import datetime, date
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy import select
from api.deps import get_db, get_current_user, require_role
from core.errors import AppError
from core.audit import log_audit
from config import settings
from db import models as M

router = APIRouter()

# Structured "brain" tables included in the snapshot. password_hash is NEVER exported.
_SNAPSHOT = [
    ("users", M.User), ("conversations", M.Conversation), ("messages", M.Message),
    ("memories", M.Memory), ("documents", M.Document), ("decisions", M.Decision),
    ("tasks", M.Task), ("approval_requests", M.ApprovalRequest), ("workflow_runs", M.WorkflowRun),
    ("prompt_versions", M.PromptVersion), ("reports", M.Report), ("audit_logs", M.AuditLog),
]
_REDACT = {"password_hash"}


def _val(v):
    if isinstance(v, _uuid.UUID):
        return str(v)
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    return v


def _row(obj) -> dict:
    return {c.name: _val(getattr(obj, c.name)) for c in obj.__table__.columns if c.name not in _REDACT}


@router.get("/list")
async def list_backups(user: dict = Depends(get_current_user)):
    d = Path(settings.BACKUP_DIR)
    items = []
    if d.exists():
        for p in sorted(d.glob("snapshot_*.json"), reverse=True):
            try:
                st = p.stat()
                items.append({"name": p.name, "size_bytes": st.st_size,
                              "created_at": datetime.utcfromtimestamp(st.st_mtime).isoformat()})
            except OSError:
                continue
    return {"backups": items, "dir": str(d)}


@router.post("/run")
async def run_backup(db=Depends(get_db), user: dict = Depends(require_role("admin"))):
    """Write a timestamped local JSON snapshot of the structured brain to BACKUP_DIR.
    Founder/admin only. Local-only: nothing is ever uploaded."""
    out_dir = Path(settings.BACKUP_DIR)
    try:
        out_dir.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        raise AppError(500, "BACKUP_DIR_UNWRITABLE", f"Cannot write to backup directory: {e}")

    snapshot: dict = {"_meta": {"created_at": datetime.utcnow().isoformat(),
                                "created_by": user.get("email"), "kind": "db_snapshot_json"}}
    counts: dict = {}
    for name, model in _SNAPSHOT:
        try:
            rows = (await db.execute(select(model))).scalars().all()
            snapshot[name] = [_row(r) for r in rows]
            counts[name] = len(rows)
        except Exception as e:       # a missing/!ready table must not abort the whole backup
            snapshot[name] = []
            counts[name] = f"error: {str(e)[:80]}"

    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    path = out_dir / f"snapshot_{ts}.json"
    try:
        path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=1), encoding="utf-8")
    except OSError as e:
        raise AppError(500, "BACKUP_WRITE_FAILED", f"Could not write snapshot: {e}")

    size = os.path.getsize(path)
    await log_audit(db, "backup_created", actor=user.get("email"), actor_role=user.get("role"),
                    entity_type="backup", entity_id=path.name,
                    metadata={"counts": counts, "size_bytes": size})
    await db.commit()
    return {"ok": True, "name": path.name, "size_bytes": size, "counts": counts,
            "note": "Local JSON snapshot of the structured database. Stored locally only — never uploaded."}
