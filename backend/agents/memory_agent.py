"""Memory Agent — curates the founder's long-term memory.

Runs on the LOCAL model on purpose: even when an answer is produced by frontier
Claude, deciding what to *remember* stays private and cheap. After each exchange
it extracts only durable, reusable facts (preferences, goals, names, projects,
constraints, decisions), de-duplicates them against what is already stored, and
saves them. It is fire-and-forget: it opens its own DB session and never blocks
the user's reply, and never touches the governance ledgers.
"""
from __future__ import annotations

import json
import re
from typing import List, Optional

from agents.ollama_client import ollama
from agents.model_router import select_model
from core.audit import log_audit
from db.base import session_factory
from services import memory_service as ms

_EXTRACT_SYSTEM = (
    "You curate long-term memory for a private AI company OS. From the exchange, extract durable, "
    "reusable facts the assistant should remember about the FOUNDER, their company, projects, tools, "
    "preferences, goals, constraints, or key people. CAPTURE stated preferences (favourite things, "
    "tools they use), personal/company facts, decisions, and goals. Ignore only pure small talk and "
    "one-off transient details. Return ONLY a JSON array; each item "
    '{"content": "<one concise sentence>", "kind": "fact|preference|project|person|goal|decision|constraint", '
    '"importance": 1-5}. Return [] only if there is genuinely nothing durable. Max 5 items.\n\n'
    "Example exchange: FOUNDER said: I prefer dark mode and I use a MacBook. We launch Project Atlas in Q3.\n"
    'Example output: [{"content":"Founder prefers dark mode","kind":"preference","importance":3},'
    '{"content":"Founder uses a MacBook","kind":"fact","importance":3},'
    '{"content":"Project Atlas launches in Q3","kind":"project","importance":4}]'
)

_VALID_KINDS = {"fact", "preference", "project", "person", "goal", "decision", "constraint", "misc"}


def _parse_array(text: str) -> List[dict]:
    if not text:
        return []
    try:
        start, end = text.index("["), text.rindex("]") + 1
        data = json.loads(text[start:end])
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


async def extract_and_store(conversation_id: Optional[str], user_id: Optional[str],
                            user_message: str, assistant_response: str,
                            actor: Optional[str] = None) -> int:
    """Extract durable facts and persist new ones. Returns count stored. Opens its
    own DB session so it can run detached from the request. Safe to await or to
    schedule fire-and-forget — all failures are swallowed (memory is best-effort)."""
    maker = session_factory()
    if maker is None:
        return 0
    stored = 0
    try:
        model = select_model("fast")
        exchange = (f"FOUNDER said:\n{(user_message or '').strip()[:2000]}\n\n"
                    f"ASSISTANT replied:\n{(assistant_response or '').strip()[:2000]}")
        out = await ollama.chat(
            model,
            [{"role": "system", "content": _EXTRACT_SYSTEM},
             {"role": "user", "content": exchange + "\n\nReturn ONLY the JSON array."}],
            temperature=0.0, num_predict=400,
        )
        items = _parse_array(out.get("content", ""))
        if not items:
            return 0
        async with maker() as db:
            seen = await ms.existing_norms(db, user_id)
            for it in items[:5]:
                if not isinstance(it, dict):
                    continue
                content = str(it.get("content", "")).strip()
                if len(content) < 6:
                    continue
                n = _norm(content)
                # Skip duplicates: exact, or the new fact is fully contained in an
                # existing one. (Do NOT block a longer, more-specific new fact just
                # because a shorter existing memory is a substring of it.)
                if any(n == e or n in e for e in seen):
                    continue
                kind = str(it.get("kind", "fact")).lower()
                if kind not in _VALID_KINDS:
                    kind = "fact"
                try:
                    importance = int(it.get("importance", 3))
                except Exception:
                    importance = 3
                await ms.store_memory(db, user_id, content, kind=kind, importance=importance,
                                      conversation_id=conversation_id, source="memory_agent")
                seen.add(n)
                stored += 1
            if stored:
                await log_audit(db, "memory_write", actor=actor, entity_type="memory",
                                entity_id=str(conversation_id) if conversation_id else None,
                                metadata={"stored": stored})
            await db.commit()
    except Exception:
        # Memory is best-effort; never surface extraction failures to the user.
        return stored
    return stored
