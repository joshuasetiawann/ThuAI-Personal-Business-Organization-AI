# Testing

Tests run fully locally against a temporary SQLite database. Ollama is mocked and n8n is
disabled, so the suite needs no model server and no cloud — it proves orchestration,
persistence, and policy, not model quality.

## Commands

```bash
cd backend && pytest -q                  # full suite (local SQLite, Ollama mocked)
python ../scripts/check-local-only.py    # fails (exit 1) on any forbidden cloud dependency
```

`scripts/check-local-only.py` should be part of the release gate: a non-zero exit means
an active external/cloud AI dependency leaked into the core path.

## Test harness (`backend/tests/conftest.py`)

Sets env **before** importing the app: `LOCAL_ONLY_MODE=true`, a temp SQLite
`POSTGRES_URL`, temp data dirs, `N8N_ENABLED=false`, and a founder account from env.
Fixtures: `app`, `client` (FastAPI `TestClient`), and `founder_token`.

## Existing coverage

| File | Focus |
|------|-------|
| `test_security.py` | hardcoded-cred logins fail; sensitive endpoints require token; CORS not wildcard; founder login + bcrypt; token-gated access |
| `test_conversations.py` | conversation/message persistence; cross-user forbidden, founder allowed; AgentRun/AgentMessage model shape |
| `test_agent_council.py` | council imports; 4-agents-plus-evaluator prompt contract; route auth; local-only model routing; sequential defaults; full run persists run/messages/evaluation/memory |
| `test_knowledge_file_security.py` | path-traversal rejection; knowledge auth; chunking; embedding-local-only; ingest→search→grounding end-to-end |
| `test_decision_task_approval.py` | decision lifecycle; task from decision; approval create/resolve; critical confirmation phrase; gated execution |
| `test_workflow_tool_observability.py` | workflow allow-list + block/audit + approval gate; tool registry enforcement; metrics counts; local-only block audited; error handler logs ErrorLog; Supabase adapter blocks+audits |
| `test_local_only.py` | `/api/health/local-only` compliant; low-level guard raises |
| `test_finalization.py` | backup scripts exist+safe; hardware auth + structured shape + CPU-fallback warning; models-health no-cloud |
| `test_backup_restore.py` | scripts exist+executable; backup includes `.env.example`, never the real `.env` |
| `test_smoke_imports.py` | app imports + all routers mounted; required models local-only; compliance scanner exits 0; audit append-only; 12 docs present |

## Verification status (Sprint 9 — executed)

Run in the real local environment (Python 3.10, deps from `backend/requirements.txt`):

- `PYTHONPATH=backend python -c "import main"` -> `BACKEND_IMPORT_OK`.
- `python scripts/check-local-only.py` -> `PASS` (exit 0).
- `PYTHONPATH=backend pytest backend/tests -q --basetemp=/tmp/ptb` -> **66 passed**.

> Sandbox note: pass `--basetemp=/tmp/ptb` (or any clean dir). Without it, pytest's
> default temp cleanup can raise a harmless teardown error in some sandboxes; the tests
> themselves still pass.

## Limitations (honest)

- Tests use SQLite + mocked Ollama + `N8N_ENABLED=false`. They prove orchestration,
  persistence, security, and policy — **not** model quality or live Postgres/n8n
  behaviour. Run the Docker stack for true integration testing.

## Pre-Shot 3 hardening tests

`test_pre_shot3_hardening.py` covers: bounded list endpoints (`limit`/`offset`); high-risk
tool blocked without approval, with an invalid approval (audited), and allowed with a valid
approved approval; oversize and bad-extension upload rejection; and a static check that the
docker-compose backend port is bound to `127.0.0.1`.
