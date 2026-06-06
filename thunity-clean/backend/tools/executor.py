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
