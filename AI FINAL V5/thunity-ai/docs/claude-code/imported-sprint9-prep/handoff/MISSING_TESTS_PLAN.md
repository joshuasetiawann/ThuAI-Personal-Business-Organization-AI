# Missing Tests — Implementation Plan (Sprint 9)

Each test below is **new** (verified absent by reading all six existing suites). All are
local-only and Ollama-free, matching the current harness in `backend/tests/conftest.py`
(temp SQLite, `N8N_ENABLED=false`, fixtures `client` + `founder_token`). Assertions are
minimal on purpose — main Claude can expand them.

> Status note: the review session could not run `pytest` (no network to install deps).
> These are specifications, not passing results.

## Summary table

| # | Test name | Target file | Type | Purpose |
|---|-----------|-------------|------|---------|
| 1 | `test_backup_excludes_real_env` | `tests/test_backup_restore.py` (new) | integration | Prove a backup never contains the real `.env`, only `.env.example` |
| 2 | `test_backup_restore_scripts_exist_exec` | `tests/test_backup_restore.py` (new) | unit | Both scripts exist and are executable |
| 3 | `test_hardware_status_requires_auth` | `tests/test_hardware.py` (new) | smoke | `/api/hardware/status` is auth-gated |
| 4 | `test_hardware_status_structured_shape` | `tests/test_hardware.py` (new) | integration | Endpoint returns the documented structure |
| 5 | `test_local_only_health_compliant` | `tests/test_local_only_health.py` (new) | integration | `/api/health/local-only` reports `compliant` |
| 6 | `test_assert_local_only_raises` | `tests/test_local_only_health.py` (new) | unit | Guard raises under `LOCAL_ONLY_MODE` |
| 7 | `test_check_local_only_script_passes` | `tests/test_local_only_health.py` (new) | integration | Compliance scanner exits 0 on the tree |
| 8 | `test_audit_has_no_mutation_routes` | `tests/test_workflow_tool_observability.py` (extend) | smoke | No `PUT`/`PATCH` on audit (append-only) |
| 9 | `test_app_imports_and_routers_mounted` | `tests/test_smoke_imports.py` (new) | smoke | App imports; all router prefixes mounted |
| 10 | `test_required_models_are_local_only` | `tests/test_smoke_imports.py` (new) | unit | `required_models()` has no cloud vendor token |
| 11 | `test_required_docs_present` | `tests/test_docs_present.py` (new, optional) | smoke | The 12 `docs/*.md` exist and are non-empty |

## Per-test detail

### 1. `test_backup_excludes_real_env` — integration (highest value)
**Purpose:** the core promise depends on backups never leaking secrets.
**Minimal assertion:**
```python
# arrange a temp ROOT with data/, a dummy .env (secret) and .env.example, run the script
subprocess.run(["bash", "scripts/backup-local.sh"], env={**os.environ, "BACKUP_DIR": out}, check=True)
names = tarfile.open(latest_archive).getnames()           # extract nested staging tar too
assert any(n.endswith(".env.example") for n in names)
assert not any(n.endswith("/.env") or n == ".env" for n in names)
```

### 2. `test_backup_restore_scripts_exist_exec` — unit
**Minimal assertion:**
```python
for s in ("scripts/backup-local.sh", "scripts/restore-local.sh"):
    assert os.path.exists(s) and os.access(s, os.X_OK)
```

### 3. `test_hardware_status_requires_auth` — smoke
**Purpose:** `/api/hardware/status` is **not** in `test_security.py`'s list today.
**Minimal assertion:**
```python
assert client.get("/api/hardware/status").status_code == 401
```

### 4. `test_hardware_status_structured_shape` — integration
**Minimal assertion:**
```python
b = client.get("/api/hardware/status", headers=_auth(founder_token)).json()
for k in ["cpu", "ram", "disk", "gpu", "gpu_acceleration_confirmed", "ollama"]:
    assert k in b
assert "missing_models" in b["ollama"]
```

### 5. `test_local_only_health_compliant` — integration
**Minimal assertion:**
```python
b = client.get("/api/health/local-only").json()
assert b["local_only_mode"] is True
assert b["external_ai_providers_enabled"] is False
assert b["status"] == "compliant"
```

### 6. `test_assert_local_only_raises` — unit
**Minimal assertion:**
```python
from core.local_only import assert_local_only, ExternalProviderBlocked
with pytest.raises(ExternalProviderBlocked):
    assert_local_only("OpenAI")
```

### 7. `test_check_local_only_script_passes` — integration
**Minimal assertion:**
```python
r = subprocess.run([sys.executable, "scripts/check-local-only.py"], capture_output=True, text=True)
assert r.returncode == 0 and "PASS" in r.stdout
```

### 8. `test_audit_has_no_mutation_routes` — smoke (extend existing)
**Purpose:** strengthen append-only beyond the existing no-`DELETE` check.
**Minimal assertion:**
```python
h = _auth(founder_token)
assert client.put("/api/audit", headers=h).status_code in (404, 405)
assert client.patch("/api/audit", headers=h).status_code in (404, 405)
```

### 9. `test_app_imports_and_routers_mounted` — smoke
**Minimal assertion:**
```python
import main
paths = {r.path for r in main.app.routes}
for prefix in ["/api/auth/login", "/api/agents/council", "/api/hardware/status",
               "/api/health/local-only", "/api/audit", "/api/settings"]:
    assert any(p.startswith(prefix.rsplit("/",1)[0]) for p in paths)
```

### 10. `test_required_models_are_local_only` — unit
**Minimal assertion:**
```python
from agents.model_router import required_models
joined = " ".join(required_models()).lower()
for cloud in ["openai", "gpt-", "claude", "anthropic", "gemini", "groq", "together"]:
    assert cloud not in joined
```

### 11. `test_required_docs_present` — smoke (optional)
**Minimal assertion:**
```python
for name in ["OPERATING_DOCTRINE","LOCAL_ONLY_COMPLIANCE","HARDWARE_PROFILE","AGENT_COUNCIL",
             "BACKEND_ARCHITECTURE","API_OVERVIEW","SECURITY_BASELINE","RAG_PIPELINE",
             "DECISION_TASK_APPROVAL","WORKFLOW_TOOL_GOVERNANCE","BACKUP_RESTORE","TESTING"]:
    p = f"docs/{name}.md"; assert os.path.exists(p) and os.path.getsize(p) > 0
```

## Notes for the implementer
- Tests 1, 2, 7 invoke shell/`subprocess` from the repo root — set `cwd` to the project
  root so relative `scripts/` and `data/` paths resolve; skip the pg step (no Docker in
  CI) — the script already degrades gracefully.
- Keep everything Ollama-free; where a route touches embeddings/chat, monkeypatch
  `agents.ollama_client.ollama` as the existing suites do.
- Do not weaken any guard to make a test pass.
