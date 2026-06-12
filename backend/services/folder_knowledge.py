"""Folder → Knowledge sync (the "brain folder").

Watches the founder's folder (bind-mounted at settings.CONVERSATIONS_EXPORT_DIR =
~/Documents/thunity-conversations on his Mac) and indexes any file HE drops/edits
there into the local Knowledge base — so adding a note makes the AI read it
(Obsidian-vault style). The AI retrieves these via the normal RAG path; nothing else
changes.

Separation (no duplication): the system's own auto-exported conversation mirrors live
in the `chats/` subfolder and are SKIPPED here (those conversations are already in
Knowledge via the DB). Everything else the founder puts in the folder is fair game.
Deduped by content SHA-256; a file that disappears → its Knowledge doc is deprecated.
Periodic + best-effort; embeds only changed/new files.
"""
from __future__ import annotations

import asyncio
import hashlib
import os
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import select

from config import settings
from core.audit import log_audit
from db.base import session_factory
from db.models import Document, DocumentChunk
from services import knowledge_service as ks
from services.embedding import embed_texts

_MIRROR_SUBDIR = "chats"            # the auto-exported conversation mirrors live here → skip
_MAX_BYTES = 25 * 1024 * 1024       # per-file safety cap


def _iter_files(root: str):
    root_real = os.path.realpath(root)
    for dirpath, _dirs, files in os.walk(root):
        for name in files:
            if name.startswith("."):
                continue
            ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
            if ext not in ks.SUPPORTED:
                continue
            full = os.path.join(dirpath, name)
            # Symlink guard: never follow a symlink out of the brain folder (a synced
            # cloud folder could drop one pointing at an arbitrary host file).
            if os.path.islink(full):
                continue
            if not os.path.realpath(full).startswith(root_real + os.sep):
                continue
            rel = os.path.relpath(full, root)
            # skip the system's own conversation mirrors
            if rel == _MIRROR_SUBDIR or rel.startswith(_MIRROR_SUBDIR + os.sep):
                continue
            yield full, rel, ext


def _read_bytes(full: str) -> bytes:
    with open(full, "rb") as f:
        return f.read()


async def _ingest_file(db, full: str, rel: str, ext: str, actor: Optional[str]) -> str:
    try:
        size = await asyncio.to_thread(os.path.getsize, full)
    except OSError:
        return "skip"
    if size == 0 or size > _MAX_BYTES:
        return "skip"
    # Read + parse off the event loop so a big/slow file never stalls the API.
    data = await asyncio.to_thread(_read_bytes, full)
    sha = hashlib.sha256(data).hexdigest()

    existing = (await db.execute(select(Document).where(
        Document.source_type == "folder", Document.stored_path == rel))).scalars().first()
    if existing and existing.sha256 == sha and existing.document_status != "deprecated":
        return "unchanged"

    segments, _extra = await asyncio.to_thread(ks.parse_file, full, ext)
    chunks = ks.chunk_segments(segments)
    vectors = await embed_texts([c["content"] for c in chunks]) if chunks else []
    meta = {"kind": "folder_file", "synced_at": datetime.utcnow().isoformat()}

    if existing:
        await db.execute(DocumentChunk.__table__.delete().where(DocumentChunk.document_id == existing.id))
        doc = existing
        doc.sha256 = sha
        doc.size_bytes = size
        doc.file_type = ext
        doc.filename = os.path.basename(rel)
        doc.chunk_count = len(chunks)
        doc.document_status = "indexed"
        doc.metadata_json = {**(doc.metadata_json or {}), **meta}
        action = "updated"
    else:
        doc = Document(file_id=f"folder-{uuid.uuid4().hex}", filename=os.path.basename(rel),
                       stored_path=rel, sha256=sha, file_type=ext, size_bytes=size,
                       document_status="indexed", sensitivity_level="internal", trust_level="medium",
                       owner=actor, source_type="folder", chunk_count=len(chunks), metadata_json=meta)
        db.add(doc)
        await db.flush()
        action = "added"

    for idx, (c, vec) in enumerate(zip(chunks, vectors)):
        db.add(DocumentChunk(document_id=doc.id, chunk_index=idx, content=c["content"],
                             embedding_json=vec, token_estimate=max(0, len(c["content"]) // 4),
                             page=c.get("page"), sheet=c.get("sheet")))
    await db.flush()
    await log_audit(db, "folder_knowledge_synced", actor=actor, entity_type="document",
                    entity_id=str(doc.id), metadata={"path": rel, "action": action, "chunks": len(chunks)})
    return action


async def sync_folder(db, actor: Optional[str] = "folder-sync") -> dict:
    root = settings.CONVERSATIONS_EXPORT_DIR
    if not settings.CONVERSATIONS_EXPORT_ENABLED or not os.path.isdir(root):
        return {"ok": False, "reason": "folder unavailable"}
    seen, added, updated, unchanged = set(), 0, 0, 0
    for full, rel, ext in _iter_files(root):
        seen.add(rel)
        try:
            r = await _ingest_file(db, full, rel, ext, actor)
        except Exception:
            continue
        if r == "added":
            added += 1
        elif r == "updated":
            updated += 1
        elif r == "unchanged":
            unchanged += 1
    # a file that disappeared from the folder → deprecate its Knowledge doc (AI stops using it)
    removed = 0
    for d in (await db.execute(select(Document).where(Document.source_type == "folder"))).scalars().all():
        if d.stored_path not in seen and d.document_status != "deprecated":
            d.document_status = "deprecated"
            removed += 1
    return {"ok": True, "added": added, "updated": updated, "unchanged": unchanged,
            "removed": removed, "indexed": len(seen)}


async def run_periodic(interval_s: int = 30) -> None:
    """Background loop: keep the folder and Knowledge in sync (best-effort)."""
    while True:
        maker = session_factory()
        if maker is not None:
            try:
                async with maker() as db:
                    res = await sync_folder(db)
                    await db.commit()
                    if res.get("added") or res.get("updated") or res.get("removed"):
                        print(f"[folder_knowledge] {res}")
            except Exception:
                pass
        await asyncio.sleep(interval_s)
