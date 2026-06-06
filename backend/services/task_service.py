"""Task layer / mission board logic."""
from __future__ import annotations
import uuid
from db.models import Task, Decision

VALID_STATUS = {"backlog", "todo", "doing", "blocked", "review", "done", "cancelled"}


async def create_task(db, *, title, description="", priority="medium", owner=None,
                      risk_level="low", source_decision_id=None, source_agent_run_id=None,
                      due_date=None, created_by=None) -> Task:
    t = Task(title=title[:500], description=description, priority=priority, status="backlog",
             owner=owner, risk_level=risk_level, due_date=due_date, created_by=created_by,
             source_decision_id=uuid.UUID(str(source_decision_id)) if source_decision_id else None,
             source_agent_run_id=uuid.UUID(str(source_agent_run_id)) if source_agent_run_id else None)
    db.add(t)
    await db.flush()
    return t


async def create_from_decision(db, decision: Decision, created_by=None) -> Task:
    return await create_task(db, title=f"Execute: {decision.title}",
                             description=decision.summary or decision.decision_text[:1000],
                             risk_level=decision.risk_level, source_decision_id=decision.id,
                             created_by=created_by)
