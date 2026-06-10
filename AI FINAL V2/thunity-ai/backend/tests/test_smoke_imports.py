"""Smoke + finalization coverage (Sprint 9): router mounts, local-only models,
compliance scanner, audit append-only, docs present."""
import os, sys, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def _auth(t): return {"Authorization": f"Bearer {t}"}

MOUNTED = ["/api/auth", "/api/agents", "/api/conversations", "/api/knowledge", "/api/files",
           "/api/datasets", "/api/decisions", "/api/tasks", "/api/approvals", "/api/workflows",
           "/api/tools", "/api/metrics", "/api/audit", "/api/hardware", "/api/health",
           "/api/models", "/api/sandbox", "/api/settings"]


def test_app_imports_and_routers_mounted():
    import main
    paths = " ".join(r.path for r in main.app.routes)
    for prefix in MOUNTED:
        assert prefix in paths, f"router not mounted: {prefix}"


def test_required_models_are_local_only():
    from agents.model_router import required_models
    joined = " ".join(required_models()).lower()
    for cloud in ["openai", "gpt-", "claude", "anthropic", "gemini", "groq", "together", "cohere"]:
        assert cloud not in joined


def test_check_local_only_script_passes():
    r = subprocess.run([sys.executable, "scripts/check-local-only.py"], cwd=ROOT,
                       capture_output=True, text=True)
    assert r.returncode == 0 and "PASS" in r.stdout, r.stdout + r.stderr


def test_audit_is_append_only(client, founder_token):
    h = _auth(founder_token)
    assert client.put("/api/audit", headers=h).status_code in (404, 405)
    assert client.patch("/api/audit", headers=h).status_code in (404, 405)
    assert client.delete("/api/audit", headers=h).status_code in (404, 405)


def test_required_docs_present():
    for n in ["OPERATING_DOCTRINE", "LOCAL_ONLY_COMPLIANCE", "HARDWARE_PROFILE", "AGENT_COUNCIL",
              "BACKEND_ARCHITECTURE", "API_OVERVIEW", "SECURITY_BASELINE", "RAG_PIPELINE",
              "DECISION_TASK_APPROVAL", "WORKFLOW_TOOL_GOVERNANCE", "BACKUP_RESTORE", "TESTING"]:
        p = os.path.join(ROOT, "docs", f"{n}.md")
        assert os.path.exists(p) and os.path.getsize(p) > 0, f"missing/empty doc {n}"
