"""Approval policy. Risk tiers gate who may approve and whether a critical
confirmation phrase is required. AI never self-approves risky actions."""
from __future__ import annotations
from datetime import datetime
from db.models import ApprovalRequest

RISK_LEVELS = ["low", "medium", "high", "critical"]
CRITICAL_DEFAULT_PHRASE = "APPROVE DELETE"


def confirmation_required(risk: str) -> bool:
    return risk == "critical"


def can_resolve(role: str, risk: str) -> bool:
    if role == "founder":
        return True
    if role == "admin" and risk in ("low", "medium"):
        return True
    return False


async def create_request(db, requested_action: str, payload: dict, risk: str,
                         requested_by: str, confirmation_phrase: str = None) -> ApprovalRequest:
    req = ApprovalRequest(
        requested_action=requested_action, payload_json=payload or {}, risk_level=risk,
        requested_by=requested_by, status="pending",
        confirmation_phrase=(confirmation_phrase or CRITICAL_DEFAULT_PHRASE) if confirmation_required(risk) else None,
    )
    db.add(req)
    await db.flush()
    return req


async def resolve(db, req: ApprovalRequest, approver_role: str, approver: str,
                  approve: bool, confirmation: str = None) -> ApprovalRequest:
    if not can_resolve(approver_role, req.risk_level):
        raise PermissionError("Insufficient role to resolve this approval.")
    if approve and confirmation_required(req.risk_level):
        if (confirmation or "") != (req.confirmation_phrase or CRITICAL_DEFAULT_PHRASE):
            raise ValueError(f"Critical action requires confirmation phrase: '{req.confirmation_phrase}'.")
    req.status = "approved" if approve else "rejected"
    req.approved_by = approver
    req.resolved_at = datetime.utcnow()
    await db.flush()
    return req
