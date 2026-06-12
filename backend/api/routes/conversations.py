"""Conversation + message persistence (real, not stubs)."""
from __future__ import annotations
import json
import uuid
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, or_, func
from api.deps import get_db, get_current_user, require_permission
from core.permissions import Perm
from core.errors import AppError
from db.models import Conversation, Message, Document
from services import conversation_service as cs
from services import conversation_knowledge as ckb

router = APIRouter()


class ConversationCreate(BaseModel):
    title: str = "New conversation"


class MessageCreate(BaseModel):
    role: str = "user"
    content: str = Field(max_length=200_000)
    metadata_json: dict = {}

    @field_validator("metadata_json")
    @classmethod
    def _metadata_bounded(cls, v: dict) -> dict:
        # Free-form metadata is persisted verbatim; cap its serialized size so a
        # single message can't bloat the row (or the export files) without bound.
        if v and len(json.dumps(v, default=str)) > 16_384:
            raise ValueError("metadata_json must serialize to at most 16 KB")
        return v


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
    count_q = select(func.count()).select_from(Conversation)
    if user["role"] not in ("founder", "admin"):
        q = q.where(Conversation.user_id == uuid.UUID(user["id"]))
        count_q = count_q.where(Conversation.user_id == uuid.UUID(user["id"]))
    q = q.limit(limit).offset(offset)
    rows = (await db.execute(q)).scalars().all()
    total = int((await db.execute(count_q)).scalar_one())
    in_kb: set[str] = set()
    if rows:
        docs = (await db.execute(select(Document.conversation_id).where(
            Document.conversation_id.in_([c.id for c in rows])))).scalars().all()
        in_kb = {str(d) for d in docs if d}
    return {"conversations": [{"id": str(c.id), "title": c.title, "status": c.status,
                               "created_at": c.created_at.isoformat(),
                               "updated_at": c.updated_at.isoformat(),  # last-activity (real chat time)
                               "in_knowledge": str(c.id) in in_kb} for c in rows],
            "total": total}


@router.get("/{conv_id}")
async def get_conversation(conv_id: str, db=Depends(get_db), user: dict = Depends(get_current_user)):
    conv = await cs.get_conversation(db, conv_id)
    if not conv:
        raise AppError(404, "NOT_FOUND", "Conversation not found.")
    if not cs.can_access(user, conv):
        raise AppError(403, "FORBIDDEN", "You do not have access to this conversation.")
    doc = await ckb.get_conversation_document(db, conv_id)
    return {"id": str(conv.id), "title": conv.title, "status": conv.status,
            "user_id": str(conv.user_id) if conv.user_id else None,
            "in_knowledge": doc is not None,
            "knowledge": ({"document_id": str(doc.id), "chunks": doc.chunk_count,
                           "trust_level": doc.trust_level,
                           "updated_at": doc.updated_at.isoformat() if doc.updated_at else None}
                          if doc else None)}


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


@router.post("/{conv_id}/ingest")
async def ingest_conversation_to_knowledge(conv_id: str, db=Depends(get_db),
                                           user: dict = Depends(require_permission(Perm.UPLOAD_FILES))):
    """Index this conversation's transcript into the local Knowledge base so the AI can
    retrieve it later as grounding. Low-trust, secrets redacted, audited (manual trigger)."""
    conv = await cs.get_conversation(db, conv_id)
    if not conv:
        raise AppError(404, "NOT_FOUND", "Conversation not found.")
    if not cs.can_access(user, conv):
        raise AppError(403, "FORBIDDEN", "You do not have access to this conversation.")
    try:
        res = await ckb.ingest_conversation(db, conv_id, actor=user["email"], trigger="manual")
    except Exception as e:
        await db.rollback()
        raise AppError(503, "INGEST_FAILED",
                       "Could not index this conversation (local embedding unavailable?).",
                       detail=str(e), suggested_action="Ensure Ollama + nomic-embed-text are running.")
    await db.commit()
    return res
