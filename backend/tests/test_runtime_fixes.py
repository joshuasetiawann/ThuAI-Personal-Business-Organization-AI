"""Regression tests for the runtime/DX + remaining-audit fixes:
invalid UUIDs return 4xx (never 500), real list totals, metadata size caps,
tool arg range bounds, and dev CORS for any localhost port.
"""
import json

import pytest


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


# ── Invalid UUIDs: structured 404/400, never a 500 ───────────────────────────
@pytest.mark.parametrize("path", [
    "/api/decisions/not-a-uuid",
    "/api/tasks/not-a-uuid",
    "/api/knowledge/documents/not-a-uuid",
    "/api/datasets/not-a-uuid",
    "/api/workflows/runs/not-a-uuid",
    "/api/audit/not-a-uuid",
    "/api/conversations/not-a-uuid",
])
def test_invalid_uuid_returns_404_not_500(client, founder_token, path):
    r = client.get(path, headers=_auth(founder_token))
    assert r.status_code == 404, f"{path} → {r.status_code}"


def test_parse_uuid_helper():
    from core.errors import parse_uuid, AppError
    import uuid as uuidlib
    assert isinstance(parse_uuid(str(uuidlib.uuid4())), uuidlib.UUID)
    with pytest.raises(AppError) as e:
        parse_uuid("nope", "decision id")
    assert e.value.status_code == 404
    with pytest.raises(AppError) as e:
        parse_uuid("nope", "approval_id", 400)
    assert e.value.status_code == 400


# ── List totals are the real corpus count, not the page size ─────────────────
def test_decisions_total_is_real_count(client, founder_token):
    h = _auth(founder_token)
    for i in range(3):
        client.post("/api/decisions", json={"title": f"count-fix {i}"}, headers=h)
    r = client.get("/api/decisions?limit=1", headers=h).json()
    assert len(r["decisions"]) == 1
    assert r["total"] >= 3


# ── Message metadata is size-capped ──────────────────────────────────────────
def test_message_metadata_size_capped(client, founder_token):
    h = _auth(founder_token)
    conv = client.post("/api/conversations", json={"title": "meta cap"}, headers=h).json()
    big = {"blob": "x" * 20_000}
    r = client.post(f"/api/conversations/{conv['id']}/messages",
                    json={"role": "user", "content": "hi", "metadata_json": big}, headers=h)
    assert r.status_code == 422
    ok = client.post(f"/api/conversations/{conv['id']}/messages",
                     json={"role": "user", "content": "hi", "metadata_json": {"k": "v"}}, headers=h)
    assert ok.status_code == 200


# ── Tool args: numeric range bounds enforced centrally ───────────────────────
def test_tool_top_k_out_of_range_rejected(client, founder_token):
    r = client.post("/api/tools/execute",
                    json={"name": "search_knowledge_base", "args": {"query": "x", "top_k": 9999}},
                    headers=_auth(founder_token))
    assert r.status_code == 400 and r.json()["code"] == "INVALID_ARGS"


def test_tool_decision_draft_accepts_summary(client, founder_token):
    # 'summary' is used by the handler and must not be rejected as unknown.
    r = client.post("/api/tools/execute",
                    json={"name": "create_decision_draft",
                          "args": {"title": "t", "decision_text": "d", "summary": "s"}},
                    headers=_auth(founder_token))
    assert r.status_code == 200


# ── Dev CORS: any localhost port may talk to the API (Vite fallback ports) ───
def test_dev_cors_allows_any_localhost_port(client):
    r = client.options("/api/health/local-only", headers={
        "Origin": "http://localhost:3001",
        "Access-Control-Request-Method": "GET",
    })
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3001"


def test_dev_cors_rejects_non_local_origin(client):
    r = client.options("/api/health/local-only", headers={
        "Origin": "https://evil.example.com",
        "Access-Control-Request-Method": "GET",
    })
    assert r.headers.get("access-control-allow-origin") != "https://evil.example.com"


# ── Embedding completeness: partial batches must abort, not silently truncate ─
def test_partial_embedding_batch_aborts():
    from services.knowledge_service import _assert_embedding_complete
    _assert_embedding_complete([{"content": "a"}], [[0.1]])     # complete → fine
    with pytest.raises(RuntimeError):
        _assert_embedding_complete([{"content": "a"}, {"content": "b"}], [[0.1]])
