"""Local knowledge base / RAG endpoints. Ingestion = parse→chunk→local embed→
store. Deletion is approval-gated (high risk)."""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from datetime import datetime
from api.deps import get_db, require_permission
from core.permissions import Perm
from core.errors import AppError, parse_uuid
from core.audit import log_audit
from db.models import Document, ApprovalRequest
from services.file_service import file_service
from services import knowledge_service as ks
from services import approval_service

router = APIRouter()


class SearchReq(BaseModel):
    query: str
    top_k: int = Field(5, ge=1, le=50)   # bounded so a caller can't request the whole corpus
    client_name: str | None = None


@router.post("/ingest")
async def ingest(file: UploadFile = File(...), client_name: str = Form(None),
                 project_name: str = Form(None), source_type: str = Form(None),
                 sensitivity_level: str = Form("internal"), db=Depends(get_db),
                 user: dict = Depends(require_permission(Perm.UPLOAD_FILES))):
    if not file_service.ext_ok(file.filename or ""):
        raise AppError(400, "UPLOAD_REJECTED", "File extension is not allowed.")
    try:
        content = await file_service.read_upload_capped(file)
        meta = await file_service.save_upload(file.filename, content, subdir="knowledge")
    except (ValueError, PermissionError) as e:
        raise AppError(400, "UPLOAD_REJECTED", str(e))
    if meta["ext"] not in ks.SUPPORTED:
        raise AppError(415, "UNSUPPORTED_TYPE", f"Cannot ingest .{meta['ext']} into the knowledge base.")
    try:
        doc = await ks.ingest_document(db, meta, owner=user["email"], client_name=client_name,
                                       project_name=project_name, source_type=source_type,
                                       sensitivity_level=sensitivity_level, abs_path=meta["abs_path"])
    except Exception as e:
        await db.rollback()
        raise AppError(503, "INGEST_FAILED", "Ingestion failed (local embedding unavailable?).",
                       detail=str(e),
                       suggested_action=f"Ensure Ollama is running and run: ollama pull {file and ''}nomic-embed-text")
    await log_audit(db, "document_ingestion", actor=user["email"], actor_role=user["role"],
                    entity_type="document", entity_id=str(doc.id),
                    metadata={"filename": doc.filename, "chunks": doc.chunk_count})
    await db.commit()
    return {"document_id": str(doc.id), "filename": doc.filename, "chunks": doc.chunk_count,
            "document_status": doc.document_status, "trust_level": doc.trust_level,
            "sha256": doc.sha256}


@router.post("/sync-folder")
async def sync_folder(db=Depends(get_db),
                      user: dict = Depends(require_permission(Perm.UPLOAD_FILES))):
    """Index files the founder dropped in the brain folder (~/Documents/thunity-conversations)
    into Knowledge so the AI reads them. Skips the auto-exported chat mirrors (chats/)."""
    from services import folder_knowledge
    res = await folder_knowledge.sync_folder(db, actor=user["email"])
    await db.commit()
    return res


@router.post("/search")
async def search(req: SearchReq, db=Depends(get_db),
                 user: dict = Depends(require_permission(Perm.READ_KNOWLEDGE))):
    try:
        sources = await ks.retrieve_context(db, req.query, top_k=req.top_k,
                                             filters={"client_name": req.client_name} if req.client_name else None)
    except Exception as e:
        raise AppError(503, "SEARCH_FAILED", "Knowledge search failed (embedding unavailable?).",
                       detail=str(e), suggested_action="Ensure Ollama + nomic-embed-text are available.")
    await log_audit(db, "knowledge_retrieval", actor=user["email"],
                    metadata={"query": req.query[:200], "hits": len(sources)})
    await db.commit()
    return {"results": sources, "grounding": ks.format_grounding(sources)}


@router.get("/documents")
async def list_documents(db=Depends(get_db), user: dict = Depends(require_permission(Perm.READ_KNOWLEDGE)),
                         limit: int = Query(100, le=500), offset: int = Query(0, ge=0)):
    rows = (await db.execute(select(Document).order_by(Document.created_at.desc())
                             .limit(limit).offset(offset))).scalars().all()
    return {"documents": [_doc_brief(d) for d in rows], "total": len(rows)}


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str, db=Depends(get_db),
                       user: dict = Depends(require_permission(Perm.READ_KNOWLEDGE))):
    doc = await _get(db, doc_id)
    return {**_doc_brief(doc), "sensitivity_level": doc.sensitivity_level,
            "owner": doc.owner, "client_name": doc.client_name, "project_name": doc.project_name,
            "sha256": doc.sha256, "metadata": doc.metadata_json}


