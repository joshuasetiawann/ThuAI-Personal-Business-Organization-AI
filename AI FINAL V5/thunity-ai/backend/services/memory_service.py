"""Long-term memory persistence + relevance retrieval.

Scope is a single founder, so the memory set is small; retrieval scores in
Python (keyword overlap + importance + recency) — deterministic, fast, and with
no dependency on the embedding model being free. This is the store that makes a
frontier answer better than a frontier model alone: it carries the founder's
private context into every prompt.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import select, func

from db.models import Memory

_STOP = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "was",
    "be", "with", "that", "this", "it", "as", "at", "by", "from", "you", "your", "i",
    "me", "my", "we", "our", "what", "how", "why", "who", "do", "does", "can", "should",
    # common Indonesian fillers
    "yang", "dan", "atau", "di", "ke", "dari", "untuk", "ini", "itu", "saya", "kamu",
    "aku", "apa", "kenapa", "bagaimana", "siapa", "adalah", "dengan", "pada",
}


def _tokens(text: str) -> set:
    return {w for w in re.findall(r"[a-z0-9]+", (text or "").lower()) if len(w) > 2 and w not in _STOP}


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


async def count_memories(db, user_id: Optional[str], status: str = "active") -> int:
    if db is None:
        return 0
    q = select(func.count(Memory.id)).where(Memory.status == status)
    if user_id:
        q = q.where(Memory.user_id == uuid.UUID(str(user_id)))
    res = await db.execute(q)
    return int(res.scalar() or 0)


async def list_memories(db, user_id: Optional[str], limit: int = 100, kind: Optional[str] = None,
                        status: str = "active") -> List[Memory]:
    if db is None:
        return []
    q = select(Memory).where(Memory.status == status)
    if user_id:
        q = q.where(Memory.user_id == uuid.UUID(str(user_id)))
    if kind:
        q = q.where(Memory.kind == kind)
    q = q.order_by(Memory.importance.desc(), Memory.created_at.desc()).limit(limit)
    res = await db.execute(q)
    return list(res.scalars().all())


async def store_memory(db, user_id: Optional[str], content: str, kind: str = "fact",
                       importance: int = 3, conversation_id=None, source: str = "memory_agent",
                       metadata: Optional[dict] = None) -> Optional[Memory]:
    if db is None or not (content or "").strip():
        return None
    m = Memory(
        user_id=uuid.UUID(str(user_id)) if user_id else None,
        conversation_id=uuid.UUID(str(conversation_id)) if conversation_id else None,
        kind=kind or "fact", content=content.strip()[:1000],
        importance=max(1, min(5, int(importance or 3))),
        source=source, status="active", metadata_json=metadata or {},
    )
    db.add(m)
    await db.flush()
    return m


async def existing_norms(db, user_id: Optional[str]) -> set:
    """Normalised contents of active memories — used to de-duplicate new extractions."""
    rows = await list_memories(db, user_id, limit=500)
    return {_norm(r.content) for r in rows}


async def get_relevant_memories(db, user_id: Optional[str], query: str, limit: int = 6) -> List[Memory]:
    """Return the memories most relevant to `query`, scored by keyword overlap,
    importance, and recency. Falls back to the most important/recent when the
    query has no usable keywords."""
    rows = await list_memories(db, user_id, limit=500)
    if not rows:
        return []
    qtok = _tokens(query)
    now = datetime.utcnow()
    scored = []
    for r in rows:
        overlap = len(qtok & _tokens(r.content)) if qtok else 0
        age_days = max(0.0, (now - (r.created_at or now)).total_seconds() / 86400.0)
        recency = 1.0 / (1.0 + age_days / 30.0)          # ~half-weight after a month
        score = overlap * 3.0 + (r.importance or 3) * 0.6 + recency * 1.2
        scored.append((score, overlap, r))
    # If the query matched nothing, still surface the founder's most important facts.
    has_match = any(o > 0 for _, o, _ in scored)
    scored.sort(key=lambda t: t[0], reverse=True)
    picked = [r for _, o, r in scored if (o > 0 or not has_match)][:limit]
    return picked


async def touch_memories(db, memories: List[Memory]) -> None:
    """Record that these memories were used (for future ranking + transparency)."""
    if db is None or not memories:
        return
    now = datetime.utcnow()
    for m in memories:
        m.use_count = (m.use_count or 0) + 1
        m.last_used_at = now
    await db.flush()


def format_memory_block(memories: List[Memory]) -> str:
    """Render memories as a compact context block for the system prompt."""
    if not memories:
        return ""
    lines = [f"- ({m.kind}) {m.content}" for m in memories]
    return ("[FOUNDER MEMORY — private context Thunity remembers about this founder; "
            "use it to personalise and ground your answer]\n" + "\n".join(lines))
