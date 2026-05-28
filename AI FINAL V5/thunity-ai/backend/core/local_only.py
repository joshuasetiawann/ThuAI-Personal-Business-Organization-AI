"""
LOCAL_ONLY_MODE enforcement + declared-frontier governance.

Two distinct concepts, kept honest:

  • UNDECLARED external calls (e.g. legacy Supabase sync) are blocked whenever
    LOCAL_ONLY_MODE is true — there is no silent cloud fallback anywhere. Such a
    path MUST call assert_local_only() first.

  • A DECLARED frontier provider (Anthropic Claude) is a deliberate, audited,
    user-configured capability: enabled only when ANTHROPIC_API_KEY is present
    AND FRONTIER_ENABLED is true. It is always labelled in the UI and reflected
    by compliance_status() == "hybrid". A frontier path calls
    assert_frontier_allowed() first. No key ⇒ frontier is off ⇒ fully local.
"""
from __future__ import annotations

from typing import List

from config import settings


class ExternalProviderBlocked(RuntimeError):
    """Raised when an UNDECLARED external provider call is attempted under LOCAL_ONLY_MODE."""


class FrontierNotConfigured(RuntimeError):
    """Raised when a frontier (Claude) call is attempted without a declared key."""


def assert_local_only(provider: str = "external AI provider") -> None:
    if settings.LOCAL_ONLY_MODE:
        # Audit logging of the attempt is done by the caller (it has request context).
        raise ExternalProviderBlocked(
            "External AI provider calls are disabled in LOCAL_ONLY_MODE."
        )


def frontier_enabled() -> bool:
    """True when a frontier provider (Anthropic Claude) is DECLARED and keyed.
    This is a deliberate, labelled, audited path — NOT the silent cloud fallback
    that LOCAL_ONLY_MODE forbids. No key ⇒ False ⇒ Thunity stays 100% local."""
    return settings.frontier_configured


def active_frontier_providers() -> List[str]:
    """Honest list of external providers that can actually be reached right now."""
    return [settings.active_frontier_provider] if frontier_enabled() else []


def assert_frontier_allowed(provider: str = "anthropic") -> None:
    if not frontier_enabled():
        raise FrontierNotConfigured(
            "Frontier provider is not configured. Set ANTHROPIC_API_KEY (and keep "
            "FRONTIER_ENABLED=true) in .env to enable the hybrid Claude route."
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
    """True if ANY external provider can be reached: a DECLARED frontier provider,
    or (legacy) the Supabase adapter when local-only is off."""
    if frontier_enabled():
        return True
    if settings.LOCAL_ONLY_MODE:
        return False
    return bool(settings.ENABLE_SUPABASE_ADAPTER)


def compliance_status() -> str:
    """compliant | hybrid | warning | error — the honest source of truth for the UI.

    • hybrid    → local-first PLUS a declared, labelled frontier provider (Claude).
    • compliant → fully local, no external reachable.
    • warning   → legacy Supabase adapter enabled.
    • error     → LOCAL_ONLY_MODE off with nothing declared (misconfiguration).
    """
    if frontier_enabled():
        return "hybrid"
    if not settings.LOCAL_ONLY_MODE:
        return "error"
    if settings.ENABLE_SUPABASE_ADAPTER:
        return "warning"
    return "compliant"