@router.post("/documents/{doc_id}/verify")
async def verify_document(doc_id: str, trust_level: str = "high", db=Depends(get_db),
                          user: dict = Depends(require_permission(Perm.MANAGE_DOCUMENTS))):
    if trust_level not in ks.TRUST_ORDER:
        raise AppError(400, "BAD_TRUST", f"trust_level must be one of {ks.TRUST_ORDER}")
    doc = await _get(db, doc_id)
    doc.document_status, doc.trust_level = "verified", trust_level
    doc.verified_by, doc.verified_at = user["email"], datetime.utcnow()
    await log_audit(db, "document_verified", actor=user["email"], entity_type="document", entity_id=doc_id,
                    metadata={"trust_level": trust_level})
    await db.commit()
    return _doc_brief(doc)


@router.post("/documents/{doc_id}/deprecate")
async def deprecate_document(doc_id: str, db=Depends(get_db),
                             user: dict = Depends(require_permission(Perm.MANAGE_DOCUMENTS))):
    doc = await _get(db, doc_id)
    doc.document_status = "deprecated"
    await log_audit(db, "document_deprecated", actor=user["email"], entity_type="document", entity_id=doc_id)
    await db.commit()
    return _doc_brief(doc)


@router.post("/documents/{doc_id}/reindex")
async def reindex_document(doc_id: str, db=Depends(get_db),
                           user: dict = Depends(require_permission(Perm.MANAGE_DOCUMENTS))):
    doc = await _get(db, doc_id)
    # Only uploaded documents live under FILES_DIR with a resolvable stored_path.
    # Folder-synced and conversation-transcript docs store paths rooted elsewhere
    # (or empty), so resolving them against FILES_DIR is meaningless/unsafe.
    if not doc.stored_path or (doc.source_type or "") in ("folder", "conversation"):
        raise AppError(400, "REINDEX_UNSUPPORTED",
                       "Reindex is only supported for uploaded documents; "
                       "re-run folder sync or re-ingest the conversation instead.")
    try:
        await ks.reindex_document(db, doc, file_service.safe_path(doc.stored_path).as_posix())
    except Exception as e:
        await db.rollback()
        raise AppError(503, "REINDEX_FAILED", "Reindex failed.", detail=str(e))
    await log_audit(db, "document_reindexed", actor=user["email"], entity_type="document", entity_id=doc_id)
    await db.commit()
    return _doc_brief(doc)


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, approval_id: str | None = None, db=Depends(get_db),
                          user: dict = Depends(require_permission(Perm.DELETE_DOCUMENT))):
    doc = await _get(db, doc_id)
    if not approval_id:   # high-risk → require founder approval first
        req = await approval_service.create_request(db, "delete_document", {"document_id": doc_id},
                                                    "high", user["email"])
        await log_audit(db, "approval_requested", actor=user["email"], entity_type="document", entity_id=doc_id)
        await db.commit()
        return JSONResponse(status_code=202, content={
            "approval_required": True, "approval_id": str(req.id), "risk_level": "high",
            "message": "Founder approval required before deleting this document."})
    appr = (await db.execute(select(ApprovalRequest).where(
        ApprovalRequest.id == parse_uuid(approval_id, "approval_id", 400)))).scalar_one_or_none()
    if not appr or appr.status != "approved" or appr.payload_json.get("document_id") != doc_id:
        raise AppError(403, "APPROVAL_REQUIRED", "A valid, approved approval is required to delete.")
    file_service.delete(doc.stored_path)
    await db.delete(doc)
    await log_audit(db, "document_deleted", actor=user["email"], actor_role=user["role"],
                    entity_type="document", entity_id=doc_id, metadata={"approval_id": approval_id})
    await db.commit()
    return {"deleted": True, "document_id": doc_id}


async def _get(db, doc_id: str) -> Document:
    doc = (await db.execute(select(Document).where(
        Document.id == parse_uuid(doc_id, "document id")))).scalar_one_or_none()
    if not doc:
        raise AppError(404, "NOT_FOUND", "Document not found.")
    return doc


def _doc_brief(d: Document) -> dict:
    return {"id": str(d.id), "filename": d.filename, "file_type": d.file_type,
            "document_status": d.document_status, "trust_level": d.trust_level,
            "chunk_count": d.chunk_count, "created_at": d.created_at.isoformat()}
