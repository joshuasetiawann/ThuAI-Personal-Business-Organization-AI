"""Runtime tool-registry ENFORCEMENT. Agents/automation may ONLY run registered
tools, and only with the caller's permission. Unregistered tools are blocked and
audited; high/critical-risk tools require an approved approval. No free-form calls.

Tools without a bound handler return status=not_implemented (honest — never a
fake success). Handlers are bound in HANDLERS as the system grows."""
from __future__ import annotations
from typing import Dict, Optional

from core.permissions import role_has_permission
from core.audit import log_audit
from core.errors import AppError
from tools.registry import get_tool

HANDLERS: Dict[str, object] = {}   # name -> async handler(db, user, args)


async def execute_tool(db, user: dict, name: str, args: Optional[dict] = None,
                       approval_id: Optional[str] = None) -> Dict:
    args = args or {}
    actor = (user or {}).get("email")
    role = (user or {}).get("role", "")

    tool = get_tool(name)
    if tool is None:                                  # block unregistered
        await log_audit(db, "tool_blocked", actor=actor, actor_role=role,
                        entity_type="tool", entity_id=name, metadata={"reason": "unregistered"})
        if db is not None:
            await db.commit()
        raise AppError(403, "TOOL_NOT_REGISTERED", f"Tool '{name}' is not registered.",
                       suggested_action="Agents may only use registered tools.")

    if not role_has_permission(role, tool["required_permission"]):   # permission check
        await log_audit(db, "tool_blocked", actor=actor, actor_role=role,
                        entity_type="tool", entity_id=name, metadata={"reason": "permission"})
        if db is not None:
            await db.commit()
        raise AppError(403, "TOOL_FORBIDDEN", f"Missing permission for tool '{name}'.")

    if tool["risk_level"] in ("high", "critical") and not approval_id:   # approval gate
        from services import approval_service
        a = await approval_service.create_request(
            db, "tool_execution", {"tool": name, "arg_keys": list(args.keys())},
            tool["risk_level"], actor)
        await log_audit(db, "tool_blocked", actor=actor, actor_role=role, entity_type="tool",
                        entity_id=name, metadata={"reason": "approval_required"})
        return {"tool": name, "approval_required": True, "approval_id": str(a.id),
                "risk_level": tool["risk_level"]}

    if tool["risk_level"] in ("high", "critical"):
        # approval_id supplied — it MUST be a valid, approved request for THIS tool
        import uuid as _uuid
        from sqlalchemy import select as _select
        from db.models import ApprovalRequest as _AR
        appr = None
        try:
            appr = (await db.execute(_select(_AR).where(
                _AR.id == _uuid.UUID(str(approval_id))))).scalar_one_or_none()
        except Exception:
            appr = None
        if (not appr or appr.status != "approved" or appr.requested_action != "tool_execution"
                or (appr.payload_json or {}).get("tool") != name):
            await log_audit(db, "tool_blocked", actor=actor, actor_role=role, entity_type="tool",
                            entity_id=name, metadata={"reason": "invalid_or_unapproved_approval"})
            if db is not None:
                await db.commit()
            raise AppError(403, "APPROVAL_REQUIRED",
                           "A valid approved approval is required for this tool.")

    if tool.get("audit", True):
        await log_audit(db, "tool_called", actor=actor, actor_role=role,
                        entity_type="tool", entity_id=name)

    handler = HANDLERS.get(name)
    if handler is None:
        return {"tool": name, "status": "not_implemented",
                "note": "Registered and authorized, but no handler is bound yet."}
    return {"tool": name, "status": "ok", "result": await handler(db, user, args)}


# ── Real handlers (bound below). Governance (registration + permission + approval)
#    is already enforced above; handlers just do the work and never fake success. ──
import uuid as _uuid
from sqlalchemy import select as _select


async def _h_search_knowledge_base(db, user, args):
    from services.knowledge_service import retrieve_context, format_grounding
    q = (args.get("query") or "").strip()
    if not q:
        raise AppError(400, "EMPTY_QUERY", "query is required.")
    sources = await retrieve_context(db, q, top_k=int(args.get("top_k") or 5))
    return {"query": q, "count": len(sources), "results": sources, "grounding": format_grounding(sources)}


