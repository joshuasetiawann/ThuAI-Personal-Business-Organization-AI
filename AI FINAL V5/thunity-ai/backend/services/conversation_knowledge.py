"""Conversations → Knowledge (frontier-style long-term memory over chat history).

Indexes a chat conversation's transcript into the SAME local Knowledge/RAG store
used for uploaded documents, so the AI can retrieve relevant PAST CONVERSATIONS as
grounding for future answers (not just the short extracted facts the Memory Agent
already keeps).

Honest by construction (respects the founder's governance doctrine):
  • trust_level='low'  → retrieval cites it as a low-trust, conversation-sourced item.
  • secrets redacted   → API keys / passwords / tokens / JWTs are stripped BEFORE embedding.
  • one doc per conv   → a conversation maps to a SINGLE Document, updated in place
                         (de-duped by transcript SHA-256), never duplicated per turn.
  • audited            → every ingest writes a `conversation_ingested` audit row.
  • async / best-effort→ auto-ingest runs in the background and never blocks the reply.
  • founder-controlled → auto-ingest only runs while the `auto_ingest_conversations`
                         app setting is on (Settings toggle). Manual ingest is explicit.
Knowledge ≠ the governance ledgers (decisions/tasks/approvals/workflows) — those stay
untouched, so Fast Chat remains side-effect-free w.r.t. governance.
"""
from __future__ import annotations

import hashlib
import re
import uuid
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select

from core.audit import log_audit
from db.base import session_factory
from db.models import Conversation, Document, DocumentChunk, Message
from services import app_settings_service as app_settings
from services import knowledge_service as ks
from services.embedding import embed_texts

# Re-ingesting the full transcript after every single turn is wasteful; debounce so
# rapid back-and-forth doesn't re-embed repeatedly. The manual button bypasses this.
_AUTO_DEBOUNCE = timedelta(seconds=20)

_REDACT = "[redacted]"
# Conservative secret patterns — strip obvious credentials before they reach the vault.
_SECRET_PATTERNS = [
    re.compile(r"\b(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),  # AWS access key id
    re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{6,}\b"),  # JWT
    re.compile(r"(?i)\b(password|passwd|api[_-]?key|secret|access[_-]?token|bearer|token)\b\s*[:=]\s*\S+"),
]

_ROLE_LABEL = {"user": "Founder", "assistant": "Thunity", "agent": "Thunity (Council)", "system": "System"}


def redact_secrets(text: str) -> tuple[str, int]:
    count = 0

    def _sub(_m):
        nonlocal count
        count += 1
        return _REDACT

    for pat in _SECRET_PATTERNS:
        text = pat.sub(_sub, text)
    return text, count


def format_transcript(conv: Conversation, messages: list[Message]) -> str:
    head = f"# Conversation: {conv.title or 'Untitled'}\nStarted: {conv.created_at.isoformat()}\n\n"
    lines = []
    for m in messages:
        label = _ROLE_LABEL.get(m.role, m.role)
        if m.agent_name and m.role in ("assistant", "agent"):
            label = f"{label} [{m.agent_name}]"
        lines.append(f"{label}: {(m.content or '').strip()}")
    return head + "\n\n".join(lines)


async def get_conversation_document(db, conversation_id) -> Optional[Document]:
    res = await db.execute(
        select(Document).where(Document.conversation_id == uuid.UUID(str(conversation_id)))
    )
    return res.scalars().first()


async def ingest_conversation(db, conversation_id, actor: Optional[str] = None,
                              trigger: str = "manual") -> dict:
    """Index (or re-index) a conversation transcript as a low-trust Knowledge document.
    Flushes but does NOT commit — the caller owns the transaction."""
    conv = (await db.execute(
        select(Conversation).where(Conversation.id == uuid.UUID(str(conversation_id))))).scalar_one_or_none()
    if not conv:
        return {"status": "not_found"}

    msgs = (await db.execute(
        select(Message).where(Message.conversation_id == conv.id).order_by(Message.created_at)
    )).scalars().all()
    real = [m for m in msgs if m.role in ("user", "assistant", "agent") and (m.content or "").strip()]
    if len(real) < 2:
        return {"status": "too_short", "messages": len(real)}

    transcript, redactions = redact_secrets(format_transcript(conv, real))
    sha = hashlib.sha256(transcript.encode("utf-8")).hexdigest()

    existing = await get_conversation_document(db, conversation_id)
    if existing and existing.sha256 == sha:
        return {"status": "unchanged", "document_id": str(existing.id), "chunks": existing.chunk_count}

    chunks = ks.chunk_segments([{"text": transcript}])
    vectors = await embed_texts([c["content"] for c in chunks]) if chunks else []

    title = (conv.title or "Conversation")[:480]
    meta = {"kind": "conversation_transcript", "message_count": len(real),
            "redactions": redactions, "trigger": trigger,
            "last_ingested_at": datetime.utcnow().isoformat()}

    if existing:
        await db.execute(DocumentChunk.__table__.delete().where(DocumentChunk.document_id == existing.id))
        doc = existing
        doc.filename = f"{title}.txt"
        doc.sha256 = sha
        doc.size_bytes = len(transcript.encode("utf-8"))
        doc.document_status = "indexed"
        doc.chunk_count = len(chunks)
        doc.metadata_json = {**(doc.metadata_json or {}), **meta}
        if not doc.trust_level or doc.trust_level == "untrusted":
            doc.trust_level = "low"
    else:
        doc = Document(
            file_id=f"conv-{conv.id.hex}", filename=f"{title}.txt", stored_path="",
            sha256=sha, file_type="txt", size_bytes=len(transcript.encode("utf-8")),
            document_status="indexed", sensitivity_level="internal", trust_level="low",
            owner=actor, source_type="conversation", conversation_id=conv.id,
            chunk_count=len(chunks), metadata_json=meta,
        )
        db.add(doc)
        await db.flush()

    for idx, (c, vec) in enumerate(zip(chunks, vectors)):
        db.add(DocumentChunk(document_id=doc.id, chunk_index=idx, content=c["content"],
                             embedding_json=vec, token_estimate=max(0, len(c["content"]) // 4)))
    await db.flush()

    await log_audit(db, "conversation_ingested", actor=actor, entity_type="document",
                    entity_id=str(doc.id),
                    metadata={"conversation_id": str(conv.id), "chunks": len(chunks),
                              "redactions": redactions, "trigger": trigger})
    return {"status": "ingested", "document_id": str(doc.id), "chunks": len(chunks),
            "redactions": redactions, "messages": len(real)}


async def auto_ingest_conversation(conversation_id, actor: Optional[str] = None) -> None:
    """Background, best-effort auto-ingest after a turn. Honors the founder's
    `auto_ingest_conversations` toggle, debounces rapid turns, swallows all errors
    so it can never affect the user's reply. Opens its own DB session."""
    maker = session_factory()
    if maker is None:
        return
    try:
        async with maker() as db:
            if not await app_settings.get_setting(db, "auto_ingest_conversations", True):
                return
            existing = await get_conversation_document(db, conversation_id)
            if existing and existing.updated_at and (datetime.utcnow() - existing.updated_at) < _AUTO_DEBOUNCE:
                return
            await ingest_conversation(db, conversation_id, actor=actor, trigger="auto")
            await db.commit()
    except Exception:
        # Best-effort; auto-ingest must never surface to the user.
        return
