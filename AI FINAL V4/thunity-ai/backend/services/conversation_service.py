"""Conversation + message persistence with ownership rules."""
from __future__ import annotations
import uuid
from typing import Optional
from sqlalchemy import select
from db.models import Conversation, Message


async def create_conversation(db, user_id: Optional[str], title: str = "New conversation") -> Conversation:
    conv = Conversation(user_id=uuid.UUID(user_id) if user_id else None, title=title, status="active")
    db.add(conv)
    await db.flush()
    return conv


async def get_conversation(db, conv_id: str) -> Optional[Conversation]:
    res = await db.execute(select(Conversation).where(Conversation.id == uuid.UUID(str(conv_id))))
    return res.scalar_one_or_none()


def can_access(user: dict, conv: Conversation) -> bool:
    if user["role"] in ("founder", "admin"):
        return True
    return conv.user_id is not None and str(conv.user_id) == user["id"]


async def add_message(db, conv_id: str, role: str, content: str,
                      agent_name: str = None, metadata: dict = None) -> Message:
    msg = Message(conversation_id=uuid.UUID(str(conv_id)), role=role, content=content,
                  agent_name=agent_name, metadata_json=metadata or {})
    db.add(msg)
    await db.flush()
    return msg
