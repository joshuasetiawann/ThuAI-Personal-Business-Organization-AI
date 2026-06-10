"""Governance tests (Phase 13/14/15): decisions, tasks, approval gate."""

def _auth(t): return {"Authorization": f"Bearer {t}"}


def test_unauthenticated_governance_endpoints_401(client):
    assert client.get("/api/decisions").status_code == 401
    assert client.get("/api/tasks").status_code == 401
    assert client.get("/api/approvals").status_code == 401


def test_create_approve_and_reject_decision(client, founder_token):
    h = _auth(founder_token)
    d = client.post("/api/decisions", json={"title": "Adopt local RAG",
                    "decision_text": "Use nomic-embed-text", "risk_level": "medium"}, headers=h)
    assert d.status_code == 200, d.text
    did = d.json()["id"]; assert d.json()["status"] == "draft"
    assert client.post(f"/api/decisions/{did}/approve", headers=h).status_code == 200
    assert client.get(f"/api/decisions/{did}", headers=h).json()["status"] == "approved"
    # a second decision can be rejected
    d2 = client.post("/api/decisions", json={"title": "Buy 70B GPU rig", "risk_level": "high"}, headers=h).json()
    assert client.post(f"/api/decisions/{d2['id']}/reject", headers=h).status_code == 200
    assert client.get(f"/api/decisions/{d2['id']}", headers=h).json()["status"] == "rejected"


def test_task_create_and_from_decision(client, founder_token):
    h = _auth(founder_token)
    t = client.post("/api/tasks", json={"title": "Wire RAG into council"}, headers=h)
    assert t.status_code == 200 and t.json()["status"] == "backlog"
    d = client.post("/api/decisions", json={"title": "Ship knowledge vault"}, headers=h).json()
    fd = client.post(f"/api/tasks/from-decision/{d['id']}", headers=h)
    assert fd.status_code == 200 and fd.json().get("id")


def test_approval_request_create_and_resolve(client, founder_token):
    h = _auth(founder_token)
    a = client.post("/api/approvals", json={"requested_action": "delete_document",
                    "risk_level": "high"}, headers=h)
    assert a.status_code == 200 and a.json()["status"] == "pending"
    aid = a.json()["id"]
    pend = client.get("/api/approvals/pending", headers=h).json()
    items = pend if isinstance(pend, list) else next((v for v in pend.values() if isinstance(v, list)), [])
    assert any(x["id"] == aid for x in items)
    assert client.post(f"/api/approvals/{aid}/approve", json={}, headers=h).status_code == 200


def test_critical_approval_requires_confirmation_phrase(client, founder_token):
    h = _auth(founder_token)
    aid = client.post("/api/approvals", json={"requested_action": "delete_file",
                      "risk_level": "critical"}, headers=h).json()["id"]
    assert client.post(f"/api/approvals/{aid}/approve", json={}, headers=h).status_code == 400
    ok = client.post(f"/api/approvals/{aid}/approve", json={"confirmation": "APPROVE DELETE"}, headers=h)
    assert ok.status_code == 200 and ok.json()["status"] == "approved"


def test_high_risk_decision_execution_is_gated(client, founder_token):
    h = _auth(founder_token)
    did = client.post("/api/decisions", json={"title": "Delete prod dataset",
                      "risk_level": "high"}, headers=h).json()["id"]
    client.post(f"/api/decisions/{did}/approve", headers=h)
    gated = client.post(f"/api/decisions/{did}/execute", headers=h)      # no approval_id
    assert gated.status_code == 202 and gated.json()["approval_required"] is True
    aid = gated.json()["approval_id"]
    assert client.post(f"/api/approvals/{aid}/approve", json={}, headers=h).status_code == 200
    done = client.post(f"/api/decisions/{did}/execute?approval_id={aid}", headers=h)
    assert done.status_code == 200
    assert client.get(f"/api/decisions/{did}", headers=h).json()["status"] == "executed"
