"""Pre-Shot 3 hardening: bounded lists, upload safety, tool approval gate, local binding."""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def _auth(t): return {"Authorization": f"Bearer {t}"}


def test_list_endpoints_respect_limit(client, founder_token):
    h = _auth(founder_token)
    for i in range(3):
        client.post("/api/conversations", json={"title": f"c{i}"}, headers=h)
    r = client.get("/api/conversations?limit=2", headers=h)
    assert r.status_code == 200 and len(r.json()["conversations"]) <= 2


def test_high_risk_tool_requires_approval(client, founder_token):
    r = client.post("/api/tools/execute", json={"name": "trigger_allowed_workflow"}, headers=_auth(founder_token))
    assert r.status_code == 200 and r.json().get("approval_required") is True


def test_high_risk_tool_invalid_approval_blocked(client, founder_token):
    import uuid
    h = _auth(founder_token)
    r = client.post("/api/tools/execute",
                    json={"name": "trigger_allowed_workflow", "approval_id": str(uuid.uuid4())}, headers=h)
    assert r.status_code == 403 and r.json()["code"] == "APPROVAL_REQUIRED"
    aud = client.get("/api/audit?action=tool_blocked", headers=h).json()["audit"]
    assert any((a.get("metadata") or {}).get("reason") == "invalid_or_unapproved_approval" for a in aud)


def test_high_risk_tool_with_valid_approval_passes_gate(client, founder_token):
    h = _auth(founder_token)
    req = client.post("/api/tools/execute", json={"name": "trigger_allowed_workflow"}, headers=h).json()
    aid = req["approval_id"]
    assert client.post(f"/api/approvals/{aid}/approve", json={}, headers=h).status_code == 200
    # Use a native (no-n8n) allow-listed workflow so the gate test is hermetic and
    # supplies the now-required, schema-validated workflow_name.
    done = client.post("/api/tools/execute",
                       json={"name": "trigger_allowed_workflow", "approval_id": aid,
                             "args": {"workflow_name": "generate_local_report"}}, headers=h)
    assert done.status_code == 200 and done.json().get("approval_required") is not True


def test_upload_oversize_rejected(client, founder_token, monkeypatch):
    monkeypatch.setattr("services.file_service.file_service.max_bytes", 5)
    files = {"file": ("note.txt", b"way more than five bytes", "text/plain")}
    r = client.post("/api/files/upload", files=files, headers=_auth(founder_token))
    assert r.status_code == 400 and r.json()["code"] == "UPLOAD_REJECTED"


def test_upload_bad_extension_rejected(client, founder_token):
    files = {"file": ("evil.exe", b"MZ...", "application/octet-stream")}
    r = client.post("/api/files/upload", files=files, headers=_auth(founder_token))
    assert r.status_code == 400 and r.json()["code"] == "UPLOAD_REJECTED"


def test_docker_compose_backend_is_localhost_only():
    text = open(os.path.join(ROOT, "docker-compose.yml")).read()
    assert '127.0.0.1:8000:8000' in text
    assert 'ports: ["8000:8000"]' not in text   # no public backend binding
