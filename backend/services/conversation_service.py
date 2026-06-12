"""Conversation + message persistence with ownership rules."""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import select, update
from db.models import Conversation, Message


async def create_conversation(db, user_id: Optional[str], title: str = "New conversation") -> Conversation:
    conv = Conversation(user_id=uuid.UUID(user_id) if user_id else None, title=title, status="active")
    db.add(conv)
    await db.flush()
    return conv


async def get_conversation(db, conv_id: str) -> Optional[Conversation]:
    try:
        cid = uuid.UUID(str(conv_id))
    except (ValueError, TypeError):
        return None       # malformed id behaves like "not found", never a 500
    res = await db.execute(select(Conversation).where(Conversation.id == cid))
    return res.scalar_one_or_none()


def can_access(user: dict, conv: Conversation) -> bool:
    if user["role"] in ("founder", "admin"):
        return True
    return conv.user_id is not None and str(conv.user_id) == user["id"]


async def add_message(db, conv_id: str, role: str, content: str,
                      agent_name: str = None, metadata: dict = None) -> Message:
    cid = uuid.UUID(str(conv_id))
    msg = Message(conversation_id=cid, role=role, content=content,
                  agent_name=agent_name, metadata_json=metadata or {})
    db.add(msg)
    # Bump the conversation's last-activity time so "Recent Conversations" reflects the
    # REAL last chat time (not when it was created) and sorts by latest activity.
    await db.execute(update(Conversation).where(Conversation.id == cid)
                     .values(updated_at=datetime.utcnow()))
    await db.flush()
    return msg


async def get_recent_messages(db, conv_id: str, limit: int = 12):
    """Last `limit` messages of a conversation in chronological order — for
    feeding prior turns back into the model as context (read-only; no side effects)."""
    res = await db.execute(
        select(Message).where(Message.conversation_id == uuid.UUID(str(conv_id)))
        .order_by(Message.created_at.desc(), Message.id.desc()).limit(limit))
    msgs = list(res.scalars().all())
    msgs.reverse()
    return msgs
