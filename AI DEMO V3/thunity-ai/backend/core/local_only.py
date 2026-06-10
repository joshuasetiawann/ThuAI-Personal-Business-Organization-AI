"""
LOCAL_ONLY_MODE enforcement.

Any code path that would reach an external AI / cloud provider MUST call
assert_local_only() first. When LOCAL_ONLY_MODE is true (the default), this
raises and the call is blocked — there is no silent cloud fallback anywhere.
"""
from __future__ import annotations

from config import settings


class ExternalProviderBlocked(RuntimeError):
    """Raised when an external provider call is attempted under LOCAL_ONLY_MODE."""


def assert_local_only(provider: str = "external AI provider") -> None:
    if settings.LOCAL_ONLY_MODE:
        # Audit logging of the attempt is done by the caller (it has request context).
        raise ExternalProviderBlocked(
            "External AI provider calls are disabled in LOCAL_ONLY_MODE."
        )


async def block_external_call(db=None, actor: str = None, provider: str = "external AI provider"):
    """Audit the attempt (when a DB session is supplied) BEFORE blocking. Never
    weakens blocking — raises under LOCAL_ONLY_MODE regardless of audit outcome."""
    if settings.LOCAL_ONLY_MODE:
        if db is not None:
            try:
                from core.audit import log_audit
                await log_audit(db, "local_only_violation_attempt", actor=actor,
                                entity_type="provider", entity_id=provider)
                await log_audit(db, "external_provider_blocked", actor=actor,
                                entity_type="provider", entity_id=provider)
            except Exception:
                pass
        raise ExternalProviderBlocked(
            "External AI provider calls are disabled in LOCAL_ONLY_MODE.")


def external_ai_providers_enabled() -> bool:
    """True only if local-only is OFF *and* some optional external adapter is enabled."""
    if settings.LOCAL_ONLY_MODE:
        return False
    return bool(settings.ENABLE_SUPABASE_ADAPTER)


def compliance_status() -> str:
    """compliant | warning | error — used by /api/health/local-only."""
    if not settings.LOCAL_ONLY_MODE:
        return "error"
    if external_ai_providers_enabled():
        return "warning"
    return "compliant"
