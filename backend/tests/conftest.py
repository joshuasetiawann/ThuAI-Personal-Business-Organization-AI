"""Shared pytest fixtures. Runs fully local against a temp SQLite DB — no
Postgres/Ollama needed. Env is set BEFORE importing the app."""
import os, pathlib, pytest

os.environ.setdefault("LOCAL_ONLY_MODE", "true")
os.environ.setdefault("APP_ENV", "development")
# A non-default secret is now required to boot (fail-closed security check).
os.environ.setdefault("SECRET_KEY", "test-only-secret-not-for-production-0123456789abcdef")
os.environ["POSTGRES_URL"] = "sqlite+aiosqlite:////tmp/thunity_test.db"
for k, v in {"FILES_DIR": "/tmp/tt_files", "KNOWLEDGE_DIR": "/tmp/tt_kn",
             "SANDBOX_DIR": "/tmp/tt_sb", "BACKUP_DIR": "/tmp/tt_bk"}.items():
    os.environ.setdefault(k, v)
os.environ.setdefault("N8N_ENABLED", "false")
os.environ.setdefault("FOUNDER_EMAIL", "founder@thunity.local")
os.environ.setdefault("FOUNDER_PASSWORD", "S3cure-Founder-Pass!")

from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def app():
    p = pathlib.Path("/tmp/thunity_test.db")
    if p.exists():
        p.unlink()
    import main
    return main.app


@pytest.fixture()
def client(app):
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def founder_token(client):
    r = client.post("/api/auth/login", json={
        "username": os.environ["FOUNDER_EMAIL"], "password": os.environ["FOUNDER_PASSWORD"]})
    assert r.status_code == 200
    return r.json()["access_token"]
