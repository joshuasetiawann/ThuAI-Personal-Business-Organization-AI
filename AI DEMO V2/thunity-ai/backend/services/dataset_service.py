"""Dataset registry — CSV/XLSX become first-class datasets with detected schema
and a simple quality score (fraction of non-missing cells)."""
from __future__ import annotations
from db.models import Dataset


def quality_score(schema: dict) -> float:
    rows = schema.get("row_count", 0)
    cols = schema.get("column_count", len(schema.get("columns", [])))
    missing = sum((schema.get("missing_value_summary") or {}).values())
    total = rows * cols
    if total <= 0:
        return 0.0
    return round(max(0.0, 1.0 - missing / total), 3)


async def register_dataset(db, *, filename, document_id=None, source_platform="manual",
                           client_name=None, project_name=None, campaign_name=None,
                           schema: dict = None) -> Dataset:
    schema = schema or {}
    ds = Dataset(
        filename=filename, document_id=document_id, source_platform=source_platform,
        client_name=client_name, project_name=project_name, campaign_name=campaign_name,
        row_count=schema.get("row_count", 0), column_count=schema.get("column_count", len(schema.get("columns", []))),
        schema_json=schema, missing_value_summary=schema.get("missing_value_summary", {}),
        quality_score=quality_score(schema), status="active",
    )
    db.add(ds)
    await db.flush()
    return ds
