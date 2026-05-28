"""Sprint 8: workflow governance, tool enforcement, local-only audit, error log,
observability. Local-only; no external services."""
import uuid

def _auth(t): return {"Authorization": f"Bearer {t}"}

def _mkuser(client, founder_token, email, pw, role):
    client.post("/api/auth/users", json={"email": email, "password": pw, "role": role},
                headers=_auth(founder_token))
    r = client.post("/api/auth/login", json={"username": email, "password": pw})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


# ── workflow governance ──────────────────────────────────────────────
def test_workflow_endpoints_require_auth(client):
    assert client.get("/api/workflows/allowed").status_code == 401
    assert client.post("/api/workflows/trigger", json={"workflow_name": "x"}).status_code == 401


def test_allowed_workflows_listed(client, founder_token):
    names = [w["name"] for w in client.get("/api/workflows/allowed", headers=_auth(founder_token)).json()["allowed_workflows"]]
    assert "generate_local_report" in names


def test_arbitrary_workflow_blocked_and_audited(client, founder_token):
    h = _auth(founder_token)
    r = client.post("/api/workflows/trigger", json={"workflow_name": "rm_rf_everything"}, headers=h)
    assert r.status_code == 403 and r.json()["code"] == "WORKFLOW_NOT_ALLOWED"
    aud = client.get("/api/audit?action=workflow_blocked", headers=h).json()["audit"]
    assert any(a["entity_id"] == "rm_rf_everything" for a in aud)


def test_high_risk_workflow_requires_approval(client, founder_token):
    r = client.post("/api/workflows/trigger", json={"workflow_name": "purge_knowledge_base"},
                    headers=_auth(founder_token))
    assert r.status_code == 202 and r.json()["approval_required"] is True


def test_trigger_accepts_and_persists_source_ids(client, founder_token):
    h = _auth(founder_token)
    did, tid = str(uuid.uuid4()), str(uuid.uuid4())
    r = client.post("/api/workflows/trigger", json={"workflow_name": "generate_local_report",
                    "source_decision_id": did, "source_task_id": tid}, headers=h)
    assert r.status_code == 200, r.text
    rid = r.json()["run_id"]
    det = client.get(f"/api/workflows/runs/{rid}", headers=h).json()
    assert det["source_decision_id"] == did and det["source_task_id"] == tid
    assert det["status"] in ("skipped", "failed", "completed")  # never fake success


# ── tool registry enforcement ────────────────────────────────────────
def test_tool_registry_exposes_metadata(client, founder_token):
    tools = client.get("/api/tools", headers=_auth(founder_token)).json()["tools"]
    t = {x["name"]: x for x in tools}
    assert "search_knowledge_base" in t
    assert t["search_knowledge_base"]["risk_level"] and t["search_knowledge_base"]["required_permission"]


def test_unregistered_tool_blocked(client, founder_token):
    r = client.post("/api/tools/execute", json={"name": "hack_db"}, headers=_auth(founder_token))
    assert r.status_code == 403 and r.json()["code"] == "TOOL_NOT_REGISTERED"


def test_tool_called_and_blocked_are_audited(client, founder_token):
    h = _auth(founder_token)
    client.post("/api/tools/execute", json={"name": "search_knowledge_base", "args": {"query": "x"}}, headers=h)
    client.post("/api/tools/execute", json={"name": "nope_tool"}, headers=h)
    called = client.get("/api/audit?action=tool_called", headers=h).json()["audit"]
    blocked = client.get("/api/audit?action=tool_blocked", headers=h).json()["audit"]
    assert any(a["entity_id"] == "search_knowledge_base" for a in called)
    assert any(a["entity_id"] == "nope_tool" for a in blocked)


def test_high_risk_tool_requires_approval(client, founder_token):
    r = client.post("/api/tools/execute", json={"name": "trigger_allowed_workflow"}, headers=_auth(founder_token))
    assert r.status_code == 200 and r.json().get("approval_required") is True


def test_tool_permission_enforced(client, founder_token):
    vt = _mkuser(client, founder_token, "vic@thunity.local", "Vic-Pass-123!", "viewer")
    r = client.post("/api/tools/execute", json={"name": "search_knowledge_base", "args": {"query": "x"}},
                    headers=_auth(vt))
    assert r.status_code == 403 and r.json()["code"] == "TOOL_FORBIDDEN"


# ── observability / audit ────────────────────────────────────────────
def test_metrics_and_audit_require_auth(client):
    assert client.get("/api/metrics/overview").status_code == 401
    assert client.get("/api/audit").status_code == 401


def test_audit_listable_and_no_delete_route(client, founder_token):
    assert client.get("/api/audit", headers=_auth(founder_token)).status_code == 200
    assert client.delete("/api/audit", headers=_auth(founder_token)).status_code in (404, 405)


def test_metrics_overview_has_real_counts(client, founder_token):
    ov = client.get("/api/metrics/overview", headers=_auth(founder_token)).json()
    for k in ["workflow_failed", "workflow_blocked_attempts", "tool_called", "tool_blocked",
              "local_only_blocks", "pending_approvals", "error_count", "failed_agent_runs"]:
        assert k in ov, f"metrics overview missing {k}"


# ── local-only audited block ─────────────────────────────────────────
def test_local_only_violation_is_audited():
    import asyncio, os
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from sqlalchemy import select, func
    from db.base import Base
    from db.models import AuditLog
    from core.local_only import block_external_call, ExternalProviderBlocked

    dbfile = "/tmp/tt_localonly.db"
    if os.path.exists(dbfile):
        os.remove(dbfile)

    async def run():
        eng = create_async_engine(f"sqlite+aiosqlite:///{dbfile}")
        async with eng.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        sm = async_sessionmaker(eng, class_=AsyncSession, expire_on_commit=False)
        raised = False
        async with sm() as db:
            try:
                await block_external_call(db, actor="tester", provider="OpenAI")
            except ExternalProviderBlocked:
                raised = True
            await db.commit()
            n = (await db.execute(select(func.count()).select_from(AuditLog)
                 .where(AuditLog.action == "local_only_violation_attempt"))).scalar()
            m = (await db.execute(select(func.count()).select_from(AuditLog)
                 .where(AuditLog.action == "external_provider_blocked"))).scalar()
        await eng.dispose()
        return raised, n, m

    raised, n, m = asyncio.run(run())
    assert raised and n >= 1 and m >= 1


# ── global error handler persists ErrorLog ───────────────────────────
def test_global_exception_handler_logs_errorlog(app, founder_token, monkeypatch):
    from fastapi.testclient import TestClient
    async def boom(*a, **k):
        raise RuntimeError("kaboom-should-not-leak")
    monkeypatch.setattr("api.routes.agents.run_council", boom)
    with TestClient(app, raise_server_exceptions=False) as c:
        r = c.post("/api/agents/council", json={"message": "trigger 500"}, headers=_auth(founder_token))
        assert r.status_code == 500
        body = r.json()
        assert body["code"] == "INTERNAL_ERROR"
        assert "kaboom" not in str(body)                 # no stack-trace/detail leak
        ov = c.get("/api/metrics/overview", headers=_auth(founder_token)).json()
        assert ov["error_count"] >= 1
