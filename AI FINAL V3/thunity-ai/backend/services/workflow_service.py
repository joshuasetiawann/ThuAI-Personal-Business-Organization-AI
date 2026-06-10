"""n8n workflow GOVERNANCE. Only allow-listed workflows may run; high/critical
risk requires approval; every run is persisted. n8n is local automation, never
a cloud brain. Arbitrary workflow names from callers are rejected."""
from __future__ import annotations
from datetime import datetime
import httpx
from config import settings
from core.permissions import Perm
from db.models import WorkflowRun

# name -> {risk, permission, description}
ALLOWED_WORKFLOWS = {
    "generate_local_report":      {"risk": "low",    "permission": Perm.RUN_APPROVED_WORKFLOW},
    "summarize_uploaded_document":{"risk": "low",    "permission": Perm.RUN_APPROVED_WORKFLOW},
    "create_daily_brief":         {"risk": "low",    "permission": Perm.RUN_APPROVED_WORKFLOW},
    "export_decision_to_markdown":{"risk": "medium", "permission": Perm.RUN_APPROVED_WORKFLOW},
    "ingest_client_data_csv":     {"risk": "medium", "permission": Perm.RUN_APPROVED_WORKFLOW},
    "purge_knowledge_base":       {"risk": "high",   "permission": Perm.EXECUTE_WORKFLOW},
}


def is_allowed(name: str) -> bool:
    return name in ALLOWED_WORKFLOWS


def risk_of(name: str) -> str:
    return ALLOWED_WORKFLOWS.get(name, {}).get("risk", "high")


def needs_approval(name: str) -> bool:
    return risk_of(name) in ("high", "critical")


async def trigger(db, name: str, triggered_by: str, approval_id=None, payload: dict = None,
                  source_decision_id=None, source_task_id=None) -> WorkflowRun:
    run = WorkflowRun(workflow_name=name, triggered_by=triggered_by, approval_id=approval_id,
                      status="running", source_decision_id=source_decision_id,
                      source_task_id=source_task_id)
    db.add(run)
    await db.flush()
    if not settings.N8N_ENABLED:
        run.status, run.error_message = "skipped", "N8N_ENABLED=false"
        await db.flush()
        return run
    try:
        url = f"{settings.N8N_URL}/webhook/{name}"
        async with httpx.AsyncClient(timeout=30.0) as c:
            r = await c.post(url, json=payload or {})
            run.status = "completed" if r.status_code < 400 else "failed"
            run.logs = f"HTTP {r.status_code}"
    except Exception as e:
        run.status, run.error_message = "failed", str(e)
    run.completed_at = datetime.utcnow()
    await db.flush()
    return run
