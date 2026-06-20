"""Tests for the frontier routing logic (agents/inference.py).

This is the enforcement point of the "no silent cloud fallback" promise, and it
previously had ZERO tests. These lock in: local-by-default, LOCAL_ONLY_MODE as
the master switch, heavy-intent escalation, and force overrides.
"""
import pytest

from agents import inference
from config import settings


def _enable_hybrid(monkeypatch, provider="anthropic"):
    monkeypatch.setattr(settings, "LOCAL_ONLY_MODE", False)
    monkeypatch.setattr(settings, "FRONTIER_ENABLED", True)
    monkeypatch.setattr(settings, "FRONTIER_PROVIDER", provider)
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "")
    monkeypatch.setattr(settings, "ROUTE_AUTO", True)


def test_route_local_when_frontier_not_configured(monkeypatch):
    monkeypatch.setattr(settings, "LOCAL_ONLY_MODE", False)
    monkeypatch.setattr(settings, "FRONTIER_ENABLED", False)
    r = inference.route("draft a strategy for our business expansion plan")
    assert r["provider"] == "local" and r["frontier"] is False


def test_route_never_frontier_under_local_only_even_with_key(monkeypatch):
    # The central promise: a present key must not route data to the cloud
    # while LOCAL_ONLY_MODE is on — not even with force="frontier".
    monkeypatch.setattr(settings, "LOCAL_ONLY_MODE", True)
    monkeypatch.setattr(settings, "FRONTIER_ENABLED", True)
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "sk-ant-test")
    for force in (None, "frontier"):
        r = inference.route("analyze our financial strategy in depth", force=force)
        assert r["provider"] == "local" and r["frontier"] is False


def test_route_heavy_keyword_escalates_to_frontier(monkeypatch):
    _enable_hybrid(monkeypatch)
    r = inference.route("please analyze our pricing")
    assert r["frontier"] is True and r["provider"] == "anthropic"
    assert "analyze" in r["reason"]


def test_route_indonesian_heavy_keyword_escalates(monkeypatch):
    _enable_hybrid(monkeypatch)
    r = inference.route("tolong evaluasi rencana ini")
    assert r["frontier"] is True


def test_route_short_chitchat_stays_local(monkeypatch):
    _enable_hybrid(monkeypatch)
    r = inference.route("hello!")
    assert r["provider"] == "local" and r["frontier"] is False


def test_route_long_message_escalates(monkeypatch):
    _enable_hybrid(monkeypatch)
    msg = "x" * (settings.ROUTE_HEAVY_CHAR_THRESHOLD + 1)
    assert inference.route(msg)["frontier"] is True


def test_route_council_mode_forces_frontier(monkeypatch):
    _enable_hybrid(monkeypatch)
    assert inference.route("hi", mode="council")["frontier"] is True


def test_route_force_local_wins_over_heavy_intent(monkeypatch):
    _enable_hybrid(monkeypatch)
    r = inference.route("analyze this strategy thoroughly", force="local")
    assert r["provider"] == "local" and r["frontier"] is False


def test_route_auto_off_keeps_everything_local(monkeypatch):
    _enable_hybrid(monkeypatch)
    monkeypatch.setattr(settings, "ROUTE_AUTO", False)
    assert inference.route("analyze our quarterly financial strategy")["frontier"] is False


def test_route_openrouter_provider_selected(monkeypatch):
    _enable_hybrid(monkeypatch, provider="openrouter")
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "sk-or-test")
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "")
    r = inference.route("compare these two roadmap options")
    assert r["frontier"] is True and r["provider"] == "openrouter"
    assert r["model"] == settings.OPENROUTER_MODEL


# ── Anthropic client safety ───────────────────────────────────────────────────
def test_anthropic_temperature_clamped_to_api_range():
    from agents.anthropic_client import anthropic
    p = anthropic._payload("m", [{"role": "user", "content": "hi"}], 1.5, 10, stream=False)
    assert p["temperature"] == 1.0
    p = anthropic._payload("m", [{"role": "user", "content": "hi"}], -3, 10, stream=False)
    assert p["temperature"] == 0.0


def test_provider_error_excludes_response_body():
    # The body can echo prompt content and the message lands in audit logs —
    # only the status + machine-readable error type may survive.
    from agents.anthropic_client import _api_error
    body = '{"error": {"type": "invalid_request_error", "message": "SECRET PROMPT ECHO"}}'
    err = _api_error("Anthropic", 400, body)
    assert "invalid_request_error" in str(err)
    assert "SECRET PROMPT ECHO" not in str(err)
