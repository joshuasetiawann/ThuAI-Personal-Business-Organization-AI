"""Secure file endpoints (auth required). Upload is traversal-safe; raw delete
is founder-only and audited."""
from __future__ import annotations
from fastapi import APIRouter, Depends, UploadFile, File, Query
from api.deps import get_db, get_current_user, require_permission
from core.permissions import Perm
from core.errors import AppError
from core.audit import log_audit
from services.file_service import file_service

router = APIRouter()


@router.post("/upload")
async def upload(file: UploadFile = File(...), db=Depends(get_db),
                 user: dict = Depends(require_permission(Perm.UPLOAD_FILES))):
    if not file_service.ext_ok(file.filename or ""):
        raise AppError(400, "UPLOAD_REJECTED", "File extension is not allowed.")
    try:
        content = await file_service.read_upload_capped(file)
        meta = await file_service.save_upload(file.filename, content, subdir="uploads")
    except (ValueError, PermissionError) as e:
        raise AppError(400, "UPLOAD_REJECTED", str(e))
    await log_audit(db, "file_upload", actor=user["email"], actor_role=user["role"],
                    entity_type="file", entity_id=meta["file_id"],
                    metadata={"filename": meta["original_filename"], "sha256": meta["sha256"]})
    await db.commit()
    return {"success": True, **{k: meta[k] for k in ("file_id", "original_filename", "stored_path", "sha256", "size")}}


@router.get("/list")
async def list_files(subdir: str = "", user: dict = Depends(get_current_user)):
    try:
        return {"files": file_service.list_files(subdir)}
    except PermissionError as e:
        raise AppError(403, "FORBIDDEN", str(e))


@router.get("/read")
async def read_file(path: str = Query(...), user: dict = Depends(get_current_user)):
    try:
        data = file_service.read_bytes(path)
    except PermissionError as e:
        raise AppError(403, "FORBIDDEN", str(e))
    except FileNotFoundError:
        raise AppError(404, "NOT_FOUND", "File not found.")
    return {"path": path, "content": data.decode("utf-8", errors="ignore")[:200000]}


@router.delete("")
async def delete_file(path: str = Query(...), db=Depends(get_db),
                      user: dict = Depends(require_permission(Perm.DELETE_DOCUMENT))):
    try:
        ok = file_service.delete(path)
    except PermissionError as e:
        raise AppError(403, "FORBIDDEN", str(e))
    await log_audit(db, "file_delete", actor=user["email"], actor_role=user["role"],
                    entity_type="file", entity_id=path)
    await db.commit()
    return {"deleted": ok, "path": path}
