"""Decision ledger logic + status transitions."""
from __future__ import annotations
import uuid
from datetime import datetime
from db.models import Decision

VALID_STATUS = {"draft", "pending_approval", "approved", "rejected", "revised", "executed", "archived"}


async def create_decision(db, *, title, decision_text="", summary="", risk_level="medium",
                          conversation_id=None, agent_run_id=None, evidence=None, created_by=None) -> Decision:
    d = Decision(title=title[:500], decision_text=decision_text, summary=summary,
                 risk_level=risk_level, status="draft",
                 conversation_id=uuid.UUID(str(conversation_id)) if conversation_id else None,
                 agent_run_id=uuid.UUID(str(agent_run_id)) if agent_run_id else None,
                 evidence_json=evidence or {}, created_by=created_by)
    db.add(d)
    await db.flush()
    return d


async def set_status(db, decision: Decision, status: str, by: str = None) -> Decision:
    if status not in VALID_STATUS:
        raise ValueError(f"Invalid status: {status}")
    decision.status = status
    if status in ("approved", "rejected"):
        decision.approved_by = by
    decision.updated_at = datetime.utcnow()
    await db.flush()
    return decision
