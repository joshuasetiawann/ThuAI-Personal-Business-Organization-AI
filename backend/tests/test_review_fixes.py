"""Regression tests for the security/correctness fixes from the code review.

These lock in the highest-impact fixes so a future refactor can't silently
reintroduce them — especially the local-only ↔ frontier gating, which is the
product's central promise and previously had ZERO tests.
"""
import pytest


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


# ── Local-only / frontier gating (core promise) ──────────────────────────────
def test_local_only_blocks_frontier_even_with_key(monkeypatch):
    from config import settings
    import core.local_only as lo
    monkeypatch.setattr(settings, "LOCAL_ONLY_MODE", True)
    monkeypatch.setattr(settings, "FRONTIER_ENABLED", True)
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "sk-ant-deadbeef")
    # A present key must NOT make the cloud reachable while local-only is on.
    assert lo.frontier_enabled() is False
    assert lo.external_ai_providers_enabled() is False
    assert lo.compliance_status() == "compliant"
    with pytest.raises(lo.ExternalProviderBlocked):
        lo.assert_frontier_allowed("anthropic")


def test_frontier_reachable_only_when_local_only_off(monkeypatch):
    from config import settings
    import core.local_only as lo
    monkeypatch.setattr(settings, "LOCAL_ONLY_MODE", False)
    monkeypatch.setattr(settings, "FRONTIER_ENABLED", True)
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "sk-or-deadbeef")
    assert lo.frontier_enabled() is True
    assert lo.compliance_status() == "hybrid"
    lo.assert_frontier_allowed("openrouter")  # must not raise


def test_frontier_off_by_default(monkeypatch):
    # With no key, frontier stays disabled regardless of the local-only flag.
    from config import settings
    import core.local_only as lo
    monkeypatch.setattr(settings, "LOCAL_ONLY_MODE", False)
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "")
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "")
    assert lo.frontier_enabled() is False


# ── Fail-closed startup security check ───────────────────────────────────────
def test_security_audit_flags_default_secret():
    from config import Settings, security_audit, _DEFAULT_SECRET
    s = Settings(SECRET_KEY=_DEFAULT_SECRET)
    fatal, _warnings = security_audit(s)
    assert any("SECRET_KEY" in f for f in fatal)


# ── Decision approval-gate cannot be bypassed via PATCH status ───────────────
def test_decision_status_not_editable_via_patch(client, founder_token):
    h = _auth(founder_token)
    did = client.post("/api/decisions", json={"title": "draft a"}, headers=h).json()["id"]
    r = client.patch(f"/api/decisions/{did}", json={"status": "approved"}, headers=h)
    assert r.status_code == 400 and r.json()["code"] == "STATUS_NOT_EDITABLE"
    # a non-status field still updates fine
    assert client.patch(f"/api/decisions/{did}", json={"title": "renamed"}, headers=h).status_code == 200


# ── Raw file read/list require READ_KNOWLEDGE (viewer must be denied) ─────────
def test_files_read_requires_read_knowledge(client, founder_token):
    h = _auth(founder_token)
    client.post("/api/auth/users",
                json={"email": "rfix-viewer@thunity.local", "password": "Vv-pass-123!", "role": "viewer"},
                headers=h)
    vt = client.post("/api/auth/login",
                     json={"username": "rfix-viewer@thunity.local", "password": "Vv-pass-123!"}).json()["access_token"]
    assert client.get("/api/files/read?path=knowledge/x.txt", headers=_auth(vt)).status_code == 403
    assert client.get("/api/files/list?subdir=knowledge", headers=_auth(vt)).status_code == 403


# ── Dataset import enforces the upload size cap (no unbounded read) ───────────
def test_dataset_import_respects_upload_cap(client, founder_token, monkeypatch):
    monkeypatch.setattr("services.file_service.file_service.max_bytes", 5)
    files = {"file": ("data.csv", b"a,b,c\n1,2,3\n4,5,6", "text/csv")}
    r = client.post("/api/datasets/import", files=files, headers=_auth(founder_token))
    assert r.status_code == 400 and r.json()["code"] == "UPLOAD_REJECTED"


# ── Tool args are validated against the declared schema ──────────────────────
def test_tool_rejects_unknown_args(client, founder_token):
    r = client.post("/api/tools/execute",
                    json={"name": "search_knowledge_base", "args": {"query": "x", "evil": 1}},
                    headers=_auth(founder_token))
    assert r.status_code == 400 and r.json()["code"] == "INVALID_ARGS"


# ── Login throttle now also caps a single IP across many usernames ───────────
def test_login_throttle_caps_per_ip_across_usernames():
    import core.ratelimit as rl
    rl._ATTEMPTS.clear()
    ip = "203.0.113.9"
    # 20 failures spread across distinct usernames (each pair stays under its own
    # limit) must still trip the per-IP cap.
    for i in range(20):
        rl.record_failure(ip, f"user{i}@x.local")
    allowed, _retry = rl.check(ip, "brand-new@x.local")
    assert allowed is False
    rl._ATTEMPTS.clear()
