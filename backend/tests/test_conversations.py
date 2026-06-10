"""Conversation + message persistence tests (Phase 4). Real local DB (SQLite)."""

def _auth(t): return {"Authorization": f"Bearer {t}"}

def _mkuser(client, founder_token, email, pw, role="analyst"):
    client.post("/api/auth/users", json={"email": email, "password": pw, "role": role},
                headers=_auth(founder_token))  # 200 first time, 409 if rerun in-session
    r = client.post("/api/auth/login", json={"username": email, "password": pw})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_unauthenticated_returns_401(client):
    assert client.get("/api/conversations").status_code == 401


def test_create_list_and_message_persist(client, founder_token):
    tok = _mkuser(client, founder_token, "alice@thunity.local", "Alice-Pass-123!")
    c = client.post("/api/conversations", json={"title": "Q3 plan"}, headers=_auth(tok))
    assert c.status_code == 200, c.text
    cid = c.json()["id"]
    lst = client.get("/api/conversations", headers=_auth(tok)).json()
    assert any(x["id"] == cid for x in lst["conversations"])
    m = client.post(f"/api/conversations/{cid}/messages",
                    json={"role": "user", "content": "hello memory", "metadata_json": {"k": 1}},
                    headers=_auth(tok))
    assert m.status_code == 200, m.text
    msgs = client.get(f"/api/conversations/{cid}/messages", headers=_auth(tok)).json()["messages"]
    assert len(msgs) == 1 and msgs[0]["content"] == "hello memory"


def test_cross_user_forbidden_but_founder_allowed(client, founder_token):
    ta = _mkuser(client, founder_token, "bob@thunity.local", "Bob-Pass-123!")
    tb = _mkuser(client, founder_token, "carol@thunity.local", "Carol-Pass-123!")
    cid = client.post("/api/conversations", json={"title": "bob secret"}, headers=_auth(ta)).json()["id"]
    assert client.get(f"/api/conversations/{cid}", headers=_auth(tb)).status_code == 403
    assert client.get(f"/api/conversations/{cid}", headers=_auth(founder_token)).status_code == 200


def test_agent_run_models_exist_and_import():
    from db.models import AgentRun, AgentMessage
    for f in ["id", "conversation_id", "mode", "user_message", "final_response",
              "model_map_json", "knowledge_used", "status", "created_at",
              "completed_at", "total_latency_ms"]:
        assert hasattr(AgentRun, f), f"AgentRun missing {f}"
    for f in ["id", "agent_run_id", "agent_name", "round", "model", "prompt_version_id",
              "prompt", "response", "token_estimate", "latency_ms", "status", "created_at"]:
        assert hasattr(AgentMessage, f), f"AgentMessage missing {f}"