async def _h_read_document(db, user, args):
    from db.models import Document, DocumentChunk
    did = args.get("document_id")
    if not did:
        raise AppError(400, "MISSING_ID", "document_id is required.")
    try:
        duid = _uuid.UUID(str(did))
    except Exception:
        raise AppError(400, "INVALID_ID", "Invalid document_id.")
    doc = (await db.execute(_select(Document).where(Document.id == duid))).scalar_one_or_none()
    if not doc:
        raise AppError(404, "NOT_FOUND", "Document not found.")
    chunks = (await db.execute(_select(DocumentChunk).where(DocumentChunk.document_id == duid)
                               .order_by(DocumentChunk.chunk_index).limit(5))).scalars().all()
    return {"document_id": str(doc.id), "filename": doc.filename, "trust_level": doc.trust_level,
            "document_status": doc.document_status, "chunk_count": doc.chunk_count,
            "preview": "\n".join(c.content for c in chunks)[:2000]}


async def _h_get_system_metrics(db, user, args):
    from services import metrics_service
    return await metrics_service.overview(db)


async def _h_create_decision_draft(db, user, args):
    from services import decision_service
    title = (args.get("title") or "").strip()
    if not title:
        raise AppError(400, "MISSING_TITLE", "title is required.")
    d = await decision_service.create_decision(
        db, title=title, decision_text=args.get("decision_text", ""),
        summary=args.get("summary", ""), risk_level=args.get("risk_level", "medium"),
        created_by=(user or {}).get("email"))
    return {"decision_id": str(d.id), "status": d.status, "title": d.title}


async def _h_create_task(db, user, args):
    from services import task_service
    title = (args.get("title") or "").strip()
    if not title:
        raise AppError(400, "MISSING_TITLE", "title is required.")
    t = await task_service.create_task(
        db, title=title, description=args.get("description", ""),
        priority=args.get("priority", "medium"), risk_level=args.get("risk_level", "low"),
        created_by=(user or {}).get("email"))
    return {"task_id": str(t.id), "status": t.status, "title": t.title}


async def _h_request_approval(db, user, args):
    from services import approval_service
    # Accept the schema-documented key 'requested_action' (and the legacy 'action').
    action = (args.get("requested_action") or args.get("action") or "manual_request").strip()
    a = await approval_service.create_request(
        db, action, args.get("payload") or {}, args.get("risk_level", "medium"),
        (user or {}).get("email"))
    return {"approval_id": str(a.id), "status": a.status, "requested_action": action}


async def _h_create_report(db, user, args):
    from db.models import Report
    title = (args.get("title") or "").strip()
    if not title:
        raise AppError(400, "MISSING_TITLE", "title is required.")
    r = Report(title=title, content=args.get("content", ""), source_type="tool",
               created_by=(user or {}).get("email"))
    db.add(r)
    await db.flush()
    return {"report_id": str(r.id), "title": r.title, "status": r.status}


async def _h_trigger_allowed_workflow(db, user, args):
    # Reached only after the approval gate above. Honest: returns the real run status
    # (e.g. 'skipped'/'failed' if no n8n workflow is defined — never a fake success).
    from services import workflow_service
    name = (args.get("workflow_name") or "").strip()
    if not name:
        raise AppError(400, "MISSING_WORKFLOW", "workflow_name is required.")
    run = await workflow_service.trigger(db, name, (user or {}).get("email"),
                                         payload=args.get("payload") or {})
    return {"workflow": name, "run_id": str(run.id), "status": run.status,
            "error": getattr(run, "error_message", None)}


HANDLERS.update({
    "search_knowledge_base": _h_search_knowledge_base,
    "read_document": _h_read_document,
    "get_system_metrics": _h_get_system_metrics,
    "create_decision_draft": _h_create_decision_draft,
    "create_task": _h_create_task,
    "request_approval": _h_request_approval,
    "create_report": _h_create_report,
    "trigger_allowed_workflow": _h_trigger_allowed_workflow,
})
