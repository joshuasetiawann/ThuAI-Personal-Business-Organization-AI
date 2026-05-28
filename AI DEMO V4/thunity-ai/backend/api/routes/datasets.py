"""Dataset registry — CSV/XLSX as first-class datasets with detected schema."""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy import select
from api.deps import get_db, require_permission
from core.permissions import Perm
from core.errors import AppError
from core.audit import log_audit
from db.models import Dataset
from services.file_service import file_service
from services import knowledge_service as ks
from services import dataset_service

router = APIRouter()


@router.post("/import")
async def import_dataset(file: UploadFile = File(...), source_platform: str = Form("manual"),
                         client_name: str = Form(None), project_name: str = Form(None),
                         campaign_name: str = Form(None), db=Depends(get_db),
                         user: dict = Depends(require_permission(Perm.UPLOAD_FILES))):
    content = await file.read()
    try:
        meta = await file_service.save_upload(file.filename, content, subdir="datasets")
    except (ValueError, PermissionError) as e:
        raise AppError(400, "UPLOAD_REJECTED", str(e))
    if meta["ext"] not in {"csv", "xlsx", "xls"}:
        raise AppError(415, "UNSUPPORTED_TYPE", "Datasets must be .csv or .xlsx.")
    try:
        _, extra = ks.parse_file(meta["abs_path"], meta["ext"])
    except Exception as e:
        raise AppError(422, "PARSE_FAILED", "Could not parse tabular file.", detail=str(e))
    schema = extra.get("schema", {})
    # xlsx returns per-sheet dict; flatten to first sheet for the headline registry row
    if schema and all(isinstance(v, dict) for v in schema.values()):
        first = next(iter(schema.values()))
        schema = {**first, "sheets": list(schema.keys())}
    ds = await dataset_service.register_dataset(db, filename=meta["original_filename"],
                                                source_platform=source_platform, client_name=client_name,
                                                project_name=project_name, campaign_name=campaign_name,
                                                schema=schema)
    await log_audit(db, "dataset_imported", actor=user["email"], entity_type="dataset", entity_id=str(ds.id),
                    metadata={"rows": ds.row_count, "cols": ds.column_count})
    await db.commit()
    return {"dataset_id": str(ds.id), "filename": ds.filename, "row_count": ds.row_count,
            "column_count": ds.column_count, "quality_score": ds.quality_score}


@router.get("")
async def list_datasets(db=Depends(get_db), user: dict = Depends(require_permission(Perm.READ_KNOWLEDGE))):
    rows = (await db.execute(select(Dataset).order_by(Dataset.imported_at.desc()))).scalars().all()
    return {"datasets": [{"id": str(d.id), "filename": d.filename, "source_platform": d.source_platform,
                          "row_count": d.row_count, "column_count": d.column_count,
                          "quality_score": d.quality_score, "status": d.status} for d in rows]}


@router.get("/{ds_id}")
async def get_dataset(ds_id: str, db=Depends(get_db),
                      user: dict = Depends(require_permission(Perm.READ_KNOWLEDGE))):
    ds = await _get(db, ds_id)
    return {"id": str(ds.id), "filename": ds.filename, "schema": ds.schema_json,
            "missing_value_summary": ds.missing_value_summary, "quality_score": ds.quality_score,
            "status": ds.status, "source_platform": ds.source_platform}


@router.get("/{ds_id}/preview")
async def preview_dataset(ds_id: str, db=Depends(get_db),
                          user: dict = Depends(require_permission(Perm.READ_KNOWLEDGE))):
    ds = await _get(db, ds_id)
    sch = ds.schema_json or {}
    return {"columns": sch.get("columns", []), "sample_rows": sch.get("sample_rows", []),
            "row_count": ds.row_count, "missing_value_summary": ds.missing_value_summary}


@router.post("/{ds_id}/archive")
async def archive_dataset(ds_id: str, db=Depends(get_db),
                          user: dict = Depends(require_permission(Perm.MANAGE_DOCUMENTS))):
    ds = await _get(db, ds_id)
    ds.status = "archived"
    await log_audit(db, "dataset_archived", actor=user["email"], entity_type="dataset", entity_id=ds_id)
    await db.commit()
    return {"id": str(ds.id), "status": ds.status}


async def _get(db, ds_id: str) -> Dataset:
    ds = (await db.execute(select(Dataset).where(Dataset.id == uuid.UUID(ds_id)))).scalar_one_or_none()
    if not ds:
        raise AppError(404, "NOT_FOUND", "Dataset not found.")
    return ds
