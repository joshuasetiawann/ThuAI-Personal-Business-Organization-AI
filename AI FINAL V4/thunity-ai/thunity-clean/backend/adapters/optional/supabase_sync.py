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
from core.local_only import assert_local_only, block_external_call


class SupabaseSyncAdapter:
    def __init__(self):
        self.enabled = bool(settings.ENABLE_SUPABASE_ADAPTER) and not settings.LOCAL_ONLY_MODE

    def _guard(self):
        # Low-level sync guard (no DB context → no audit). Always blocks under LOCAL_ONLY_MODE.
        assert_local_only("Supabase")
        if not self.enabled:
            raise RuntimeError("Supabase adapter is disabled (ENABLE_SUPABASE_ADAPTER=false).")

    async def _guard_audited(self, db=None, actor=None):
        # Preferred: audits the violation attempt when a DB session is available,
        # then blocks. Never weakens blocking under LOCAL_ONLY_MODE.
        await block_external_call(db=db, actor=actor, provider="Supabase")
        if not self.enabled:
            raise RuntimeError("Supabase adapter is disabled (ENABLE_SUPABASE_ADAPTER=false).")

    async def upsert(self, table: str, rows: List[Dict] | Dict, db=None, actor=None) -> Dict:
        await self._guard_audited(db, actor)  # audited + raises under LOCAL_ONLY_MODE
        raise NotImplementedError("Cloud sync intentionally not implemented in local-first core.")

    async def health_check(self) -> Dict:
        return {"status": "disabled", "reason": "LOCAL_ONLY_MODE / adapter disabled"}
