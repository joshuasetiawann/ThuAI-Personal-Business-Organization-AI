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

## Verification status (this review session — honest)

- **Syntax sanity:** `python -m py_compile` over all backend `*.py` passed (exit 0).
- **Full `pytest`: NOT executed here.** The review sandbox has no network access to
  install FastAPI / SQLAlchemy / pydantic / etc., so the suite could not be run. **No
  claim is made that the tests pass.** Main Claude must run `pytest -q` and
  `check-local-only.py` in the real environment and record the results.

## Gaps to close in Sprint 9

See `reviews/MISSING_TESTS_CHECKLIST.md` — notably hardware-endpoint auth + shape,
`/api/health/local-only` compliance, backup-script `.env` exclusion, the local-only
scanner as a test, and a backend import/route-mount smoke test.
