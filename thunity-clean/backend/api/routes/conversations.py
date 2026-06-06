"""Conversation + message persistence (real, not stubs)."""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, or_
from api.deps import get_db, get_current_user
from core.errors import AppError
from db.models import Conversation, Message
from services import conversation_service as cs

router = APIRouter()


class ConversationCreate(BaseModel):
    title: str = "New conversation"


class MessageCreate(BaseModel):
    role: str = "user"
    content: str
    metadata_json: dict = {}


@router.post("")
async def create_conversation(req: ConversationCreate, db=Depends(get_db),
                              user: dict = Depends(get_current_user)):
    conv = await cs.create_conversation(db, user["id"], req.title)
    await db.commit()
    return {"id": str(conv.id), "title": conv.title, "status": conv.status,
            "created_at": conv.created_at.isoformat()}


@router.get("")
async def list_conversations(db=Depends(get_db), user: dict = Depends(get_current_user),
                             limit: int = Query(100, le=500), offset: int = Query(0, ge=0)):
    q = select(Conversation).order_by(Conversation.updated_at.desc())
    if user["role"] not in ("founder", "admin"):
        q = q.where(Conversation.user_id == uuid.UUID(user["id"]))
    q = q.limit(limit).offset(offset)
    rows = (await db.execute(q)).scalars().all()
    return {"conversations": [{"id": str(c.id), "title": c.title, "status": c.status,
                               "created_at": c.created_at.isoformat()} for c in rows],
            "total": len(rows)}


@router.get("/{conv_id}")
async def get_conversation(conv_id: str, db=Depends(get_db), user: dict = Depends(get_current_user)):
    conv = await cs.get_conversation(db, conv_id)
    if not conv:
        raise AppError(404, "NOT_FOUND", "Conversation not found.")
    if not cs.can_access(user, conv):
        raise AppError(403, "FORBIDDEN", "You do not have access to this conversation.")
    return {"id": str(conv.id), "title": conv.title, "status": conv.status,
            "user_id": str(conv.user_id) if conv.user_id else None}


@router.get("/{conv_id}/messages")
async def get_messages(conv_id: str, db=Depends(get_db), user: dict = Depends(get_current_user)):
    conv = await cs.get_conversation(db, conv_id)
    if not conv:
        raise AppError(404, "NOT_FOUND", "Conversation not found.")
    if not cs.can_access(user, conv):
        raise AppError(403, "FORBIDDEN", "You do not have access to this conversation.")
    rows = (await db.execute(select(Message).where(Message.conversation_id == conv.id)
                             .order_by(Message.created_at))).scalars().all()
    return {"conversation_id": conv_id,
            "messages": [{"id": str(m.id), "role": m.role, "content": m.content,
                          "agent_name": m.agent_name, "created_at": m.created_at.isoformat()}
                         for m in rows]}


@router.post("/{conv_id}/messages")
async def add_message(conv_id: str, req: MessageCreate, db=Depends(get_db),
                      user: dict = Depends(get_current_user)):
    conv = await cs.get_conversation(db, conv_id)
    if not conv:
        raise AppError(404, "NOT_FOUND", "Conversation not found.")
    if not cs.can_access(user, conv):
        raise AppError(403, "FORBIDDEN", "You do not have access to this conversation.")
    if req.role not in ("user", "assistant", "system", "agent"):
        raise AppError(400, "BAD_ROLE", "role must be user|assistant|system|agent")
    m = await cs.add_message(db, conv_id, req.role, req.content, metadata=req.metadata_json)
    await db.commit()
    return {"id": str(m.id), "role": m.role, "created_at": m.created_at.isoformat()}
