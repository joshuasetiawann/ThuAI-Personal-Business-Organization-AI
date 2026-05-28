"""Tiny key/value store for runtime-tunable app settings (founder-controlled in
the UI, persisted in the DB so they survive restarts). Distinct from config.py
(env/boot config). Used for toggles like `auto_ingest_conversations`."""
from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import select

from db.models import AppSetting

# Built-in defaults when a key has never been written.
DEFAULTS: dict[str, Any] = {
    "auto_ingest_conversations": True,   # founder chose: auto-save every conversation to Knowledge
}


async def get_setting(db, key: str, default: Any = None) -> Any:
    row = (await db.execute(select(AppSetting).where(AppSetting.key == key))).scalar_one_or_none()
    if row is None:
        return DEFAULTS.get(key, default)
    val = row.value_json
    if isinstance(val, dict) and "value" in val:
        return val["value"]
    return val


async def set_setting(db, key: str, value: Any, actor: Optional[str] = None) -> AppSetting:
    row = (await db.execute(select(AppSetting).where(AppSetting.key == key))).scalar_one_or_none()
    if row is None:
        row = AppSetting(key=key, value_json={"value": value}, updated_by=actor)
        db.add(row)
    else:
        row.value_json = {"value": value}
        row.updated_by = actor
    await db.flush()
    return row
