"""Security baseline tests (Phase 2)."""
import os, pytest

SENSITIVE_GET = [
    "/api/agents/health", "/api/files/list", "/api/metrics/system",
    "/api/workflows/allowed", "/api/conversations", "/api/knowledge/documents",
    "/api/decisions", "/api/tasks", "/api/approvals", "/api/audit",
]

@pytest.mark.parametrize("creds", [("admin", "admin123"), ("user", "user123")])
def test_hardcoded_creds_login_fails(client, creds):
    r = client.post("/api/auth/login", json={"username": creds[0], "password": creds[1]})
    assert r.status_code == 401

@pytest.mark.parametrize("path", SENSITIVE_GET)
def test_sensitive_endpoint_requires_token(client, path):
    assert client.get(path).status_code == 401

def test_cors_is_not_wildcard(app):
    cors = [m for m in app.user_middleware if "CORS" in m.cls.__name__]
    assert cors, "CORS middleware missing"
    ao = cors[0].kwargs.get("allow_origins")
    assert ao and "*" not in ao

def test_founder_login_and_password_hashing(client):
    good = client.post("/api/auth/login", json={
        "username": os.environ["FOUNDER_EMAIL"], "password": os.environ["FOUNDER_PASSWORD"]})
    assert good.status_code == 200 and good.json().get("access_token")
    bad = client.post("/api/auth/login", json={
        "username": os.environ["FOUNDER_EMAIL"], "password": "wrong"})
    assert bad.status_code == 401

def test_token_grants_access(client, founder_token):
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {founder_token}"})
    assert r.status_code == 200
