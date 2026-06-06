"""Local-only compliance tests (Phase 1)."""

def test_health_local_only_endpoint_is_compliant(client):
    r = client.get("/api/health/local-only")          # public liveness endpoint
    assert r.status_code == 200
    b = r.json()
    assert b["local_only_mode"] is True
    assert b["external_ai_providers_enabled"] is False
    assert b["status"] in ("compliant", "warning", "error")


def test_low_level_guard_blocks():
    from core.local_only import assert_local_only, ExternalProviderBlocked
    raised = False
    try:
        assert_local_only("openai")
    except ExternalProviderBlocked:
        raised = True
    assert raised
