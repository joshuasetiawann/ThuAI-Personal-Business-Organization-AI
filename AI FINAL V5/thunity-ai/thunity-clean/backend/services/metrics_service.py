"""Real observability aggregations over persisted data (no dummy numbers)."""
from __future__ import annotations
import os
from datetime import datetime, timedelta
from typing import Dict
from sqlalchemy import select, func
from config import settings
from core.local_only import compliance_status, external_ai_providers_enabled
from db.models import (AgentRun, AgentMessage, ModelUsageLog, Decision, Task,
                       Document, WorkflowRun, ErrorLog, AuditLog, ApprovalRequest)


def last_backup() -> str:
    d = settings.BACKUP_DIR
    try:
        files = [os.path.join(d, f) for f in os.listdir(d)]
        files = [f for f in files if os.path.isfile(f)]
        if not files:
            return "never"
        return datetime.utcfromtimestamp(max(os.path.getmtime(f) for f in files)).isoformat()
    except Exception:
        return "never"


async def overview(db) -> Dict:
    since = datetime.utcnow() - timedelta(days=1)
    runs_today = (await db.execute(select(func.count()).select_from(AgentRun)
                                   .where(AgentRun.created_at >= since))).scalar() or 0
    avg_latency = (await db.execute(select(func.avg(AgentRun.total_latency_ms)))).scalar()
    failed_runs = (await db.execute(select(func.count()).select_from(AgentRun)
                                    .where(AgentRun.status == "failed"))).scalar() or 0
    errors = (await db.execute(select(func.count()).select_from(ErrorLog))).scalar() or 0

    async def count(model, **w):
        q = select(func.count()).select_from(model)
        for k, v in w.items():
            q = q.where(getattr(model, k) == v)
        return (await db.execute(q)).scalar() or 0

    async def acount(action):
        return (await db.execute(select(func.count()).select_from(AuditLog)
                                 .where(AuditLog.action == action))).scalar() or 0

    return {
        "agent_runs_today": runs_today,
        "avg_latency_ms": round(float(avg_latency), 1) if avg_latency else 0,
        "failed_agent_runs": failed_runs,
        "error_count": errors,
        "decisions": {s: await count(Decision, status=s)
                      for s in ["draft", "pending_approval", "approved", "rejected", "executed"]},
        "tasks": {s: await count(Task, status=s) for s in ["backlog", "todo", "doing", "done"]},
        "documents_total": await count(Document),
        "documents_unverified": await count(Document, trust_level="untrusted"),
        "documents_deprecated": await count(Document, document_status="deprecated"),
        "workflow_runs_total": await count(WorkflowRun),
        "workflow_failed": await count(WorkflowRun, status="failed"),
        "workflow_blocked_attempts": await acount("workflow_blocked"),
        "tool_called": await acount("tool_called"),
        "tool_blocked": await acount("tool_blocked"),
        "local_only_blocks": await acount("external_provider_blocked"),
        "pending_approvals": await count(ApprovalRequest, status="pending"),
        "hardware_warning": "GPU acceleration unconfirmed (RX 6600 XT / gfx1032); "
                            "Ollama may run on CPU fallback — multi-agent runs may be slow.",
        "local_only_status": compliance_status(),
        "external_ai_providers_enabled": external_ai_providers_enabled(),
        "last_backup": last_backup(),
    }


async def models(db) -> Dict:
    rows = (await db.execute(
        select(ModelUsageLog.model, func.count(), func.avg(ModelUsageLog.latency_ms))
        .group_by(ModelUsageLog.model))).all()
    return {"models": [{"model": m, "calls": c, "avg_latency_ms": round(float(l), 1) if l else 0}
                       for m, c, l in rows]}


async def agents(db) -> Dict:
    rows = (await db.execute(
        select(AgentMessage.agent_name, func.count(), func.avg(AgentMessage.latency_ms))
        .group_by(AgentMessage.agent_name))).all()
    return {"agents": [{"agent": a, "messages": c, "avg_latency_ms": round(float(l), 1) if l else 0}
                       for a, c, l in rows]}


async def knowledge(db) -> Dict:
    total = (await db.execute(select(func.count()).select_from(Document))).scalar() or 0
    by_status = (await db.execute(select(Document.document_status, func.count())
                                  .group_by(Document.document_status))).all()
    by_trust = (await db.execute(select(Document.trust_level, func.count())
                                 .group_by(Document.trust_level))).all()
    return {"documents_total": total,
            "by_status": {s: c for s, c in by_status},
            "by_trust": {t: c for t, c in by_trust}}


async def workflows(db) -> Dict:
    rows = (await db.execute(select(WorkflowRun.workflow_name, WorkflowRun.status, func.count())
                             .group_by(WorkflowRun.workflow_name, WorkflowRun.status))).all()
    agg: Dict = {}
    for name, status, c in rows:
        agg.setdefault(name, {})[status] = c
    return {"workflows": agg}
