"""Export each conversation as human-readable files on the HOST filesystem.

Writes `<slug>_<id8>.md` (readable) + `<slug>_<id8>.json` (structured) into
`settings.CONVERSATIONS_EXPORT_DIR` — which is bind-mounted to a real folder on the
founder's Mac (see docker-compose `…/thunity-conversations:/exports`), so he can open
his whole chat history in Finder. Best-effort + fire-and-forget: never blocks a reply,
all errors swallowed. Re-written in place on every turn (one file pair per conversation).
"""
from __future__ import annotations

import json
import os
import re
import uuid
from typing import Optional

from sqlalchemy import select

from config import settings
from db.base import session_factory
from db.models import Conversation, Message

_ROLE = {"user": "Founder", "assistant": "Thunity", "agent": "Thunity (Council)", "system": "System"}


def _z(dt) -> Optional[str]:
    # DB datetimes are naive UTC; mark them UTC so readers parse correctly.
    return dt.isoformat() + "Z" if dt else None


def _slug(title: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", (title or "conversation").strip().lower()).strip("-")
    return (s or "conversation")[:50]


def format_md(conv: Conversation, msgs: list[Message]) -> str:
    head = (f"# {conv.title or 'Untitled conversation'}\n\n"
            f"- ID: `{conv.id}`\n"
            f"- Started: {_z(conv.created_at)}\n"
            f"- Last activity: {_z(conv.updated_at)}\n"
            f"- Messages: {len(msgs)}\n\n---\n")
    body = []
    for m in msgs:
        who = _ROLE.get(m.role, m.role)
        if m.agent_name and m.role in ("assistant", "agent"):
            who = f"{who} · {m.agent_name}"
        body.append(f"\n**{who}** · {_z(m.created_at)}\n\n{(m.content or '').strip()}\n")
    return head + "\n".join(body) + "\n"


def format_json(conv: Conversation, msgs: list[Message]) -> dict:
    return {
        "id": str(conv.id),
        "title": conv.title,
        "status": conv.status,
        "created_at": _z(conv.created_at),
        "updated_at": _z(conv.updated_at),
        "message_count": len(msgs),
        "messages": [
            {"role": m.role, "agent_name": m.agent_name, "content": m.content,
             "model": (m.metadata_json or {}).get("model"),
             "provider": (m.metadata_json or {}).get("provider"),
             "frontier": (m.metadata_json or {}).get("frontier"),
             "created_at": _z(m.created_at)}
            for m in msgs
        ],
    }


def _cleanup_old(dirpath: str, id8: str) -> None:
    try:
        for f in os.listdir(dirpath):
            if f.endswith(f"_{id8}.md") or f.endswith(f"_{id8}.json"):
                try:
                    os.remove(os.path.join(dirpath, f))
                except OSError:
                    pass
    except OSError:
        pass


async def export_conversation(db, conversation_id) -> dict:
    """Write the .md + .json files for one conversation. Returns {written, files}."""
    if not settings.CONVERSATIONS_EXPORT_ENABLED:
        return {"written": False, "reason": "disabled"}
    conv = (await db.execute(
        select(Conversation).where(Conversation.id == uuid.UUID(str(conversation_id))))).scalar_one_or_none()
    if not conv:
        return {"written": False, "reason": "not_found"}
    msgs = (await db.execute(
        select(Message).where(Message.conversation_id == conv.id).order_by(Message.created_at)
    )).scalars().all()
    if not msgs:
        return {"written": False, "reason": "empty"}

    # mirrors go in the `chats/` subfolder so the folder→Knowledge sync can cleanly
    # skip them (those conversations are already indexed from the DB).
    dirpath = os.path.join(settings.CONVERSATIONS_EXPORT_DIR, "chats")
    os.makedirs(dirpath, exist_ok=True)
    id8 = conv.id.hex[:8]
    _cleanup_old(dirpath, id8)  # handle title (slug) changes → one pair per conversation
    base = f"{_slug(conv.title)}_{id8}"
    md_path = os.path.join(dirpath, base + ".md")
    json_path = os.path.join(dirpath, base + ".json")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(format_md(conv, list(msgs)))
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(format_json(conv, list(msgs)), f, ensure_ascii=False, indent=2)
    return {"written": True, "files": [os.path.basename(md_path), os.path.basename(json_path)]}


async def export_conversation_bg(conversation_id) -> None:
    """Fire-and-forget: own DB session, swallow all errors (never affects the reply)."""
    if not settings.CONVERSATIONS_EXPORT_ENABLED:
        return
    maker = session_factory()
    if maker is None:
        return
    try:
        async with maker() as db:
            await export_conversation(db, conversation_id)
    except Exception:
        return
