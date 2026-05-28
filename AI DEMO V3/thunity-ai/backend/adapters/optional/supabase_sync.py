"""
OPTIONAL legacy adapter — QUARANTINED. Disabled by default.

This file is NOT imported by any core path. Every method is gated by
assert_local_only(): under LOCAL_ONLY_MODE (the default) any call raises
ExternalProviderBlocked. It exists only so prior Supabase sync work is not
lost; it is never part of the company brain's core reasoning/storage path.
"""
from __future__ import annotations
from typing import Dict, List
from config import settings
from core.local_only import assert_local_only


class SupabaseSyncAdapter:
    def __init__(self):
        self.enabled = bool(settings.ENABLE_SUPABASE_ADAPTER) and not settings.LOCAL_ONLY_MODE

    def _guard(self):
        assert_local_only("Supabase")
        if not self.enabled:
            raise RuntimeError("Supabase adapter is disabled (ENABLE_SUPABASE_ADAPTER=false).")

    async def upsert(self, table: str, rows: List[Dict] | Dict) -> Dict:
        self._guard()  # raises under LOCAL_ONLY_MODE
        raise NotImplementedError("Cloud sync intentionally not implemented in local-first core.")

    async def health_check(self) -> Dict:
        return {"status": "disabled", "reason": "LOCAL_ONLY_MODE / adapter disabled"}
