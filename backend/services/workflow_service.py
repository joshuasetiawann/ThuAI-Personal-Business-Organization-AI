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


# ── Native LOCAL workflow execution ─────────────────────────────────────────
# Safe, low-risk workflows run entirely in-backend from local data and produce a
# real Report artifact — no n8n, no external/destructive action. Audited via the
# persisted WorkflowRun + the route's audit log. Higher-risk workflows are NOT
# given native handlers; they remain n8n-gated (and report honestly if not built).
async def _native_generate_local_report(db, triggered_by, payload):
    from services import metrics_service
    from db.models import Report
    m = await metrics_service.overview(db)
    decs = m.get("decisions") or {}
    tasks = m.get("tasks") or {}
    lines = [
        "# Local Operations Report",
        f"_Generated locally by Thunity · {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}_",
        "",
        "## Snapshot",
        f"- AI Council runs (24h): **{m.get('agent_runs_today', 0)}**",
        f"- Decisions: **{sum(decs.values())}** (draft {decs.get('draft', 0)} · "
        f"approved {decs.get('approved', 0)} · executed {decs.get('executed', 0)})",
        f"- Tasks: **{sum(tasks.values())}** (todo {tasks.get('todo', 0)} · "
        f"doing {tasks.get('doing', 0)} · done {tasks.get('done', 0)})",
        f"- Knowledge documents: **{m.get('documents_total', 0)}** "
        f"({m.get('documents_unverified', 0)} unverified)",
        f"- Pending approvals: **{m.get('pending_approvals', 0)}**",
        f"- Workflow runs total: **{m.get('workflow_runs_total', 0)}**",
        "",
        "## Posture",
        f"- Local-only status: **{m.get('local_only_status', 'unknown')}**",
        f"- External AI providers enabled: **{m.get('external_ai_providers_enabled', False)}**",
        f"- Last backup: **{m.get('last_backup', 'never')}**",
        "",
        "_Read-only summary of local data. No external calls were made._",
    ]
    r = Report(title="Local Operations Report", content="\n".join(lines),
               source_type="workflow", created_by=triggered_by)
    db.add(r)
    await db.flush()
    return {"report_id": str(r.id), "title": r.title}


async def _native_create_daily_brief(db, triggered_by, payload):
    from services import metrics_service
    from db.models import Report
    m = await metrics_service.overview(db)
    decs = m.get("decisions") or {}
    attention = []
    if (m.get("pending_approvals") or 0) > 0:
        attention.append(f"{m['pending_approvals']} approval(s) awaiting your decision")
    if decs.get("draft"):
        attention.append(f"{decs['draft']} draft decision(s) to review")
    if (m.get("documents_unverified") or 0) > 0:
        attention.append(f"{m['documents_unverified']} unverified knowledge document(s)")
    if m.get("last_backup", "never") == "never":
        attention.append("no local backup has been taken yet")
    if not attention:
        attention.append("nothing urgent — systems nominal")
    lines = [
        f"# Founder Daily Brief — {datetime.utcnow().strftime('%Y-%m-%d')}",
        f"_Generated locally by Thunity · {datetime.utcnow().strftime('%H:%M UTC')}_",
        "",
        "## What needs your attention",
        *[f"- {a}" for a in attention],
        "",
        "## At a glance",
        f"- Local-only status: **{m.get('local_only_status', 'unknown')}**",
        f"- AI Council runs (24h): **{m.get('agent_runs_today', 0)}**",
        f"- Open decisions (draft+pending): **{decs.get('draft', 0) + decs.get('pending_approval', 0)}**",
        f"- Knowledge documents: **{m.get('documents_total', 0)}**",
        "",
        "_The AI proposes; the founder decides. Read-only local summary._",
    ]
    r = Report(title="Founder Daily Brief", content="\n".join(lines),
               source_type="workflow", created_by=triggered_by)
    db.add(r)
    await db.flush()
    return {"report_id": str(r.id), "title": r.title}


NATIVE_WORKFLOWS = {
    "generate_local_report": _native_generate_local_report,
    "create_daily_brief": _native_create_daily_brief,
}


async def trigger(db, name: str, triggered_by: str, approval_id=None, payload: dict = None,
                  source_decision_id=None, source_task_id=None) -> WorkflowRun:
    run = WorkflowRun(workflow_name=name, triggered_by=triggered_by, approval_id=approval_id,
                      status="running", source_decision_id=source_decision_id,
                      source_task_id=source_task_id)
    db.add(run)
    await db.flush()
    # Native local execution first — completes honestly with a real local artifact,
    # no external dependency. (Only safe, low-risk report workflows are native.)
    native = NATIVE_WORKFLOWS.get(name)
    if native is not None:
        try:
            result = await native(db, triggered_by, payload or {})
            run.status = "completed"
            rid = result.get("report_id") if isinstance(result, dict) else None
            run.logs = "native:local" + (f" report={rid}" if rid else "")
            if rid:
                import uuid as _uuid
                try:
                    run.output_artifact_id = _uuid.UUID(str(rid))   # link run -> Report artifact
                except (ValueError, TypeError):
                    pass
        except Exception as e:
            run.status, run.error_message = "failed", f"native: {e}"
        run.completed_at = datetime.utcnow()
        await db.flush()
        return run
    if not settings.N8N_ENABLED:
        run.status, run.error_message = "skipped", "N8N_ENABLED=false"
        await db.flush()
        return run
    try:
        url = f"{settings.N8N_URL}/webhook/{name}"
        async with httpx.AsyncClient(timeout=30.0) as c:
            r = await c.post(url, json=payload or {})
            run.logs = f"HTTP {r.status_code}"
            if r.status_code in (404, 405):
                # The webhook for this allow-listed workflow isn't built/active in
                # n8n yet. That is NOT a failure of Thunity — it's an unconfigured
                # automation. Report it honestly as 'skipped' so the UI never shows
                # a healthy backend as "failed". (Configure the webhook in n8n to
                # turn this into a real 'completed' run.)
                run.status = "skipped"
                run.error_message = "n8n webhook not configured for this workflow"
            else:
                run.status = "completed" if r.status_code < 400 else "failed"
                if r.status_code >= 400:
                    run.error_message = f"n8n returned HTTP {r.status_code}"
    except Exception as e:
        run.status, run.error_message = "failed", str(e)
    run.completed_at = datetime.utcnow()
    await db.flush()
    return run
